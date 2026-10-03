export type ProARDocumentKind = "budget"|"order"|"service_order"|"stock"|"fiscal"|"finance"|"payment"|"refund";
export type ProAREvent = { id:string; aggregateId:string; kind:ProARDocumentKind; action:string; sourceId:string; correlationId:string; idempotencyKey:string; occurredAt:string; payload?:Record<string,unknown> };

export function correlationId(rootId:string){ return `proar:${rootId}`; }
export function idempotencyKey(input:{tenantId:string;kind:ProARDocumentKind;sourceId:string;action:string}) {
  return [input.tenantId,input.kind,input.sourceId,input.action].join(":");
}
export function assertSingleEffect(events:ProAREvent[], key:string) {
  const duplicates=events.filter(e=>e.idempotencyKey===key);
  if(duplicates.length>1) throw new Error(`Efeito duplicado detectado: ${key}`);
}
export function traceChain(events:ProAREvent[], correlation:string) {
  return events.filter(e=>e.correlationId===correlation).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt));
}
