import "server-only";
import { request } from "node:https";
import { gzipSync } from "node:zlib";
import { loadRecord } from "./fiscal-vault";

const host = "sefin.producaorestrita.nfse.gov.br";
const maxBytes = 2 * 1024 * 1024;

async function sefin(companyId: string, path: string, body?: string) {
  const certificate = (await loadRecord(companyId)).certificate;
  if (!certificate || !(Date.parse(certificate.validFrom) <= Date.now() && Date.parse(certificate.validTo) > Date.now())) {
    throw new Error("Certificado A1 ausente ou fora da validade.");
  }
  const pfx = Buffer.from(certificate.pfxBase64, "base64");
  try {
    return await new Promise<{ status: number; data: unknown }>((resolve, reject) => {
      const req = request({
        hostname: host, path: "/SefinNacional" + path, method: body ? "POST" : "GET",
        pfx, passphrase: certificate.password, minVersion: "TLSv1.2", rejectUnauthorized: true, agent: false,
        headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {}) },
      }, response => {
        let size = 0;
        const parts: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) req.destroy(new Error("Resposta fiscal excede o limite."));
          else parts.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          const status = response.statusCode ?? 502;
          if (status >= 300 && status < 400) return reject(new Error("Redirecionamento fiscal inesperado."));
          try { resolve({ status, data: JSON.parse(Buffer.concat(parts).toString("utf8")) }); }
          catch { reject(new Error("Resposta da SEFIN não reconhecida.")); }
        });
      });
      const deadline = setTimeout(() => req.destroy(new Error("Tempo limite da SEFIN atingido. Consulte a DPS antes de reenviar.")), 25000);
      req.once("close", () => clearTimeout(deadline));
      req.on("error", reject);
      req.end(body);
    });
  } finally {
    pfx.fill(0);
  }
}

// Server-generated and signed DPS only. No route exposes this transport.
export function submitRestrictedDps(companyId: string, signedXml: string) {
  if (!signedXml || Buffer.byteLength(signedXml) > maxBytes) throw new Error("DPS inválida ou grande demais.");
  return sefin(companyId, "/nfse", JSON.stringify({ dpsXmlGZipB64: gzipSync(signedXml).toString("base64") }));
}

export function lookupRestrictedDps(companyId: string, id: string) {
  if (!/^DPS\d{42}$/.test(id)) throw new Error("Identificador da DPS inválido.");
  return sefin(companyId, "/dps/" + id);
}
