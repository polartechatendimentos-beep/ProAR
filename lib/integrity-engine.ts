import type { ProAREvent } from "./transaction-engine";
export type IntegrityIssue={severity:"info"|"warning"|"critical";code:string;message:string;correlationId?:string};
export function auditTransactionIntegrity(events:ProAREvent[]):IntegrityIssue[]{
 const issues:IntegrityIssue[]=[]; const byKey=new Map<string,ProAREvent[]>();
 for(const e of events){const a=byKey.get(e.idempotencyKey)||[];a.push(e);byKey.set(e.idempotencyKey,a);}
 for(const [key,list] of byKey) if(list.length>1) issues.push({severity:"critical",code:"DUPLICATE_EFFECT",message:`Baixa/efeito duplicado: ${key}`,correlationId:list[0]?.correlationId});
 const paid=new Set(events.filter(e=>e.kind==="payment"&&e.action==="approved").map(e=>e.correlationId));
 const finance=new Set(events.filter(e=>e.kind==="finance"&&e.action==="settled").map(e=>e.correlationId));
 for(const c of paid) if(!finance.has(c)) issues.push({severity:"warning",code:"PAYMENT_WITHOUT_SETTLEMENT",message:"Pagamento aprovado sem baixa financeira.",correlationId:c});
 return issues;
}
