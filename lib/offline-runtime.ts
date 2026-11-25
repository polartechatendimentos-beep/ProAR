type UserScope = { userId: string; companyId: string; key: string };
type CachedResponse = { key: string; body: unknown; status: number; headers: [string, string][]; savedAt: string };
type QueuedRequest = {
  id: string;
  scope: string;
  url: string;
  method: string;
  headers: [string, string][];
  body: string;
  createdAt: string;
  localId?: string;
  lastError?: string;
};

const DB_NAME = "proar-offline-v1";
const DB_VERSION = 1;
const CACHEABLE = new Set([
  "/api/companies", "/api/customers", "/api/products", "/api/state",
  "/api/dashboard/summary", "/api/fiscal-config", "/api/relatorios",
  "/api/licitacoes", "/api/licitacoes-checklist", "/api/licitacoes-documents",
  "/api/licitacoes-bid-events", "/api/licitacoes-bid-sessions",
  "/api/work-projects", "/api/work-findings", "/api/work-consumptions",
  "/api/work-changes", "/api/work-contacts", "/api/work-house-priorities",
  "/api/public-work-map", "/api/catalog/default-services",
]);
const WRITABLE = new Set([
  "/api/companies", "/api/customers", "/api/products", "/api/state",
  "/api/fiscal-config", "/api/licitacoes", "/api/licitacoes-checklist",
  "/api/licitacoes-documents", "/api/licitacoes-bid-events", "/api/licitacoes-bid-sessions",
  "/api/work-projects", "/api/work-findings", "/api/work-consumptions",
  "/api/work-changes", "/api/work-contacts", "/api/work-house-priorities",
  "/api/public-work-map",
]);

let originalFetch: typeof window.fetch | null = null;
let currentScope: UserScope | null = null;
let syncing = false;
let scopeReady: Promise<void> = Promise.resolve();

function openDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("responses")) db.createObjectStore("responses", { keyPath: "key" });
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbRequest<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDB();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = run(tx.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

const getRecord = <T,>(store: string, key: IDBValidKey) => dbRequest<T | undefined>(store, "readonly", (objectStore) => objectStore.get(key));
const putRecord = (store: string, value: unknown) => dbRequest<IDBValidKey>(store, "readwrite", (objectStore) => objectStore.put(value));
const deleteRecord = (store: string, key: IDBValidKey) => dbRequest<undefined>(store, "readwrite", (objectStore) => objectStore.delete(key));
const getAll = <T,>(store: string) => dbRequest<T[]>(store, "readonly", (objectStore) => objectStore.getAll());

function apiPath(url: URL) { return url.pathname; }
function responseKey(url: URL, scope: string) { return `${scope}|${url.pathname}${url.search}`; }
function broadcast() { window.dispatchEvent(new CustomEvent("proar:offline-state")); }

export async function getOfflineStatus() {
  const queue = await getAll<QueuedRequest>("outbox").catch(() => []);
  const scoped = currentScope ? queue.filter((item) => item.scope === currentScope?.key) : [];
  return { online: navigator.onLine, pending: scoped.length, failed: scoped.filter((item) => Boolean(item.lastError)).length, scopeReady: Boolean(currentScope) };
}

async function discoverScope() {
  if (!originalFetch || !navigator.onLine) return;
  try {
    const response = await originalFetch("/api/auth", { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json();
    if (response.status === 401) {
      currentScope = null;
      try { localStorage.removeItem("proar-offline-scope"); } catch { /* IndexedDB remains authoritative for the offline session. */ }
      broadcast();
      return;
    }
    if (!response.ok || !payload?.success || !payload?.user?.id) return;
    const userId = String(payload.user.id);
    const companyId = String(payload.user.companyId ?? payload.user.company_id ?? "");
    currentScope = { userId, companyId, key: `${location.host}:${companyId}:${userId}` };
    try { localStorage.setItem("proar-offline-scope", currentScope.key); } catch { /* IndexedDB remains authoritative. */ }
    await putRecord("meta", { key: "last-user-scope", scope: currentScope });
  } catch { /* Keep the last authenticated scope for offline work. */ }
  broadcast();
}

async function restoreScope() {
  const saved = await getRecord<{ key: string; scope: UserScope }>("meta", "last-user-scope").catch(() => undefined);
  if (saved?.scope?.key?.startsWith(`${location.host}:`)) {
    currentScope = saved.scope;
    try { localStorage.setItem("proar-offline-scope", currentScope.key); } catch { /* IndexedDB remains authoritative. */ }
  }
}

function isCacheable(url: URL) { return CACHEABLE.has(apiPath(url)); }
function isWritable(url: URL) { return WRITABLE.has(apiPath(url)); }

async function cacheJsonResponse(url: URL, scope: UserScope, response: Response) {
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
  try {
    const body = await response.clone().json();
    const record: CachedResponse = {
      key: responseKey(url, scope.key), body, status: response.status,
      headers: [["content-type", "application/json; charset=utf-8"]], savedAt: new Date().toISOString(),
    };
    await putRecord("responses", record);
  } catch { /* Invalid or oversized responses are not cached. */ }
}

async function offlineRead(url: URL, scope: UserScope) {
  const cached = await getRecord<CachedResponse>("responses", responseKey(url, scope.key));
  if (!cached) return null;
  return new Response(JSON.stringify(cached.body), { status: cached.status, headers: cached.headers });
}

async function enqueue(request: Request, url: URL, scope: UserScope) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  let body: string;
  try { body = await request.clone().text(); JSON.parse(body); } catch { return null; }
  if (body.length > 1_000_000) return null;
  const optimistic = dataAsObject(body);
  const localId = request.method === "POST" && !("id" in optimistic) ? String(-Date.now()) : undefined;
  if (localId) optimistic.id = Number(localId);
  if (url.pathname === "/api/work-house-priorities") optimistic.ativo = optimistic.ativo ?? optimistic.nivel !== "normal";
  const id = crypto.randomUUID();
  const item: QueuedRequest = {
    id, scope: scope.key, url: `${url.pathname}${url.search}`, method: request.method,
    headers: [...request.headers.entries()].filter(([name]) => !["cookie", "authorization", "content-length"].includes(name.toLowerCase())),
    body, createdAt: new Date().toISOString(), localId,
  };
  await putRecord("outbox", item);
  await applyOptimisticCache(url, scope, request.method, optimistic);
  broadcast();
  if (url.pathname === "/api/public-work-map") {
    return Response.json({
      saved: true,
      progress: 0,
      map: { workId: String(optimistic.workId ?? ""), title: optimistic.title || "Acompanhamento da obra", revision: Number(optimistic.baseRevision || 0) + 1, houses: Array.isArray(optimistic.houses) ? optimistic.houses : [], updatedAt: new Date().toISOString() },
      offlineQueued: true,
      offlineId: id,
    }, { status: 202 });
  }
  return Response.json({
    success: true,
    queuedOffline: true,
    offlineId: id,
    message: "Salvo neste aparelho. Será sincronizado quando a conexão voltar.",
    data: optimistic,
  }, { status: 202 });
}

function dataAsObject(body: string) {
  try {
    const value = JSON.parse(body);
    return value && typeof value === "object" && !Array.isArray(value) ? { ...value } as Record<string, unknown> : {};
  } catch { return {}; }
}

async function applyOptimisticCache(url: URL, scope: UserScope, method: string, patch: Record<string, unknown>) {
  const records = await getAll<CachedResponse>("responses").catch(() => []);
  const prefix = `${scope.key}|${url.pathname}`;
  for (const record of records) {
    if (!record.key.startsWith(prefix)) continue;
    const envelope = record.body && typeof record.body === "object" ? { ...(record.body as Record<string, unknown>) } : null;
    if (!envelope) continue;
    const rows = Array.isArray(envelope.data) ? envelope.data : null;
    if (method === "POST") {
      if (rows) envelope.data = [...rows, patch];
      else envelope.data = patch;
    } else if (method === "PATCH" || method === "PUT") {
      const id = patch.id;
      if (rows && id !== undefined) {
        envelope.data = rows.map((row) => row && typeof row === "object" && (row as Record<string, unknown>).id === id
          ? { ...(row as Record<string, unknown>), ...patch }
          : row);
      } else if (envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)) {
        envelope.data = { ...(envelope.data as Record<string, unknown>), ...patch };
      }
      if (url.pathname === "/api/public-work-map" && String(new URL(record.key.split("|").slice(1).join("|"), location.origin).searchParams.get("work")) === String(patch.workId)) {
        envelope.map = { ...(envelope.map && typeof envelope.map === "object" ? envelope.map as Record<string, unknown> : {}), workId: String(patch.workId), title: patch.title, revision: Number(patch.baseRevision || 0) + 1, houses: Array.isArray(patch.houses) ? patch.houses : [], updatedAt: new Date().toISOString() };
      }
    } else if (method === "DELETE" && rows) {
      envelope.data = rows.filter((row) => !row || typeof row !== "object" || (row as Record<string, unknown>).id !== patch.id);
    }
    await putRecord("responses", { ...record, body: envelope });
  }
}

async function invalidatePathCache(scope: string, path: string) {
  const records = await getAll<CachedResponse>("responses").catch(() => []);
  await Promise.all(records
    .filter((record) => record.key.startsWith(`${scope}|${path}`))
    .map((record) => deleteRecord("responses", record.key)));
}

async function readIdMap(scope: string) {
  const saved = await getRecord<{ key: string; value: Record<string, string> }>("meta", `id-map:${scope}`).catch(() => undefined);
  return saved?.value || {};
}

function remapLocalIds(value: unknown, mapping: Record<string, string>): unknown {
  if (typeof value === "string" || typeof value === "number") return mapping[String(value)] ?? value;
  if (Array.isArray(value)) return value.map((item) => remapLocalIds(item, mapping));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapLocalIds(item, mapping)]));
  }
  return value;
}

