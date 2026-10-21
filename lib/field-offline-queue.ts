// No cookies, passwords or access tokens are persisted. Only the identity scope
// just confirmed by the authenticated server may decrypt and send this queue.
export type QueuedFieldCommand={requestId:string;action:string;data:Record<string,unknown>};
type QueueRow={id:string;scope:string;iv:Uint8Array;cipher:ArrayBuffer;state:"PENDING"|"SYNCING"|"FAILED";attempts:number;nextTry:number;createdAt:number;error?:string};
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function database(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("proar-field-queue-v1",1);r.onupgradeneeded=()=>{const db=r.result;db.createObjectStore("commands",{keyPath:"id"});db.createObjectStore("keys");};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function rows(db:IDBDatabase){return request(db.transaction("commands").objectStore("commands").getAll()) as Promise<QueueRow[]>;}
async function put(db:IDBDatabase,row:QueueRow){return new Promise<void>((resolve,reject)=>{const tx=db.transaction("commands","readwrite");tx.objectStore("commands").put(row);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});}
async function key(db:IDBDatabase,scope:string){let k=await request(db.transaction("keys").objectStore("keys").get(scope)) as CryptoKey|undefined;if(k)return k;
  k=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  // Serialize concurrent key creation across tabs: keep the first stored key.
  return new Promise<CryptoKey>((resolve,reject)=>{const tx=db.transaction("keys","readwrite"),store=tx.objectStore("keys"),r=store.get(scope);let chosen=k!;r.onsuccess=()=>{if(r.result)chosen=r.result;else store.put(k,scope);};tx.oncomplete=()=>resolve(chosen);tx.onabort=()=>reject(tx.error);});
}
export async function queueFieldCommand(scope:string,command:QueuedFieldCommand){
  if(!["fuel","checklist","point-adjustment"].includes(command.action))throw new Error("Esta ação exige confirmação online.");
  const db=await database();try{const all=await rows(db);if(all.filter(row=>row.scope===scope).length>=100)throw new Error("Fila local cheia. Sincronize antes de continuar.");
    const id=`${scope}:${command.requestId}`;if(all.some(row=>row.id===id))return;
    const iv=crypto.getRandomValues(new Uint8Array(12)),k=await key(db,scope);
    const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},k,new TextEncoder().encode(JSON.stringify(command)));
    await put(db,{id,scope,iv,cipher,state:"PENDING",attempts:0,nextTry:0,createdAt:Date.now()});
  }finally{db.close();}
}
export async function queueCount(scope:string){const db=await database();try{return (await rows(db)).filter(row=>row.scope===scope).length;}finally{db.close();}}
export async function synchronizeFieldQueue(scope:string,send:(command:QueuedFieldCommand)=>Promise<void>){
  const db=await database();try{const k=await key(db,scope);for(const row of (await rows(db)).filter(item=>item.scope===scope&&item.state!=="FAILED"&&item.nextTry<=Date.now())){
    try{await put(db,{...row,state:"SYNCING",nextTry:Date.now()+60000});
      const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(row.iv)},k,row.cipher);
      await send(JSON.parse(new TextDecoder().decode(decrypted)));
      await request(db.transaction("commands","readwrite").objectStore("commands").delete(row.id));
    }catch(error){const permanent=Boolean((error as {permanent?:boolean})?.permanent),attempts=row.attempts+1;
      await put(db,{...row,state:permanent?"FAILED":"PENDING",attempts,nextTry:Date.now()+Math.min(300000,1000*2**Math.min(attempts,8)),error:error instanceof Error?error.message:"Falha de sincronização"});
      if(!permanent)break;
    }
  }}finally{db.close();}
}

/** Metadata only; no command content or credentials leave the encrypted store. */
export async function fieldQueueSummary(scope:string){const db=await database();try{return (await rows(db)).filter(row=>row.scope===scope).map(row=>({id:row.id,state:row.state,attempts:row.attempts,nextTry:row.nextTry,createdAt:row.createdAt,error:row.error}));}finally{db.close();}}
