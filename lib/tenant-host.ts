export const RESERVED_PROAR_SUBDOMAINS = new Set([
  "www", "app", "api", "admin", "manager", "teste", "test", "staging", "homolog", "homologacao",
  "suporte", "support", "status", "mail", "smtp", "imap", "ftp", "cdn", "assets", "static", "docs",
]);

export function normalizeHost(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().split(":")[0].replace(/\.$/, "");
}

export function rootDomain() {
  return (process.env.PROAR_ROOT_DOMAIN || "proar.app").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function tenantSlugFromHost(value: string | null | undefined, domain = rootDomain()) {
  const host = normalizeHost(value);
  if (!host || host === "localhost" || host === "127.0.0.1" || host === domain || host === `www.${domain}`) return "";
  const suffix = `.${domain}`;
  if (!host.endsWith(suffix)) return "";
  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes(".") || RESERVED_PROAR_SUBDOMAINS.has(slug)) return "";
  return slug;
}

export function isReservedSlug(slug: string) {
  return RESERVED_PROAR_SUBDOMAINS.has(String(slug || "").trim().toLowerCase());
}

export function companyUrl(slug: string, domain = rootDomain()) {
  return `https://${String(slug).trim().toLowerCase()}.${domain}`;
}
