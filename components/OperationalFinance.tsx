"use client";
import { useMemo, useRef, useState } from "react";
import { Plus, X, CheckCircle2, WalletCards, FileText, Search, ArrowDownLeft, ArrowUpRight, TrendingUp, Landmark, ReceiptText, LineChart, ShieldCheck, Clock3, type LucideIcon } from "lucide-react";
import { defaultFinancialAccounts, financialAccountBalance, type ErpRecord, type OperationalCommand } from "@/lib/operational-ledger";
import { cashFlowForecast } from "@/lib/cash-flow-forecast";
import { profitabilityPortfolio } from "@/lib/profitability-derivation";
import { CurrencyInput } from "@/components/CurrencyInput";
import { centsToMoney, moneyToCents } from "@/lib/money-input";
import { formatBrazilDate } from "@/lib/date-format";
import { notifyFeedback } from "@/lib/ui-feedback";

type Props = { records: ErpRecord[]; modules: Record<string, ErpRecord[]>; onOpen: (title: string) => void; onOperation: (command: OperationalCommand) => Promise<void>; onIssueInvoice: (record: ErpRecord, number: string) => Promise<boolean> };
const money = (value: number) => centsToMoney(moneyToCents(value)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const payable = (record: ErpRecord) => record.transactionType === "Pagar" || /pagar|compra|fornecedor/i.test(`${record.name} ${record.category}`);
const financialOriginLabel = (record: ErpRecord) => {
  if (record.purchaseId) return `Origem: Compra ${record.purchaseId}`;
  if (record.serviceOrderId) return `Origem: OS ${record.serviceOrderId}`;
  if (record.saleId) return `Origem: Venda ${record.saleId}`;
  if (record.empenhoId) return `Origem: Empenho ${record.empenhoId}`;
  const raw=String(record.originKey || "");
  const match=raw.match(/^[PR]:(purchase|os|sale|empenho):([^:]+)(?::(\d+))?$/i);
  if(match){
    const labels:Record<string,string>={purchase:"Compra",os:"OS",sale:"Venda",empenho:"Empenho"};
    return `Origem: ${labels[match[1].toLowerCase()] || "Registro"} ${match[2]}${match[3] ? ` • Parcela ${match[3]}` : ""}`;
  }
  return record.id ? `Título: ${record.id}` : "Origem não informada";
};

export function OperationalFinance({ records, modules, onOpen, onOperation, onIssueInvoice }: Props) {
  const [view, setView] = useState("Títulos");
  const [filter, setFilter] = useState("Todos");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ action: string; record?: ErpRecord } | null>(null);
  const [data, setData] = useState<ErpRecord>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const initialModalData=useRef("");
  const accounts = modules["Contas financeiras"]?.length ? modules["Contas financeiras"] : defaultFinancialAccounts();
  const ledger = modules["Razão financeiro"] || [];
  const reconciliations = modules["Conciliações"] || [];
  const outstanding = (record: ErpRecord) => /cancelad/i.test(record.status || "") ? 0 : centsToMoney(Math.max(0, moneyToCents(record.value) - moneyToCents(record.settledValue)));
  const visible = useMemo(() => records.filter(record => (filter === "Todos" || (filter === "Pagamentos" ? payable(record) : !payable(record))) && `${record.name ?? ""} ${record.client ?? ""} ${record.invoiceNumber ?? ""} ${record.originKey ?? ""}`.toLowerCase().includes(query.toLowerCase().trim())), [records, filter, query]);
  const openTotal = (pay: boolean) => records.filter(record => payable(record) === pay).reduce((sum, record) => sum + outstanding(record), 0);
  const incoming = centsToMoney(ledger.filter(item => moneyToCents(item.signedValue) > 0).reduce((sum, item) => sum + moneyToCents(item.signedValue), 0));
  const outgoing = centsToMoney(ledger.filter(item => moneyToCents(item.signedValue) < 0).reduce((sum, item) => sum - moneyToCents(item.signedValue), 0));
  const balance = accounts.reduce((sum, account) => sum + financialAccountBalance(account.id, ledger), 0);
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const dueTodayTotal = records.filter(record => !/cancelad/i.test(record.status || "") && outstanding(record) > 0 && String(record.dueDate || record.date || "").slice(0,10) === today).reduce((sum,record) => sum + outstanding(record),0);
  const expectedRevenue = centsToMoney(records.filter(record=>!payable(record) && !/cancelad/i.test(record.status || "")).reduce((sum,record)=>sum+moneyToCents(record.value),0));
  const expectedExpense = centsToMoney(records.filter(record=>payable(record) && !/cancelad/i.test(record.status || "")).reduce((sum,record)=>sum+moneyToCents(record.value),0));
  const overdueReceivables = records.filter(record=>!payable(record) && outstanding(record)>0 && String(record.dueDate || record.date || "") < today).reduce((sum,record)=>sum+outstanding(record),0);
  const aging = [
    {label:"Vencido até 7 dias",min:0,max:7},
    {label:"Vencido 8–30 dias",min:8,max:30},
    {label:"Vencido acima de 30 dias",min:31,max:Number.POSITIVE_INFINITY},
  ].map(bucket=>({label:bucket.label,value:records.filter(record=>{
    if(payable(record)||outstanding(record)<=0)return false;
    const due=String(record.dueDate||record.date||"");
    if(!due||due>=today)return false;
    const days=Math.floor((new Date(today+"T12:00:00").getTime()-new Date(due+"T12:00:00").getTime())/86400000);
    return days>=bucket.min&&days<=bucket.max;
  }).reduce((sum,record)=>sum+outstanding(record),0)}));
  const forecastItems = records.filter(record=>!/cancelad/i.test(record.status || "") && outstanding(record)>0).map(record=>({id:String(record.id),date:String(record.dueDate||record.date||today).slice(0,10),amount:outstanding(record),direction:(payable(record)?"out":"in") as "in"|"out",status:"confirmed" as const,source:String(record.originKey||record.id)}));
  const forecast = cashFlowForecast(forecastItems,today);
  const profitability=useMemo(()=>profitabilityPortfolio([...(modules["Ordens de serviço"]||[]),...(modules.Obras||[]),...(modules.Vendas||[])]),[modules]);
  const kpis: [string, number, LucideIcon, string][] = [
    ["A RECEBER", openTotal(false), ArrowDownLeft, "receivable"],
    ["VENCE HOJE", dueTodayTotal, Clock3, "due-today"],
    ["A PAGAR", openTotal(true), ArrowUpRight, "payable"],
    ["ENTRADAS NO RAZÃO", incoming, TrendingUp, "income"],
    ["SALDO DAS CONTAS", balance, Landmark, "balance"],
  ];
  const tabs: [string, LucideIcon][] = [
    ["Títulos", ReceiptText], ["Fluxo de caixa", LineChart], ["Gestão", TrendingUp],
    ["Contas e razão", Landmark], ["Auditoria", ShieldCheck],
  ];
  const open = (action: string, record?: ErpRecord) => {
    setNotice(""); setModal({ action, record });
    const initial = { principal: record ? outstanding(record) : 0, interest: 0, discount: 0, method: "Pix", accountId: accounts.find(item => item.status === "Ativo")?.id || "BANK", paymentDate: new Date().toISOString().slice(0, 10), competenceDate: record?.competenceDate || record?.date || new Date().toISOString().slice(0, 10), dueDate: record?.dueDate || record?.date || new Date().toISOString().slice(0, 10), reason: "", openingBalance: 0, type: "Banco" };
    setData(initial); initialModalData.current=JSON.stringify(initial);
  };
  const closeModal = () => {
    if(saving)return;
    if(modal && JSON.stringify(data)!==initialModalData.current && !window.confirm("Você tem dados não salvos. Deseja realmente fechar sem salvar?"))return;
    setModal(null);
  };
  const submit = async () => {
    if (!modal || saving) return;
    setSaving(true);
    try {
      if (modal.action === "invoice") {
        if (!String(data.invoiceNumber || "").trim()) throw new Error("Informe o número da NF.");
        if (!await onIssueInvoice(modal.record!, data.invoiceNumber.trim())) throw new Error("Não foi possível confirmar o faturamento.");
      } else {
        await onOperation({ idempotencyKey: crypto.randomUUID(), action: modal.action, recordId: modal.record?.id, expectedRecord: modal.record, data });
      }
      const amount=centsToMoney(moneyToCents(data.principal)+moneyToCents(data.interest)-moneyToCents(data.discount));
      const feedback = modal.action==="settle"
        ? {title:"Baixa confirmada",message:`Baixa de ${money(amount)} confirmada com sucesso.`,tone:"success" as const,actions:modal.record?[{label:"Ver histórico",onClick:()=>setModal({action:"history",record:modal.record})}]:undefined}
        : modal.action==="reverse"
          ? {title:"Estorno registrado",message:"Pagamento estornado com sucesso. Saldo recalculado.",tone:"success" as const}
          : modal.action==="dates"
            ? {title:"Vencimento atualizado",message:"Datas e competência foram atualizadas com sucesso.",tone:"change" as const}
            : modal.action==="invoice"
              ? {title:"Faturamento atualizado",message:"Documento fiscal associado ao título.",tone:"change" as const}
              : {title:"Operação confirmada",message:"Alteração registrada com sucesso no banco e na auditoria.",tone:"success" as const};
      notifyFeedback(feedback);
      setModal(null); setNotice("");
    } catch (error) { const message=error instanceof Error ? error.message : "Operação não confirmada."; setNotice(message); notifyFeedback({title:"Operação não confirmada",message,tone:"error"}); }
    finally { setSaving(false); }
  };
  const field = (key: string, value: string | number) => setData(current => ({ ...current, [key]: value }));
  return <section className="module-page financial-module">
    <div className="management-hero"><div><span className="section-kicker"><WalletCards size={12}/> CONTROLE FINANCEIRO</span><h2>Financeiro e fluxo de caixa</h2><p>Baixas, estornos, contas e documentos com rastreabilidade.</p></div><div className="management-actions"><button className="outline-btn" onClick={() => window.print()}><FileText size={14}/> Relatório</button><button className="primary-btn" onClick={() => onOpen("Novo registro • Financeiro")}><Plus size={15}/> Novo lançamento</button></div></div>
    {notice && <div className="public-contract-message" role="status">{notice}</div>}
    <div className="finance-kpis finance-kpis-remodeled">{kpis.map(([label,total,Icon,tone]) => <article key={String(label)} className={`finance-kpi ${tone}`}><div><small>{label}</small><strong>{money(Number(total))}</strong><span>{label === "VENCE HOJE" ? "Contas a pagar e receber vencem hoje" : ledger.length ? "Movimentações registradas" : "Razão disponível após a primeira operação confirmada"}</span></div><i><Icon size={20}/></i></article>)}</div>
    <div className="finance-navigation"><nav className="management-tabs finance-main-tabs">{tabs.map(([tab,Icon]) => <button key={String(tab)} className={view === tab ? "active" : ""} onClick={() => setView(String(tab))}><Icon size={15}/>{String(tab)}</button>)}</nav>{view === "Títulos" && <div className="finance-filter-tools"><nav className="management-tabs finance-sub-tabs">{["Todos","Recebimentos","Pagamentos"].map(tab => <button key={tab} className={filter === tab ? "active" : ""} onClick={() => setFilter(tab)}>{tab}</button>)}</nav><label className="finance-search"><Search size={14}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filtrar por NF, cliente, origem..." /></label></div>}</div>
    {view === "Títulos" && <><div className="panel finance-titles-panel"><div className="w-full overflow-x-auto min-w-0 table-wrap finance-titles-wrap"><table className="finance-titles-table"><thead><tr><th>DESCRIÇÃO / ORIGEM</th><th>TIPO</th><th>COMPETÊNCIA</th><th>VENCIMENTO</th><th>VALOR</th><th>LIQUIDADO / RESTANTE</th><th>SITUAÇÃO</th><th>AÇÕES</th></tr></thead><tbody>{visible.map(record => <tr key={record.id}><td><strong>{record.name}</strong><small className="table-description">{record.client} {record.invoiceNumber ? `• NF ${record.invoiceNumber}` : ""}</small><small className="finance-origin-label">{financialOriginLabel(record)}</small></td><td>{payable(record) ? "A pagar" : "A receber"}</td><td>{formatBrazilDate(record.competenceDate || record.date)}</td><td>{formatBrazilDate(record.dueDate || record.date)}</td><td>{money(record.value)}</td><td><div className="finance-settlement-values"><span><small>Liquidado</small><strong>{money(record.settledValue)}</strong></span><span><small>Restante</small><strong>{money(outstanding(record))}</strong></span></div></td><td>{record.status || "Em aberto"}</td><td><div className="finance-row-actions">
          {record.status === "Pronto para faturar" ? <button type="button" className="settle-button" onClick={() => open("invoice",record)}>Emitir NF</button> : outstanding(record) > 0 ? <button type="button" className="settle-button" onClick={() => open("settle",record)}>Dar baixa</button> : <span className="finance-settled-label">Quitado</span>}
          <details className="finance-row-menu"><summary aria-label={`Mais ações para o título ${record.name}`} title="Mais ações"><span aria-hidden="true">⋯</span></summary><div className="finance-row-menu__items">
          <button type="button" onClick={event=>{open("history",record);event.currentTarget.closest("details")?.removeAttribute("open");}}>Histórico de estorno</button>
          <button type="button" onClick={event=>{open("dates",record);event.currentTarget.closest("details")?.removeAttribute("open");}}>Prorrogar vencimento</button>
          {!/cancelad/i.test(record.status || "") && <button type="button" onClick={event=>{open("cancel",record);event.currentTarget.closest("details")?.removeAttribute("open");}}>Cancelar título</button>}
        </div></details></div></td></tr>)}</tbody></table></div>{!visible.length && <p className="linked-empty">Nenhum título neste filtro.</p>}</div></>}
    {view === "Fluxo de caixa" && <div className="panel erp-card"><h3>Previsto e realizado</h3><div className="finance-kpis finance-kpis-remodeled">{forecast.map(item=><article className="finance-kpi balance" key={item.days}><div><small>PROJEÇÃO {item.days} DIAS</small><strong>{money(item.total)}</strong><span>Entradas menos saídas em aberto</span></div></article>)}</div>{[["Receitas previstas",openTotal(false)],["Despesas previstas",openTotal(true)],["Entradas efetivas",incoming],["Saídas efetivas",outgoing],["Saldo realizado",balance]].map(([label,value]) => <div className="erp-balance-row" key={String(label)}><span>{label}</span><strong>{money(Number(value))}</strong></div>)}<p>Estornos aparecem como movimentos compensatórios. Saldos legados permanecem identificados no razão.</p></div>}
    {view === "Gestão" && <div className="finance-management-grid">
      <article className="panel erp-card"><h3>DRE gerencial simplificada</h3><div className="erp-balance-row"><span>Receitas lançadas</span><strong>{money(expectedRevenue)}</strong></div><div className="erp-balance-row"><span>Despesas lançadas</span><strong>{money(expectedExpense)}</strong></div><div className="erp-balance-row"><span>Resultado previsto</span><strong>{money(expectedRevenue-expectedExpense)}</strong></div><div className="erp-balance-row"><span>Resultado realizado no razão</span><strong>{money(incoming-outgoing)}</strong></div><p>Visão gerencial baseada exclusivamente nos títulos e movimentos registrados no ProAR.</p></article>
      <article className="panel erp-card"><h3>Rentabilidade real</h3><div className="erp-balance-row"><span>Receita operacional</span><strong>{money(profitability.revenue)}</strong></div><div className="erp-balance-row"><span>Custos identificados</span><strong>{money(profitability.totalCost)}</strong></div><div className="erp-balance-row"><span>Resultado operacional</span><strong>{money(profitability.profit)}</strong></div><div className="erp-balance-row"><span>Margem real</span><strong>{profitability.margin.toLocaleString("pt-BR",{maximumFractionDigits:1})}%</strong></div><p>Considera os custos registrados nas OS, obras e vendas. Campos ainda não informados permanecem zerados e não são estimados.</p></article>
      <article className="panel erp-card"><h3>Inadimplência</h3><div className="erp-balance-row"><span>Total vencido a receber</span><strong>{money(overdueReceivables)}</strong></div>{aging.map(item=><div className="erp-balance-row" key={item.label}><span>{item.label}</span><strong>{money(item.value)}</strong></div>)}</article>
    </div>}
    {view === "Contas e razão" && <><div className="panel erp-card"><div className="panel-head"><h3>Contas financeiras</h3><button className="primary-btn" onClick={() => open("account")}>Nova conta</button></div>{accounts.map(account => <div className="erp-balance-row" key={account.id}><span>{account.name} • {account.type}</span><strong>{money(financialAccountBalance(account.id,ledger))}</strong></div>)}</div><div className="panel"><div className="w-full overflow-x-auto min-w-0 table-wrap"><table><thead><tr><th>DATA</th><th>CONTA</th><th>MOVIMENTO</th><th>ORIGEM</th><th>VALOR</th><th>USUÁRIO</th><th>CONCILIAÇÃO</th></tr></thead><tbody>{[...ledger].reverse().map(item => <tr key={item.id}><td>{item.paymentDate || item.createdAt?.slice(0,10)}</td><td>{accounts.find(account => account.id === item.accountId)?.name}</td><td>{item.name}<small className="table-description">{item.reason}</small></td><td>{item.titleId || "Abertura"}</td><td>{money(item.signedValue)}</td><td>{item.user}</td><td>{reconciliations.some(record => record.movementId === item.id) ? reconciliations.find(record => record.movementId === item.id)?.reference : <button className="outline-btn" onClick={() => { open("reconcile"); setData({ movementId:item.id, accountId:item.accountId, reference:"", date:new Date().toISOString().slice(0,10) }); }}>Conciliar</button>}</td></tr>)}</tbody></table></div></div></>}
    {view === "Auditoria" && <div className="panel"><div className="w-full overflow-x-auto min-w-0 table-wrap"><table><thead><tr><th>DATA</th><th>USUÁRIO</th><th>REGISTRO</th><th>MOTIVO</th><th>ALTERAÇÕES</th></tr></thead><tbody>{[...(modules["Auditoria operacional"] || [])].reverse().filter(item => ["Financeiro","Contas financeiras","Conciliações"].includes(item.module)).map(item => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td><td>{item.displayName || item.user}</td><td>{item.module} • {item.recordId}</td><td>{item.reason}</td><td><details><summary>Valores anteriores e novos</summary><pre className="erp-audit-data">{JSON.stringify(item.changes,null,2)}</pre></details></td></tr>)}</tbody></table></div></div>}
    {modal && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Operação financeira"><button className="modal-backdrop" disabled={saving} onClick={closeModal} aria-label="Fechar"/><div className="modal settlement-modal"><div className="modal-head"><div><span>FINANCEIRO • HISTÓRICO PRESERVADO</span><h2>{modal.record?.name || "Conta / conciliação"}</h2></div><button disabled={saving} onClick={closeModal} aria-label="Fechar"><X size={18}/></button></div><div className="settlement-form">
      {modal.action === "settle" && <>{[["principal","Principal liquidado"],["interest","Juros / multa"],["discount","Desconto"]].map(([key,label]) => <label key={key}>{label}<CurrencyInput aria-label={label} value={Number(data[key] || 0)} onValueChange={value => field(key,value)}/></label>)}<label>Data de pagamento<input type="date" value={data.paymentDate} onChange={event => field("paymentDate",event.target.value)}/></label><label>Forma<select value={data.method} onChange={event => field("method",event.target.value)}>{["Pix","Boleto","Cartão de crédito","Cartão de débito","Dinheiro","Transferência"].map(value => <option key={value}>{value}</option>)}</select></label><label>Conta<select value={data.accountId} onChange={event => field("accountId",event.target.value)}>{accounts.filter(item => item.status === "Ativo").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="settlement-total"><span>VALOR EFETIVO EM CAIXA</span><strong>{money(centsToMoney(moneyToCents(data.principal)+moneyToCents(data.interest)-moneyToCents(data.discount)))}</strong></div></>}
      {modal.action === "history" && <div className="erp-history">{(modal.record?.settlementHistory || []).map((entry: ErpRecord) => { const reversed = (modal.record?.reversalHistory || []).find((item: ErpRecord) => item.settlementId === entry.id); return <article key={entry.id}><b>{money(entry.value)} • {entry.method}</b><p>{entry.createdAt} • {entry.user || "Legado"}</p><p>Principal: {money(entry.principal ?? entry.value)} • Juros: {money(entry.interest)} • Desconto: {money(entry.discount)}</p>{reversed ? <small>Estornada: {reversed.reason} • {reversed.user}</small> : <button className="outline-btn" onClick={() => { setModal({action:"reverse",record:modal.record}); setData({settlementId:entry.id,reason:""}); }}>Estornar esta baixa</button>}</article>; })}{Number(modal.record?._settlementOpening || (!modal.record?.settlementHistory?.length ? modal.record?.settledValue : 0)) > 0 && !(modal.record?.reversalHistory || []).some((item:ErpRecord) => item.settlementId === `LEGACY-${modal.record?.id}`) && <article><b>Saldo legado: {money(modal.record?._settlementOpening ?? modal.record?.settledValue)}</b><p>Baixa anterior à implantação do razão.</p><button className="outline-btn" onClick={() => {setModal({action:"reverse",record:modal.record});setData({settlementId:`LEGACY-${modal.record?.id}`,reason:""});}}>Estornar saldo legado</button></article>}{!modal.record?.settlementHistory?.length && <p>Não há baixas detalhadas. Saldos legados ficam identificados no razão e não podem ser apagados por edição.</p>}</div>}
      {["reverse","cancel"].includes(modal.action) && <label>Motivo obrigatório<textarea required value={data.reason || ""} onChange={event => field("reason",event.target.value)}/></label>}
      {modal.action === "dates" && <><label>Competência<input type="date" value={data.competenceDate} onChange={event => field("competenceDate",event.target.value)}/></label><label>Vencimento<input type="date" value={data.dueDate} onChange={event => field("dueDate",event.target.value)}/></label><label>Motivo<input value={data.reason} onChange={event => field("reason",event.target.value)}/></label></>}
      {modal.action === "invoice" && <label>Número da Nota Fiscal<input value={data.invoiceNumber || ""} onChange={event => field("invoiceNumber",event.target.value)}/></label>}
      {modal.action === "account" && <><label>Nome<input value={data.name || ""} onChange={event => field("name",event.target.value)}/></label><label>Tipo<select value={data.type} onChange={event => field("type",event.target.value)}>{["Caixa","Banco","Pix","Cartão"].map(value => <option key={value}>{value}</option>)}</select></label><label>Saldo inicial<CurrencyInput aria-label="Saldo inicial" value={Number(data.openingBalance || 0)} onValueChange={value => field("openingBalance",value)}/></label></>}
      {modal.action === "reconcile" && <><label>Referência no extrato<input value={data.reference || ""} onChange={event => field("reference",event.target.value)}/></label><label>Data da conciliação<input type="date" value={data.date} onChange={event => field("date",event.target.value)}/></label></>}
    </div>{notice && <p className="erp-card" role="alert">{notice}</p>}<div className="modal-actions"><button className="outline-btn" disabled={saving} onClick={closeModal}>Fechar</button>{modal.action !== "history" && <button className="primary-btn" disabled={saving} onClick={() => void submit()}><CheckCircle2 size={15}/>{saving ? "Confirmando..." : "Confirmar no banco"}</button>}</div></div></div>"}</button>}</div></div></div>}
  </section>;
}
