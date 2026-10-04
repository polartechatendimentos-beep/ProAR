import type {WorkRoute} from "./work-routes.ts";import {attendanceSummary} from "./route-adherence.ts";
export type EmployeeComplianceDoc={id:string;name:string;kind:"NR"|"ASO"|"CNH"|"Certificado"|"Documento";issuedAt?:string;expiresAt?:string;status?:"Válido"|"Vencido"|"Pendente";attachment?:string};
export type EmployeeAsset={id:string;name:string;kind:"EPI"|"Ferramenta"|"Veículo"|"Equipamento";serial?:string;deliveredAt?:string;returnedAt?:string;condition?:string};
export function employeeManagementMetrics(routes:WorkRoute[],orders:{status?:string;tech?:string;estimatedDurationMinutes?:number;checkInAt?:string;checkOutAt?:string}[],employeeName:string,monthlyTargetHours=220){
 const summaries=routes.map(attendanceSummary),workedMinutes=summaries.reduce((s,x)=>s+x.workedMinutes,0),completed=orders.filter(o=>o.tech===employeeName&&/conclu|finaliz/i.test(o.status||""));
 const actualMinutes=completed.reduce((s,o)=>s+(o.checkInAt&&o.checkOutAt?Math.max(0,(Date.parse(o.checkOutAt)-Date.parse(o.checkInAt))/60000):0),0),estimatedMinutes=completed.reduce((s,o)=>s+Number(o.estimatedDurationMinutes||0),0);
 return{workedMinutes,targetMinutes:monthlyTargetHours*60,balanceMinutes:workedMinutes-monthlyTargetHours*60,completedOrders:completed.length,averageServiceMinutes:completed.length?Math.round(actualMinutes/completed.length):0,estimatedMinutes:Math.round(estimatedMinutes),actualMinutes:Math.round(actualMinutes)};
}
export function expiringEmployeeDocuments(docs:EmployeeComplianceDoc[],days=30,now=new Date()){const limit=new Date(now.getTime()+days*86400000);return docs.filter(d=>d.expiresAt&&new Date(d.expiresAt)<=limit).sort((a,b)=>String(a.expiresAt).localeCompare(String(b.expiresAt)));}
