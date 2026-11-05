"use client";

import { useMemo, useState } from "react";
import { Activity, CalendarDays, Clock3, Filter, Search, UserRound } from "lucide-react";

type AuditRecord = {
  id?: string;
  module?: string;
  recordId?: string;
  action?: string;
  user?: string;
  displayName?: string;
  createdAt?: string;
  reason?: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
};

const auditZone = "America/Sao_Paulo";
const auditDay = new Intl.DateTimeFormat("en-CA", { timeZone: auditZone, year: "numeric", month: "2-digit", day: "2-digit" });
const auditTime = new Intl.DateTimeFormat("pt-BR", { timeZone: auditZone, dateStyle: "short", timeStyle: "medium" });

function actorLabel(item: AuditRecord) {
  return item.displayName && item.displayName !== item.user
    ? `${item.displayName} (${item.user})`
    : item.user || "Usuário não identificado";
}

const auditFieldLabels: Record<string, string> = {
  catalogItems: "Itens do catálogo",
  contractItems: "Itens do contrato",
  path: "Etapas da ordem",
  photos: "Fotos",
  materialCost: "Custo de materiais",
  laborCost: "Custo de mão de obra",
  travelCost: "Custo de deslocamento",
  taxCost: "Impostos",
  commissionCost: "Comissão",
  date: "Data",
  time: "Horário",
  unit: "Unidade",
  unitId: "Unidade vinculada",
  status: "Situação",
  client: "Cliente",
  description: "Descrição",
  value: "Valor",
  dueDate: "Vencimento",
};

function auditDateKey(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "" : auditDay.format(date);
}

function auditValue(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.length ? `${value.length} item(ns)` : "Vazio";
  if (typeof value === "object") return "Dados atualizados";
  if (typeof value === "number" && /(cost|price|value|valor|custo)/i.test(field)) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return String(value);
}

function auditFieldLabel(field: unknown) {
  const raw = String(field ?? "Campo atualizado");
  if (auditFieldLabels[raw]) return auditFieldLabels[raw];
  return raw.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, value => value.toLocaleUpperCase("pt-BR"));
}

export function ActivityCenter({ records }: { records: AuditRecord[] }) {
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("Todos");
  const [userFilter, setUserFilter] = useState("Todos");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const modules = useMemo(() => Array.from(new Set(records.map(item => String(item.module || "Sistema")).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [records]);
  const users = useMemo(() => Array.from(new Set(records.map(item => actorLabel(item)).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [records]);
  const filtered = useMemo(() => records.filter(item => {
    const moduleName = String(item.module || "Sistema");
    const user = actorLabel(item);
    const text = `${item.action || ""} ${item.reason || ""} ${item.recordId || ""} ${moduleName} ${user}`.toLocaleLowerCase("pt-BR");
    const dateKey = auditDateKey(item.createdAt);
    return (!query || text.includes(query.toLocaleLowerCase("pt-BR").trim()))
      && (moduleFilter === "Todos" || moduleName === moduleFilter)
      && (userFilter === "Todos" || user === userFilter)
      && (!fromDate || (dateKey && dateKey >= fromDate))
      && (!toDate || (dateKey && dateKey <= toDate));
  }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()), [records, query, moduleFilter, userFilter, fromDate, toDate]);
  const todayKey = auditDay.format(new Date());
  const todayCount = records.filter(item => auditDateKey(item.createdAt) === todayKey).length;

  return <section className="activity-center">
    <div className="activity-hero">
      <div><span><Activity size={14}/> RASTREABILIDADE</span><h2>Central de atividades</h2><p>Histórico claro das alterações e operações realizadas no ProAR.</p></div>
      <div className="activity-today"><Clock3 size={18}/><span><small>HOJE</small><strong>{todayCount}</strong></span></div>
    </div>
    <div className="activity-toolbar">
      <label className="list-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar ação, registro, usuário ou módulo..."/></label>
      <label><Filter size={14}/><select aria-label="Filtrar por módulo" value={moduleFilter} onChange={event => setModuleFilter(event.target.value)}><option>Todos</option>{modules.map(item => <option key={item}>{item}</option>)}</select></label>
      <label><UserRound size={14}/><select aria-label="Filtrar por usuário" value={userFilter} onChange={event => setUserFilter(event.target.value)}><option>Todos</option>{users.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="activity-date-filter"><CalendarDays size={14}/><span>De</span><input aria-label="Data inicial" type="date" value={fromDate} max={toDate || undefined} onChange={event => setFromDate(event.target.value)}/></label>
      <label className="activity-date-filter"><CalendarDays size={14}/><span>Até</span><input aria-label="Data final" type="date" value={toDate} min={fromDate || undefined} onChange={event => setToDate(event.target.value)}/></label>
    </div>
    <div className="activity-stats">
      <article><small>EVENTOS REGISTRADOS</small><strong>{records.length}</strong></article>
      <article><small>RESULTADOS DESTA BUSCA</small><strong>{filtered.length}</strong></article>
      <article><small>USUÁRIOS IDENTIFICADOS</small><strong>{users.length}</strong></article>
    </div>
    <div className="activity-list" aria-label="Histórico de atividades">
      {filtered.length ? filtered.map((item, index) => {
        const changes = Object.entries(item.changes ?? {});
        const title = item.action || "Atividade registrada";
        const moduleName = item.module || "Sistema";
        const user = actorLabel(item);
        const date = new Date(item.createdAt || "");
        const timestamp = Number.isNaN(date.getTime()) ? "Data não informada" : auditTime.format(date);
        return <article className="activity-entry" key={item.id || `${moduleName}-${index}`}>
          <span className="activity-dot"><Activity size={14}/></span>
          <div className="activity-main">
            <header><div className="activity-title"><b>{title}</b><small>{moduleName}{item.recordId ? ` • ${item.recordId}` : ""}</small></div><time dateTime={item.createdAt}>{timestamp}</time></header>
            <div className="activity-summary">
              <p>{item.reason || "Operação registrada."}</p>
            </div>
            {changes.length > 0 && <details className="activity-details">
              <summary>{changes.length} alteração(ões) • Ver detalhes</summary>
              <div className="activity-changes">{changes.map(([field, change]) => <div className="activity-change" key={field}>
                <b>{auditFieldLabel(field)}</b><span>{auditValue(change.before, String(field || ""))}</span><i>→</i><strong>{auditValue(change.after, String(field || ""))}</strong>
              </div>)}</div>
            </details>}
            <footer><UserRound size={12}/><span>{user}</span></footer>
          </div>
        </article>;
      }) : <div className="activity-empty"><Activity size={25}/><b>Nenhuma atividade encontrada.</b><span>Ajuste os filtros de busca ou período.</span></div>}
    </div>
  </section>;
}
