import { agendaToday } from "./agenda-calendar.ts";

const normalized = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export function operationalVisitIssue(order: { status?: unknown; date?: unknown; tech?: unknown }, now = new Date()) {
  const status = normalized(order.status);
  if (!status || /concluid|finalizad|cancelad|encerrad|rascunho/.test(status)) return null;
  if (/aguardando (?:a |uma )?(?:peca|pecas|material|materiais)\b/.test(status)) return "parts" as const;
  if (order.date === agendaToday(now) && /agendad|reagendad|confirmad/.test(status) &&
      /^(?:|a definir|nao definid[oa]|sem tecnico|nao atribuid[oa]|-)$/.test(normalized(order.tech))) return "unassigned" as const;
  return null;
}

export function isQuoteApproved(quote: { status?: string; approvalStatus?: string; approvalRequired?: boolean }) {
  if (/convertid|cancelad|recusad|rejeitad/.test(normalized(quote.status))) return false;
  return normalized(quote.approvalStatus) === "aprovado" || (!quote.approvalRequired && normalized(quote.status) === "aprovado");
}


export function validOperationalRecordId(value: string | null) {
  return value && /^[#a-z0-9][a-z0-9-]{0,95}$/i.test(value) ? value : "";
}
