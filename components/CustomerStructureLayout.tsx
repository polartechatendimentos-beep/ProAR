"use client";

import { useMemo, useState } from "react";
import { Building2, CheckCircle2, ChevronRight, Edit3, MapPin, Plus, Save, Search, Trash2, Wrench, X } from "lucide-react";

type RecordItem = Record<string, unknown>;
type Props = {
  canEdit: boolean;
  customer: RecordItem & { id: string; name: string };
  structures: RecordItem[];
  serviceOrders: Array<RecordItem & { id: string; client: string; unit: string; service: string; tech: string; date: string; status: string }>;
  equipment: RecordItem[];
  roomQuery: string;
  setRoomQuery: (value: string) => void;
  onOpen: (name: string) => void;
  onUpdateStructure: (record: RecordItem) => void | boolean | Promise<boolean>;
  onDeleteStructure: (record: RecordItem) => void | boolean | Promise<boolean>;
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

export function CustomerStructureLayout({ canEdit, customer, structures, serviceOrders, equipment, roomQuery, setRoomQuery, onOpen, onUpdateStructure, onDeleteStructure }: Props) {
  const [selectedId, setSelectedId] = useState(String(structures[0]?.id ?? ""));
  const [detailTab, setDetailTab] = useState("Ambiente");
  const [structureForm, setStructureForm] = useState<null | { id?: string; name: string; hierarchyLevel: string; parentId: string; responsible: string; phone: string; email: string; description: string }>(null);
  const publicCustomer=/Prefeitura|Órgão Público|Autarquia|Fundação|Entidade Pública/i.test(String(customer.organizationType ?? ""));
  const hierarchyParents: Record<string, string[]> = publicCustomer ? {
    Secretaria: [],
    Unidade: ["Secretaria"],
    Sala: ["Unidade"],
    Ambiente: ["Unidade"],
  } : {
    Secretaria: [],
    Diretoria: ["Secretaria"],
    Departamento: ["Secretaria", "Diretoria"],
    "Órgão": ["Secretaria", "Diretoria"],
    Unidade: ["Secretaria", "Diretoria", "Departamento", "Órgão"],
    Setor: ["Unidade"],
    Sala: ["Setor", "Unidade"],
    Ambiente: ["Setor", "Sala", "Unidade"],
  };
  const normalizeLevel = (item: RecordItem) => text(item, "hierarchyLevel", "category", "type");
  const canonicalPublicLevel=(item:RecordItem)=>{
    const level=normalizeLevel(item).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
    if(["secretaria","diretoria","departamento","orgao"].includes(level)) return "Secretaria";
    if(level==="unidade") return "Unidade";
    if(["sala","ambiente","setor"].includes(level)) return "Sala";
    return normalizeLevel(item);
  };
  const allowedParents = (level: string) => {
    const levels = hierarchyParents[level] ?? [];
    return structures.filter(item => levels.some(parentLevel => (publicCustomer ? canonicalPublicLevel(item) : normalizeLevel(item)).toLocaleLowerCase("pt-BR") === parentLevel.toLocaleLowerCase("pt-BR")));
  };
  const openStructureForm = (level = "Secretaria", parentId = "") => canEdit && setStructureForm({ name: "", hierarchyLevel: level, parentId, responsible: "", phone: "", email: "", description: "" });
  const saveStructureForm = async () => {
    if (!canEdit || !structureForm?.name.trim()) return;
    const parent = structures.find(item => String(item.id) === structureForm.parentId);
    const parentOptions = allowedParents(structureForm.hierarchyLevel);
    if (structureForm.parentId && !parentOptions.some(item => String(item.id) === structureForm.parentId)) return;
    const saved = await onUpdateStructure({
      id: structureForm.id || `EST-${Date.now().toString().slice(-8)}`,
      name: structureForm.name.trim(),
      client: customer.name,
      customerId: customer.id,
      category: structureForm.hierarchyLevel,
      hierarchyLevel: structureForm.hierarchyLevel,
      parentId: structureForm.parentId || undefined,
      parentUnit: parent ? text(parent, "name", "unit") : undefined,
      responsible: structureForm.responsible.trim() || undefined,
      contact: structureForm.responsible.trim() || undefined,
      phone: structureForm.phone.trim() || undefined,
      email: structureForm.email.trim() || undefined,
      description: structureForm.description.trim() || undefined,
      status: "Ativo",
      createdAt: new Date().toLocaleString("pt-BR"),
    });
    if (saved !== false) setStructureForm(null);
  };
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
  const structureLevel = (item: RecordItem) => text(item, "hierarchyLevel", "category", "type").toLowerCase();
  const parentOf = (item: RecordItem) => String(item.parentId ?? item.parentStructureId ?? "");
  const topStructures = structures.filter(item => !parentOf(item) || /unidade|secretaria|diretoria|departamento|órgão|orgao|prédio|predio/.test(structureLevel(item)));
  const unitCandidates = (topStructures.length ? topStructures : structures).filter((item, index, list) => list.findIndex(candidate => String(candidate.id) === String(item.id)) === index);
  const selectedUnit = unitCandidates.find(item => String(item.id) === selectedId) ?? unitCandidates[0];
  const selectedUnitId = String(selectedUnit?.id ?? "");
  const descendantsOfSelected = structures.filter(item => {
    if (!selectedUnitId || String(item.id) === selectedUnitId) return false;
    let current = item;
    const seen = new Set<string>();
    while (parentOf(current) && !seen.has(String(current.id))) {
      if (parentOf(current) === selectedUnitId) return true;
      seen.add(String(current.id));
      const parent = structures.find(candidate => String(candidate.id) === parentOf(current));
      if (!parent) break;
      current = parent;
    }
    return false;
  });
  const visibleUnits = unitCandidates.filter(item => `${text(item, "name", "unit")} ${text(item, "category", "type")} ${text(item, "address", "street")}`.toLowerCase().includes(roomQuery.toLowerCase()));
  const selectedChildren = descendantsOfSelected.filter(item => /setor|sala|ambiente/.test(structureLevel(item)) || !structures.some(candidate => parentOf(candidate) === String(item.id)));
  const roomEquipment = selected ? equipment.filter(item => text(item, "room", "environment", "ambiente", "installationLocation") === text(selected, "name", "unit") || text(item, "unit", "equipmentUnit", "parentUnit") === text(selected, "name", "unit")) : [];
  const customerOrders = serviceOrders.filter(order => order.client === customer.name && (!selected || order.unit === text(selected, "name", "unit") || order.unit === text(selected, "unit", "parentUnit")));
  const openOrders = serviceOrders.filter(order => order.client === customer.name && /aberta|pendente|andamento/i.test(order.status));
  const environmentName = text(selected, "name", "unit");

  return <div className="customer-structure-screen unified-master-detail">
    <div className="customer-structure-toolbar">
      <div className="customer-breadcrumb"><span>Cliente</span><ChevronRight size={13}/><strong>Unidades & Setores</strong></div>
      <div className="customer-structure-actions"><label className="structure-search"><Search size={15}/><input placeholder="Buscar unidade, setor ou ambiente..." value={roomQuery} onChange={event => setRoomQuery(event.target.value)} /></label><button className="primary-btn" onClick={() => openStructureForm("Secretaria")}><Plus size={14}/> {publicCustomer?"Nova Secretaria":"Nova Secretaria / Unidade"}</button></div>
    </div>
    <div className="customer-structure-title"><div><span className="section-kicker"><Building2 size={12}/> ESTRUTURA FÍSICA & PMOC</span><h3>{publicCustomer?"Prefeitura → Secretaria → Unidade → Sala":"Unidades / Secretarias e Setores / Salas"}</h3><p>{publicCustomer?"Cadastre primeiro a Secretaria, depois suas Unidades e, dentro de cada Unidade, as Salas/Ambientes.":"Selecione uma unidade à esquerda para visualizar e gerenciar seus setores e ambientes sem sair do cadastro."}</p></div></div>
    <div className="structure-master-detail">
      <aside className="structure-units-column">
        <header><div><b>UNIDADES CADASTRADAS</b><span>{unitCandidates.length} registro(s)</span></div><small>Clique para ver os setores</small></header>
        <div className="structure-unit-list">{visibleUnits.map(item => {
          const id=String(item.id); const active=id===selectedUnitId;
          const directCount=structures.filter(candidate => parentOf(candidate)===id).length;
          const machineCount=equipment.filter(eq => [text(eq,"unit","equipmentUnit","parentUnit"),text(eq,"secretary","area")].includes(text(item,"name","unit"))).length;
          return <button type="button" key={id} className={`structure-unit-card ${active?"active":""}`} onClick={() => setSelectedId(id)}><div className="unit-card-main"><span className="tree-node-icon"><Building2 size={16}/></span><div><b>{text(item,"name","unit")}</b><small>{text(item,"category","type","hierarchyLevel")}</small></div><ChevronRight size={15}/></div><div className="unit-card-facts"><span>{directCount} vínculo(s)</span><span>{machineCount} equipamento(s)</span><span className="unit-card-delete" role="button" tabIndex={0} title="Excluir / inativar" onClick={event=>{event.stopPropagation();if (canEdit) void onDeleteStructure(item);}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();event.stopPropagation();if (canEdit) void onDeleteStructure(item);}}}><Trash2 size={13}/></span></div></button>;
        })}{!visibleUnits.length && <div className="empty-state compact"><Building2 size={20}/><b>Nenhuma unidade cadastrada</b><span>Cadastre a primeira unidade ou secretaria deste cliente.</span></div>}</div>
        <button className="structure-add-dashed" onClick={() => openStructureForm("Secretaria")}><Plus size={14}/> Adicionar estrutura</button>
      </aside>
      <main className="structure-sectors-column">
        <header className="selected-unit-head"><div><span className="section-kicker">UNIDADE SELECIONADA</span><h3>{selectedUnit ? text(selectedUnit,"name","unit") : "Selecione uma unidade"}</h3><p>{selectedUnit ? text(selectedUnit,"address","street","description") : "Os setores e ambientes aparecerão aqui."}</p></div><button className="primary-btn" disabled={!selectedUnit} onClick={() => openStructureForm("Setor", selectedUnitId)}><Plus size={14}/> Novo Setor nesta Unidade</button></header>
        <div className="structure-sector-list">{selectedChildren.map(item => {
          const itemEquipment=equipment.filter(eq => [text(eq,"room","environment","ambiente","installationLocation"),text(eq,"sector","setor")].includes(text(item,"name","unit")));
          return <article className="structure-sector-card" key={String(item.id)}><div className="sector-card-copy"><span className="tree-node-icon"><MapPin size={15}/></span><div><div className="sector-card-title"><b>{text(item,"name","unit")}</b><em>{text(item,"category","type","hierarchyLevel")}</em></div><p>{text(item,"description","observation","observations")}</p><small>{itemEquipment.length} equipamento(s) vinculado(s)</small></div></div><div className="sector-card-actions"><button className="icon-btn" onClick={() => {setSelectedId(String(item.id)); setDetailTab("Equipamentos");}} title="Ver equipamentos"><Wrench size={14}/></button><button className="icon-btn" onClick={() => { setStructureForm({ id:String(item.id), name:text(item,"name","unit"), hierarchyLevel:text(item,"hierarchyLevel","category","type"), parentId:String(item.parentId??""), responsible:text(item,"responsible","contact")==="—"?"":text(item,"responsible","contact"), phone:text(item,"phone")==="—"?"":text(item,"phone"), email:text(item,"email")==="—"?"":text(item,"email"), description:text(item,"description")==="—"?"":text(item,"description") }); }} title="Editar"><Edit3 size={14}/></button><button className="icon-btn icon-danger" onClick={() => canEdit && void onDeleteStructure(item)} title="Excluir / inativar"><Trash2 size={14}/></button></div></article>;
        })}{selectedUnit && !selectedChildren.length && <div className="empty-state compact"><MapPin size={20}/><b>Nenhum setor ou ambiente nesta unidade</b><span>Use “Novo Setor nesta Unidade” para criar o primeiro vínculo.</span></div>}{!selectedUnit && <div className="empty-state compact"><Building2 size={20}/><b>Nenhuma unidade selecionada</b><span>Cadastre ou selecione uma unidade.</span></div>}</div>
        <footer className="structure-live-summary"><span><CheckCircle2 size={14}/> Estrutura vinculada ao cadastro real do cliente</span><b>{selectedChildren.length} ambiente(s) • {equipment.filter(eq => selectedChildren.some(child => [text(eq,"room","environment","ambiente","installationLocation"),text(eq,"sector","setor")].includes(text(child,"name","unit")))).length} equipamento(s)</b></footer>
      </main>
    </div>
    <div className="structure-global-summary"><span><b>Resumo da Estrutura</b></span><span>1 Cliente</span><span>{unitCandidates.length} Unidades / Secretarias</span><span>{structures.filter(item => /setor|sala|ambiente/.test(structureLevel(item))).length} Setores / Salas</span><span>{equipment.length} Equipamentos</span></div>
    {structureForm && <div className="modal-backdrop" role="presentation"><section className="modal-card" role="dialog" aria-modal="true" aria-label="Cadastro da estrutura do cliente"><header><div><span className="section-kicker">ESTRUTURA VINCULADA</span><h3>Novo cadastro em {customer.name}</h3><p>O registro ficará subordinado ao cliente e poderá ser reutilizado em Orçamentos, OS, Equipamentos e PMOC.</p></div><button type="button" className="icon-btn" onClick={() => setStructureForm(null)} aria-label="Fechar"><X size={18}/></button></header><div className="profile-form-grid">
      <label>Tipo / nível<select value={structureForm.hierarchyLevel} onChange={event => setStructureForm(current => current ? {...current, hierarchyLevel:event.target.value, parentId:""} : current)}>{(publicCustomer ? ["Secretaria","Unidade","Sala","Ambiente"] : ["Secretaria","Diretoria","Departamento","Órgão","Unidade","Setor","Sala","Ambiente"]).map(level=><option key={level}>{level}</option>)}</select></label>
      <label>Nome<input autoFocus value={structureForm.name} onChange={event => setStructureForm(current => current ? {...current, name:event.target.value} : current)} placeholder="Ex.: Diretoria de Saúde"/></label>
      <label className="wide">Vinculado a<select value={structureForm.parentId} disabled={structureForm.hierarchyLevel==="Secretaria"} onChange={event => setStructureForm(current => current ? {...current, parentId:event.target.value} : current)}><option value="">{structureForm.hierarchyLevel === "Secretaria" ? "Prefeitura / cliente principal" : structureForm.hierarchyLevel === "Unidade" ? "Selecione a Secretaria" : "Selecione a Unidade"}</option>{allowedParents(structureForm.hierarchyLevel).map(item => <option key={String(item.id)} value={String(item.id)}>{`${publicCustomer ? canonicalPublicLevel(item) : normalizeLevel(item)} • ${text(item,"name","unit")}`}</option>)}</select>{publicCustomer&&structureForm.hierarchyLevel!=="Secretaria"&&!allowedParents(structureForm.hierarchyLevel).length&&<small className="structure-parent-warning">{structureForm.hierarchyLevel==="Unidade"?"Cadastre primeiro uma Secretaria.":"Cadastre primeiro uma Unidade vinculada à Secretaria."}</small>}</label>
      <label>Responsável<input value={structureForm.responsible} onChange={event => setStructureForm(current => current ? {...current, responsible:event.target.value} : current)} placeholder="Nome do responsável"/></label>
      <label>Telefone<input value={structureForm.phone} onChange={event => setStructureForm(current => current ? {...current, phone:event.target.value} : current)} placeholder="(17) 0000-0000"/></label>
      <label className="wide">E-mail<input type="email" value={structureForm.email} onChange={event => setStructureForm(current => current ? {...current, email:event.target.value} : current)} placeholder="email@prefeitura.sp.gov.br"/></label>
      <label className="wide">Observações<textarea value={structureForm.description} onChange={event => setStructureForm(current => current ? {...current, description:event.target.value} : current)} placeholder="Informações complementares do órgão, unidade, setor ou ambiente."/></label>
    </div><footer><button type="button" className="outline-btn" onClick={() => setStructureForm(null)}>Cancelar</button><button type="button" className="primary-btn" disabled={!canEdit || !structureForm.name.trim()} onClick={saveStructureForm}><Save size={14}/> Salvar vínculo</button></footer></section></div>}

  </div>;
}
