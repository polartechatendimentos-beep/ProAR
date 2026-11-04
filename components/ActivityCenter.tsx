"use client";

import { useMemo, useState } from "react";
import { Activity, CalendarDays, Clock3, Filter, Search, UserRound } from "lucide-react";

type AuditRecord = Record<string, any>;

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
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);
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
  const modules = useMemo(() => Array.from(new Set(records.map(item => String(item.auditModule || item.category || "Sistema")).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [records]);
  const users = useMemo(() => Array.from(new Set(records.map(item => String(item.auditUser || item.client || "Sistema")).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [records]);
  const filtered = useMemo(() => records.filter(item => {
    const moduleName = String(item.auditModule || item.category || "Sistema");
    const user = String(item.auditUser || item.client || "Sistema");
    const text = `${item.name || ""} ${item.description || ""} ${item.auditDetail || ""} ${item.recordId || ""} ${moduleName} ${user}`.toLocaleLowerCase("pt-BR");
    const dateKey = auditDateKey(item.createdAt || item.date);
    return (!query || text.includes(query.toLocaleLowerCase("pt-BR").trim()))
      && (moduleFilter === "Todos" || moduleName === moduleFilter)
      && (userFilter === "Todos" || user === userFilter)
      && (!fromDate || (dateKey && dateKey >= fromDate))
      && (!toDate || (dateKey && dateKey <= toDate));
  }).sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime()), [records, query, moduleFilter, userFilter, fromDate, toDate]);
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todayCount = records.filter(item => auditDateKey(item.createdAt || item.date) === todayKey).length;

  return <section className="activity-center">
    <div className="activity-hero">
      <div><span><Activity size={14}/> RASTREABILIDADE</span><h2>Central de atividades</h2><p>Histórico claro das alterações e operações realizadas no ProAR.</p></div>
      <div className="activity-today"><Clock3 size={18}/><span><small>HOJE</small><strong>{todayCount}</strong></span></div>
    </div>
    <div className="activity-toolbar">
      <label className="list-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar ação, cliente, OS, usuário ou módulo..."/></label>
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
        const changes = Array.isArray(item.auditChanges) ? item.auditChanges : [];
        const title = item.name || item.auditAction || "Atividade registrada";
        const moduleName = item.auditModule || item.category || "Sistema";
        const user = item.auditUser || item.client || "Sistema";
        const waitingForBank = /aguardou|aguardando|confirmação do banco/i.test(String(item.auditDetail || item.description || ""));
        const timestamp = item.createdAt || item.date || "Data não informada";
        return <article className="activity-entry" key={item.id || `${moduleName}-${index}`}>
          <span className="activity-dot"><Activity size={14}/></span>
          <div className="activity-main">
            <header><div className="activity-title"><b>{title}</b><small>{moduleName}{item.recordId ? ` • ${item.recordId}` : ""}</small></div><time dateTime={typeof timestamp === "string" ? timestamp : undefined}>{timestamp}</time></header>
            <div className="activity-summary">
              <p>{item.auditDetail || item.description || "Operação registrada."}</p>
              {waitingForBank && <span className="activity-state pending">Aguardando confirmação</span>}
            </div>
            {changes.length > 0 && <details className="activity-details">
              <summary>{changes.length} alteração(ões) • Ver detalhes</summary>
              <div className="activity-changes">{changes.slice(0, 20).map((change: any, changeIndex: number) => <div className="activity-change" key={changeIndex}>
                <b>{auditFieldLabel(change.field)}</b><span>{auditValue(change.before, String(change.field || ""))}</span><i>→</i><strong>{auditValue(change.after, String(change.field || ""))}</strong>
              </div>)}</div>
              {changes.length > 20 && <small className="activity-truncated">Mais {changes.length - 20} alterações disponíveis no registro completo.</small>}
            </details>}
            <footer><UserRound size={12}/><span>{user}</span></footer>
          </div>
        </article>;
      }) : <div className="activity-empty"><Activity size={25}/><b>Nenhuma atividade encontrada.</b><span>Ajuste os filtros de busca ou período.</span></div>}
    </div>
  </section>;
}
