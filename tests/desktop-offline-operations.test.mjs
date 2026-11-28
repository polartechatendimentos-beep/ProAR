import assert from "node:assert/strict";
import test from "node:test";
import {desktopOperationChanges,desktopQueuePrefix,enqueueDesktopOperation,readDesktopOperations,legacyDesktopOperationsCount,syncDesktopOperations} from "../lib/desktop-offline-operations.ts";

const company="empresa-sintetica",user="responsavel";
const prefix=desktopQueuePrefix(company,user);
const store=()=>{
 const entries=new Map();
 return {get length(){return entries.size;},key:n=>[...entries.keys()][n]??null,getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
};
const state={customers:[{id:"CLI-1",name:"Anterior"},{id:"CLI-2",name:"Outro"}],serviceOrders:[],moduleRecords:{},_revision:5};
const changed=(id,name,tag)=>({id:tag,at:"2026-11-28T00:00:00Z",changes:desktopOperationChanges(state,{...state,customers:state.customers.map(r=>r.id===id?{...r,name}:r)})});

test("offline operations coexist and are separated by company and username; legacy snapshot remains read-only",()=>{
 const queue=store();const legacy=JSON.stringify([{companyId:company,payload:{_baseRevision:4}}]);queue.setItem("proar-offline-queue",legacy);
 enqueueDesktopOperation(queue,prefix,changed("CLI-1","Novo","i"));
 enqueueDesktopOperation(queue,prefix,changed("CLI-2","Atualizado","j"));
 enqueueDesktopOperation(queue,prefix,changed("CLI-2","Atualizado","k"));
 assert.deepEqual(readDesktopOperations(queue,prefix).map(v=>v.id),["i","j"]);
 assert.deepEqual(readDesktopOperations(queue,desktopQueuePrefix(company,"outra-pessoa")),[]);
 assert.equal(legacyDesktopOperationsCount(queue,company),1);assert.equal(queue.getItem("proar-offline-queue"),legacy);
});

test("409 retains the operation and cannot report success or skip a dependent entry",async()=>{
 const queue=store(),calls=[];
 enqueueDesktopOperation(queue,prefix,changed("CLI-1","Novo","i"));
 enqueueDesktopOperation(queue,prefix,changed("CLI-2","Atualizado","j"));
 const result=await syncDesktopOperations({store:queue,prefix,read:async()=>state,write:async payload=>{calls.push(payload);return {status:409,body:{error:"Conflito"}};}});
 assert.equal(result.confirmed,0);assert.equal(calls.length,1);assert.equal(result.remaining.length,2);
 assert.equal(result.remaining[0].status,"review");assert.equal(result.remaining[0].changes[0].after.name,"Novo");
});

test("retains when server responds 200 without confirming the actual record",async()=>{
 const queue=store();enqueueDesktopOperation(queue,prefix,changed("CLI-1","Novo","i"));
 const result=await syncDesktopOperations({store:queue,prefix,read:async()=>state,write:async()=>({status:200,body:{saved:true,state:{...state,_revision:6}}})});
 assert.equal(result.confirmed,0);assert.equal(result.remaining[0].status,"review");
});

test("confirms independent mutations against current revision and preserves unrelated online edits",async()=>{
 const queue=store();const next={...state,customers:[...state.customers,{id:"CLI-3",name:"Criado online"}],_revision:12};let sent;
 enqueueDesktopOperation(queue,prefix,changed("CLI-1","Novo","i"));
 const result=await syncDesktopOperations({store:queue,prefix,read:async()=>next,write:async draft=>{sent=draft;return {status:200,body:{saved:true,state:{...draft,_revision:13}}};}});
 assert.equal(result.confirmed,1);assert.equal(result.remaining.length,0);
 assert.equal(sent._revision,12);assert.equal(sent.customers[2].name,"Criado online");
});

test("do not replay financial changes, document issuances or OS snapshots via the desktop cache",()=>{
 assert.throws(()=>desktopOperationChanges(state,{...state,moduleRecords:{Financeiro:[{id:"FIN-1"}]}}),/confirmação online/);
 assert.throws(()=>desktopOperationChanges(state,{...state,serviceOrders:[{id:"OS-01"}]}),/confirmação online/);
});
