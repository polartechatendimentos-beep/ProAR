import test from "node:test";
import assert from "node:assert/strict";
import { customerHierarchy,hierarchySelection,filterHierarchy,matchesHierarchyLocation,isMunicipalCustomer,hierarchyCounts } from "../lib/customer-hierarchy.ts";
import { prepareCustomerStructureSave } from "../lib/customer-structure.ts";
const customer={id:"pref-A",name:"Prefeitura A",organizationType:"Prefeitura"};
const unit={id:"unit",name:"UBS Centro",customerId:customer.id,hierarchyLevel:"Unidade"};
const sector={id:"sector",name:"Atendimento",customerId:customer.id,parentId:"unit",hierarchyLevel:"Setor"};
const room={id:"room",name:"Sala 1",customerId:customer.id,parentId:"sector",hierarchyLevel:"Ambiente"};
test("municipal tree selects the exact matrix/unit/sector/room ID path",()=>{
 const nodes=customerHierarchy(customer,[room,sector,unit]);
 assert.deepEqual(nodes.map(node=>[node.id,node.depth]),[["unit",0],["sector",1],["room",2]]);
 const selection=hierarchySelection(customer,nodes,"room");
 assert.equal(selection.customerId,"pref-A");assert.equal(selection.unitId,"unit");assert.equal(selection.sectorId,"sector");assert.equal(selection.roomId,"room");assert.equal(selection.structureId,"room");
 assert.deepEqual(selection.path,["Prefeitura A","UBS Centro","Atendimento","Sala 1"]);
 assert.equal(hierarchySelection(customer,nodes).structureId,undefined);
});
test("foreign IDs and ambiguous legacy customer names never enter the tree",()=>{
 const duplicate={...customer,id:"pref-B"};
 const nodes=customerHierarchy(customer,[unit,{...room,id:"foreign",customerId:"pref-B",client:"Prefeitura A"},{id:"legacy",name:"Ambíguo",client:"Prefeitura A"}],[customer,duplicate]);
 assert.deepEqual(nodes.map(node=>node.id),["unit"]);
});
test("search retains ancestors and matches Portuguese accents",()=>{
 const nodes=customerHierarchy(customer,[unit,{...sector,name:"Recepção"},room]);
 assert.deepEqual(filterHierarchy(nodes,"sala").map(node=>node.id),["unit","sector","room"]);
 assert.deepEqual(filterHierarchy(nodes,"recepcao").map(node=>node.id),["unit","sector"]);
});
test("cycles and missing parents are visible but cannot be selected",()=>{
 const nodes=customerHierarchy(customer,[{...unit,parentId:"sector"},sector,{...room,parentId:"missing"}]);
 assert.equal(nodes.length,3);assert.ok(nodes.every(node=>node.issue));
 assert.throws(()=>hierarchySelection(customer,nodes,"room"),/vínculo inválido/);
});
test("inactive structures remain in management and are excluded from selectors",()=>{
 assert.equal(customerHierarchy(customer,[{...unit,status:"Inativo"}]).length,0);
 assert.equal(customerHierarchy(customer,[{...unit,status:"Inativo"}],[customer],true).length,1);
});
test("subtree filtering uses IDs and excludes ambiguous name-only records",()=>{
 const nodes=customerHierarchy(customer,[unit,sector,room,{...room,id:"other-room",parentId:"unit"}]);
 assert.equal(matchesHierarchyLocation({roomId:"room"},nodes,"sector"),true);
 assert.equal(matchesHierarchyLocation({roomId:"other-room"},nodes,"sector"),false);
 assert.equal(matchesHierarchyLocation({room:"Sala 1"},nodes,"sector"),false);
});
test("new municipal hierarchy is saved through existing records without relinking others",()=>{
 const a=prepareCustomerStructureSave(customer,unit,[]);
 const b=prepareCustomerStructureSave(customer,sector,a.nextStructures);
 const c=prepareCustomerStructureSave(customer,room,b.nextStructures);
 assert.equal(c.record.parentId,"sector");assert.equal(c.record.customerId,"pref-A");
 const rootSector=prepareCustomerStructureSave(customer,{...sector,parentId:undefined},a.nextStructures);
 assert.equal(rootSector.record.parentId,undefined);
 assert.equal(b.record.parentId,"unit");
 assert.equal(a.nextStructures.length,1);
 assert.equal(prepareCustomerStructureSave(customer,{...unit,id:"filial",hierarchyLevel:"Filial"},[]).record.parentId,undefined);
});
test("municipal behavior recognizes explicit profiles and legacy municipal names",()=>{
 assert.equal(isMunicipalCustomer(customer),true);
 assert.equal(isMunicipalCustomer({...customer,organizationType:"Empresa"}),true);
 assert.equal(isMunicipalCustomer({id:"legacy",name:"MUNICÍPIO DE BÁLSAMO"}),true);
 assert.equal(isMunicipalCustomer({id:"business",name:"Serviços para Prefeitura",organizationType:"Empresa"}),false);
});

test("OS and equipment counters aggregate descendants without counting other customers",()=>{
 const nodes=customerHierarchy(customer,[unit,sector,room]);
 const counts=hierarchyCounts(customer,nodes,[customer],[{id:"os-1",customerId:"pref-A",roomId:"room"},{id:"os-2",customerId:"pref-B",roomId:"room"}],[{id:"eq-1",customerId:"pref-A",sectorId:"sector"}]);
 assert.deepEqual(counts.get(""),{orders:1,equipment:1});
 assert.deepEqual(counts.get("unit"),{orders:1,equipment:1});
 assert.deepEqual(counts.get("sector"),{orders:1,equipment:1});
 assert.deepEqual(counts.get("room"),{orders:1,equipment:0});
});
