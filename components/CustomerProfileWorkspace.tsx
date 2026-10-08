"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Edit3, FileText, Filter, History, MapPin, MessageCircle, Plus, Save, Search, ShieldCheck, ShoppingCart, UserRound, Wrench, X } from "lucide-react";
import "./customer-profile.css";
import { CustomerStructureLayout } from "./CustomerStructureLayout";
import { customerHealth } from "@/lib/customer-health";
import { buildUniversalTimeline, type TimelineEntry } from "@/lib/universal-timeline";
import { validateCustomer } from "@/lib/customer-validation";
import { customerCompleteness } from "@/lib/customer-master";

type AnyRecord = Record<string, unknown>;
type CustomerRecord = AnyRecord & { id: string; name: string; doc?: string; contact?: string; phone?: string; address?: string; units?: number; status?: string; organizationType?: string; legalName?: string; tradeName?: string; email?: string; zipCode?: string; street?: string; addressNumber?: string; complement?: string; neighborhood?: string; city?: string; state?: string; stateRegistration?: string; municipalRegistration?: string; createdAt?: string; website?: string; segment?: string; size?: string; paymentCondition?: string; priceTable?: string; preferredPaymentMethod?: string; dueDay?: string | number; financialNote?: string; allowCredit?: boolean; creditLimit?: number; creditCommitted?: number; maxDiscountPercent?: number; billingBlocked?: boolean; cnpjLoadedAt?: string; cnpjStatus?: string; taxpayerIndicator?: string; finalConsumer?: boolean; billingEmail?: string; billingContact?: string; purchaseContact?: string };
type ServiceOrderRecord = AnyRecord & { id: string; client: string; unit: string; service: string; tech: string; date: string; time?: string; status: string; address?: string; timeline?: AnyRecord[] };
type Props = { customer: CustomerRecord; structures: AnyRecord[]; serviceOrders: ServiceOrderRecord[]; modules: Record<string, AnyRecord[]>; canEdit: boolean; onBack: () => void; onOpen: (name: string) => void; onUpdateCustomer: (customer: CustomerRecord) => void; onUpdateStructure: (record: AnyRecord) => void | boolean | Promise<boolean>; onDeleteStructure: (record: AnyRecord) => void | boolean | Promise<boolean> };

type Tab = "Dados do Cliente" | "Unidades & Ambientes" | "Histórico";
const tabs: Tab[] = ["Dados do Cliente", "Unidades & Ambientes", "Histórico"];
const value = (record: AnyRecord | undefined, ...keys: string[]) => { for (const key of keys) { const item = record?.[key]; if (item !== undefined && item !== null && String(item).trim()) return String(item); } return "—"; };
const related = (record: AnyRecord, customer: CustomerRecord) => { const linkedId = String(record.customerId ?? ""); if (linkedId) return linkedId === customer.id; const names = [customer.name, customer.legalName, customer.tradeName].filter(Boolean).map(String); return names.includes(String(record.client ?? record.customer ?? record.customerName ?? "")); };
const dateLabel = (raw: unknown) => { if (!raw) return "—"; const date = new Date(String(raw)); return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleDateString("pt-BR"); };

