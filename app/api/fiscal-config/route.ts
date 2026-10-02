import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { get, put } from "@vercel/blob";
import forge from "node-forge";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../lib/permissions";

export const runtime = "nodejs";

const LEGACY_STORAGE_PATH = "proar/configuracao-fiscal.enc";
const storagePath = (companyId: string) => `proar/fiscal/${createHash("sha256").update(companyId).digest("hex").slice(0, 24)}/configuracao-fiscal.enc`;

type CertificateRecord = {
  fileName: string;
  pfxBase64: string;
  password: string;
  subject: string;
  issuer: string;
  document: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  fingerprint: string;
  importedAt: string;
};

type FiscalRecord = {
  company: Record<string, string | boolean>;
  nfe: Record<string, string | boolean>;
  nfce?: Record<string, string | boolean>;
  nfse: Record<string, string | boolean>;
  certificate?: CertificateRecord;
  updatedAt?: string;
  updatedBy?: string;
};


function encryptionKey() {
  const secret = process.env.PROAR_FISCAL_ENCRYPTION_KEY ?? "";
  if (secret.length < 32) throw new Error("STORAGE_NOT_CONFIGURED");
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: FiscalRecord) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") });
}

function decrypt(value: string): FiscalRecord {
  const payload = JSON.parse(value) as { iv: string; tag: string; data: string };
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8"));
}

