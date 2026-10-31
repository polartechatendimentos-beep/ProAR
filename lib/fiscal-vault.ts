import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { get, put } from "@vercel/blob";
import { databaseFetch } from "./supabase-rest";
import { resolveTenantDb, tenantHeaders } from "./tenant-rest";
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

export type FiscalRecord = {
  company: Record<string, string | boolean>;
  nfe: Record<string, string | boolean>;
  nfce?: Record<string, string | boolean>;
  nfse: Record<string, string | boolean>;
  certificate?: CertificateRecord;
  updatedAt?: string;
  updatedBy?: string;
};


function encryptionKey() {
  const secret = process.env.PROAR_FISCAL_ENCRYPTION_KEY ?? process.env.PROAR_TENANT_MASTER_KEY ?? "";
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

const databaseRecordId = (companyId: string) => `fiscal-config:${createHash("sha256").update(companyId).digest("hex").slice(0,24)}`;

async function loadDatabaseRecord(companyId: string): Promise<FiscalRecord | null> {
  const db=await resolveTenantDb(companyId);
  if(!db.url||!db.key)return null;
  const response=await databaseFetch(`${db.url}/rest/v1/proar_state?select=payload&id=eq.${encodeURIComponent(databaseRecordId(companyId))}&limit=1`,{
    headers:tenantHeaders(db.key),
    cache:"no-store",
  });
  if(!response.ok)return null;
  const rows=await response.json() as {payload?:{encrypted?:string}}[];
  const encrypted=rows[0]?.payload?.encrypted;
  if(!encrypted)return null;
  return decrypt(encrypted);
}

async function saveDatabaseRecord(companyId:string,record:FiscalRecord){
  const db=await resolveTenantDb(companyId);
  if(!db.url||!db.key)throw new Error("STORAGE_NOT_CONFIGURED");
  const response=await databaseFetch(`${db.url}/rest/v1/proar_state?on_conflict=id`,{
    method:"POST",
    headers:{...tenantHeaders(db.key),Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify({id:databaseRecordId(companyId),payload:{encrypted:encrypt(record),kind:"fiscal-config",version:1},updated_at:new Date().toISOString()}),
  });
  if(!response.ok)throw new Error("STORAGE_WRITE_FAILED");
}

export async function loadRecord(companyId: string): Promise<FiscalRecord> {
  encryptionKey();
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      let result = await get(storagePath(companyId), { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
      if (!result && process.env.PROAR_LEGACY_FISCAL_COMPANY_ID === companyId) {
        result = await get(LEGACY_STORAGE_PATH, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
      }
      if (result) {
        if (result.statusCode !== 200 || !result.stream) throw new Error("STORAGE_READ_FAILED");
        return decrypt(await new Response(result.stream).text());
      }
    } catch (error) {
      console.warn("Fiscal Blob unavailable, falling back to tenant database.", error);
    }
  }
  return (await loadDatabaseRecord(companyId)) ?? { company: {}, nfe: {}, nfce: {}, nfse: {} };
}

export async function saveRecord(companyId: string, record: FiscalRecord) {
  encryptionKey();
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await put(storagePath(companyId), encrypt(record), {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/octet-stream",
        cacheControlMaxAge: 60,
      });
      return;
    } catch (error) {
      console.warn("Fiscal Blob write failed, using tenant database fallback.", error);
    }
  }
  await saveDatabaseRecord(companyId, record);
}