export function CustomerProfileWorkspace({ customer, structures, serviceOrders, modules, canEdit, onBack, onOpen, onUpdateCustomer, onUpdateStructure, onDeleteStructure }: Props) {
  const [tab, setTab] = useState<Tab>("Dados do Cliente");
  const [dataSection,setDataSection]=useState<"Cadastro"|"Contato"|"Endereço"|"Financeiro">("Cadastro");
  const [cepLookup,setCepLookup]=useState({loading:false,message:""});
  const [documentLookup, setDocumentLookup] = useState<{ loading: boolean; message: string; kind: "idle" | "success" | "error" }>({ loading: false, message: "", kind: "idle" });
  const [structureType, setStructureType] = useState("Todos");
  const [roomQuery, setRoomQuery] = useState("");
  const [roomId, setRoomId] = useState("");
  const [equipmentFilters, setEquipmentFilters] = useState({ unit: "Todos", area: "Todos", room: "Todos", type: "Todos", brand: "Todos", status: "Todos", pmoc: "Todos", warranty: "Todos" });
  const [historyFilter, setHistoryFilter] = useState("Todos");
  const [draft, setDraft] = useState<CustomerRecord>(customer);
  const customerStructures = useMemo(() => structures.filter(item => related(item, customer)), [structures, customer]);
  const rooms = useMemo(() => customerStructures.filter(item => /sala|ambiente|consult|labor|farm|uti|recep|almox|audit|cozinha|cpd|quarto/i.test(`${value(item, "name")} ${value(item, "category")} ${value(item, "environmentType", "tipoAmbiente")}`)), [customerStructures]);
  const equipment = useMemo(() => (modules["Equipamentos"] ?? []).filter(item => related(item, customer)), [modules, customer]);
  const selectedRoom = rooms.find(item => String(item.id) === roomId) ?? rooms[0];
  const roomEquipment = selectedRoom ? equipment.filter(item => value(item, "unit", "equipmentUnit", "parentUnit", "installationLocation") === value(selectedRoom, "name", "unit") || value(item, "room", "environment", "ambiente") === value(selectedRoom, "name", "unit")) : [];
  const allHistory = useMemo(() => {
    const orders = serviceOrders.filter(order => order.client === customer.name).flatMap(order => [{ id: order.id, date: order.date, type: "OS", title: `${order.id} criada`, detail: `${order.unit} → ${order.service}`, record: order }, ...(order.timeline ?? []).map(event => ({ id: `${order.id}-${String(event.id)}`, date: String(event.createdAt ?? order.date), type: "OS", title: String(event.status ?? "Atualização da OS"), detail: String(event.internalNote ?? event.customerNote ?? order.service), record: order }))]);
    const records = Object.entries(modules).flatMap(([module, list]) => list.filter(item => related(item, customer)).map(item => ({ id: item.id, date: String(item.date ?? item.createdAt ?? ""), type: module, title: `${module} • ${item.name}`, detail: String(item.description ?? item.status ?? "Registro cadastrado"), record: item })));
    const entries:TimelineEntry[]=[...orders,...records].map(item=>({id:`${item.type}-${String(item.id)}`,at:String(item.date||new Date(0).toISOString()),module:item.type,entityType:item.type,entityId:String(item.id),action:item.title,summary:item.detail,actor:String((item.record as AnyRecord)?.updatedBy??(item.record as AnyRecord)?.createdBy??""),correlationId:String((item.record as AnyRecord)?.correlationId??"")||undefined})); return buildUniversalTimeline(entries,{}).map(item=>({id:item.entityId,date:item.at,type:item.module,title:item.action,detail:item.summary,record:{actor:item.actor,correlationId:item.correlationId}}));
  }, [customer, modules, serviceOrders]);
  const filteredHistory = allHistory.filter(item => historyFilter === "Todos" || item.type.toLowerCase().includes(historyFilter.toLowerCase()) || (historyFilter === "Alterações cadastrais" && item.type === "Cadastro"));
  const updateDraft = (key: string, next: unknown) => setDraft(current => ({ ...current, [key]: next }));
  const inputValue = (key: string) => draft[key] == null || draft[key] === "—" ? "" : String(draft[key]);
  const lookupCnpj = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 14) {
      setDocumentLookup({ loading: false, message: "", kind: "idle" });
      return;
    }
    setDocumentLookup({ loading: true, message: "Consultando dados do CNPJ...", kind: "idle" });
    try {
      const response = await fetch(`/api/cnpj/${digits}`, { cache: "no-store" });
      const result = await response.json() as Record<string, unknown> & { error?: string };
      if (!response.ok) throw new Error(result.error || "CNPJ não encontrado.");
      setDraft(current => ({
        ...current,
        doc: String(result.cnpj || digits),
        legalName: String(result.legalName || current.legalName || ""),
        tradeName: String(result.tradeName || current.tradeName || ""),
        email: String(result.email || current.email || ""),
        phone: String(result.phone || current.phone || ""),
        zipCode: String(result.zipCode || current.zipCode || ""),
        street: String(result.street || current.street || ""),
        addressNumber: String(result.addressNumber || current.addressNumber || ""),
        complement: String(result.complement || current.complement || ""),
        neighborhood: String(result.neighborhood || current.neighborhood || ""),
        city: String(result.city || current.city || ""),
        state: String(result.state || current.state || ""),
        stateRegistration: String(result.stateRegistration || current.stateRegistration || ""),
        cnaeMain: String(result.cnaeMain || current.cnaeMain || ""),
        taxStatus: String(result.taxStatus || current.taxStatus || ""),
        cnpjStatus: String(result.taxStatus || current.cnpjStatus || ""), cnpjLoadedAt:new Date().toISOString(),
      }));
      setDocumentLookup({ loading: false, message: "Dados preenchidos automaticamente. Revise e salve as alterações.", kind: "success" });
    } catch (error) {
      setDocumentLookup({ loading: false, message: error instanceof Error ? error.message : "Não foi possível consultar o CNPJ.", kind: "error" });
    }
  };
  const lookupCep=async(raw:string)=>{const digits=raw.replace(/\D/g,"");if(digits.length!==8)return;setCepLookup({loading:true,message:"Consultando CEP..."});try{const response=await fetch(`/api/cep/${digits}`,{cache:"no-store"});const result=await response.json() as Record<string,unknown>&{error?:string};if(!response.ok)throw new Error(result.error||"CEP não encontrado.");setDraft(current=>({...current,zipCode:String(result.zipCode||digits),street:String(result.street||current.street||""),complement:String(result.complement||current.complement||""),neighborhood:String(result.neighborhood||current.neighborhood||""),city:String(result.city||current.city||""),state:String(result.state||current.state||"")}));setCepLookup({loading:false,message:"Endereço preenchido pelo CEP. Revise o número e complemento."})}catch(error){setCepLookup({loading:false,message:error instanceof Error?error.message:"Falha ao consultar CEP."})}};
  const handleDocumentChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 14);
    const formatted = digits.length <= 2 ? digits : digits.length <= 5 ? `${digits.slice(0, 2)}.${digits.slice(2)}` : digits.length <= 8 ? `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}` : digits.length <= 12 ? `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}` : `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    updateDraft("doc", formatted);
    if (digits.length === 14) void lookupCnpj(digits);
    else setDocumentLookup({ loading: false, message: "", kind: "idle" });
  };
  const validation=validateCustomer(draft);
  const completeness=customerCompleteness(draft);
  const saveCustomer = () => { if(!validation.valid){setDocumentLookup({loading:false,message:validation.issues.filter(i=>i.severity==="error").map(i=>i.message).join(" "),kind:"error"});return;} onUpdateCustomer({...draft,state:String(draft.state||"").toUpperCase()}); };
  const structureList = customerStructures.filter(item => structureType === "Todos" || value(item, "category", "type", "organizationType") === structureType);
  const roomList = rooms.filter(item => `${value(item, "name", "unit")} ${value(item, "code", "codigo")} ${value(item, "sector", "setor")}`.toLowerCase().includes(roomQuery.toLowerCase()));
  const equipmentList = equipment.filter(item => Object.entries(equipmentFilters).every(([key, filter]) => filter === "Todos" || value(item, key === "area" ? "secretary" : key, key === "brand" ? "manufacturer" : key).toLowerCase() === filter.toLowerCase()));
  const options = (key: string) => ["Todos", ...Array.from(new Set(equipment.map(item => value(item, key)).filter(item => item !== "—")))];
  const isPublic = /Prefeitura|Órgão Público|Autarquia|Fundação|Entidade Pública/i.test(customer.organizationType ?? "");
  const customerFinancial=(modules.Financeiro??[]).filter(item=>related(item,customer));
  const overdueAmount=customerFinancial.filter(item=>/vencid/i.test(String(item.status||""))).reduce((sum,item)=>sum+Math.max(0,Number(item.value||0)-Number(item.settledValue||0)),0);
  const health=customerHealth({overdueAmount,openCriticalIssues:allHistory.filter(item=>/crític|rejeitad|erro/i.test(String(item.detail))).length,pmocOverdue:allHistory.some(item=>/PMOC/i.test(item.type)&&/vencid/i.test(String(item.detail)))?1:0,contractDaysToExpire:undefined,recentRework:serviceOrders.some(order=>order.client===customer.name&&/retrabalho|garantia/i.test(String(order.service)))?1:0});
  const openOrders=serviceOrders.filter(order=>order.client===customer.name&&!/conclu|cancel/i.test(order.status));
  const customerAlerts=[
    ...(!draft.cnpjLoadedAt?["CNPJ ainda não consultado"]:[]),
    ...(draft.billingBlocked?["Faturamento bloqueado"]:[]),
    ...(Number(draft.creditCommitted||0)>Number(draft.creditLimit||0)&&Number(draft.creditLimit||0)>0?["Limite de crédito excedido"]:[]),
    ...(openOrders.length?[openOrders.length+" OS aberta(s)"]:[]),
    ...(health.alerts||[]),
    ...(!validation.valid?["Cadastro possui campos inválidos"]:[])
  ].filter((item,index,list)=>list.indexOf(item)===index).slice(0,6);
  const whatsappDigits=String(draft.whatsapp||draft.phone||"").replace(/\D/g,"");
  const tabLabel = isPublic ? "Prefeitura → Secretaria → Unidade → Sala/Ambiente" : "Unidades, áreas e ambientes vinculados ao cliente";

  return <section className="customer-profile-workspace"><div className="operations-summary"><article className={health.status==="critical"?"critical":health.status==="attention"?"attention":""}><ShieldCheck size={19}/><div><small>SAÚDE DO CLIENTE</small><strong>{health.score}/100</strong><span>{health.alerts[0]||"Relacionamento operacional saudável"}</span></div></article></div>
    <header className="customer-profile-header customer-sticky-header"><button className="customer-back" onClick={onBack}><ChevronRight size={16} className="rotate-180"/> Clientes</button><div className="customer-profile-identity"><span>{customer.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</span><div><h2>{customer.name}</h2><p>{value(customer, "doc")} <b className="customer-status-dot">•</b> {value(customer, "status")}</p></div></div><div className="customer-profile-actions"><button className="outline-btn" onClick={() => { setDraft(customer); setDocumentLookup({ loading: false, message: "", kind: "idle" }); }}><X size={14}/> Descartar</button><button className="primary-btn" onClick={saveCustomer} disabled={!canEdit}><Save size={14}/> Salvar</button></div></header><div className="customer-360-toolbar"><div className="customer-360-meta"><span><MapPin size={13}/>{[draft.city,draft.state].filter(Boolean).join(" / ")||"Localização não informada"}</span><span>{String(draft.phone||draft.whatsapp||"Telefone não informado")}</span></div><div className="customer-quick-actions"><button onClick={()=>onOpen("Ordens de serviço")}><ClipboardList size={14}/> Nova OS</button><button onClick={()=>onOpen("Orçamentos")}><FileText size={14}/> Orçamento</button><button onClick={()=>onOpen("Vendas")}><ShoppingCart size={14}/> Venda</button><button onClick={()=>onOpen("Financeiro")}><CalendarDays size={14}/> Financeiro</button><button disabled={!whatsappDigits} onClick={()=>{if(whatsappDigits)window.open(`https://wa.me/${whatsappDigits}`,"_blank","noopener,noreferrer")}}><MessageCircle size={14}/> WhatsApp</button></div></div>
    <div className="customer-profile-kpis"><article><small>CADASTRO</small><strong>{completeness.percent}%</strong><span>{completeness.missing.length?`${completeness.missing.length} campo(s) pendente(s)`:"Completo"}</span></article><article><small>CRÉDITO DISPONÍVEL</small><strong>{Math.max(0,Number(draft.creditLimit||0)-Number(draft.creditCommitted||0)).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong><span>{draft.billingBlocked?"Faturamento bloqueado":draft.allowCredit?"Prazo autorizado":"Somente condições liberadas"}</span></article><article><small>EQUIPAMENTOS</small><strong>{equipment.length}</strong><span>{customerStructures.length} estrutura(s)</span></article><article><small>VALIDAÇÃO</small><strong>{validation.valid?"OK":"Revisar"}</strong><span>{validation.issues.length} alerta(s)</span></article></div><div className="customer-360-grid"><nav className="customer-360-nav" aria-label="Visão 360 do cliente"><button className={tab==="Dados do Cliente"?"active":""} onClick={()=>setTab("Dados do Cliente")}>Resumo / Cadastro</button><button className={tab==="Unidades & Ambientes"?"active":""} onClick={()=>setTab("Unidades & Ambientes")}>Estrutura</button><button onClick={()=>onOpen("Equipamentos")}>Equipamentos</button><button onClick={()=>onOpen("Orçamentos")}>Comercial</button><button onClick={()=>onOpen("Ordens de serviço")}>OS</button><button onClick={()=>onOpen("Financeiro")}>Financeiro</button><button onClick={()=>onOpen("Fiscal")}>Fiscal</button><button className={tab==="Histórico"?"active":""} onClick={()=>setTab("Histórico")}>Histórico</button></nav><aside className={`customer-attention-panel ${customerAlerts.length?"has-alerts":""}`}><b>Requer atenção</b>{customerAlerts.length?customerAlerts.map(alert=><span key={alert}>{alert}</span>):<span>Nenhuma pendência crítica no momento.</span>}</aside></div><nav className="customer-profile-tabs legacy-customer-tabs" aria-label="Abas principais do cliente" role="tablist">{tabs.map(item => <button key={item} id={`customer-tab-${item}`} role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>

    {tab === "Dados do Cliente" && <div className="profile-pane customer-data-pane"><div className="profile-pane-head compact-pane-head"><div><span className="section-kicker"><UserRound size={12}/> DADOS DO CLIENTE</span><h3>Cadastro mestre</h3></div></div><div className="customer-section-nav">{(["Cadastro","Contato","Endereço","Financeiro"] as const).map(section=><button key={section} className={dataSection===section?"active":""} onClick={()=>setDataSection(section)}>{section}</button>)}</div><div className="profile-section-grid">
      <article className={`profile-card customer-identification-card ${dataSection!=="Cadastro"?"section-collapsed":""}`}><div className="customer-card-title"><div><span className="section-kicker">IDENTIFICAÇÃO PRINCIPAL</span><h4>Dados cadastrais</h4></div><ShieldCheck size={19}/></div><div className="document-first-field"><label>CNPJ / CPF<input value={inputValue("doc")} onChange={event => handleDocumentChange(event.target.value)} onBlur={event => void lookupCnpj(event.target.value)} placeholder="Digite o CNPJ para consultar automaticamente" inputMode="numeric" autoComplete="off" /></label><button type="button" className="document-search-button" onClick={() => void lookupCnpj(inputValue("doc"))} disabled={documentLookup.loading}><Search size={14}/>{documentLookup.loading ? "Consultando..." : "Consultar CNPJ"}</button></div>{documentLookup.message && <div className={`document-lookup-banner ${documentLookup.kind}`} role={documentLookup.kind === "error" ? "alert" : "status"}>{documentLookup.message}</div>}<div className="customer-master-status"><b>Cadastro {completeness.percent}% completo</b><span>{draft.cnpjLoadedAt?`CNPJ consultado em ${dateLabel(draft.cnpjLoadedAt)}${draft.cnpjStatus?` • ${draft.cnpjStatus}`:""}`:"Dados do CNPJ ainda não confirmados"}</span></div><div className="customer-validation-summary">{validation.issues.slice(0,3).map(i=><span key={i.code} className={i.severity}>{i.message}</span>)}</div><div className="profile-form-grid">{[["legalName", "Razão Social"], ["tradeName", "Nome Fantasia"], ["stateRegistration", "Inscrição Estadual"], ["municipalRegistration", "Inscrição Municipal"], ["createdAt", "Data de cadastro"], ["segment", "Segmento"], ["size", "Porte"], ["website", "Site"]].map(([key, label]) => <label key={key}>{label}<input value={inputValue(key)} onChange={event => key === "doc" ? handleDocumentChange(event.target.value) : updateDraft(key, event.target.value)} onBlur={event => key === "doc" && void lookupCnpj(event.target.value)} placeholder={key === "doc" ? "00.000.000/0000-00" : undefined} inputMode={key === "doc" ? "numeric" : undefined} autoComplete={key === "doc" ? "off" : undefined} /></label>)}</div></article>
      <article className={`profile-card ${dataSection!=="Contato"?"section-collapsed":""}`}><h4>Contato</h4><div className="profile-form-grid">{[["phone", "Telefone"], ["whatsapp", "WhatsApp"], ["email", "E-mail"], ["contact", "Contato principal"], ["contactRole", "Cargo"], ["additionalContacts", "Contatos adicionais"]].map(([key, label]) => <label key={key}>{label}<input value={inputValue(key)} onChange={event => updateDraft(key, event.target.value)} /></label>)}</div></article>
      <article className={`profile-card wide address-card ${dataSection!=="Endereço"?"section-collapsed":""}`}><h4>Endereço</h4><div className="address-smart-grid">{[["zipCode","CEP","cep"],["street","Logradouro","street"],["addressNumber","Número","number"],["neighborhood","Bairro","neighborhood"],["complement","Complemento","complement"],["city","Cidade","city"],["state","UF","state"],["reference","Ponto de Referência","reference"]].map(([key,label,slot]) => <label key={key} className={`field-${slot}`}>{label}<input value={inputValue(key)} onChange={event => {updateDraft(key,event.target.value);if(key==="zipCode"&&event.target.value.replace(/\\D/g,"").length===8)void lookupCep(event.target.value)}} onBlur={event=>key==="zipCode"&&void lookupCep(event.target.value)} /></label>)}{cepLookup.message&&<small className="cep-lookup-status">{cepLookup.message}</small>}</div></article>
      <article className={`profile-card wide finance-card ${dataSection!=="Financeiro"?"section-collapsed":""}`}><h4>Financeiro / Comercial</h4><div className="finance-smart-grid">{[["paymentCondition","Condição de Pagamento","condition"],["preferredPaymentMethod","Forma de Pagamento","method"],["dueDay","Dia de Vencimento","due"],["priceTable","Tabela de Preço","price"],["creditLimit","Limite de Crédito","credit"],["creditCommitted","Crédito Comprometido","committed"],["maxDiscountPercent","Desconto Máximo (%)","discount"],["financialNote","Observação Financeira","note"]].map(([key,label,slot]) => <label key={key} className={`field-${slot}`}>{label}<input value={inputValue(key)} inputMode={["creditLimit","creditCommitted","maxDiscountPercent"].includes(key)?"decimal":undefined} onChange={event => updateDraft(key,["creditLimit","creditCommitted","maxDiscountPercent"].includes(key)?Number(event.target.value):event.target.value)} /></label>)}</div><div className="customer-commercial-switches"><label><input type="checkbox" checked={Boolean(draft.allowCredit)} onChange={e=>updateDraft("allowCredit",e.target.checked)}/> Permitir faturamento a prazo</label><label><input type="checkbox" checked={Boolean(draft.billingBlocked)} onChange={e=>updateDraft("billingBlocked",e.target.checked)}/> Bloquear novas vendas/faturamento</label><span>Crédito disponível: <b>{Math.max(0,Number(draft.creditLimit||0)-Number(draft.creditCommitted||0)).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</b></span></div><div className="customer-fiscal-preferences"><label>Indicador fiscal<select value={inputValue("taxpayerIndicator")} onChange={e=>updateDraft("taxpayerIndicator",e.target.value)}><option value="">Selecionar</option><option>Contribuinte ICMS</option><option>Contribuinte isento</option><option>Não contribuinte</option></select></label><label><input type="checkbox" checked={Boolean(draft.finalConsumer)} onChange={e=>updateDraft("finalConsumer",e.target.checked)}/> Consumidor final</label><label>Responsável financeiro<input value={inputValue("billingContact")} onChange={e=>updateDraft("billingContact",e.target.value)}/></label><label>E-mail financeiro/NF<input value={inputValue("billingEmail")} onChange={e=>updateDraft("billingEmail",e.target.value)}/></label><label>Responsável por compras<input value={inputValue("purchaseContact")} onChange={e=>updateDraft("purchaseContact",e.target.value)}/></label></div></article>
    </div></div>}

    {tab === "Unidades & Ambientes" && <div className="profile-pane structure-tab-pane">
      <div className="customer-structure-context"><div><span className="section-kicker"><Building2 size={12}/> ESTRUTURA OPERACIONAL</span><h3>{isPublic ? "Secretarias, unidades e salas/ambientes" : "Unidades, setores e ambientes"}</h3><p>{isPublic ? "Prefeitura → Secretaria → Unidade → Sala/Ambiente → Equipamento" : "Cliente → Unidade → Setor → Sala/Ambiente → Equipamento"}</p></div><div className="structure-context-counts"><span><b>{customerStructures.length}</b> estruturas</span><span><b>{equipment.length}</b> equipamentos</span></div></div>
      <CustomerStructureLayout canEdit={canEdit} customer={customer} structures={customerStructures} serviceOrders={serviceOrders} equipment={equipment} roomQuery={roomQuery} setRoomQuery={setRoomQuery} onOpen={onOpen} onUpdateStructure={onUpdateStructure} onDeleteStructure={onDeleteStructure} />
    </div>}

    {tab === "Histórico" && <div className="profile-pane"><div className="profile-pane-head"><div><span className="section-kicker"><History size={12}/> LINHA DO TEMPO</span><h3>Histórico completo do cliente</h3><p>OS, orçamentos, financeiro, equipamentos, PMOC, obras, documentos e alterações cadastrais.</p></div><select className="room-selector" value={historyFilter} onChange={event => setHistoryFilter(event.target.value)}>{["Todos", "OS", "Orçamentos", "Financeiro", "Equipamentos", "PMOC", "Obras", "Documentos", "Alterações cadastrais"].map(item => <option key={item}>{item}</option>)}</select></div><div className="profile-timeline">{filteredHistory.map(item => <article key={`${item.type}-${item.id}`}><div className="timeline-dot"><History size={14}/></div><div><time>{dateLabel(item.date)}</time><h4>{item.title}</h4><p>{item.detail}</p><span>{item.type}</span></div></article>)}{!filteredHistory.length && <div className="empty-state"><History size={25}/><h4>Nenhum registro encontrado</h4><p>Os eventos relacionados ao cliente aparecerão aqui.</p></div>}</div></div>}
  </section>;
}

export type { CustomerRecord };
