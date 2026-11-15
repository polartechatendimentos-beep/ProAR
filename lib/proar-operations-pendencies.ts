/** Read-only operational pending items; input must be prefiltered by authenticated tenant. */
export type OperationalItem = { companyId:string; id:string; kind:"os"|"chat"|"quote"|"pmoc"; status:string; dueAt?:string; assignee?:string };
export function operationalPendencies(companyId:string,items:OperationalItem[],now:string) {
 if(!companyId)throw new Error("Empresa não identificada.");
 const timestamp=Date.parse(now);
 if(!Number.isFinite(timestamp))throw new Error("Data inválida.");
 if(items.some(item=>item.companyId!==companyId))throw new Error("Dados de outra empresa recusados.");
 const closed=new Set(["concluido","concluído","cancelado","finalizado","aprovado"]);
 return items.filter(item=>!closed.has(item.status.toLocaleLowerCase("pt-BR"))).map(item=>{
  const due=item.dueAt?Date.parse(item.dueAt):NaN;
  return {id:item.id,kind:item.kind,assignee:item.assignee||"",overdue:Number.isFinite(due)&&due<timestamp,unassigned:!item.assignee,dueAt:item.dueAt||null};
 }).sort((a,b)=>Number(b.overdue)-Number(a.overdue)||Number(b.unassigned)-Number(a.unassigned)||a.id.localeCompare(b.id));
}
