import type { PendingOrderSubmission } from "./mobile-order-submission";
import type { MobileFieldOrder } from "./mobile-field";
export type OrderDraft={version:number;editToken?:string;observations?:string;measurements?:Record<string,string>;beforePhotos?:string[];afterPhotos?:string[];report:string;diagnosis:string;checklist:Record<string,boolean>;equipmentIds:string[];before:string;after:string;signature:string;signerName:string;savedAt:number;pendingSubmission?:PendingOrderSubmission;orderSnapshot?:MobileFieldOrder};
type DraftRow={id:string;scope?:string;orderId?:string;iv:Uint8Array;cipher:ArrayBuffer};
const pending=new Map<string,Promise<unknown>>();
function open(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("proar-order-drafts-v1",1);r.onupgradeneeded=()=>{r.result.createObjectStore("drafts",{keyPath:"id"});r.result.createObjectStore("keys");};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function read<T>(db:IDBDatabase,store:string,id:string){return new Promise<T|undefined>((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function write(db:IDBDatabase,store:string,value:unknown,id?:string){return new Promise<void>((resolve,reject)=>{const tx=db.transaction(store,"readwrite");if(id)tx.objectStore(store).put(value,id);else tx.objectStore(store).put(value);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});}
async function key(db:IDBDatabase,scope:string){let value=await read<CryptoKey>(db,"keys",scope);if(value)return value;value=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);return new Promise<CryptoKey>((resolve,reject)=>{const tx=db.transaction("keys","readwrite"),store=tx.objectStore("keys"),r=store.get(scope);let chosen=value!;r.onsuccess=()=>{if(r.result)chosen=r.result;else store.put(value,scope);};tx.oncomplete=()=>resolve(chosen);tx.onabort=()=>reject(tx.error);});}
function serial<T>(id:string,task:()=>Promise<T>):Promise<T>{const next=(pending.get(id)||Promise.resolve()).catch(()=>{}).then(task);pending.set(id,next);void next.finally(()=>{if(pending.get(id)===next)pending.delete(id);}).catch(()=>{});return next;}
export function saveOrderDraft(scope:string,orderId:string,draft:OrderDraft){const id=`${scope}:${orderId}`;return serial(id,async()=>{const db=await open();try{const iv=crypto.getRandomValues(new Uint8Array(12)),k=await key(db,scope),cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},k,new TextEncoder().encode(JSON.stringify(draft)));await write(db,"drafts",{id,scope,orderId,iv,cipher});}finally{db.close();}});}
export function loadOrderDraft(scope:string,orderId:string){const id=`${scope}:${orderId}`;return serial(id,async()=>{const db=await open();try{const row=await read<DraftRow>(db,"drafts",id);if(!row)return null;const k=await key(db,scope),bytes=await crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(row.iv)},k,row.cipher);const value=JSON.parse(new TextDecoder().decode(bytes)) as OrderDraft;return value.savedAt>Date.now()-30*86400000?value:null;}finally{db.close();}});}
export function clearOrderDraft(scope:string,orderId:string){const id=`${scope}:${orderId}`;return serial(id,async()=>{const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction("drafts","readwrite");tx.objectStore("drafts").delete(id);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}});}

/** Pending commands remain recoverable after a lost response or reload, scoped to company/user. */
export async function listPendingOrderDrafts(scope:string) {
  const db=await open();
  let ids:string[];
  try {
    const keys=await new Promise<string[]>((resolve,reject)=>{const r=db.transaction("drafts").objectStore("drafts").getAllKeys();r.onsuccess=()=>resolve(r.result.filter((id):id is string=>typeof id==="string"&&id.startsWith(`${scope}:`)));r.onerror=()=>reject(r.error);});
    const rows=await Promise.all(keys.map(id=>read<DraftRow>(db,"drafts",id)));
    ids=rows.filter((row):row is DraftRow&{orderId:string}=>Boolean(row?.scope===scope&&typeof row.orderId==="string"&&row.id===`${scope}:${row.orderId}`)).map(row=>row.orderId);
  }
  finally { db.close(); }
  const rows=await Promise.all(ids.map(id=>loadOrderDraft(scope,id)));
  return rows.filter((row):row is OrderDraft=>Boolean(row?.pendingSubmission&&row.orderSnapshot));
}
