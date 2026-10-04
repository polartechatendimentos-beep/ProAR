import type { IntegrityIssue } from "./integrity-engine";
export type ExceptionItem={id:string;severity:"info"|"warning"|"critical";area:string;title:string;detail:string;entityId?:string;correlationId?:string;recommendedAction:string};
export function buildExceptionCenter(input:{integrity:IntegrityIssue[];completedOsWithoutFiscal?:string[];approvedBudgetsWithoutOrder?:string[];rejectedFiscal?:string[];negativeStock?:string[]}):ExceptionItem[]{
 const out:ExceptionItem[]=input.integrity.map((x,i)=>({id:"integrity-"+i+"-"+x.code,severity:x.severity,area:"Integridade",title:x.code,detail:x.message,correlationId:x.correlationId,recommendedAction:"Abrir a cadeia da operação e corrigir a origem antes de repetir a baixa."}));
 for(const id of input.completedOsWithoutFiscal||[]) out.push({id:"os-fiscal-"+id,severity:"warning",area:"Fiscal",title:"OS concluída sem documento fiscal",detail:"OS "+id+" concluída e ainda não faturada.",entityId:id,recommendedAction:"Abrir Central Fiscal e preparar emissão."});
 for(const id of input.approvedBudgetsWithoutOrder||[]) out.push({id:"budget-order-"+id,severity:"warning",area:"Comercial",title:"Orçamento aprovado sem Pedido",detail:"Orçamento "+id+" aprovado sem continuidade.",entityId:id,recommendedAction:"Converter em Pedido preservando o vínculo de origem."});
 for(const id of input.rejectedFiscal||[]) out.push({id:"fiscal-rejected-"+id,severity:"critical",area:"Fiscal",title:"Documento fiscal rejeitado",detail:"Documento "+id+" requer correção.",entityId:id,recommendedAction:"Abrir rejeição traduzida e corrigir o campo indicado."});
 for(const id of input.negativeStock||[]) out.push({id:"stock-negative-"+id,severity:"critical",area:"Estoque",title:"Saldo negativo",detail:"Item "+id+" está com saldo negativo.",entityId:id,recommendedAction:"Auditar movimentos e bloquear nova saída até regularização."});
 return out;
}
