import test from "node:test";
import assert from "node:assert/strict";
import {fieldServiceCatalog,addFieldService} from "../lib/mobile-service-catalog.ts";
import {improveFieldOrder} from "../lib/mobile-order-improvements.ts";
import {fieldOrderFingerprint} from "../lib/mobile-workday.ts";
import {mobileFieldOrders} from "../lib/mobile-field.ts";
const catalog=[{id:"S1",name:"Higienização",status:"Ativo",cost:900,value:1500,password:"private"},{id:"S2",name:"Instalação",status:"Inativo"}];
const user={username:"marin",displayName:"Marin",role:"Técnico de Campo"};
const order={id:"OS1",client:"Cliente",tech:"Marin",status:"Em andamento",service:"Descrição original",fieldVersion:0,total:700,catalogItems:[{id:"P1",name:"Peça",kind:"Produto",quantity:1}]};
const command=(o=order)=>({requestId:"service-test-0001",orderId:o.id,expectedVersion:Number(o.fieldVersion||0),expectedToken:fieldOrderFingerprint(o),action:"add-service",serviceId:"S1",quantity:2});
test("service catalog filters inactive and searches without accents without exposing prices or private fields",()=>{
 assert.deepEqual(fieldServiceCatalog(catalog,"higienizacao").services,[{id:"S1",name:"Higienização"}]);
 assert.equal(fieldServiceCatalog(catalog,"instalacao").total,0);
});
test("service catalog paginates all records, including after the first 50",()=>{
 const rows=Array.from({length:112},(_,i)=>({id:"S"+i,name:"Serviço "+String(i).padStart(3,"0")}));
 assert.equal(fieldServiceCatalog(rows).services.length,50);
 assert.equal(fieldServiceCatalog(rows,"",100).services.length,12);
 assert.equal(fieldServiceCatalog(rows,"",100).hasMore,false);
 assert.equal(fieldServiceCatalog(rows,"",NaN).offset,0);
});
test("adding a service uses authoritative name and preserves existing scope, materials, price and report",()=>{
 const before={...order,executedService:"Relatório preservado"};
 const result=addFieldService(before,catalog,{serviceId:"S1",quantity:2,name:"forjado",value:1},"marin","2026-10-28T12:00:00Z");
 assert.equal(result.catalogItems[1].name,"Higienização");assert.equal(result.catalogItems[1].quantity,2);
 assert.equal(result.catalogItems[1].value,undefined);assert.equal(result.total,700);
 assert.equal(result.service,before.service);assert.equal(result.executedService,before.executedService);
 assert.deepEqual(result.catalogItems[0],order.catalogItems[0]);assert.equal(order.catalogItems.length,1);
 assert.equal(result.timeline[0].customerVisible,false);
});
test("unknown, inactive, duplicate and invalid quantity service additions fail closed",()=>{
 for(const serviceId of ["unknown","S2"])assert.throws(()=>addFieldService(order,catalog,{serviceId,quantity:1},"marin","now"));
 for(const quantity of [0,-1,NaN,Infinity,10001,"1"])assert.throws(()=>addFieldService(order,catalog,{serviceId:"S1",quantity},"marin","now"));
 const next=addFieldService(order,catalog,{serviceId:"S1",quantity:1},"marin","now");
 assert.throws(()=>addFieldService(next,catalog,{serviceId:"S1",quantity:1},"marin","now"),/já está incluído/);
 assert.throws(()=>addFieldService(order,[],{serviceId:"S1",quantity:1},"marin","now"),/catálogo desta empresa/);
});
test("service mutation enforces assignment, open status and concurrency fingerprint",()=>{
 const cmd=command();
 assert.equal(improveFieldOrder(order,[],cmd,user,false,"now",catalog).order.fieldVersion,1);
 assert.throws(()=>improveFieldOrder(order,[],cmd,{...user,username:"other",displayName:"Outro"},false,"now",catalog),/atribuída/);
 const closed={...order,status:"Concluída"};
 assert.throws(()=>improveFieldOrder(closed,[],command(closed),user,false,"now",catalog),/concluída/);
 assert.throws(()=>improveFieldOrder(order,[],{...cmd,expectedToken:"0".repeat(64)},user,false,"now",catalog),/alterada/);
});
test("mobile service projection separates services from materials without sending full catalog",()=>{
 const next=addFieldService(order,catalog,{serviceId:"S1",quantity:2},"marin","now");
 const row=mobileFieldOrders([next],user)[0];
 assert.deepEqual(row.appliedServices,[{id:"S1",name:"Higienização",quantity:2}]);
 assert.deepEqual(row.appliedMaterials,[{name:"Peça",quantity:1}]);
 assert.equal(row.total,undefined);
});
