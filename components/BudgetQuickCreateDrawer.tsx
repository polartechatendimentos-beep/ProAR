"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, ChevronRight, LoaderCircle, MapPin, Plus, Search, X } from "lucide-react";

type QuickCustomer = { id: string; name: string; doc: string; legalName?: string; tradeName?: string; phone?: string; email?: string; city?: string; state?: string };
type QuickStructure = { id: string; name: string; client: string; category?: string; parentId?: string; hierarchyLevel?: string; environmentType?: string };

type CustomerDraft = { name: string; legalName: string; tradeName: string; doc: string; phone: string; email: string; city: string; state: string };
type StructureDraft = { kind: "Setor" | "Unidade" | "Ambiente"; name: string; parentId: string; environmentType: string; roomNumber: string; description: string };

export type QuickCreateMode = "customer" | "structure";

export function BudgetQuickCreateDrawer({
  open,
  mode,
  customerName,
  customers,
  structures,
  onClose,
  onCreateCustomer,
  onCreateStructure,
}: {
  open: boolean;
  mode: QuickCreateMode;
  customerName: string;
  customers: QuickCustomer[];
  structures: QuickStructure[];
  onClose: () => void;
  onCreateCustomer: (draft: CustomerDraft) => QuickCustomer | null;
  onCreateStructure: (draft: StructureDraft & { client: string }) => QuickStructure | null;
}) {
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>({ name: "", legalName: "", tradeName: "", doc: "", phone: "", email: "", city: "", state: "SP" });
  const [structureDraft, setStructureDraft] = useState<StructureDraft>({ kind: "Setor", name: "", parentId: "", environmentType: "Sala", roomNumber: "", description: "" });
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  const customer = customers.find(item => item.name === customerName);
  const customerStructures = useMemo(() => structures.filter(item => item.client === customerName), [structures, customerName]);
  const parentOptions = useMemo(() => {
    if (structureDraft.kind === "Setor") return customerStructures.filter(item => !item.parentId && /setor|secretaria|área|departamento/i.test(`${item.category ?? ""} ${item.hierarchyLevel ?? ""}`));
    if (structureDraft.kind === "Unidade") return customerStructures.filter(item => /setor|secretaria|área|departamento/i.test(`${item.category ?? ""} ${item.hierarchyLevel ?? ""}`));
    return customerStructures.filter(item => /unidade|hospital|escola|ubs|clínica|filial/i.test(`${item.category ?? ""} ${item.hierarchyLevel ?? ""}`) || item.parentId);
  }, [customerStructures, structureDraft.kind]);

  useEffect(() => {
    if (!open) return;
    setFeedback("");
    setLookupState("idle");
    setStructureDraft(current => ({ ...current, parentId: "" }));
  }, [open, mode]);

  useEffect(() => {
    if (open && mode === "structure" && !customerName) setFeedback("Selecione um cliente antes de cadastrar a estrutura.");
  }, [customerName, mode, open]);

  const lookupCnpj = async () => {
    const digits = customerDraft.doc.replace(/\D/g, "");
    if (digits.length !== 14) { setLookupState("error"); setFeedback("Informe um CNPJ com 14 dígitos para consultar."); return; }
    setLookupState("loading"); setFeedback("");
    try {
      const response = await fetch(`/api/cnpj/${digits}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.data) throw new Error(result.error || "CNPJ não encontrado.");
      const data = result.data as Record<string, string | undefined>;
      setCustomerDraft(current => ({ ...current, name: data.razao_social || data.nome_fantasia || current.name, legalName: data.razao_social || current.legalName, tradeName: data.nome_fantasia || current.tradeName, phone: data.ddd_telefone_1 || current.phone, email: data.email || current.email, city: data.municipio || current.city, state: data.uf || current.state }));
      setLookupState("success"); setFeedback("Dados preenchidos pela consulta do CNPJ. Revise antes de salvar.");
    } catch (error) { setLookupState("error"); setFeedback(error instanceof Error ? error.message : "Não foi possível consultar o CNPJ."); }
  };

  const submitCustomer = (event: React.FormEvent) => {
    event.preventDefault();
    if (!customerDraft.name.trim()) { setFeedback("Informe a razão social ou o nome do cliente."); return; }
    const created = onCreateCustomer({ ...customerDraft, name: customerDraft.name.trim(), doc: customerDraft.doc.replace(/\D/g, "") });
    if (!created) { setFeedback("Não foi possível criar o cliente."); return; }
    setFeedback(`Cliente ${created.name} selecionado no orçamento.`);
    window.setTimeout(onClose, 350);
  };

  const submitStructure = (event: React.FormEvent) => {
    event.preventDefault();
    if (!customerName) { setFeedback("Selecione um cliente antes de cadastrar a estrutura."); return; }
    if (!structureDraft.name.trim()) { setFeedback("Informe o nome do setor, unidade ou ambiente."); return; }
    const created = onCreateStructure({ ...structureDraft, client: customerName, name: structureDraft.name.trim() });
    if (!created) { setFeedback("Não foi possível criar a estrutura."); return; }
    setFeedback(`${created.name} foi criado e selecionado no orçamento.`);
    window.setTimeout(onClose, 350);
  };

  if (!open) return null;
  return <div className="budget-quick-layer" role="presentation">
    <button className="budget-quick-backdrop" aria-label="Fechar cadastro rápido" onClick={onClose}/>
    <aside className="budget-quick-drawer" role="dialog" aria-modal="true" aria-labelledby="budget-quick-title">
      <header className="budget-quick-head"><div><span className="section-kicker"><Plus size={12}/> CADASTRO RÁPIDO</span><h2 id="budget-quick-title">{mode === "customer" ? "Novo cliente" : "Nova estrutura"}</h2><p>{mode === "customer" ? "Cadastre e selecione o cliente sem sair do orçamento." : `Inclua uma estrutura dentro de ${customerName || "um cliente"}.`}</p></div><button className="budget-quick-close" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
      {mode === "customer" ? <form className="budget-quick-form" onSubmit={submitCustomer}>
        <label className="budget-quick-wide">CNPJ<div className="budget-quick-inline"><input value={customerDraft.doc} onChange={event => setCustomerDraft(current => ({ ...current, doc: event.target.value }))} placeholder="00.000.000/0000-00" inputMode="numeric"/><button type="button" className="outline-btn" onClick={() => void lookupCnpj()} disabled={lookupState === "loading"}>{lookupState === "loading" ? <LoaderCircle size={14} className="spin"/> : <Search size={14}/>} Buscar CNPJ</button></div></label>
        <label>Razão social / Nome<input required value={customerDraft.name} onChange={event => setCustomerDraft(current => ({ ...current, name: event.target.value }))} autoFocus/></label>
        <label>Nome fantasia<input value={customerDraft.tradeName} onChange={event => setCustomerDraft(current => ({ ...current, tradeName: event.target.value }))}/></label>
        <label>Telefone<input value={customerDraft.phone} onChange={event => setCustomerDraft(current => ({ ...current, phone: event.target.value }))}/></label>
        <label>E-mail<input type="email" value={customerDraft.email} onChange={event => setCustomerDraft(current => ({ ...current, email: event.target.value }))}/></label>
        <label>Cidade<input value={customerDraft.city} onChange={event => setCustomerDraft(current => ({ ...current, city: event.target.value }))}/></label>
        <label>UF<select value={customerDraft.state} onChange={event => setCustomerDraft(current => ({ ...current, state: event.target.value }))}>{["SP","MG","PR","RJ","MS","GO","SC","RS"].map(item => <option key={item}>{item}</option>)}</select></label>
        {feedback && <p className={`budget-quick-feedback ${lookupState === "error" ? "error" : ""}`}><CheckCircle2 size={14}/>{feedback}</p>}
        <footer><button type="button" className="outline-btn" onClick={onClose}>Cancelar</button><button type="submit" className="primary-btn"><CheckCircle2 size={15}/> Salvar e selecionar</button></footer>
      </form> : <form className="budget-quick-form" onSubmit={submitStructure}>
        <div className="budget-quick-context"><Building2 size={16}/><span><small>CLIENTE PRINCIPAL</small><b>{customer?.name || customerName || "Selecione um cliente"}</b></span></div>
        <label>Tipo de estrutura<select value={structureDraft.kind} onChange={event => setStructureDraft(current => ({ ...current, kind: event.target.value as StructureDraft["kind"], parentId: "" }))}><option value="Setor">Setor / Secretaria</option><option value="Unidade">Unidade / Filial</option><option value="Ambiente">Sala / Ambiente</option></select></label>
        <label>Nome<input required value={structureDraft.name} onChange={event => setStructureDraft(current => ({ ...current, name: event.target.value }))} placeholder={structureDraft.kind === "Setor" ? "Ex.: Secretaria da Saúde" : structureDraft.kind === "Unidade" ? "Ex.: UBS Central" : "Ex.: Consultório 01"} autoFocus/></label>
        {structureDraft.kind !== "Setor" && <label>Vincular a<select value={structureDraft.parentId} onChange={event => setStructureDraft(current => ({ ...current, parentId: event.target.value }))}><option value="">Selecionar vínculo</option>{parentOptions.map(item => <option key={item.id} value={item.id}>{item.name} • {item.category || item.hierarchyLevel || "Estrutura"}</option>)}</select></label>}
        {structureDraft.kind === "Ambiente" && <><label>Tipo de ambiente<select value={structureDraft.environmentType} onChange={event => setStructureDraft(current => ({ ...current, environmentType: event.target.value }))}>{["Sala","Consultório","Recepção","Sala técnica","CPD","Laboratório","Farmácia","Outro"].map(item => <option key={item}>{item}</option>)}</select></label><label>Número da sala<input value={structureDraft.roomNumber} onChange={event => setStructureDraft(current => ({ ...current, roomNumber: event.target.value }))}/></label></>}
        <label className="budget-quick-wide">Observação<textarea value={structureDraft.description} onChange={event => setStructureDraft(current => ({ ...current, description: event.target.value }))} placeholder="Informações úteis para o orçamento..."/></label>
        {feedback && <p className="budget-quick-feedback"><CheckCircle2 size={14}/>{feedback}</p>}
        <footer><button type="button" className="outline-btn" onClick={onClose}>Cancelar</button><button type="submit" className="primary-btn"><MapPin size={15}/> Criar e selecionar</button></footer>
      </form>}
      {mode === "structure" && customerStructures.length > 0 && <div className="budget-quick-existing"><small>ESTRUTURAS JÁ CADASTRADAS</small>{customerStructures.slice(0, 5).map(item => <div key={item.id}><ChevronRight size={13}/><span>{item.name}</span><em>{item.category || item.hierarchyLevel || "Estrutura"}</em></div>)}</div>}
    </aside>
  </div>;
}

export type { CustomerDraft, StructureDraft };
