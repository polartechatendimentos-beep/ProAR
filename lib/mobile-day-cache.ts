import {validDayPackage,type MobileDayPackage,type CachedHistory} from "./mobile-day-policy.ts";
const jobs=new Map<string,Promise<unknown>>();
const read=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
function open(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("proar-mobile-day-v1",1);r.onupgradeneeded=()=>{r.result.createObjectStore("packages",{keyPath:"id"});r.result.createObjectStore("keys");};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function key(db:IDBDatabase,scope:string){const found=await read(db.transaction("keys").objectStore("keys").get(scope)) as CryptoKey|undefined;if(found)return found;
  const generated=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  return new Promise<CryptoKey>((resolve,reject)=>{const tx=db.transaction("keys","readwrite"),store=tx.objectStore("keys"),r=store.get(scope);let chosen=generated;r.onsuccess=()=>{if(r.result)chosen=r.result;else store.put(generated,scope);};tx.oncomplete=()=>resolve(chosen);tx.onabort=()=>reject(tx.error);});
}
async function writePackage(scope:string,value:MobileDayPackage){
  const db=await open();try{const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(scope)},await key(db,scope),new TextEncoder().encode(JSON.stringify(value)));
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction("packages","readwrite");tx.objectStore("packages").put({id:scope,iv,cipher});tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});
  }finally{db.close();}
}
function serial<T>(scope:string,run:()=>Promise<T>){const next=(jobs.get(scope)||Promise.resolve()).catch(()=>{}).then(run);jobs.set(scope,next);void next.finally(()=>{if(jobs.get(scope)===next)jobs.delete(scope);}).catch(()=>{});return next;}
export function saveDayPackage(value:MobileDayPackage){return serial(value.scope,async()=>{const previous=await loadDayPackage(value.scope);const histories=Object.fromEntries(value.data.orders.filter(order=>previous?.data.orders.some(old=>old.id===order.id&&old.fieldVersion===order.fieldVersion)&&previous.histories[order.id]).map(order=>[order.id,previous!.histories[order.id]]));await writePackage(value.scope,{...value,histories:{...histories,...value.histories}});});}
export async function loadDayPackage(scope:string,now=Date.now()){
  const db=await open();try{const row=await read(db.transaction("packages").objectStore("packages").get(scope));if(!row)return null;
    const bytes=await crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(row.iv),additionalData:new TextEncoder().encode(scope)},await key(db,scope),row.cipher);
    const value=JSON.parse(new TextDecoder().decode(bytes)) as MobileDayPackage;return validDayPackage(value,scope,now)?value:null;
  }catch{return null;}finally{db.close();}
}
export function saveDayHistories(scope:string,preparedAt:number,histories:Record<string,CachedHistory[]>){return serial(scope,async()=>{const value=await loadDayPackage(scope);if(!value||value.preparedAt!==preparedAt)return false;const allowed=new Set(value.data.orders.map(o=>o.id));const filtered=Object.fromEntries(Object.entries(histories).filter(([id])=>allowed.has(id)));await writePackage(scope,{...value,histories:{...value.histories,...filtered}});return true;});}
export function removeDayOrder(scope:string,orderId:string){return serial(scope,async()=>{const value=await loadDayPackage(scope);if(!value)return;const orders=value.data.orders.filter(o=>o.id!==orderId),histories={...value.histories};delete histories[orderId];await writePackage(scope,{...value,histories,data:{...value.data,orders,summary:{today:orders.filter(o=>o.date===value.day).length,inProgress:orders.filter(o=>Boolean(o.checkInAt)).length,pending:orders.filter(o=>!o.checkInAt).length}}});});}