async function persistIdMapping(scope: string, localId: string, serverId: string) {
  const mapping = await readIdMap(scope);
  mapping[localId] = serverId;
  await putRecord("meta", { key: `id-map:${scope}`, value: mapping });
  const records = await getAll<CachedResponse>("responses").catch(() => []);
  for (const record of records.filter((entry) => entry.key.startsWith(`${scope}|`))) {
    await putRecord("responses", { ...record, body: remapLocalIds(record.body, mapping) });
  }
}

function remapUrl(rawUrl: string, mapping: Record<string, string>) {
  const url = new URL(rawUrl, location.origin);
  for (const [name, value] of url.searchParams.entries()) {
    if (mapping[value]) url.searchParams.set(name, mapping[value]);
  }
  return `${url.pathname}${url.search}`;
}

async function wrappedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const baseFetch = originalFetch!;
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith("/api/") || ["/api/auth", "/api/mobile/orders"].includes(url.pathname)) {
    return baseFetch(request);
  }

  const method = request.method.toUpperCase();
  await scopeReady;
  if (!currentScope && navigator.onLine) await discoverScope();
  const scope = currentScope;
  if (method === "GET" && isCacheable(url) && scope) {
    try {
      const response = await baseFetch(request.clone());
      await cacheJsonResponse(url, scope, response);
      if (!response.ok && response.status >= 500) {
        const cached = await offlineRead(url, scope);
        if (cached) return cached;
      }
      return response;
    } catch (error) {
      const cached = await offlineRead(url, scope);
      if (cached) return cached;
      throw error;
    }
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && isWritable(url)) {
    if (!scope) return baseFetch(request);
    if (!navigator.onLine) {
      const saved = await enqueue(request, url, scope);
      if (saved) return saved;
      return Response.json({ success: false, error: "Esta operação precisa de internet ou não pode ser guardada como dado local." }, { status: 503 });
    }
    try { return await baseFetch(request.clone()); }
    catch (error) {
      const saved = await enqueue(request, url, scope);
      if (saved) return saved;
      throw error;
    }
  }
  return baseFetch(request);
}

export async function syncOfflineQueue(allowReviewRetry = false) {
  if (!originalFetch || !navigator.onLine || !currentScope || syncing) return;
  syncing = true;
  try {
    const queued = (await getAll<QueuedRequest>("outbox"))
      .filter((item) => item.scope === currentScope?.key)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const item of queued) {
      if (item.lastError && !allowReviewRetry) break;
      try {
        const mapping = await readIdMap(item.scope);
        const parsedBody = JSON.parse(item.body) as unknown;
        const mappedUrl = remapUrl(item.url, mapping);
        const headers = new Headers(item.headers);
        headers.set("X-ProAR-Offline-Operation", item.id);
        const response = await originalFetch(mappedUrl, {
          method: item.method,
          credentials: "same-origin",
          headers,
          body: item.method === "DELETE" ? undefined : JSON.stringify(remapLocalIds(parsedBody, mapping)),
        });
        if (!response.ok) {
          item.lastError = response.status === 401
            ? "Sessão expirada. Entre novamente com o mesmo usuário para sincronizar."
            : `O servidor recusou esta alteração (HTTP ${response.status}).`;
          await putRecord("outbox", item);
          break;
        }
        const result = await response.clone().json().catch(() => null);
        if (result && result.success === false) {
          item.lastError = typeof result.error === "string" ? result.error : "O servidor não confirmou esta alteração.";
          await putRecord("outbox", item);
          break;
        }
        const serverId = result?.data?.id ?? result?.id;
        if (item.localId && serverId !== undefined && serverId !== null) await persistIdMapping(item.scope, item.localId, String(serverId));
        await deleteRecord("outbox", item.id);
        await invalidatePathCache(item.scope, new URL(item.url, location.origin).pathname);
      } catch {
        item.lastError = "Resultado incerto: a conexão caiu durante a sincronização. Confira se a alteração chegou ao sistema antes de reenviar.";
        await putRecord("outbox", item);
        break;
      }
    }
  } finally {
    syncing = false;
    broadcast();
  }
}

export function startOfflineRuntime() {
  if (typeof window === "undefined" || originalFetch) return;
  originalFetch = window.fetch.bind(window);
  window.fetch = wrappedFetch.bind(window);
  scopeReady = restoreScope().then(() => discoverScope()).then(() => undefined);
  void scopeReady.then(() => syncOfflineQueue());
  window.addEventListener("online", () => { void discoverScope().then(() => syncOfflineQueue()); });
  window.addEventListener("offline", broadcast);
}
