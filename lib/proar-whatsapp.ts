import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { get, put } from "@vercel/blob";
import { databaseFetch } from "./supabase-rest";
import { resolveTenantDb, tenantHeaders } from "./tenant-rest";

const storagePath = (companyId:string) => `proar/whatsapp/${createHash("sha256").update(companyId).digest("hex").slice(0,24)}/config.enc`;
const databaseRecordId = (companyId:string) => `whatsapp-config:${createHash("sha256").update(companyId).digest("hex").slice(0,24)}`;

export type WhatsAppConfig = {
  active: boolean;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  apiVersion: string;
  defaultCountry: string;
  tenderTo: string;
  tenderTemplate: string;
  reminderTemplate: string;
  updatedAt?: string;
  updatedBy?: string;
};

const defaults: WhatsAppConfig = {
  active: false,
  phoneNumberId: "",
  wabaId: "",
  accessToken: "",
  apiVersion: "v23.0",
  defaultCountry: "55",
  tenderTo: "5517991567798",
  tenderTemplate: "nova_licitacao_proar",
  reminderTemplate: "lembrete_higienizacao",
};

function key() {
  const secret = process.env.PROAR_FISCAL_ENCRYPTION_KEY ?? process.env.PROAR_TENANT_MASTER_KEY ?? "";
  if (secret.length < 32) throw new Error("Cofre seguro não configurado");
  return createHash("sha256").update(`${secret}:whatsapp`).digest();
}

function encrypt(value: WhatsAppConfig) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") });
}

function decrypt(value: string): WhatsAppConfig {
  const payload = JSON.parse(value) as { iv: string; tag: string; data: string };
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return { ...defaults, ...JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8")) };
}

export async function loadWhatsAppConfig(companyId="polartech-principal") {
  key();
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const result = await get(storagePath(companyId), { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
      if (result) {
        if (result.statusCode !== 200 || !result.stream) throw new Error("Falha ao ler configuração do WhatsApp");
        return decrypt(await new Response(result.stream).text());
      }
    } catch (error) {
      console.warn("WhatsApp Blob unavailable, using tenant database fallback.", error);
    }
  }
  const db=await resolveTenantDb(companyId);
  if(!db.url||!db.key)return { ...defaults };
  const response=await databaseFetch(`${db.url}/rest/v1/proar_state?select=payload&id=eq.${encodeURIComponent(databaseRecordId(companyId))}&limit=1`,{headers:tenantHeaders(db.key),cache:"no-store"});
  if(!response.ok)return { ...defaults };
  const rows=await response.json() as {payload?:{encrypted?:string}}[];
  const encrypted=rows[0]?.payload?.encrypted;
  return encrypted ? decrypt(encrypted) : { ...defaults };
}

export async function saveWhatsAppConfig(config: WhatsAppConfig,companyId="polartech-principal") {
  key();
  const encrypted=encrypt({ ...defaults, ...config });
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await put(storagePath(companyId), encrypted, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN, addRandomSuffix: false, allowOverwrite: true, contentType: "application/octet-stream", cacheControlMaxAge: 60 });
      return;
    } catch (error) {
      console.warn("WhatsApp Blob write failed, using tenant database fallback.", error);
    }
  }
  const db=await resolveTenantDb(companyId);
  if(!db.url||!db.key)throw new Error("Cofre seguro não configurado");
  const response=await databaseFetch(`${db.url}/rest/v1/proar_state?on_conflict=id`,{
    method:"POST",
    headers:{...tenantHeaders(db.key),Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify({id:databaseRecordId(companyId),payload:{encrypted,kind:"whatsapp-config",version:1},updated_at:new Date().toISOString()}),
  });
  if(!response.ok)throw new Error("Não foi possível salvar a configuração do WhatsApp");
}

export function publicWhatsAppConfig(config: WhatsAppConfig) {
  return { ...config, accessToken: "", tokenConfigured: Boolean(config.accessToken), tokenPreview: config.accessToken ? `••••••••${config.accessToken.slice(-4)}` : "" };
}

export function normalizeWhatsAppNumber(value: string, country = "55") {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith(country) ? digits : `${country}${digits}`;
}

export async function testWhatsAppConnection(config: WhatsAppConfig) {
  if (!config.phoneNumberId || !config.accessToken) throw new Error("Informe o Phone Number ID e o token de acesso");
  const response = await fetch(`https://graph.facebook.com/${config.apiVersion || "v23.0"}/${config.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, { headers: { Authorization: `Bearer ${config.accessToken}` }, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message ?? `Meta respondeu ${response.status}`);
  return result as { id?: string; display_phone_number?: string; verified_name?: string; quality_rating?: string };
}

export async function sendWhatsAppTemplate(config: WhatsAppConfig, to: string, template: string, parameters: string[]) {
  if (!config.active || !config.phoneNumberId || !config.accessToken) throw new Error("Integração do WhatsApp não está ativa");
  const response = await fetch(`https://graph.facebook.com/${config.apiVersion || "v23.0"}/${config.phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: normalizeWhatsAppNumber(to, config.defaultCountry), type: "template", template: { name: template, language: { code: "pt_BR" }, components: [{ type: "body", parameters: parameters.map(text => ({ type: "text", text })) }] } }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message ?? `WhatsApp respondeu ${response.status}`);
  return result;
}
