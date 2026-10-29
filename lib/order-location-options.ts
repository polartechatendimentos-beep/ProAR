import {customerHierarchy,hierarchySelection,type HierarchyCustomer,type HierarchyRecord} from "./customer-hierarchy.ts";
export function orderLocationOptions(customer:HierarchyCustomer,records:HierarchyRecord[],customers:HierarchyCustomer[],unitId="",sectorId=""){
 const nodes=customerHierarchy(customer,records,customers).filter(node=>!node.issue);
 const units=nodes.filter(node=>node.kind==="unit");
 const sectors=nodes.filter(node=>node.kind==="sector"&&(hierarchySelection(customer,nodes,node.id).unitId||"")===unitId);
 const rooms=nodes.filter(node=>node.kind==="room").filter(node=>{const location=hierarchySelection(customer,nodes,node.id);return (location.unitId||"")===unitId&&(location.sectorId||"")===sectorId;});
 return {nodes,units,sectors,rooms};
}

/** Sector-first OS navigation preserves existing registration topology. */
export function orderSectorLocationOptions(customer:HierarchyCustomer,records:HierarchyRecord[],customers:HierarchyCustomer[],sectorId="",unitId=""){
 const nodes=customerHierarchy(customer,records,customers).filter(node=>!node.issue);
 const sectors=nodes.filter(node=>node.kind==="sector");
 const sector=sectors.find(node=>node.id===sectorId);
 const units=nodes.filter(node=>node.kind==="unit"&&Boolean(sector&&(node.path.includes(sector.id)||sector.path.includes(node.id))));
 const rooms=nodes.filter(node=>node.kind==="room").filter(node=>{const selection=hierarchySelection(customer,nodes,node.id);return selection.sectorId===sectorId&&(selection.unitId||"")===unitId;});
 return {nodes,sectors,units,rooms};
}
export function orderSectorUnitSelection(customer:HierarchyCustomer,nodes:ReturnType<typeof customerHierarchy>,sectorId:string,unitId:string){
 const sector=nodes.find(node=>node.id===sectorId&&node.kind==="sector"&&!node.issue);
 if(!sector)return hierarchySelection(customer,nodes);
 if(!unitId)return hierarchySelection(customer,nodes,sectorId);
 const unit=nodes.find(node=>node.id===unitId&&node.kind==="unit"&&!node.issue);
 if(!unit||(!unit.path.includes(sector.id)&&!sector.path.includes(unit.id)))throw new Error("A unidade não pertence ao setor selecionado.");
 return hierarchySelection(customer,nodes,sector.path.includes(unit.id)?sector.id:unit.id);
}
