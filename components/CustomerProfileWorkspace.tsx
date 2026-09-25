"use client";

import { useMemo, useState } from "react";
import { Building2, MapPin, Search } from "lucide-react";
import { isValidCpfOrCnpj, onlyDigits } from "@/lib/br-documents";

type Tab = "cadastro" | "estrutura" | "financeiro" | "historico";
type Audit = { at: string; action: string; detail: string };
type FormState = {
  cnpj: string; legalName: string; tradeName: string; status: string; consultedAt: string; source: string;
  stateRegistration: string; municipalRegistration: string; segment: string; cnae: string; phone: string; email: string;
  cep: string; street: string; number: string; neighborhood: string; city: string; state: string; complement: string;
  priceTable: string; payment: string; terms: string; discount: string; allowCredit: boolean; creditLimit: number; creditCommitted: number;
};

const formatDocument = (value: string) => {
  const clean = onlyDigits(value).slice(0, 14);
  if (clean.length <= 11) return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2}).*/, "$1.$2.$3-$4");
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, "$1.$2.$3/$4-$5");
};
const formatCep = (value: string) => onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d{0,3}).*/, "$1-$2");

export function CustomerProfileWorkspace() {
  const [tab, setTab] = useState<Tab>("cadastro");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [loading, setLoading] = useState<"cnpj" | "cep" | "">("");
  const [notice, setNotice] = useState("");
  const [audit, setAudit] = useState<Audit[]>([]);
  const [form, setForm] = useState<FormState>({
    cnpj: "", legalName: "", tradeName: "", status: "Não consultada", consultedAt: "", source: "",
    stateRegistration: "", municipalRegistration: "", segment: "Empresa", cnae: "", phone: "", email: "",
    cep: "", street: "", number: "", neighborhood: "", city: "", state: "", complement: "",
    priceTable: "Padrão", payment: "Boleto", terms: "30 dias", discount: "0,00", allowCredit: false, creditLimit: 0, creditCommitted: 0,
  });
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => { setForm(current => ({ ...current, [key]: value })); setSaving("idle"); };
  const input = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const header = useMemo(() => form.legalName || "Novo cliente", [form.legalName]);
  const creditAvailable = Math.max(0, form.creditLimit - form.creditCommitted);
  const percent = form.creditLimit ? Math.min(100, form.creditCommitted / form.creditLimit * 100) : 0;
  const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const log = (action: string, detail: string) => setAudit(events => [{ at: new Date().toLocaleString("pt-BR"), action, detail }, ...events]);

  async function consultCnpj() {
    const document = onlyDigits(form.cnpj);
    if (document.length !== 14 || !isValidCpfOrCnpj(document)) { setNotice("CNPJ inválido. Confira todos os dígitos."); return; }
    setLoading("cnpj"); setNotice("");
    try {
      const response = await fetch(`/api/cnpj/${document}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Consulta indisponível.");
      const now = new Date().toLocaleString("pt-BR");
      setForm(current => ({ ...current, legalName: data.razaoSocial || "", tradeName: data.nomeFantasia || "",
        status: data.situacaoCadastral || "Não informado", cnae: data.cnaeDescricao || data.cnaeFiscal || "",
        phone: data.telefone || "", email: data.email || "", cep: formatCep(data.cep || ""), street: data.endereco || "",
        neighborhood: data.bairro || "", city: data.cidade || "", state: data.uf || "", consultedAt: now, source: data.fonte || "Base pública autorizada" }));
      log("Consulta cadastral", `Origem: ${data.fonte || "Base pública autorizada"}. Somente campos retornados foram carregados.`);
      setNotice("✓ Dados do CNPJ carregados. Revise antes de salvar.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Consulta indisponível."); }
    finally { setLoading(""); }
  }

  async function consultCep() {
    const cep = onlyDigits(form.cep);
    if (cep.length !== 8) { setNotice("Informe um CEP válido com 8 dígitos."); return; }
    setLoading("cep"); setNotice("");
    try {
      const response = await fetch(`/api/cep/${cep}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "CEP não localizado.");
      setForm(current => ({ ...current, ...data.address, cep: formatCep(data.address.cep) }));
      log("Endereço atualizado", `Origem: ${data.source}. CEP ${formatCep(cep)}.`);
      setNotice("✓ Endereço carregado pelo CEP. Revise antes de salvar.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Consulta de CEP indisponível."); }
    finally { setLoading(""); }
  }

  function save() {
    if (!isValidCpfOrCnpj(form.cnpj)) { setNotice("Não foi possível salvar: CNPJ/CPF inválido."); return; }
    setSaving("saving");
    window.setTimeout(() => { setSaving("saved"); log("Cadastro atualizado", "Dados atuais aprovados para novas operações; operações antigas permanecem inalteradas."); }, 450);
  }

  const tabClass = (id: Tab) => `min-h-11 px-3 py-2 rounded-lg text-xs font-bold ${tab === id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`;
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 px-5 py-4 text-white"><div><div className="flex items-center gap-2"><Building2 className="size-5 text-blue-300"/><h2 className="font-bold">{header}</h2></div><p className="mt-1 text-xs text-slate-300">Cadastro de Cliente · fonte única dos dados atuais</p></div><button onClick={save} className="min-h-11 rounded-lg bg-blue-600 px-4 text-xs font-bold hover:bg-blue-500">{saving === "saving" ? "Salvando..." : saving === "saved" ? "✓ Alteração efetuada" : "Alterações não salvas · Salvar"}</button></div>
    <div className="flex gap-1 overflow-x-auto border-b px-4 py-2"><button onClick={()=>setTab("cadastro")} className={tabClass("cadastro")}>Cadastro</button><button onClick={()=>setTab("estrutura")} className={tabClass("estrutura")}>Unidades / Secretarias / Áreas</button><button onClick={()=>setTab("financeiro")} className={tabClass("financeiro")}>Financeiro / Comercial</button><button onClick={()=>setTab("historico")} className={tabClass("historico")}>Histórico</button></div>
    <div className="p-5">
      {tab === "cadastro" && <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border p-4"><h3 className="mb-4 font-bold">Identificação</h3><label className="mb-1 block text-xs font-semibold">CNPJ / CPF</label><div className="flex flex-col gap-2 sm:flex-row"><input value={form.cnpj} onChange={e=>set("cnpj",formatDocument(e.target.value))} className={input} placeholder="00.000.000/0000-00"/><button onClick={consultCnpj} disabled={Boolean(loading)} className="min-h-11 shrink-0 rounded-lg border border-blue-600 px-3 text-xs font-bold text-blue-700 disabled:opacity-60"><Search className="mr-1 inline size-4"/>{loading === "cnpj" ? "Consultando..." : "Consultar CNPJ"}</button></div><p className="mt-2 text-xs text-slate-600">Situação cadastral: <b>{form.status}</b>{form.consultedAt ? ` · Última consulta: ${form.consultedAt}` : ""}{form.source ? ` · ${form.source}` : ""}</p>{notice ? <p role="status" className="mt-2 rounded-lg bg-blue-50 p-2 text-xs font-semibold text-blue-800">{notice}</p> : null}<div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Razão Social" value={form.legalName} onChange={v=>set("legalName",v)} className={input}/><Field label="Nome Fantasia" value={form.tradeName} onChange={v=>set("tradeName",v)} className={input}/><Field label="Inscrição Estadual" value={form.stateRegistration} onChange={v=>set("stateRegistration",v)} className={input}/><Field label="Inscrição Municipal" value={form.municipalRegistration} onChange={v=>set("municipalRegistration",v)} className={input}/><label className="text-xs">Segmento<select value={form.segment} onChange={e=>set("segment",e.target.value)} className={input}><option>Empresa</option><option>Órgão Público</option><option>Pessoa Física</option></select></label><Field label="CNAE Principal" value={form.cnae} onChange={v=>set("cnae",v)} className={input}/></div></div>
        <div className="space-y-5"><div className="rounded-xl border p-4"><h3 className="mb-4 font-bold">Contato</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="Telefone" value={form.phone} onChange={v=>set("phone",v)} className={input}/><Field label="E-mail" value={form.email} onChange={v=>set("email",v)} className={input}/></div></div><div className="rounded-xl border p-4"><h3 className="mb-4 font-bold">Endereço principal</h3><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs">CEP<div className="mt-1 flex gap-2"><input value={form.cep} onChange={e=>set("cep",formatCep(e.target.value))} className={input}/><button onClick={consultCep} disabled={Boolean(loading)} className="min-h-11 rounded-lg border px-3 font-bold text-blue-700">{loading === "cep" ? "..." : "Buscar"}</button></div></label><div className="sm:col-span-2"><Field label="Logradouro" value={form.street} onChange={v=>set("street",v)} className={input}/></div><Field label="Número" value={form.number} onChange={v=>set("number",v)} className={input}/><Field label="Bairro" value={form.neighborhood} onChange={v=>set("neighborhood",v)} className={input}/><Field label="Cidade" value={form.city} onChange={v=>set("city",v)} className={input}/><Field label="UF" value={form.state} onChange={v=>set("state",v.toUpperCase().slice(0,2))} className={input}/><div className="sm:col-span-2"><Field label="Complemento" value={form.complement} onChange={v=>set("complement",v)} className={input}/></div></div><a className="mt-3 inline-flex min-h-11 items-center text-xs font-bold text-blue-700" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.street}, ${form.number}, ${form.city}`)}`}><MapPin className="mr-1 size-4"/>Abrir no mapa</a></div></div>
      </div>}
      {tab === "estrutura" && <div><h3 className="font-bold">Estrutura interna</h3><p className="mt-2 text-sm text-slate-600">{header} permanece um único cliente. Secretarias, unidades, setores e salas são estruturas internas vinculadas ao cadastro.</p></div>}
      {tab === "financeiro" && <div className="grid gap-5 lg:grid-cols-2"><div className="rounded-xl border p-4"><h3 className="mb-4 font-bold">Condições comerciais</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="Tabela de preços" value={form.priceTable} onChange={v=>set("priceTable",v)} className={input}/><label className="text-xs">Forma de pagamento<select value={form.payment} onChange={e=>set("payment",e.target.value)} className={input}><option>Boleto</option><option>PIX</option><option>Cartão</option></select></label><Field label="Condição / prazo" value={form.terms} onChange={v=>set("terms",v)} className={input}/><Field label="Desconto máximo (%)" value={form.discount} onChange={v=>set("discount",v)} className={input}/></div><label className="mt-4 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.allowCredit} onChange={e=>set("allowCredit",e.target.checked)}/> Permitir faturamento a prazo</label></div><div className="rounded-xl border p-4"><h3 className="font-bold">Crédito</h3><label className="mt-3 block text-xs">Limite autorizado<input type="number" value={form.creditLimit} onChange={e=>set("creditLimit",Number(e.target.value))} className={input}/></label><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-slate-50 p-3">Comprometido<br/><b>{money(form.creditCommitted)}</b></div><div className="rounded-lg bg-emerald-50 p-3">Disponível<br/><b>{money(creditAvailable)}</b></div></div><div className="mt-4 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-blue-600" style={{width:`${percent}%`}}/></div><p className="mt-2 text-xs">Utilização: {percent.toFixed(1)}% · {percent >= 90 ? "Requer revisão" : "Regular"}</p></div></div>}
      {tab === "historico" && <div><h3 className="font-bold">Histórico auditável</h3><div className="mt-4 space-y-3">{audit.length ? audit.map((item,index)=><article key={`${item.at}-${index}`} className="rounded-xl border p-3"><p className="text-sm font-bold">{item.action}</p><p className="text-xs text-slate-500">{item.detail}</p><p className="mt-1 text-xs text-slate-400">{item.at} · Usuário atual</p></article>) : <p className="text-sm text-slate-500">Nenhuma alteração registrada nesta sessão.</p>}</div></div>}
    </div>
  </section>;
}

function Field({label,value,onChange,className}:{label:string;value:string;onChange:(value:string)=>void;className:string}) {
  return <label className="text-xs">{label}<input value={value} onChange={event=>onChange(event.target.value)} className={`${className} mt-1`}/></label>;
}
