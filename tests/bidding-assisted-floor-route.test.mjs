import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import { computeBidFloor } from "../lib/bidding-assisted-floor.ts";

const route=stripTypeScriptTypes(await readFile(new URL("../app/api/bidding-workflow/route.ts",import.meta.url),"utf8")).replace(/^import .*;$/gm,"").replace(/^export /gm,"");
const endpoint=new URL("https://proar.example/api/bidding-workflow");
const example={scope:"lote",reference:"IV",materials:"100",labor:"150",travel:"30",other:"20",taxes:"8",margin:"12"};
function mock() {
 let record={companyId:"empresa",_revision:0,records:{}},actor="editor",allowed=["licitacoes.editar"];
 const api=runInNewContext(route+"\n({GET,POST})",{
  createHash,NextResponse:{json:(body,opts)=>({body,status:opts.status})},procurementAccess:()=>({ok:true,session:{username:actor}}),hasPermission:(_,access)=>allowed.includes(access),routeContext:async()=>({db:{url:"test"},company:"empresa",state:{}}),
  routeRest:async()=>({ok:true,json:async()=>[{payload:record}]}),PRIMARY_DATABASE_URL:"test",commitNeonOperationalState:async(_key,_rev,next)=>{record=next;return true;},biddingTenderOptions:()=>[{id:"bid-1"},{id:"bid-2"}],computeBidFloor,
 });
 const request={headers:new Headers({origin:endpoint.origin}),nextUrl:endpoint};
 return {as:(name,permissions)=>{actor=name;allowed=permissions;},get:tender=>api.GET({...request,nextUrl:new URL("?floorTender="+tender,endpoint)}),post:body=>api.POST({...request,text:async()=>JSON.stringify({expectedRevision:record._revision,tenderId:"bid-1",...body})}),snapshot:()=>record};
}
test("piso usa cálculo do servidor e exige revisão de outro usuário com permissão",async()=>{
 const m=mock();
 assert.equal((await m.post({action:"submit-bid-floor",floor:example})).status,422);
 const saved=await m.post({action:"submit-bid-floor",costsReviewed:true,floor:{...example,status:"approved",floorCents:1}});
 assert.equal(saved.status,200);
 assert.equal(saved.body.floors[0].floorCents,37500);
 assert.equal(saved.body.floors[0].status,"pending");
 const decision={action:"decide-bid-floor",floorKey:"lote:iv",decision:"approved",note:"Verifiquei os custos e a margem."};
 assert.equal((await m.post(decision)).status,403);
 m.as("editor",["aprovacoes.aprovar"]);
 assert.equal((await m.post(decision)).status,403);
 m.as("gestor",["aprovacoes.aprovar"]);
 assert.equal((await m.post(decision)).status,200);
 assert.equal((await m.get("bid-1")).body.floors[0].status,"approved");
 assert.equal((await m.get("bid-2")).body.floors.length,0);
 assert.equal((await m.get("bid-inexistente")).status,422);
});
test("gravação antiga não consegue sobrescrever piso aprovado e concorrência retorna 409",async()=>{
 const m=mock();
 await m.post({action:"submit-bid-floor",costsReviewed:true,floor:example});
 assert.equal((await m.post({action:"submit-bid-floor",costsReviewed:true,floor:example})).status,409);
 assert.equal((await m.post({expectedRevision:0,records:{}})).status,409);
 assert.equal((await m.post({records:{},bidFloors:{"bid-1":[]}})).status,200);
 assert.equal(m.snapshot().bidFloors["bid-1"][0].status,"pending");
});
