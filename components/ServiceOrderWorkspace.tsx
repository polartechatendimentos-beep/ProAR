"use client";

import { useMemo, useState } from "react";
import { Camera, Check, ChevronRight, Clock3, FileText, History, ImagePlus, MapPin, Plus, Save, Sparkles, Wrench, X } from "lucide-react";
import { improveTechnicalText } from "@/lib/text-assist";
import "./service-order-workspace.css";

type WorkspaceOrder = {
  id: string;
  client: string;
  unit: string;
  service: string;
  tech: string;
  date: string;
  time: string;
  address: string;
  status: string;
  tone?: string;
  catalogItems?: { id: string; name: string; kind: "Serviço" | "Produto" }[];
  [key: string]: unknown;
};

type RecordItem = Record<string, unknown>;

type Props = {
  order: WorkspaceOrder;
  customers?: RecordItem[];
  structures?: RecordItem[];
  equipment?: RecordItem[];
  canEdit: boolean;
  onSave: (order: WorkspaceOrder) => Promise<unknown>;
  onClose?: () => void;
};

const tabs = ["Resumo", "Serviços", "Equipamentos", "Fotos", "Histórico", "Financeiro", "Docs"] as const;
type Tab = typeof tabs[number];

function text(record: RecordItem | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ServiceOrderWorkspace({ order, customers = [], structures = [], equipment = [], canEdit, onSave, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Resumo");
  const [draft, setDraft] = useState<WorkspaceOrder>(order);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [photos, setPhotos] = useState<Record<string, string[]>>((order.photos as Record<string, string[]>) || {});
  const [newService, setNewService] = useState("");
  const [servicePrice, setServicePrice] = useState("0");

  const customer = customers.find(item => text(item, "name", "client") === draft.client) || customers.find(item => text(item, "legalName", "tradeName") === draft.client);
  const customerStructures = structures.filter(item => text(item, "client", "customer", "customerName") === draft.client);
  const selectedStructure = customerStructures.find(item => text(item, "name", "unit") === draft.unit) || structures.find(item => text(item, "name", "unit") === draft.unit);
  const selectedRoom = text(selectedStructure, "room", "environment", "ambiente") || String(draft.environment || draft.room || "Sala/Ambiente não informado");
  const linkedEquipment = equipment.filter(item => text(item, "client", "customer", "customerName") === draft.client || text(item, "unit", "location", "environment") === draft.unit).slice(0, 8);
  const catalog = draft.catalogItems || [];
  const servicesTotal = Number(draft.servicesTotal || catalog.filter(item => item.kind === "Serviço").reduce((sum, item) => sum + Number((item as unknown as RecordItem).price || 0), 0));
  const productsTotal = Number(draft.productsTotal || catalog.filter(item => item.kind === "Produto").reduce((sum, item) => sum + Number((item as unknown as RecordItem).price || 0), 0));
  const discount = Number(draft.discount || 0);
  const total = Math.max(0, servicesTotal + productsTotal - discount);

  const setField = (key: string, value: unknown) => setDraft(current => ({ ...current, [key]: value }));
  const assist = (key: string, kind: "observacao" | "cliente" = "observacao") => {
    const value = String(draft[key] || "").trim();
    if (!value) return;
    setField(key, improveTechnicalText(value, kind));
    setNotice("Texto melhorado com IA local — revise antes de salvar.");
  };
  const save = async () => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      await onSave({ ...draft, photos, servicesTotal, productsTotal, discount, total });
      setNotice("Alterações salvas com sucesso.");
    } catch {
      setNotice("Não foi possível salvar. Verifique a conexão e tente novamente.");
    } finally {
      setSaving(false);
      window.setTimeout(() => setNotice(""), 3000);
    }
  };
  const addPhoto = async (category: string, file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotos(current => ({ ...current, [category]: [...(current[category] || []), String(reader.result)] }));
    reader.readAsDataURL(file);
  };
  const addService = () => {
    if (!newService.trim()) return;
    const item = { id: `svc-${Date.now()}`, name: newService.trim(), kind: "Serviço" as const, price: Number(servicePrice.replace(",", ".")) || 0 };
    setDraft(current => ({ ...current, catalogItems: [...(current.catalogItems || []), item] }));
    setNewService("");
    setServicePrice("0");
  };
  const history = Array.isArray(draft.timeline) ? draft.timeline as RecordItem[] : [];

  return <section className="os-workspace" aria-label={`Área de trabalho da ${draft.id}`}>
    <header className="os-workspace-header">
      <div className="os-title-block"><button className="os-icon-button" onClick={() => onClose?.()} aria-label="Voltar"><X size={17}/></button><div><span className="os-kicker">ORDEM DE SERVIÇO</span><h2>{draft.id}</h2><p>{draft.client || "Cliente não informado"}</p></div></div>
      <div className="os-header-actions"><span className={`os-status ${draft.tone || "blue"}`}><i/> {draft.status}</span><button className="os-primary-button" disabled={!canEdit || saving} onClick={() => void save()}><Save size={15}/> {saving ? "Salvando..." : "Salvar"}</button></div>
    </header>

    <div className="os-location-bar">
      <label>Cliente<select value={draft.client} onChange={event => setField("client", event.target.value)}><option>{draft.client}</option>{customers.filter(item => text(item, "name", "legalName", "tradeName")).map(item => <option key={text(item, "id", "name")} value={text(item, "name", "legalName", "tradeName")}>{text(item, "name", "legalName", "tradeName")}</option>)}</select></label>
      <ChevronRight size={15}/><label>Unidade / setor<select value={draft.unit} onChange={event => setField("unit", event.target.value)}><option>{draft.unit || "Selecionar"}</option>{customerStructures.map(item => <option key={text(item, "id", "name")} value={text(item, "name", "unit")}>{text(item, "name", "unit")}</option>)}</select></label>
      <ChevronRight size={15}/><label>Sala / ambiente<input value={selectedRoom} onChange={event => setField("environment", event.target.value)} placeholder="Sala ou ambiente"/></label>
      <div className="os-location-summary"><MapPin size={15}/><span>{draft.unit || "Local não informado"} <b>›</b> {selectedRoom}</span></div>
    </div>

    <nav className="os-tabs" aria-label="Abas da ordem de serviço">{tabs.map(tab => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
    {notice && <div className="os-notice"><Check size={15}/> {notice}</div>}

    {activeTab === "Resumo" && <div className="os-summary-grid">
      <div className="os-main-column">
        <article className="os-card"><div className="os-card-heading"><div><span className="os-section-label">DADOS DO ATENDIMENTO</span><h3>Informações operacionais</h3></div><Wrench size={18}/></div><div className="os-form-grid"><label>Tipo<select value={String(draft.serviceType || "Manutenção corretiva")} onChange={event => setField("serviceType", event.target.value)}><option>Manutenção corretiva</option><option>Manutenção preventiva</option><option>Higienização</option><option>Instalação</option><option>Vistoria técnica</option></select></label><label>Situação<select value={draft.status} onChange={event => setField("status", event.target.value)}><option>Aberta</option><option>Em atendimento</option><option>Aguardando peça</option><option>Concluída</option><option>Cancelada</option></select></label><label>Prioridade<select value={String(draft.priority || "Normal")} onChange={event => setField("priority", event.target.value)}><option>Baixa</option><option>Normal</option><option>Alta</option><option>Urgente</option></select></label><label>Técnico<input value={draft.tech} onChange={event => setField("tech", event.target.value)}/></label><label>Data<input type="date" value={draft.date} onChange={event => setField("date", event.target.value)}/></label><label>Hora<input type="time" value={draft.time} onChange={event => setField("time", event.target.value)}/></label></div></article>
        <article className="os-card"><div className="os-card-heading"><div><span className="os-section-label">SOLICITAÇÃO DO CLIENTE</span><h3>Problema relatado</h3></div><button className="os-ai-button" onClick={() => assist("request", "cliente")}><Sparkles size={14}/> Melhorar com IA</button></div><textarea value={String(draft.request || draft.customerRequest || "")} onChange={event => setField("request", event.target.value)} placeholder="Descreva o que o cliente solicitou..."/></article>
        <article className="os-card"><div className="os-card-heading"><div><span className="os-section-label">DIAGNÓSTICO TÉCNICO</span><h3>Conclusão da avaliação</h3></div><button className="os-ai-button" onClick={() => assist("diagnosis")}><Sparkles size={14}/> Auxiliar com IA</button></div><textarea value={String(draft.diagnosis || "")} onChange={event => setField("diagnosis", event.target.value)} placeholder="Registre apenas fatos, medições e conclusões observadas..."/></article>
        <article className="os-card"><div className="os-card-heading"><div><span className="os-section-label">SERVIÇO EXECUTADO</span><h3>O que foi realizado</h3></div><button className="os-ai-button" onClick={() => assist("executedService")}><Sparkles size={14}/> Auxiliar com IA</button></div><textarea value={String(draft.executedService || "")} onChange={event => setField("executedService", event.target.value)} placeholder="Descreva exatamente o serviço executado..."/></article>
      </div>
      <aside className="os-side-column"><article className="os-card os-room-card"><span className="os-section-label">AMBIENTE SELECIONADO</span><h3>{selectedRoom}</h3><p><MapPin size={14}/> {text(selectedStructure, "address", "location") || draft.address || "Endereço não informado"}</p><dl><div><dt>Código</dt><dd>{text(selectedStructure, "code", "codigo") || "Não informado"}</dd></div><div><dt>Responsável local</dt><dd>{text(selectedStructure, "responsible", "contact") || "Não informado"}</dd></div><div><dt>Equipamentos</dt><dd>{linkedEquipment.length || Number(selectedStructure?.equipmentCount || 0)} cadastrados</dd></div></dl><button className="os-link-button" onClick={() => setActiveTab("Equipamentos")}>Ver equipamentos <ChevronRight size={14}/></button></article><article className="os-card"><span className="os-section-label">REGISTROS COMPLEMENTARES</span><div className="os-quick-links"><button onClick={() => setActiveTab("Serviços")}><Wrench size={15}/> Serviços e materiais</button><button onClick={() => setActiveTab("Fotos")}><Camera size={15}/> Evidências fotográficas</button><button onClick={() => setActiveTab("Histórico")}><History size={15}/> Histórico da OS</button><button onClick={() => setActiveTab("Financeiro")}><FileText size={15}/> Resumo financeiro</button></div></article></aside>
    </div>}

    {activeTab === "Serviços" && <div className="os-tab-content"><article className="os-card"><div className="os-card-heading"><div><span className="os-section-label">SERVIÇOS ADICIONADOS</span><h3>Serviços e materiais da OS</h3></div><div className="os-inline-form"><input value={newService} onChange={event => setNewService(event.target.value)} placeholder="Nome do serviço"/><input value={servicePrice} onChange={event => setServicePrice(event.target.value)} inputMode="decimal" placeholder="Preço"/><button className="os-primary-button" onClick={addService}><Plus size={14}/> Adicionar</button></div></div><div className="os-items-table"><div className="os-items-head"><span>Serviço / produto</span><span>Tipo</span><span>Valor</span><span/></div>{catalog.map(item => <div className="os-item-row" key={item.id}><span>{item.name}</span><span>{item.kind}</span><span>{money(Number((item as unknown as RecordItem).price || 0))}</span><button onClick={() => setDraft(current => ({ ...current, catalogItems: (current.catalogItems || []).filter(existing => existing.id !== item.id) }))} aria-label={`Remover ${item.name}`}><X size={14}/></button></div>)}{!catalog.length && <p className="os-empty">Nenhum serviço ou material vinculado.</p>}</div><div className="os-totals"><span>Produtos / materiais <b>{money(productsTotal)}</b></span><span>Serviços <b>{money(servicesTotal)}</b></span><span>Desconto <input value={String(discount)} onChange={event => setField("discount", Number(event.target.value.replace(",", ".")) || 0)}/></span><strong>TOTAL DA OS <b>{money(total)}</b></strong></div></article></div>}

    {activeTab === "Equipamentos" && <div className="os-tab-content"><article className="os-card"><div className="os-card-heading"><div><span className="os-section-label">EQUIPAMENTO DO ATENDIMENTO</span><h3>{linkedEquipment.length || 0} equipamento(s) relacionado(s)</h3></div><button className="os-secondary-button" onClick={() => setNotice("Cadastro de equipamento será aberto na aba Equipamentos.")}><Plus size={14}/> Adicionar equipamento</button></div><div className="os-equipment-grid">{linkedEquipment.map(item => <div className="os-equipment-card" key={text(item, "id", "name")}><div className="os-equipment-icon"><Wrench size={18}/></div><div><h4>{text(item, "name", "description", "model") || "Equipamento"}</h4><p>{text(item, "brand", "manufacturer")} • {text(item, "capacity", "capacityBtu", "model")}</p><small>Patrimônio: {text(item, "assetCode", "patrimony", "patrimonio") || "Não informado"} • Série: {text(item, "serial", "serialNumber") || "Não informada"}</small></div><div className="os-equipment-actions"><button onClick={() => setActiveTab("Histórico")}>Histórico</button><button onClick={() => setActiveTab("Fotos")}>Fotos</button></div></div>)}{!linkedEquipment.length && <div className="os-empty"><Wrench size={22}/><p>Nenhum equipamento foi vinculado a esta OS.</p><button className="os-secondary-button" onClick={() => setNotice("Vincule um equipamento pelo cadastro do cliente e ambiente.")}>Vincular equipamento</button></div>}</div></article></div>}

    {activeTab === "Fotos" && <div className="os-tab-content"><article className="os-card"><div className="os-card-heading"><div><span className="os-section-label">REGISTRO FOTOGRÁFICO</span><h3>Evidências por categoria</h3></div></div><div className="os-photo-categories">{["Antes", "Durante", "Depois", "Equipamento", "Etiqueta", "Defeito", "Medições", "Outros"].map(category => <div className="os-photo-category" key={category}><div><b>{category}</b><span>{(photos[category] || []).length} foto(s)</span></div><label><Camera size={17}/> Tirar ou escolher foto<input type="file" accept="image/*" capture="environment" onChange={event => void addPhoto(category, event.target.files?.[0])}/></label><div className="os-photo-thumbs">{(photos[category] || []).map((src, index) => <img key={index} src={src} alt={`${category} ${index + 1}`}/>)}</div></div>)}</div><p className="os-helper-text"><ImagePlus size={14}/> Cada evidência deve permanecer associada à OS, técnico, data/hora, equipamento e ambiente.</p></article></div>}

    {activeTab === "Histórico" && <div className="os-tab-content os-history-layout"><article className="os-card"><div className="os-card-heading"><div><span className="os-section-label">HISTÓRICO DESTA OS</span><h3>Linha do tempo operacional</h3></div><History size={18}/></div>{history.length ? <div className="os-timeline">{history.map((event, index) => <div className="os-timeline-item" key={String(event.id || index)}><i/><div><b>{text(event, "status", "action") || "Atualização registrada"}</b><small><Clock3 size={12}/> {text(event, "createdAt", "date") || "Data não informada"}</small><p>{text(event, "internalNote", "customerNote", "description")}</p></div></div>)} </div> : <p className="os-empty">Ainda não há eventos registrados nesta OS.</p>}</article><article className="os-card"><div className="os-card-heading"><div><span className="os-section-label">HISTÓRICO DO AMBIENTE</span><h3>{selectedRoom}</h3></div></div><p className="os-helper-text">As ordens anteriores do ambiente aparecerão aqui quando estiverem vinculadas ao mesmo cadastro.</p><button className="os-link-button" onClick={() => setNotice("Histórico completo do ambiente disponível após o vínculo do cadastro.")}>Ver histórico completo <ChevronRight size={14}/></button></article></div>}

    {activeTab === "Financeiro" && <div className="os-tab-content"><article className="os-card"><span className="os-section-label">RESUMO FINANCEIRO</span><h3>Valores autorizados da ordem</h3><div className="os-finance-grid"><div><small>Serviços</small><b>{money(servicesTotal)}</b></div><div><small>Produtos / materiais</small><b>{money(productsTotal)}</b></div><div><small>Desconto</small><b>{money(discount)}</b></div><div className="highlight"><small>Total da OS</small><b>{money(total)}</b></div></div><p className="os-helper-text">Quantidade, preço autorizado e desconto devem ser revisados antes da conclusão da OS.</p></article></div>}

    {activeTab === "Docs" && <div className="os-tab-content"><article className="os-card"><span className="os-section-label">DOCUMENTOS</span><h3>Documentos relacionados</h3><div className="os-doc-row"><FileText size={18}/><span><b>Ordem de Serviço {draft.id}</b><small>Documento operacional e relatório técnico</small></span><button className="os-secondary-button" onClick={() => setNotice("Use o botão de impressão da OS para gerar o documento.")}>Abrir / imprimir</button></div></article></div>}
  </section>;
}
