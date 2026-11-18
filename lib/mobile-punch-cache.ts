export type MobilePunchCommand = {
  action: "clock-in" | "break-start" | "break-end" | "clock-out" | "correction-request";
  requestId: string;
  date: string;
  at: string;
  offline: boolean;
  location?: { latitude: number; longitude: number; accuracy: number; capturedAt: string };
  correctionType?: "clock-in" | "break-start" | "break-end" | "clock-out";
  requestedAt?: string;
  reason?: string;
};
export type MobilePunchDay = {
  companyId: string;
  employeeId: string;
  employeeName: string;
  date: string;
  _revision: number;
  punches: Array<{ id: string; type: string; at: string; recordedAt: string; offline: boolean; location?: { latitude: number; longitude: number; accuracy: number; capturedAt: string } }>;
  corrections: Array<{ id: string; type: string; requestedAt: string; reason: string; status: string; requestedAtServer: string; employeeId: string; employeeName: string; reviewedAt?: string; reviewer?: string; reviewReason?: string }>;
  adjustments: Array<{ id: string; type: string; at: string; correctionId: string; reason: string; approvedAt: string; approvedBy: string }>;
};
type Cache = { days: Record<string, MobilePunchDay>; pending: MobilePunchCommand[] };
type Row = { scope: string; iv: Uint8Array; cipher: ArrayBuffer };
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("proar-mobile-punch-cache-v1", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("cache", { keyPath: "scope" }); request.result.createObjectStore("keys"); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function read<T>(db: IDBDatabase, store: string, id: string) {
  return new Promise<T | undefined>((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function key(db: IDBDatabase, scope: string) {
  const existing = await read<CryptoKey>(db, "keys", scope);
  if (existing) return existing;
  const generated = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return new Promise<CryptoKey>((resolve, reject) => {
    const tx = db.transaction("keys", "readwrite"), store = tx.objectStore("keys"), request = store.get(scope);
    let chosen = generated;
    request.onsuccess = () => { if (request.result) chosen = request.result; else store.put(generated, scope); };
    tx.oncomplete = () => resolve(chosen);
    tx.onabort = () => reject(tx.error);
  });
}
export async function loadPunchCache(scope: string): Promise<Cache> {
  const db = await open();
  try {
    const row = await read<Row>(db, "cache", scope);
    if (!row) return { days: {}, pending: [] };
    const cryptoKey = await key(db, scope);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(row.iv) }, cryptoKey, row.cipher);
    const value = JSON.parse(new TextDecoder().decode(plain)) as Cache;
    return { days: value.days || {}, pending: Array.isArray(value.pending) ? value.pending : [] };
  } finally { db.close(); }
}
export async function savePunchCache(scope: string, value: Cache) {
  const db = await open();
  try {
    const cryptoKey = await key(db, scope), iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, new TextEncoder().encode(JSON.stringify(value)));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("cache", "readwrite");
      tx.objectStore("cache").put({ scope, iv, cipher } satisfies Row);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
