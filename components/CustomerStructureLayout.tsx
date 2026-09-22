"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarDays, ChevronRight, ClipboardList, Edit3, FileText, Filter, MapPin, Plus, Search, ShieldCheck, Wrench } from "lucide-react";

type RecordItem = Record<string, unknown>;
type Props = {
  customer: RecordItem & { id: string; name: string };
  structures: RecordItem[];
  serviceOrders: Array<RecordItem & { id: string; client: string; unit: string; service: string; tech: string; date: string; status: string }>;
  equipment: RecordItem[];
  roomQuery: string;
  setRoomQuery: (value: string) => void;
  onOpen: (name: string) => void;
  onUpdateStructure: (record: RecordItem) => void;
};

const text = (item: RecordItem | undefined, ...keys: string[]) => {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "—";
};
const dateLabel = (raw: unknown) => {
  if (!raw) return "—";
  const date = new Date(String(raw));
  return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleDateString("pt-BR");
};

export function CustomerStructureLayout({ customer, structures, serviceOrders, equipment, roomQuery, setRoomQuery, onOpen, onUpdateStructure }: Props) {
  const [selectedId, setSelectedId] = useState(String(structures[0]?.id ?? ""));
  const [detailTab, setDetailTab] = useState("Ambiente");
  const selected = structures.find(item => String(item.id) === selectedId) ?? structures[0];
  const nodes = useMemo(() => {
    const parentOf = (item: RecordItem) => String(item.parentId ?? item.parentStructureId ?? "");
    const children = new Map<string, RecordItem[]>();
    structures.forEach(item => {
      const parent = parentOf(item);
      children.set(parent, [...(children.get(parent) ?? []), item]);
    });
    const result: Array<{ item: RecordItem; depth: number }> = [];
    const visit = (parent: string, depth: number) => {
      (children.get(parent) ?? []).forEach(item => {
        result.push({ item, depth });
        visit(String(item.id), depth + 1);
      });
    };
    visit("", 0);
    const used = new Set(result.map(node => String(node.item.id)));
    structures.filter(item => !used.has(String(item.id))).forEach(item => result.push({ item, depth: 0 }));
    return result;
  }, [structures]);
  const visibleNodes = nodes.filter(node => `${text(node.item, "name", "unit")} ${text(node.item, "category", "type")}`.toLowerCase().includes(roomQuery.toLowerCase()));
  const roomEquipment = selected ? equipment.filter(item => text(item, "room", "environment", "ambiente", "installationLocation") === text(selected, "name", "unit") || text(item, "unit", "equipmentUnit", "parentUnit") === text(selected, "name", "unit")) : [];
  const customerOrders = serviceOrders.filter(order => order.client === customer.name && (!selected || order.unit === text(selected, "name", "unit") || order.unit === text(selected, "unit", "parentUnit")));
  const openOrders = serviceOrders.filter(order => order.client === customer.name && /aberta|pendente|andamento/i.test(order.status));
  const environmentName = text(selected, "name", "unit");

  return <div className="customer-structure-screen">
    <div className="customer-structure-toolbar"><div className="customer-breadcrumb"><span>Cliente</span><ChevronRight size={13}/><span>Secretaria</span><ChevronRight size={13}/><span>Unidade</span><ChevronRight size={13}/><strong>Ambiente</strong><ChevronRight size={13}/><span>Equipamento</span></div><div className="customer-structure-actions"><label className="structure-search"><Search size={15}/><input placeholder="Buscar na estrutura..." value={roomQuery} onChange={event => setRoomQuery(event.target.value)} /></label><button className="outline-btn" onClick={() => onOpen(`Filtros da estrutura • ${customer.name}`)}><Filter size={14}/> Filtros</button><button className="primary-btn" onClick={() => onOpen(`Nova unidade, filial ou setor • ${customer.name}`)}><Plus size={14}/> Novo</button></div></div>
    <div className="customer-structure-title"><div><span className="section-kicker"><Building2 size={12}/> ESTRUTURA DO CLIENTE</span><h3>{customer.name}</h3><p>Navegue pela hierarquia e acompanhe os ambientes, equipamentos e ordens de serviço vinculados.</p></div><div className="structure-title-actions"><button className="outline-btn" onClick={() => onOpen(`Nova sala ou ambiente • ${customer.name}`)}><Plus size={14}/> Nova sala</button><button className="primary-btn" onClick={() => onOpen(`Novo setor • ${customer.name}`)}><Plus size={14}/> Novo setor</button></div></div>
    <div className="customer-structure-grid">
      <aside className="structure-tree-panel"><header><b>ÁRVORE DA ESTRUTURA</b><span>{structures.length} registros</span></header><div className="structure-tree">{visibleNodes.map(node => { const item = node.item; const selectedNode = String(item.id) === String(selected?.id); return <button type="button" className={`structure-tree-node ${selectedNode ? "selected" : ""}`} style={{ paddingLeft: `${14 + node.depth * 22}px` }} key={String(item.id)} onClick={() => { setSelectedId(String(item.id)); setDetailTab(/sala|ambiente|consult|labor|farm|uti|recep|almox|audit|cozinha|cpd|quarto/i.test(`${text(item, "name", "unit")} ${text(item, "category", "type")}`) ? "Ambiente" : "Equipamentos"); }}><ChevronRight size={13} className={node.depth ? "tree-chevron" : "tree-chevron muted"}/><span className="tree-node-icon"><Building2 size={14}/></span><span className="tree-node-copy"><b>{text(item, "name", "unit")}</b><small>{text(item, "category", "type")}</small></span></button>; })}{!visibleNodes.length && <div className="empty-state compact"><Building2 size={20}/><b>Nenhuma estrutura cadastrada</b><span>Use Novo para iniciar a hierarquia.</span></div>}</div></aside>
      <main className="structure-detail-panel">{selected ? <><header className="structure-detail-head"><div><span className="section-kicker">AMBIENTE SELECIONADO</span><h2>{environmentName}</h2><p>{text(selected, "parentUnit", "secretary", "area", "parent")} / {text(selected, "sector", "setor", "category")}</p></div><div className="structure-detail-actions"><button className="outline-btn" onClick={() => onOpen(`Sugerir com IA • ${environmentName}`)}><ShieldCheck size={14}/> Otimizar com IA</button><button className="outline-btn" onClick={() => onUpdateStructure(selected)}><Edit3 size={14}/> Editar dados</button></div></header><nav className="structure-detail-tabs" aria-label="Detalhes do ambiente" role="tablist">{["Ambiente", "Equipamentos", "Histórico de OS", "Documentos"].map(item => <button type="button" role="tab" aria-selected={detailTab === item} className={detailTab === item ? "active" : ""} key={item} onClick={() => setDetailTab(item)}>{item}{item === "Equipamentos" ? ` (${roomEquipment.length})` : ""}</button>)}</nav>{detailTab === "Ambiente" && <div className="structure-fields-grid"><label>Nome do ambiente<input value={environmentName} readOnly /></label><label>Tipo de ambiente<select value={text(selected, "environmentType", "tipoAmbiente", "category")} disabled><option>{text(selected, "environmentType", "tipoAmbiente", "category")}</option></select></label><label>Área total (m²)<input value={text(selected, "area", "areaM2")} readOnly /></label><label>Capacidade<input value={text(selected, "capacity", "capacityPeople")} readOnly /></label><label className="wide">Observações técnicas<textarea value={text(selected, "observation", "observations", "description")} readOnly /></label></div>}{detailTab === "Equipamentos" && <div className="structure-equipment-list">{roomEquipment.map(item => <article key={String(item.id)}><Wrench size={17}/><div><b>{text(item, "name", "model", "equipmentType")}</b><span>{text(item, "id", "code")} • {text(item, "brand", "manufacturer")} • {text(item, "capacityBtus", "capacity", "btus")} BTUs</span></div><ChevronRight size={15}/></article>)}{!roomEquipment.length && <div className="empty-state compact"><Wrench size={20}/><b>Nenhum equipamento neste ambiente</b><span>Os equipamentos vinculados aparecerão aqui.</span></div>}</div>}{detailTab === "Histórico de OS" && <div className="structure-os-list">{customerOrders.map(order => <article key={order.id}><CalendarDays size={16}/><div><b>{order.id} • {order.service}</b><span>{dateLabel(order.date)} • {order.status} • {order.tech}</span></div></article>)}{!customerOrders.length && <div className="empty-state compact"><ClipboardList size={20}/><b>Nenhuma OS neste ambiente</b><span>Ordens vinculadas ao local aparecerão aqui.</span></div>}</div>}{detailTab === "Documentos" && <div className="empty-state compact"><FileText size={20}/><b>Documentos do ambiente</b><span>Edite o ambiente para vincular documentos técnicos.</span></div>}</> : <div className="empty-state"><Building2 size={25}/><h4>Selecione uma estrutura</h4><p>Escolha uma unidade, setor ou ambiente na árvore.</p></div>}</main>
      <aside className="structure-summary-panel"><article><h4>RESUMO DO AMBIENTE</h4><div><span>Equipamentos</span><b>{String(roomEquipment.length).padStart(2, "0")}</b></div><div><span>OS em aberto</span><b>{String(openOrders.length).padStart(2, "0")}</b></div><div><span>Em andamento</span><b>{String(openOrders.filter(order => /andamento/i.test(order.status)).length).padStart(2, "0")}</b></div><p>Última manutenção: <strong>{dateLabel(serviceOrders.find(order => order.client === customer.name)?.date)}</strong></p><p>Próxima revisão PMOC: <strong>—</strong></p></article><article><h4>LOCALIZAÇÃO</h4><div className="structure-map-placeholder"><MapPin size={28}/><small>OpenStreetMap</small></div><p>{text(customer, "street", "address")} {text(customer, "addressNumber")}<br/>{text(customer, "neighborhood")}, {text(customer, "city")} - {text(customer, "state")}<br/>CEP {text(customer, "zipCode")}</p></article></aside>
    </div>
  </div>;
}
