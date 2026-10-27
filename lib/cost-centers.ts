export type CostCenter={id:string;name:string;type:"vehicle"|"technician"|"work"|"contract"|"branch"|"department";active:boolean};
export type CostAllocation={costCenterId:string;amount:number;sourceId?:string;description?:string};
export function summarizeCostCenters(centers:CostCenter[],allocations:CostAllocation[]){return centers.filter(x=>x.active).map(c=>({id:c.id,name:c.name,type:c.type,total:allocations.filter(a=>a.costCenterId===c.id).reduce((s,a)=>s+a.amount,0),entries:allocations.filter(a=>a.costCenterId===c.id).length})).sort((a,b)=>b.total-a.total);}
