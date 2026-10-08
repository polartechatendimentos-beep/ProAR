/** Shared optimistic persistence: a concurrent edit must never overwrite another save. */
export async function commitJsonState(
  fetcher: (input: string, init: RequestInit) => Promise<Response>,
  url: string,
  headers: Record<string, string>,
  id: string,
  previous: Record<string, unknown> | null,
  payload: Record<string, unknown>,
) {
  const filter = previous
    ? `id=eq.${encodeURIComponent(id)}&payload->>revision=${previous.revision == null ? "is.null" : `eq.${encodeURIComponent(String(previous.revision))}`}`
    : "on_conflict=id";
  const response = await fetcher(`${url}/rest/v1/proar_state?${filter}`, {
    method: previous ? "PATCH" : "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ ...(previous ? {} : { id }), payload, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) return { ok: false as const, conflict: false, status: response.status };
  const rows = await response.json() as { payload?: Record<string, unknown> }[];
  if (!Array.isArray(rows) || !rows.length) return { ok: false as const, conflict: true, status: 409 };
  return { ok: true as const, payload: rows[0].payload };
}
