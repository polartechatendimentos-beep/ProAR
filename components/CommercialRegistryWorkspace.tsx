"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Building2, Package, Plus, Search, Sparkles, Wrench } from "lucide-react";

type Tab = "customers" | "products" | "services";
type Customer = { id: number; tipoPessoa: string; nome: string; nomeFantasia: string | null; documento: string | null; email: string | null; telefone: string | null; whatsapp: string | null; cep: string | null; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; observacoes: string | null; ativo: boolean };
type CatalogItem = { id: number; codigo: string; codigoBarras: string | null; descricao: string; tipo: string; unidade: string; ncm: string | null; custo: string; precoVenda: string; estoqueAtual: string; estoqueMinimo: string; ativo: boolean };
type CustomerForm = { tipoPessoa: string; nome: string; nomeFantasia: string; documento: string; email: string; telefone: string; whatsapp: string; cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string; observacoes: string };
type CatalogForm = { codigo: string; codigoBarras: string; descricao: string; unidade: string; ncm: string; custo: string; precoVenda: string; estoqueAtual: string; estoqueMinimo: string };

const blankCustomer: CustomerForm = { tipoPessoa: "PJ", nome: "", nomeFantasia: "", documento: "", email: "", telefone: "", whatsapp: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", observacoes: "" };
const blankCatalog: CatalogForm = { codigo: "", codigoBarras: "", descricao: "", unidade: "UN", ncm: "", custo: "0", precoVenda: "0", estoqueAtual: "0", estoqueMinimo: "0" };
const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500";
const money = (value: string | number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const digits = (value: string) => value.replace(/\D/g, "");
const formatDocument = (value: string) => {
  const valueDigits = digits(value).slice(0, 14);
  if (valueDigits.length <= 11) return valueDigits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
  return valueDigits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export function CommercialRegistryWorkspace() {
  const [tab, setTab] = useState<Tab>("customers");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [query, setQuery] = useState("");
  const [customerForm, setCustomerForm] = useState<CustomerForm>(blankCustomer);
  const [catalogForm, setCatalogForm] = useState<CatalogForm>(blankCatalog);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [assistantText, setAssistantText] = useState("");
  const [suggestions, setSuggestions] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (selectedTab: Tab) => {
    setLoading(true);
    try {
      const response = await fetch(selectedTab === "customers" ? "/api/customers" : "/api/products", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Não foi possível carregar os cadastros.");
      if (selectedTab === "customers") setCustomers(payload.data);
      else setCatalog(payload.data);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao carregar os cadastros."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(tab); }, [tab, refresh]);
  const filteredCustomers = useMemo(() => customers.filter((row) => `${row.nome} ${row.nomeFantasia || ""} ${row.documento || ""}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [customers, query]);
  const filteredCatalog = useMemo(() => catalog.filter((row) => row.tipo === (tab === "products" ? "PRODUTO" : "SERVICO") && `${row.codigo} ${row.descricao} ${row.ncm || ""}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [catalog, query, tab]);

  const resetForm = () => { setEditingId(null); setCustomerForm(blankCustomer); setCatalogForm(blankCatalog); setSuggestions(null); setAssistantText(""); setNotice(""); };
  const editCustomer = (row: Customer) => {
    setEditingId(row.id);
    setCustomerForm({ tipoPessoa: row.tipoPessoa || "PJ", nome: row.nome, nomeFantasia: row.nomeFantasia || "", documento: formatDocument(row.documento || ""), email: row.email || "", telefone: row.telefone || "", whatsapp: row.whatsapp || "", cep: row.cep || "", logradouro: row.logradouro || "", numero: row.numero || "", complemento: row.complemento || "", bairro: row.bairro || "", cidade: row.cidade || "", uf: row.uf || "", observacoes: row.observacoes || "" });
    setSuggestions(null); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const editCatalog = (row: CatalogItem) => {
    setEditingId(row.id);
    setCatalogForm({ codigo: row.codigo, codigoBarras: row.codigoBarras || "", descricao: row.descricao, unidade: row.unidade || "UN", ncm: row.ncm || "", custo: row.custo || "0", precoVenda: row.precoVenda || "0", estoqueAtual: row.estoqueAtual || "0", estoqueMinimo: row.estoqueMinimo || "0" });
    setSuggestions(null); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const setCustomer = (key: keyof CustomerForm, value: string) => setCustomerForm((current) => ({ ...current, [key]: value }));
  const setCatalogField = (key: keyof CatalogForm, value: string) => setCatalogForm((current) => ({ ...current, [key]: value }));

  const askAssistant = async () => {
    if (assistantText.trim().length < 5) { setNotice("Descreva o cadastro que deseja preparar."); return; }
    setAssistantLoading(true); setNotice(""); setSuggestions(null);
    try {
      const entity = tab === "customers" ? "customer" : tab === "products" ? "product" : "service";
      const current = tab === "customers" ? customerForm : catalogForm;
      const response = await fetch("/api/commercial-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, prompt: assistantText, current }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Não foi possível gerar sugestões.");
      setSuggestions(payload.suggestions); setNotice("Sugestões prontas. Confira os dados antes de aplicar.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível gerar sugestões."); }
    finally { setAssistantLoading(false); }
  };
  const lookupCnpj = async () => {
    const document = digits(customerForm.documento);
    if (document.length !== 14) { setNotice("Informe um CNPJ com 14 números para consultar."); return; }
    setCnpjLoading(true); setNotice("");
    try {
      const response = await fetch(`/api/cnpj/${document}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Não foi possível consultar o CNPJ.");
      setCustomerForm((current) => ({
        ...current,
        tipoPessoa: "PJ",
        nome: current.nome || payload.razaoSocial || "",
        nomeFantasia: current.nomeFantasia || payload.nomeFantasia || "",
        documento: formatDocument(payload.cnpj || document),
        email: current.email || payload.email || "",
        telefone: current.telefone || payload.telefone || "",
        cep: current.cep || payload.cep || "",
        logradouro: current.logradouro || payload.logradouro || payload.endereco || "",
        numero: current.numero || payload.numero || "",
        bairro: current.bairro || payload.bairro || "",
        cidade: current.cidade || payload.cidade || "",
        uf: current.uf || payload.uf || "",
      }));
      setNotice(`Dados da ${payload.fonte || "consulta pública"} preenchidos nos campos vazios. Revise antes de salvar.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível consultar o CNPJ."); }
    finally { setCnpjLoading(false); }
  };
  const applySuggestions = () => {
    if (!suggestions) return;
    const nonEmpty = Object.fromEntries(Object.entries(suggestions).filter(([, value]) => value.trim()));
    if (tab === "customers") setCustomerForm((current) => ({ ...current, ...nonEmpty }));
    else setCatalogForm((current) => ({ ...current, ...nonEmpty }));
    setNotice("Sugestões aplicadas ao formulário. Revise e salve quando estiver pronto.");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setNotice("");
    const isCustomer = tab === "customers";
    const endpoint = isCustomer ? "/api/customers" : "/api/products";
    const body = isCustomer ? customerForm : { ...catalogForm, tipo: tab === "products" ? "PRODUTO" : "SERVICO", unidade: catalogForm.unidade || (tab === "services" ? "SV" : "UN") };
    try {
      const response = await fetch(endpoint, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingId ? { ...body, id: editingId } : body) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Não foi possível salvar o cadastro.");
      setEditingId(null); setCustomerForm(blankCustomer); setCatalogForm(blankCatalog); setSuggestions(null); setAssistantText("");
      setNotice(isCustomer ? "Cliente salvo." : tab === "products" ? "Produto salvo." : "Serviço salvo."); await refresh(tab);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível salvar o cadastro."); }
    finally { setSaving(false); }
  };

  const tabs: { id: Tab; label: string; icon: typeof Building2 }[] = [{ id: "customers", label: "Clientes", icon: Building2 }, { id: "products", label: "Produtos", icon: Package }, { id: "services", label: "Serviços", icon: Wrench }];
  const entityName = tab === "customers" ? "cliente" : tab === "products" ? "produto" : "serviço";

  return <section className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Cadastros comerciais</p><h1 className="mt-1 text-2xl font-black text-slate-900">Clientes, produtos e serviços</h1><p className="mt-1 text-sm text-slate-500">Cadastros compartilhados pelo orçamento, PDV e ordens de serviço.</p></div><nav className="flex gap-2">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setTab(id); resetForm(); setQuery(""); }} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${tab === id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}><Icon size={16}/>{label}</button>)}</nav></header>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">{editingId ? `Editar ${entityName}` : `Novo ${entityName}`}</h2><p className="text-xs text-slate-500">Campos com * são necessários para salvar.</p></div>{editingId && <button type="button" onClick={resetForm} className="text-sm font-semibold text-slate-500">Cancelar edição</button>}</div>
        {tab === "customers" ? <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">Tipo de pessoa<select className={inputClass} value={customerForm.tipoPessoa} onChange={(e) => setCustomer("tipoPessoa", e.target.value)}><option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option></select></label>
          <label className="text-xs font-semibold">CPF / CNPJ<div className="mt-1 flex gap-2"><input inputMode="numeric" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" value={customerForm.documento} onChange={(e) => setCustomer("documento", formatDocument(e.target.value))} /><button type="button" disabled={cnpjLoading || digits(customerForm.documento).length !== 14} onClick={lookupCnpj} className="shrink-0 rounded-lg border border-blue-300 px-3 text-xs font-bold text-blue-800 disabled:opacity-50">{cnpjLoading ? "Consultando…" : "Consultar CNPJ"}</button></div></label>
          <label className="text-xs font-semibold sm:col-span-2">Nome / razão social *<input required className={inputClass} value={customerForm.nome} onChange={(e) => setCustomer("nome", e.target.value)} /></label>
          <label className="text-xs font-semibold">Nome fantasia<input className={inputClass} value={customerForm.nomeFantasia} onChange={(e) => setCustomer("nomeFantasia", e.target.value)} /></label>
          <label className="text-xs font-semibold">E-mail<input type="email" className={inputClass} value={customerForm.email} onChange={(e) => setCustomer("email", e.target.value)} /></label>
          <label className="text-xs font-semibold">Telefone<input className={inputClass} value={customerForm.telefone} onChange={(e) => setCustomer("telefone", e.target.value)} /></label>
          <label className="text-xs font-semibold">WhatsApp<input className={inputClass} value={customerForm.whatsapp} onChange={(e) => setCustomer("whatsapp", e.target.value)} /></label>
          <label className="text-xs font-semibold">CEP<input className={inputClass} value={customerForm.cep} onChange={(e) => setCustomer("cep", e.target.value)} /></label>
          <label className="text-xs font-semibold sm:col-span-2">Logradouro<input className={inputClass} value={customerForm.logradouro} onChange={(e) => setCustomer("logradouro", e.target.value)} /></label>
          <label className="text-xs font-semibold">Número<input className={inputClass} value={customerForm.numero} onChange={(e) => setCustomer("numero", e.target.value)} /></label>
          <label className="text-xs font-semibold">Complemento<input className={inputClass} value={customerForm.complemento} onChange={(e) => setCustomer("complemento", e.target.value)} /></label>
          <label className="text-xs font-semibold">Bairro<input className={inputClass} value={customerForm.bairro} onChange={(e) => setCustomer("bairro", e.target.value)} /></label>
          <label className="text-xs font-semibold">Cidade<input className={inputClass} value={customerForm.cidade} onChange={(e) => setCustomer("cidade", e.target.value)} /></label>
          <label className="text-xs font-semibold">UF<input maxLength={2} className={inputClass} value={customerForm.uf} onChange={(e) => setCustomer("uf", e.target.value.toUpperCase())} /></label>
          <label className="text-xs font-semibold sm:col-span-2">Observações<textarea rows={3} className={inputClass} value={customerForm.observacoes} onChange={(e) => setCustomer("observacoes", e.target.value)} /></label>
        </div> : <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">Código interno *<input required maxLength={64} className={inputClass} value={catalogForm.codigo} onChange={(e) => setCatalogField("codigo", e.target.value.toUpperCase())} placeholder="Ex.: SRV-001" /></label>
          <label className="text-xs font-semibold">Unidade<input maxLength={8} className={inputClass} value={catalogForm.unidade} onChange={(e) => setCatalogField("unidade", e.target.value.toUpperCase())} placeholder={tab === "services" ? "SV" : "UN"} /></label>
          <label className="text-xs font-semibold sm:col-span-2">Descrição *<input required className={inputClass} value={catalogForm.descricao} onChange={(e) => setCatalogField("descricao", e.target.value)} /></label>
          <label className="text-xs font-semibold">Código de barras<input className={inputClass} value={catalogForm.codigoBarras} onChange={(e) => setCatalogField("codigoBarras", e.target.value)} /></label>
          {tab === "products" && <label className="text-xs font-semibold">NCM<input maxLength={8} className={inputClass} value={catalogForm.ncm} onChange={(e) => setCatalogField("ncm", e.target.value.replace(/\D/g, ""))} placeholder="8 dígitos" /></label>}
          <label className="text-xs font-semibold">Custo (R$)<input type="number" min="0" step="0.01" className={inputClass} value={catalogForm.custo} onChange={(e) => setCatalogField("custo", e.target.value)} /></label>
          <label className="text-xs font-semibold">Preço de venda (R$)<input type="number" min="0" step="0.01" className={inputClass} value={catalogForm.precoVenda} onChange={(e) => setCatalogField("precoVenda", e.target.value)} /></label>
          {tab === "products" && <><label className="text-xs font-semibold">Estoque atual<input type="number" min="0" step="0.001" className={inputClass} value={catalogForm.estoqueAtual} onChange={(e) => setCatalogField("estoqueAtual", e.target.value)} /></label><label className="text-xs font-semibold">Estoque mínimo<input type="number" min="0" step="0.001" className={inputClass} value={catalogForm.estoqueMinimo} onChange={(e) => setCatalogField("estoqueMinimo", e.target.value)} /></label></>}
        </div>}
        {notice && <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">{notice}</p>}
        <div className="flex justify-end border-t pt-4"><button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Salvando…" : editingId ? "Salvar alterações" : `Salvar ${entityName}`}</button></div>
      </form>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-blue-800"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white"><Bot size={19}/></span><div><h2 className="font-bold">Assistente de cadastro IA</h2><p className="text-xs text-blue-700">Prepara sugestões para revisar</p></div></div>
          <label className="mt-4 block text-xs font-semibold text-slate-700">Descreva o {entityName}<textarea rows={4} maxLength={3000} className={inputClass} placeholder={tab === "customers" ? "Ex.: Cliente pessoa jurídica, nome ..., telefone ..., endereço ..." : `Ex.: ${tab === "products" ? "Produto" : "Serviço"} ..., unidade ..., preço informado ...`} value={assistantText} onChange={(e) => setAssistantText(e.target.value)} /></label>
          <button type="button" disabled={assistantLoading || assistantText.trim().length < 5} onClick={askAssistant} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Sparkles size={16}/>{assistantLoading ? "Preparando…" : "Gerar sugestões"}</button>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">A IA não salva dados. Confira documentos, endereço, NCM e valores antes de aplicar as sugestões.</p>
          {suggestions && <div className="mt-4 rounded-xl border border-blue-200 bg-white p-3"><h3 className="mb-2 text-sm font-bold">Sugestões recebidas</h3><div className="max-h-52 space-y-1 overflow-auto">{Object.entries(suggestions).filter(([, value]) => value.trim()).map(([key, value]) => <p key={key} className="text-xs text-slate-600"><b className="text-slate-800">{key}:</b> {value}</p>)}{!Object.values(suggestions).some((value) => value.trim()) && <p className="text-xs text-slate-500">A IA não encontrou dados explícitos para preencher.</p>}</div><button type="button" onClick={applySuggestions} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-bold text-blue-800"><Sparkles size={14}/>Aplicar ao formulário</button></div>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b p-4"><div><h2 className="font-bold">{tab === "customers" ? "Clientes cadastrados" : tab === "products" ? "Produtos cadastrados" : "Serviços cadastrados"}</h2><p className="text-xs text-slate-500">{loading ? "Carregando…" : `${tab === "customers" ? filteredCustomers.length : filteredCatalog.length} registro(s)`}</p></div><button type="button" onClick={resetForm} aria-label={`Novo ${entityName}`} className="rounded-lg bg-slate-100 p-2 text-blue-700"><Plus size={18}/></button></div><label className="mx-4 mt-3 flex items-center gap-2 rounded-lg border px-3"><Search size={15} className="text-slate-400"/><input className="w-full border-0 py-2 text-sm outline-none" placeholder="Buscar por nome, documento ou código" value={query} onChange={(e) => setQuery(e.target.value)}/></label>
          <div className="max-h-[440px] overflow-auto p-3">{tab === "customers" ? filteredCustomers.map((row) => <button type="button" onClick={() => editCustomer(row)} key={row.id} className="mb-2 block w-full rounded-xl border p-3 text-left hover:border-blue-400 hover:bg-blue-50"><b className="block text-sm text-slate-800">{row.nome}</b><span className="mt-1 block text-xs text-slate-500">{row.documento || "Sem documento"}{row.cidade ? ` · ${row.cidade}${row.uf ? `/${row.uf}` : ""}` : ""}</span></button>) : filteredCatalog.map((row) => <button type="button" onClick={() => editCatalog(row)} key={row.id} className="mb-2 block w-full rounded-xl border p-3 text-left hover:border-blue-400 hover:bg-blue-50"><b className="block text-sm text-slate-800">{row.descricao}</b><span className="mt-1 block text-xs text-slate-500">{row.codigo} · {row.unidade} · {money(row.precoVenda)}</span></button>)}{!loading && (tab === "customers" ? filteredCustomers.length : filteredCatalog.length) === 0 && <p className="p-5 text-center text-sm text-slate-500">Nenhum cadastro encontrado.</p>}</div>
        </section>
      </aside>
    </div>
  </section>;
}