async function loadRecord(companyId: string): Promise<FiscalRecord> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("STORAGE_NOT_CONFIGURED");
  let result = await get(storagePath(companyId), { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
  // Migração legada somente quando o servidor identifica explicitamente a empresa dona do cofre antigo.
  if (!result && process.env.PROAR_LEGACY_FISCAL_COMPANY_ID === companyId) {
    result = await get(LEGACY_STORAGE_PATH, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
  }
  if (!result) return { company: {}, nfe: {}, nfce: {}, nfse: {} };
  if (result.statusCode !== 200 || !result.stream) throw new Error("STORAGE_READ_FAILED");
  return decrypt(await new Response(result.stream).text());
}

async function saveRecord(companyId: string, record: FiscalRecord) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("STORAGE_NOT_CONFIGURED");
  await put(storagePath(companyId), encrypt(record), {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/octet-stream",
    cacheControlMaxAge: 60,
  });
}

function publicFiscalSection(section: Record<string, string | boolean> = {}) {
  const result: Record<string, string | boolean> = {};
  for (const [key,value] of Object.entries(section)) {
    if (/password|senha|token|secret/i.test(key) || /^csc$/i.test(key)) continue;
    result[key] = value;
  }
  if (typeof section.csc === "string") result.cscConfigured = Boolean(section.csc.trim());
  return result;
}

function publicRecord(record: FiscalRecord) {
  const certificate = record.certificate;
  return {
    company: publicFiscalSection(record.company ?? {}),
    nfe: publicFiscalSection(record.nfe ?? {}),
    nfce: publicFiscalSection(record.nfce ?? {}),
    nfse: publicFiscalSection(record.nfse ?? {}),
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
    certificate: certificate ? {
      fileName: certificate.fileName,
      subject: certificate.subject,
      issuer: certificate.issuer,
      document: certificate.document,
      serialNumber: certificate.serialNumber,
      validFrom: certificate.validFrom,
      validTo: certificate.validTo,
      fingerprint: certificate.fingerprint,
      importedAt: certificate.importedAt,
      status: new Date(certificate.validTo).getTime() > Date.now() ? "Válido" : "Vencido",
      daysToExpiry: Math.ceil((new Date(certificate.validTo).getTime() - Date.now()) / 86400000),
      expiryLevel: new Date(certificate.validTo).getTime() <= Date.now() ? "expired" : (new Date(certificate.validTo).getTime() - Date.now()) / 86400000 <= 7 ? "critical" : (new Date(certificate.validTo).getTime() - Date.now()) / 86400000 <= 30 ? "warning" : (new Date(certificate.validTo).getTime() - Date.now()) / 86400000 <= 60 ? "attention" : "ok",
    } : null,
  };
}

function storageError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "STORAGE_NOT_CONFIGURED") {
    return NextResponse.json({ error: "O cofre fiscal ainda não foi ativado no servidor." }, { status: 503 });
  }
  console.error("Fiscal configuration error", error);
  return NextResponse.json({ error: "Não foi possível acessar o cofre fiscal." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const access = requirePermission(request, "fiscal.consultar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const companyContext = sessionCompany(access.session);
  if (!companyContext.ok) return NextResponse.json({ error: "Sessão de empresa inválida." }, { status: companyContext.status });
  try {
    return NextResponse.json(publicRecord(await loadRecord(companyContext.companyId)));
  } catch (error) {
    return storageError(error);
  }
}

export async function PUT(request: NextRequest) {
  const access = requirePermission(request, "fiscal.configurar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const companyContext = sessionCompany(access.session);
  if (!companyContext.ok) return NextResponse.json({ error: "Sessão de empresa inválida." }, { status: companyContext.status });
  const user = access.session;
  try {
    const body = await request.json() as Partial<FiscalRecord>;
    const current = await loadRecord(companyContext.companyId);
    const record: FiscalRecord = {
      ...current,
      company: { ...(current.company ?? {}), ...(body.company ?? {}) },
      nfe: { ...(current.nfe ?? {}), ...(body.nfe ?? {}) },
      nfce: { ...(current.nfce ?? {}), ...(body.nfce ?? {}) },
      nfse: { ...(current.nfse ?? {}), ...(body.nfse ?? {}) },
      updatedAt: new Date().toISOString(),
      updatedBy: user.displayName,
    };
    await saveRecord(companyContext.companyId, record);
    return NextResponse.json(publicRecord(record));
  } catch (error) {
    return storageError(error);
  }
}

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.configurar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const companyContext = sessionCompany(access.session);
  if (!companyContext.ok) return NextResponse.json({ error: "Sessão de empresa inválida." }, { status: companyContext.status });
  const user = access.session;
  try {
    const form = await request.formData();
    const file = form.get("certificate");
    const password = String(form.get("password") ?? "");
    if (!(file instanceof File) || !password) return NextResponse.json({ error: "Selecione o certificado A1 e informe a senha." }, { status: 400 });
    if (!/\.(pfx|p12)$/i.test(file.name)) return NextResponse.json({ error: "Use um certificado A1 no formato .pfx ou .p12." }, { status: 400 });
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "O certificado deve ter no máximo 2 MB." }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    let cert: ReturnType<typeof forge.pki.certificateFromAsn1>;
    try {
      const asn1 = forge.asn1.fromDer(bytes.toString("binary"));
      const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
      const bags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
      if (!bags[0]?.cert) throw new Error("CERT_NOT_FOUND");
      cert = bags[0].cert;
    } catch {
      return NextResponse.json({ error: "Certificado inválido ou senha incorreta." }, { status: 400 });
    }

    const subject = cert.subject.attributes.map((attribute: { shortName?: string; name?: string; value?: string }) => `${attribute.shortName ?? attribute.name}=${attribute.value ?? ""}`).join(", ");
    const issuer = cert.issuer.attributes.map((attribute: { shortName?: string; name?: string; value?: string }) => `${attribute.shortName ?? attribute.name}=${attribute.value ?? ""}`).join(", ");
    const document = subject.match(/(?:CNPJ|CPF)[:= ]*(\d{11,14})/i)?.[1] ?? subject.match(/\b\d{14}\b/)?.[0] ?? "";
    const record = await loadRecord(companyContext.companyId);
    record.certificate = {
      fileName: file.name,
      pfxBase64: bytes.toString("base64"),
      password,
      subject,
      issuer,
      document,
      serialNumber: cert.serialNumber,
      validFrom: cert.validity.notBefore.toISOString(),
      validTo: cert.validity.notAfter.toISOString(),
      fingerprint: createHash("sha256").update(bytes).digest("hex").match(/.{1,2}/g)?.join(":").toUpperCase() ?? "",
      importedAt: new Date().toISOString(),
    };
    record.updatedAt = new Date().toISOString();
    record.updatedBy = user.displayName;
    await saveRecord(companyContext.companyId, record);
    return NextResponse.json(publicRecord(record));
  } catch (error) {
    return storageError(error);
  }
}

export async function DELETE(request: NextRequest) {
  const access = requirePermission(request, "fiscal.configurar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const companyContext = sessionCompany(access.session);
  if (!companyContext.ok) return NextResponse.json({ error: "Sessão de empresa inválida." }, { status: companyContext.status });
  const user = access.session;
  try {
    const record = await loadRecord(companyContext.companyId);
    delete record.certificate;
    record.updatedAt = new Date().toISOString();
    record.updatedBy = user.displayName;
    await saveRecord(companyContext.companyId, record);
    return NextResponse.json(publicRecord(record));
  } catch (error) {
    return storageError(error);
  }
}
