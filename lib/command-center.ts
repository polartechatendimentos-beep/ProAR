import {deriveOperationalActions,summarizeOperationalActions} from "./action-center";
import {evaluateDayClose} from "./day-close";
import {forecastStock} from "./predictive-stock";
import {integrationCenter,type IntegrationState} from "./integration-center";
import {companyHealth} from "./company-health";
import {buildDre,type DreEntry} from "./management-dre";
import {evaluateGoals,type ManagementGoal} from "./management-goals";
import {evaluatePreClose} from "./pre-close";
import type {IntegrityResult} from "./integrity-audit";
type R=Record<string,unknown>;
const num=(x:unknown)=>Number(x||0);
export function buildCommandCenter(serviceOrders:R[],modules:Record<string,R[]>,integrations:IntegrationState[]=[],dreEntries:DreEntry[]=[],goals:ManagementGoal[]=[],integrity:IntegrityResult|null=null){
 const actions=deriveOperationalActions(serviceOrders,modules);
 const summary=summarizeOperationalActions(actions);
 const products=(modules.Produtos||[]).map(p=>forecastStock({productId:String(p.id||""),name:String(p.name||p.id||""),available:num(p.stockCurrent),reserved:num(p.stockReserved),minimum:num(p.stockMin),scheduledDemand:num(p.scheduledDemand),horizonDays:7}));
 const financial=modules.Financeiro||[];
 const dayClose=evaluateDayClose({
  openOs:serviceOrders.filter(o=>!/conclu[ií]d|cancelad/i.test(String(o.status||""))).length,
  paymentsWithoutSettlement:financial.filter(x=>/pagamento aprovado/i.test(String(x.status||""))&&!x.settledAt).length,
  fiscalPending:serviceOrders.filter(o=>/pendente|validando|transmitindo|processando|rejeitada|erro/i.test(String(o.nfseStatus||""))).length,
  stockDivergences:products.filter(x=>x.projected<0).length,
  refundsPending:financial.filter(x=>/estorno|devolu/i.test(String(x.status||""))&&!/conclu|pago|creditado/i.test(String(x.status||""))).length,
  cashDifference:num((modules["Fechamento de caixa"]||[])[0]?.difference)
 });
 const dre=buildDre(dreEntries); const integrationStatus=integrationCenter(integrations); const overdue=financial.filter(x=>/vencid/i.test(String(x.status||""))).reduce((s,x)=>s+num(x.value)-num(x.settledValue),0); const receivable=financial.filter(x=>!/pagar/i.test(String(x.transactionType||""))).reduce((s,x)=>s+Math.max(0,num(x.value)-num(x.settledValue)),0); const openOs=serviceOrders.filter(x=>!/conclu[ií]d|cancelad/i.test(String(x.status||""))); const preClose=evaluatePreClose({openOs:dayClose.checks.find(x=>x.key==="os")?.count||0,paymentsWithoutSettlement:dayClose.checks.find(x=>x.key==="payments")?.count||0,fiscalPending:dayClose.checks.find(x=>x.key==="fiscal")?.count||0,stockDivergences:dayClose.checks.find(x=>x.key==="stock")?.count||0,refundsPending:dayClose.checks.find(x=>x.key==="refunds")?.count||0,cashDifference:num((modules["Fechamento de caixa"]||[])[0]?.difference),integrity,integrationCritical:integrationStatus.filter(x=>x.status==="critical").length}); const health=companyHealth({cashCoverage:1,overdueRatio:receivable?overdue/receivable:0,margin:dre.margin,stockRisk:products.length?products.filter(x=>x.status!=="ok").length/products.length:0,lateOsRatio:openOs.length?actions.filter(x=>x.category==="OS"&&x.priority===1).length/openOs.length:0,fiscalIssues:actions.filter(x=>x.category==="Fiscal").length,contractRisk:0,reworkRatio:0,integrationIssues:integrationStatus.filter(x=>x.status==="critical").length}); return {actions,summary,dayClose,preClose,stockForecast:products,integrations:integrationStatus,dre,goals:evaluateGoals(goals),health,critical:actions.filter(x=>x.priority===1).slice(0,10)};
}
