import {deriveOperationalActions,summarizeOperationalActions} from "./action-center";
import {evaluateDayClose} from "./day-close";
import {forecastStock} from "./predictive-stock";
import {integrationCenter,type IntegrationState} from "./integration-center";
type R=Record<string,unknown>;
const num=(x:unknown)=>Number(x||0);
export function buildCommandCenter(serviceOrders:R[],modules:Record<string,R[]>,integrations:IntegrationState[]=[]){
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
 return {actions,summary,dayClose,stockForecast:products,integrations:integrationCenter(integrations),critical:actions.filter(x=>x.priority===1).slice(0,10)};
}
