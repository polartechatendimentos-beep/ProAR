import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { get, put } from "@vercel/blob";

const STORAGE_PATH = "proar/whatsapp-config.enc";

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
  const secret = process.env.PROAR_FISCAL_ENCRYPTION_KEY ?? "";
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

export async function loadWhatsAppConfig() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Cofre seguro não configurado");
  const result = await get(STORAGE_PATH, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!result) return { ...defaults };
  if (result.statusCode !== 200 || !result.stream) throw new Error("Falha ao ler configuração do WhatsApp");
  return decrypt(await new Response(result.stream).text());
}

export async function saveWhatsAppConfig(config: WhatsAppConfig) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Cofre seguro não configurado");
  await put(STORAGE_PATH, encrypt({ ...defaults, ...config }), { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN, addRandomSuffix: false, allowOverwrite: true, contentType: "application/octet-stream", cacheControlMaxAge: 60 });
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
