// Only thumbnails returned by the company's WhatsApp integration are eligible.
export function whatsappProfilePhotoUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as { profilePictureUrl?: unknown }).profilePictureUrl;
  if (typeof raw !== "string" || raw.length > 4096) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash ||
        !/^(?:pps|pps-cdn|mmg|media)(?:\.[a-z0-9-]+)*\.(?:whatsapp\.net|whatsapp\.com)$/.test(url.hostname) ||
        !url.pathname.startsWith("/v/")) return null;
    return url.href;
  } catch { return null; }
}

export function makeProfilePhotoLookup(
  fetchPhoto: (company: string, phone: string) => Promise<unknown>,
  now = Date.now,
) {
  const cache = new Map<string, { value: string | null; expires: number }>();
  const pending = new Map<string, Promise<string | null>>();
  return (company: string, phone: string) => {
    const key = JSON.stringify([company, phone]);
    const hit = cache.get(key);
    if (hit && hit.expires > now()) return Promise.resolve(hit.value);
    cache.delete(key);
    const active = pending.get(key);
    if (active) return active;

    const read = Promise.resolve().then(() => fetchPhoto(company, phone))
      .then(whatsappProfilePhotoUrl)
      .then(value => {
        if (cache.size >= 256) cache.delete(cache.keys().next().value!);
        cache.set(key, { value, expires: now() + (value ? 5 * 60_000 : 60_000) });
        return value;
      })
      .catch(() => null)
      .finally(() => pending.delete(key));
    pending.set(key, read);
    return read;
  };
}
