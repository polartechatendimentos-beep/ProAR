export type CustomerHealthInput={overdueAmount?:number;openCriticalIssues?:number;pmocOverdue?:number;contractDaysToExpire?:number;openOpportunities?:number;recentRework?:number};
export function customerHealth(i:CustomerHealthInput){
 let score=100; const alerts:string[]=[];
 if((i.overdueAmount||0)>0){score-=25;alerts.push("Inadimplência em aberto");}
 if((i.openCriticalIssues||0)>0){score-=20;alerts.push("Pendências críticas");}
 if((i.pmocOverdue||0)>0){score-=20;alerts.push("PMOC vencido");}
 if(i.contractDaysToExpire!=null&&i.contractDaysToExpire<=30){score-=10;alerts.push("Contrato próximo do vencimento");}
 if((i.recentRework||0)>0){score-=15;alerts.push("Retrabalho recente");}
 return {score:Math.max(0,score),status:score>=80?"healthy":score>=55?"attention":"critical",alerts,opportunities:i.openOpportunities||0};
}
