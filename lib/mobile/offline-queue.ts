export type MobileDraftEvent = { id: string; osId: string; type: "checklist" | "photo-metadata" | "checkin"; payload: Record<string, unknown>; createdAt: string; status: "local" | "pending-review" };
const DB = "proar-mobile-drafts-v1";
const STORE = "events";
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE,{keyPath:"id"}); };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}
export async function saveLocalEvent(event:MobileDraftEvent):Promise<void>{
  const db=await openDb();
  try { await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(event);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);}); }
  finally {db.close();}
}
export async function getLocalEvents():Promise<MobileDraftEvent[]>{
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly");const req=tx.objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result as MobileDraftEvent[]);req.onerror=()=>reject(req.error);});}
  finally{db.close();}
}
// No automatic POST until an authenticated, tenant-scoped idempotent endpoint is validated.
