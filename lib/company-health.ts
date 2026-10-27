export type CompanyHealthInput={cashCoverage:number;overdueRatio:number;margin:number;stockRisk:number;lateOsRatio:number;fiscalIssues:number;contractRisk:number;reworkRatio:number;integrationIssues:number};
export function companyHealth(i:CompanyHealthInput){const factors=[
 {key:"cash",label:"Caixa",score:Math.max(0,Math.min(100,i.cashCoverage*100)),weight:20},
 {key:"overdue",label:"Inadimplência",score:Math.max(0,100-i.overdueRatio*100),weight:15},
 {key:"margin",label:"Margem",score:Math.max(0,Math.min(100,i.margin*2.5)),weight:15},
 {key:"stock",label:"Estoque",score:Math.max(0,100-i.stockRisk*100),weight:10},
 {key:"os",label:"OS no prazo",score:Math.max(0,100-i.lateOsRatio*100),weight:10},
 {key:"fiscal",label:"Fiscal",score:Math.max(0,100-i.fiscalIssues*15),weight:10},
 {key:"contracts",label:"Contratos",score:Math.max(0,100-i.contractRisk*100),weight:8},
 {key:"rework",label:"Retrabalho",score:Math.max(0,100-i.reworkRatio*100),weight:7},
 {key:"integrations",label:"Integrações",score:Math.max(0,100-i.integrationIssues*20),weight:5},
 ];const score=Math.round(factors.reduce((s,f)=>s+f.score*f.weight,0)/factors.reduce((s,f)=>s+f.weight,0));return{score,status:score>=80?"healthy":score>=60?"attention":"critical",factors:factors.sort((a,b)=>a.score-b.score)};}
