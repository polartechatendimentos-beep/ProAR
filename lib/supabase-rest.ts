const baseUrl = () => process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseConfigured() {
  return Boolean(baseUrl() && serviceKey());
}

export async function supabaseRest(path: string, init: RequestInit = {}) {
  const key = serviceKey();
  if (!baseUrl() || !key) throw new Error("Supabase não configurado");
  return fetch(`${baseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
}
