/** Preview-only PMOC planning; no appointments are booked or notifications sent. */
export type PmocContractPlan = { companyId:string; contractCompanyId:string; contractId:string; startDate:string; endDate:string; frequencyMonths:1|2|3|6|12 };
function parseDate(value:string):Date {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error("Data inválida.");
 const date=new Date(value+"T12:00:00.000Z");
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new Error("Data inválida.");
 return date;
}
export function previewPmocCalendar(plan:PmocContractPlan,year:number) {
 if(!plan.companyId||plan.companyId!==plan.contractCompanyId)throw new Error("Contrato de outra empresa.");
 if(!plan.contractId.trim()||!Number.isInteger(year)||year<2000||year>2100||![1,2,3,6,12].includes(plan.frequencyMonths))throw new Error("Plano inválido.");
 const start=parseDate(plan.startDate),end=parseDate(plan.endDate);
 if(end<start)throw new Error("Vigência inválida.");
 const result:{contractId:string;date:string;companyId:string}[]=[];
 const anchorDay=start.getUTCDate();
 for(let i=0;i<=1200;i++){
  const month=start.getUTCMonth()+i*plan.frequencyMonths;
  const first=new Date(Date.UTC(start.getUTCFullYear(),month,1,12));
  const lastDay=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0,12)).getUTCDate();
  const date=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(anchorDay,lastDay),12));
  if(date>end)break;
  if(date.getUTCFullYear()===year)result.push({companyId:plan.companyId,contractId:plan.contractId,date:date.toISOString().slice(0,10)});
  if(date.getUTCFullYear()>year)break;
 }
 return result;
}
