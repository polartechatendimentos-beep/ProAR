import test from "node:test";
import assert from "node:assert/strict";
import {orderLocationOptions,orderSectorLocationOptions,orderSectorUnitSelection} from "../lib/order-location-options.ts";
import {hierarchySelection} from "../lib/customer-hierarchy.ts";
const customer={id:"C1",name:"Prefeitura",organizationType:"Prefeitura"};
const other={id:"C2",name:"Outro cliente"};
const records=[
 {id:"U1",name:"Unidade A",customerId:"C1",category:"Unidade"},
 {id:"U2",name:"Unidade B",customerId:"C1",category:"Unidade"},
 {id:"S1",name:"Educação",customerId:"C1",category:"Diretoria",parentId:"U1"},
 {id:"S2",name:"Educação",customerId:"C1",category:"Setor",parentId:"U2"},
 {id:"R1",name:"Sala 1",customerId:"C1",category:"Ambiente",parentId:"S1"},
 {id:"ROOT",name:"Gabinete",customerId:"C1",category:"Diretoria"},
 {id:"OTHER",name:"Outro setor",customerId:"C2",category:"Setor"},
 {id:"BAD",name:"Vínculo quebrado",customerId:"C1",category:"Setor",parentId:"missing"},
 {id:"OFF",name:"Inativo",customerId:"C1",category:"Setor",status:"Inativo"}
];
test("order uses registration hierarchy including directorates and root sectors",()=>{
 const root=orderLocationOptions(customer,records,[customer,other]);
 assert.deepEqual(root.units.map(x=>x.id),["U1","U2"]);
 assert.deepEqual(root.sectors.map(x=>x.id),["ROOT"]);
});
test("same named sectors remain scoped to selected unit and selection stores exact IDs",()=>{
 const options=orderLocationOptions(customer,records,[customer,other],"U2");
 assert.deepEqual(options.sectors.map(x=>x.id),["S2"]);
 const selected=hierarchySelection(customer,options.nodes,"S2");
 assert.equal(selected.unitId,"U2");assert.equal(selected.sectorId,"S2");
});
test("rooms follow selected unit and sector without exposing unrelated or invalid locations",()=>{
 const options=orderLocationOptions(customer,records,[customer,other],"U1","S1");
 assert.deepEqual(options.rooms.map(x=>x.id),["R1"]);
 for(const id of ["OTHER","BAD","OFF"])assert.ok(!options.nodes.some(x=>x.id===id));
 assert.deepEqual(orderLocationOptions(customer,records,[customer,other],"U2","S2").rooms,[]);
});
test("new sector becomes selectable under its actual parent without modifying existing records",()=>{
 const added={id:"NEW",name:"Novo setor",customerId:"C1",category:"Setor",parentId:"U1"};
 assert.ok(orderLocationOptions(customer,[...records,added],[customer,other],"U1").sectors.some(x=>x.id==="NEW"));
 assert.equal(records.some(x=>x.id==="NEW"),false);
});

test("sector-first navigation scopes units and preserves exact IDs",()=>{
 const items=[...records,{id:"CHILD",name:"UBS",customerId:"C1",category:"Unidade",parentId:"ROOT"},{id:"CHILD2",name:"UBS",customerId:"C1",category:"Unidade",parentId:"S1"},{id:"ROOM2",name:"Sala",customerId:"C1",category:"Sala",parentId:"CHILD"}];
 const root=orderSectorLocationOptions(customer,items,[customer,other]);
 assert.deepEqual(root.units,[]);
 assert.deepEqual(new Set(root.sectors.map(x=>x.id)),new Set(["ROOT","S1","S2"]));
 const selected=orderSectorLocationOptions(customer,items,[customer,other],"ROOT","CHILD");
 assert.deepEqual(selected.units.map(x=>x.id),["CHILD"]);
 assert.deepEqual(selected.rooms.map(x=>x.id),["ROOM2"]);
 const location=orderSectorUnitSelection(customer,selected.nodes,"ROOT","CHILD");
 assert.equal(location.sectorId,"ROOT");assert.equal(location.unitId,"CHILD");assert.equal(location.structureId,"CHILD");
 assert.throws(()=>orderSectorUnitSelection(customer,selected.nodes,"ROOT","CHILD2"),/não pertence/);
});
test("sector-first selection preserves legacy unit ancestors without reparenting",()=>{
 const options=orderSectorLocationOptions(customer,records,[customer,other],"S1","U1");
 assert.deepEqual(options.units.map(x=>x.id),["U1"]);
 const location=orderSectorUnitSelection(customer,options.nodes,"S1","U1");
 assert.equal(location.sectorId,"S1");assert.equal(location.unitId,"U1");assert.equal(location.structureId,"S1");
 assert.deepEqual(options.rooms.map(x=>x.id),["R1"]);
 assert.equal(records.find(x=>x.id==="S1").parentId,"U1");
});
