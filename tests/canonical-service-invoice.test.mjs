import test from "node:test";
import assert from "node:assert/strict";
import { inspectCanonicalServiceLinks } from "../lib/canonical-service-links.ts";
import { inspectPublicInvoiceBalance } from "../lib/public-invoice-balance.ts";
import { prepareOperationalState } from "../lib/operational-ledger.ts";

const customers=[{id:"cust-A",name:"Cliente Demo"},{id:"cust-B",name:"Cliente Demo"}];
const structures=[
 {id:"unit-A",name:"Centro",customerId:"cust-A",category:"Unidade"},
 {id:"room-A",name:"Sala 1",customerId:"cust-A",category:"Sala",parentId:"unit-A"},
 {id:"unit-B",name:"Centro",customerId:"cust-B",category:"Unidade"},
 {id:"room-B",name:"Sala 1",customerId:"cust-B",category:"Sala",parentId:"unit-B"},
 {id:"room-legacy",name:"Legada",client:"Cliente Demo",category:"Sala",parentId:"unit-A"},
];
const equipment=[
 {id:"equipment-A",name:"Split",customerId:"cust-A",roomId:"room-A"},
 {id:"equipment-B",name:"Split",customerId:"cust-B",roomId:"room-B"},
 {id:"equipment-legacy",name:"Legado",client:"Cliente Demo",roomId:"room-A"},
];
const plan={id:"plan-1",name:"Plano",customerId:"cust-A",unitId:"unit-A",roomId:"room-A",structureId:"room-A",equipmentIds:["equipment-A"]};
test("PMOC links resolve only existing canonical client/unit/room/equipment IDs",()=>{
 const canonical=inspectCanonicalServiceLinks(plan,customers,structures,equipment);
 assert.deepEqual(canonical.issues,[]);
 assert.deepEqual(canonical.equipmentOptions.map(item=>item.id),["equipment-A"]);
 assert.deepEqual(canonical.selection.path,["Cliente Demo","Centro","Sala 1"]);
 for(const altered of [
  {...plan,customerId:"cust-B"},
  {...plan,customerId:undefined,client:"Cliente Demo"},
  {...plan,roomId:"room-B"},
  {...plan,roomId:"room-legacy",structureId:"room-legacy"},
  {...plan,equipmentIds:["equipment-legacy"]},
  {...plan,equipmentIds:["equipment-B"]},
 ]) assert.ok(inspectCanonicalServiceLinks(altered,customers,structures,equipment).issues.length);
});
const contract={id:"contract",certameCustomerId:"cust-A",certameItems:[{id:"item",certameId:"contract",unitValue:100,movements:[
 {id:"exec-1",serviceOrderId:"os-1",certameId:"contract",itemId:"item",type:"Execução",executedDelta:2},
]}]};
const commitment={id:"emp-1",certameId:"contract",status:"Empenho recebido",value:1000,empenhoAllocations:[
 {id:"a1",empenhoId:"emp-1",serviceOrderId:"os-1",certameItemId:"item",amount:125},
]};
const order={id:"os-1",certameId:"contract",customerId:"cust-A",status:"Concluída",contractItems:[{certameItemId:"item",executionMovementId:"exec-1"}]};
const balance=(invoice=commitment,other=[],os=order,certame=contract)=>inspectPublicInvoiceBalance(invoice,[invoice,...other],[certame],[os],customers);
test("amount billable is allocated execution, not commitment face value; duplicates and legacy must be reviewed",()=>{
 assert.deepEqual(balance(),{ok:true,reason:"",invoiceableValue:125,remainingValue:875});
 assert.equal(balance({...commitment,empenhoAllocations:[{...commitment.empenhoAllocations[0],amount:201}]}).ok,false);
 assert.equal(balance(commitment,[],{...order,customerId:"cust-B"}).ok,false);
 assert.equal(balance(commitment,[],{...order,contractItems:[{...order.contractItems[0],executionMovementId:"missing"}]}).ok,false);
 const other={...commitment,id:"emp-2",empenhoAllocations:[{...commitment.empenhoAllocations[0],id:"a2",empenhoId:"emp-2",amount:80}]};
 assert.equal(balance(commitment,[other]).ok,false);
 assert.equal(balance(commitment,[{...other,status:"Cancelado"}]).ok,true);
 assert.equal(balance(commitment,[{...other,empenhoAllocations:[{...other.empenhoAllocations[0],certameItemId:undefined,amount:1}]}]).ok,false);
});
test("server refuses face-value billing and verifies matching linked title atomically",()=>{
 const actor={username:"user",can:()=>true};
 const old={customers,serviceOrders:[order],moduleRecords:{Certames:[contract],Empenhos:[commitment]}};
 const next=structuredClone(old);
 next.moduleRecords.Empenhos[0].status="Pronto para faturar";
 next.moduleRecords.Financeiro=[{id:"FAT-emp-1",empenhoId:"emp-1",name:"Faturamento",value:1000,transactionType:"Receber",status:"Pronto para faturar"}];
 assert.throws(()=>prepareOperationalState(old,next,actor),/título de faturamento/);
 next.moduleRecords.Financeiro[0].value=125;
 const ready=prepareOperationalState(old,next,actor);
 assert.equal(ready.moduleRecords.Financeiro[0].value,125);
 const issued=structuredClone(ready);
 issued.moduleRecords.Empenhos[0].status="Faturado";
 assert.throws(()=>prepareOperationalState(ready,issued,actor),/título de faturamento/);
 issued.moduleRecords.Financeiro[0].invoiceNumber="DEMO-1";
 issued.moduleRecords.Financeiro[0].invoiceIssuedAt="2026-11-27T13:00:00Z";
 assert.equal(prepareOperationalState(ready,issued,actor).moduleRecords.Empenhos[0].status,"Faturado");
});
