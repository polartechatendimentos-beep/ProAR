export type CopilotSignal={priority:"low"|"medium"|"high";title:string;reason:string;nextAction:string};
export function buildOperationalSignals(input:{completedOsWithoutInvoice:number;overduePmoc:number;viewedBudgetsWithoutFollowup:number;tomorrowStockShortages:number}):CopilotSignal[]{
 const s:CopilotSignal[]=[];
 if(input.completedOsWithoutInvoice) s.push({priority:"high",title:"OS concluídas sem faturamento",reason:`${input.completedOsWithoutInvoice} OS aguardam faturamento.`,nextAction:"Abrir Central Fiscal com as OS filtradas."});
 if(input.overduePmoc) s.push({priority:"high",title:"PMOC vencendo ou vencido",reason:`${input.overduePmoc} equipamentos exigem atenção.`,nextAction:"Criar oportunidades e tarefas de renovação."});
 if(input.viewedBudgetsWithoutFollowup) s.push({priority:"medium",title:"Orçamentos sem retorno",reason:`${input.viewedBudgetsWithoutFollowup} propostas foram visualizadas sem follow-up.`,nextAction:"Criar fila comercial priorizada."});
 if(input.tomorrowStockShortages) s.push({priority:"high",title:"Risco de falta de material",reason:`${input.tomorrowStockShortages} atendimentos de amanhã têm possível ruptura.`,nextAction:"Reservar estoque ou abrir compra."});
 return s;
}
