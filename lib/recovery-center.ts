import {idempotencyKey,type ProAREvent,type ProARDocumentKind} from "./transaction-engine.ts";
export type RecoveryStep={kind:ProARDocumentKind;action:string;sourceId:string;label:string};
export type RecoveryIncident={id:string;rootId:string;tenantId:string;reason:string;steps:RecoveryStep[]};
export function recoveryPlan(incident:RecoveryIncident,events:ProAREvent[]){const completed=new Set(events.map(e=>e.idempotencyKey));return incident.steps.map(step=>{const key=idempotencyKey({tenantId:incident.tenantId,kind:step.kind,sourceId:step.sourceId,action:step.action});return{...step,idempotencyKey:key,status:completed.has(key)?"completed":"pending" as "completed"|"pending"};});}
export function nextRecoveryStep(incident:RecoveryIncident,events:ProAREvent[]){return recoveryPlan(incident,events).find(x=>x.status==="pending")??null;}
export function canResumeRecovery(incident:RecoveryIncident,events:ProAREvent[]){return Boolean(nextRecoveryStep(incident,events));}
