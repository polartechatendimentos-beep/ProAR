import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
import {stripTypeScriptTypes} from "node:module";
import {prepareOperationalState} from "../lib/operational-ledger.ts";
import {operationalPendingCenter} from "../lib/operational-pending-center.ts";
import {publicOrderProjection,publicOrderIsCurrent,publicOrderSnapshotId,safePublicOrderId} from "../lib/service-order-public-view.ts";

const id="#OS-15599", tenant="test-empresa", token="x".repeat(32);
const saved={id,trackingToken:token,client:"Cliente de teste",service:"Instalação",status:"Agendada",date:"2026-12-01",time:"08:30",timeline:[
 {id:"private",customerVisible:false,customerNote:"Não público",cost:1200},
 {id:"public",customerVisible:true,createdAt:"2026-11-26T12:00:00Z",status:"Agendada",customerNote:"Confirmada",cost:999,photos:["javascript:do-not-display","https://example.invalid/photo.jpg"]},
]};
test("a projeção usa o identificador legado sem copiar campos privados nem HTML arbitrário",()=>{
 const view=publicOrderProjection(saved,tenant);
 assert.equal(publicOrderSnapshotId(tenant,id),"osmap-test-empresa-OS-15599");
 assert.equal(safePublicOrderId("../#OS-15599"),"");
 assert.deepEqual(view.timeline.map(row=>row.id),["public"]);
 assert.equal(view.timeline[0].cost,undefined);
 assert.deepEqual(view.timeline[0].photos,["https://example.invalid/photo.jpg"]);
 assert.equal(publicOrderIsCurrent({...view,sourceHash:undefined},view),true);
 assert.equal(publicOrderIsCurrent({...view,companyId:"outro"},view),false);
 assert.equal(publicOrderIsCurrent(view,publicOrderProjection({...saved,status:"Em andamento"},tenant)),false);
});

test("central diferencia agenda, envio incerto e aceitação sem entrega; piloto e mensagens lidas não contam",()=>{
 const now=new Date("2026-11-26T17:30:00Z");
 const msg={id:"e",direction:"out",text:"Olá",at:"2026-11-26T16:50:00Z"};
 const base={name:"Teste",assignee:"",stage:"Novo contato",sector:"Geral",optOut:false};
 const summary=operationalPendingCenter({state:{serviceOrders:[{...saved,date:"2026-11-26",tech:"Não definido"},{...saved,id:"#OS-closed",status:"Concluída"}]}, chats:[
  {...base,phone:"5517999990000",messages:[{...msg,status:"unknown"}]},
  {...base,phone:"5517999990001",messages:[{...msg,status:"accepted"}]},
  {...base,phone:"5517999990002",messages:[{...msg,status:"accepted",deliveryStatus:"read"}]},
  {...base,phone:"5517999990003",messages:[{...msg,status:"failed"}]},
 ],pilotPhone:"5517999990003",outdatedTracking:[saved],trackingComplete:false},now);
 assert.equal(summary.scheduling.total,1);assert.equal(summary.scheduling.items[0].priority,"urgent");
 assert.equal(summary.tracking.total,1);assert.equal(summary.trackingComplete,false);
 assert.equal(summary.delivery.total,2);
 assert.match(summary.delivery.items[0].detail,/antes de reenviar/);
 assert.match(summary.delivery.items[1].detail,/sem confirmação de entrega/);
});

test("resincronização da OS usa apenas snapshot persistido e reprova tenant alheio",async()=>{
 const source=stripTypeScriptTypes(await readFile(new URL("../app/api/public-service-order/route.ts",import.meta.url),"utf8")).replace(/^import .*;$/gm,"").replace(/^export /gm,"");
 const publications=[];
 const put=runInNewContext(source+"\nPUT",{
  NextResponse:{json:(body,init)=>({body,status:init?.status??200})},masterDatabaseConfig:()=>({}),
  requirePermission:()=>({ok:true,session:{companyId:tenant}}),sessionCompany:(s,requested)=>requested&&requested!==s.companyId?{ok:false,status:403,error:"Outra empresa"}:{ok:true,companyId:s.companyId},
  safePublicOrderId,publicOrderProjection,getOperationalState:async()=>({ok:true,json:async()=>({state:{serviceOrders:[saved],_revision:7}})}),
  publicOrderStore:async()=>({publish:async(view,version)=>{publications.push({view,version});return {status:"published"};}}),
 });
 const call=body=>put({headers:new Headers(),nextUrl:new URL("https://example.invalid/api/public-service-order"),text:async()=>JSON.stringify(body)});
 assert.equal((await call({orderId:id,companyId:"outro"})).status,403);
 assert.equal((await call({orderId:"#OS-inexistente"})).status,404);
 assert.equal((await call({orderId:id,status:"Alterado no navegador",token:"Não usar"})).status,200);
 assert.equal(publications.length,1);assert.equal(publications[0].view.status,"Agendada");assert.equal(publications[0].view.token,token);assert.equal(publications[0].version,7);
});


test("alteração pelo desktop não apaga resultados móveis nem encerra a OS com aparelho pendente",()=>{
 const previous={customers:[],moduleRecords:{},serviceOrders:[{id:"#OS-9",status:"Em andamento",fieldEquipmentResults:[{equipmentId:"EQ-1",status:"pending",note:"Aguardando peça."}]}]};
 const options={username:"auditoria",can:()=>true};
 const erase={...previous,serviceOrders:[{id:"#OS-9",status:"Em andamento"}]};
 assert.throws(()=>prepareOperationalState(previous,erase,options),/preservados/);
 const close={...previous,serviceOrders:[{...previous.serviceOrders[0],status:"Concluída"}]};
 assert.throws(()=>prepareOperationalState(previous,close,options),/aparelho pendente/);
});
