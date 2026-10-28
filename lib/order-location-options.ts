import {customerHierarchy,hierarchySelection,type HierarchyCustomer,type HierarchyRecord} from "./customer-hierarchy.ts";
export function orderLocationOptions(customer:HierarchyCustomer,records:HierarchyRecord[],customers:HierarchyCustomer[],unitId="",sectorId=""){
 const nodes=customerHierarchy(customer,records,customers).filter(node=>!node.issue);
 const units=nodes.filter(node=>node.kind==="unit");
 const sectors=nodes.filter(node=>node.kind==="sector"&&(hierarchySelection(customer,nodes,node.id).unitId||"")===unitId);
 const rooms=nodes.filter(node=>node.kind==="room").filter(node=>{const location=hierarchySelection(customer,nodes,node.id);return (location.unitId||"")===unitId&&(location.sectorId||"")===sectorId;});
 return {nodes,units,sectors,rooms};
}
