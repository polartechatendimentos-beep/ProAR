export type ProarAction = {
  id: string;
  title: string;
  detail: string;
  module: string;
  tone: "blue" | "amber" | "red";
  priority: number;
  dueDate?: string;
  recordId?: string;
  reason: string;
};

type RecordLike = {
  id?: string;
  name?: string;
  client?: string;
  status?: string;
  date?: string;
  dueDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  value?: number;
  settledValue?: number;
  stockCurrent?: number;
  stockMin?: number;
  description?: string;
  category?: string;
  [key: string]: unknown;
};

const day = (value: unknown) => String(value || "").slice(0,10);
const ageDays = (date: unknown, today: string) => {
  const a = Date.parse(day(date));
  const b = Date.parse(today);
  return Number.isFinite(a) ? Math.floor((b-a)/86400000) : 0;
};
const daysUntil = (date: unknown, today: string) => {
  const a = Date.parse(day(date));
  const b = Date.parse(today);
  return Number.isFinite(a) ? Math.ceil((a-b)/86400000) : 9999;
};

export function deriveProarActions(serviceOrders: RecordLike[], modules: Record<string, RecordLike[]>, today = new Date().toISOString().slice(0,10)): ProarAction[] {
  const actions: ProarAction[] = [];

  for (const order of serviceOrders) {
    const status=String(order.status||"");
    if (order.date && day(order.date)<today && !/conclu|cancel/i.test(status)) actions.push({
      id:`os-overdue-${order.id}`,title:`OS atrasada • ${order.id}`,detail:`${order.client||"Cliente"} • prevista ${day(order.date)}`,module:"Ordens de serviço",tone:"red",priority:100,recordId:String(order.id||""),reason:"Data vencida e OS ainda aberta",
    });
    else if (day(order.date)===today && !/conclu|cancel/i.test(status)) actions.push({
      id:`os-today-${order.id}`,title:`Atendimento hoje • ${order.id}`,detail:`${order.client||"Cliente"} • ${status||"Agendada"}`,module:"Agenda",tone:"blue",priority:65,recordId:String(order.id||""),reason:"Atendimento programado para hoje",
    });
  }

  for (const budget of modules.Orçamentos || []) {
    if (/aprov|convert|cancel|perdid/i.test(String(budget.status||""))) continue;
    const age=ageDays(budget.updatedAt||budget.createdAt||budget.date,today);
    if (age>=3) actions.push({
      id:`budget-followup-${budget.id}`,title:`Orçamento sem retorno • ${budget.name||budget.id}`,detail:`${budget.client||"Cliente"} • há ${age} dias`,module:"Orçamentos",tone:age>=7?"red":"amber",priority:age>=7?85:55,recordId:String(budget.id||""),reason:"Follow-up comercial recomendado",
    });
  }

  for (const product of modules.Produtos || []) {
    const current=Number(product.stockCurrent||0), min=Number(product.stockMin??-1);
    if (min>=0 && current<=min) actions.push({
      id:`stock-${product.id}`,title:`Estoque crítico • ${product.name||product.id}`,detail:`Atual ${current} • mínimo ${min}`,module:"Estoque",tone:current<=0?"red":"amber",priority:current<=0?95:60,recordId:String(product.id||""),reason:"Saldo igual ou abaixo do estoque mínimo",
    });
  }

  for (const title of modules.Financeiro || []) {
    if (/paga|recebida|cancel/i.test(String(title.status||""))) continue;
    const due=day(title.dueDate||title.date);
    const outstanding=Math.max(0,Number(title.value||0)-Number(title.settledValue||0));
    if (due && due<today && outstanding>0) actions.push({
      id:`finance-${title.id}`,title:`Título vencido • ${title.name||title.id}`,detail:`${title.client||""} • vencimento ${due}`,module:"Financeiro",tone:"red",priority:90,recordId:String(title.id||""),reason:"Saldo financeiro vencido",
    });
  }

  for (const work of modules.Obras || []) {
    if (/conclu|cancel/i.test(String(work.status||""))) continue;
    const age=ageDays(work.updatedAt||work.date||work.createdAt,today);
    if (age>=7) actions.push({
      id:`work-stalled-${work.id}`,title:`Obra sem atualização • ${work.name||work.id}`,detail:`${age} dias sem avanço registrado`,module:"Obras",tone:age>=14?"red":"amber",priority:age>=14?80:50,recordId:String(work.id||""),reason:"Obra ativa sem atualização recente",
    });
  }

  for (const tender of [...(modules.Certames||[]),...(modules.Licitações||[])]) {
    if (/encerr|cancel|perdid/i.test(String(tender.status||""))) continue;
    const remaining=daysUntil(tender.endDate||tender.dueDate,today);
    if (remaining>=0 && remaining<=3) actions.push({
      id:`tender-deadline-${tender.id}`,title:`Prazo de licitação • ${tender.name||tender.id}`,detail:remaining===0?"Encerra hoje":`Encerra em ${remaining} dia(s)`,module:"Licitações",tone:remaining<=1?"red":"amber",priority:remaining<=1?98:70,recordId:String(tender.id||""),reason:"Prazo público próximo",
    });
  }

  for (const document of modules["Documentação / Habilitação"] || []) {
    const remaining=daysUntil(document.endDate||document.dueDate,today);
    if (remaining>=0 && remaining<=30) actions.push({
      id:`document-expiry-${document.id}`,title:`Documento vencendo • ${document.name||document.id}`,detail:remaining===0?"Vence hoje":`Vence em ${remaining} dia(s)`,module:"Licitações",tone:remaining<=7?"red":"amber",priority:remaining<=7?88:45,recordId:String(document.id||""),reason:"Documento/certidão próximo do vencimento",
    });
  }

  return actions.sort((a,b)=>b.priority-a.priority).slice(0,40);
}
