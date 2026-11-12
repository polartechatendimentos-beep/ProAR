import { createHash, createHmac } from "node:crypto";

export function evolutionTenantIdentity(companyId: string, secret: string) {
  if (!companyId || secret.length < 32) throw new Error("Provisionamento seguro do WhatsApp indisponível.");
  const hash = createHash("sha256").update(companyId).digest("hex");
  return {
    instance: `proar-${hash.slice(0, 32)}`,
    key: createHmac("sha256", secret).update(`proar-whatsapp-instance:v1:${companyId}`).digest("hex"),
    recordId: `evolution-connection:${hash}`,
  };
}
