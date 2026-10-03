export type OperationalLedgerEntry={id:string;at:string;tenantId:string;correlationId:string;entityType:string;entityId:string;event:string;actorId?:string;sourceId?:string;idempotencyKey:string;amount?:number;quantity?:number;metadata?:Record<string,unknown>};
export function appendOperationalLedger(entries:OperationalLedgerEntry[],entry:OperationalLedgerEntry){
 if(entries.some(x=>x.idempotencyKey===entry.idempotencyKey)) return {entries,appended:false};
 return {entries:[...entries,entry],appended:true};
}
export function traceOperationalLedger(entries:OperationalLedgerEntry[],correlationId:string){return entries.filter(x=>x.correlationId===correlationId).sort((a,b)=>a.at.localeCompare(b.at));}
export function reconcileOperationalLedger(entries:OperationalLedgerEntry[],correlationId:string){
 const chain=traceOperationalLedger(entries,correlationId); const duplicateKeys=chain.map(x=>x.idempotencyKey).filter((x,i,a)=>a.indexOf(x)!==i);
 return {chain,duplicateKeys:[...new Set(duplicateKeys)],consistent:duplicateKeys.length===0};
}
