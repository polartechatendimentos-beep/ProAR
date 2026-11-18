"use client";
import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from "react";
import {createPortal} from "react-dom";
import {CalendarDays,ChevronLeft,ChevronRight,Plus,Search,Clock,MapPin,UserRound,AlertCircle,Maximize2,Minimize2} from "lucide-react";
import {agendaToday,agendaDates,validAgendaDate,navigateAgenda,closedAgendaOrder,filterAgendaOrders,type AgendaMode,type AgendaOrder} from "../lib/agenda-calendar";
import {orderEndTime,orderReadiness,type OrderScheduleSeed} from "../lib/order-workspace-state";
import {agendaInsights} from "../lib/agenda-insights";
import styles from "./OperationalAgenda.module.css";
import {preferredAgendaMode} from "../lib/daily-usability";
import {QuickScheduleAssistant} from "./QuickScheduleAssistant";
import type {QuickScheduleCustomer} from "../lib/quick-schedule-matching";
const narrowQuery="(max-width: 700px)";
const narrowSnapshot=()=>window.matchMedia(narrowQuery).matches;
const subscribeNarrow=(notify:()=>void)=>{const media=window.matchMedia(narrowQuery);media.addEventListener("change",notify);return()=>media.removeEventListener("change",notify);};
const serverNarrow=()=>false;
const modes:AgendaMode[]=["Dia","Semana","Mês","Técnico","Lista"];
const label=(day:string,options:Intl.DateTimeFormatOptions={day:"2-digit",month:"short"})=>new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR",{...options,timeZone:"UTC"});

type AgendaServiceKind="cleaning"|"pmoc"|"installation"|"corrective"|"urgent"|"works"|"other";
const serviceOptions:{key:AgendaServiceKind;label:string;style:string}[]=[
 {key:"installation",label:"Instalação",style:styles.legendInstallation},{key:"cleaning",label:"Higienização",style:styles.legendCleaning},
 {key:"corrective",label:"Corretiva",style:styles.legendCorrective},{key:"pmoc",label:"PMOC",style:styles.legendPmoc},
 {key:"urgent",label:"Urgência",style:styles.legendUrgent},{key:"works",label:"Obra / infraestrutura",style:styles.legendWorks},
];
function serviceKind(order:AgendaOrder):AgendaServiceKind {
 const text=[order.service,order.unit,order.address].filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
 if(/\b(urgente|urgencia|critica|sala de vacina|uti|emergencia)\b/.test(text))return "urgent";
 if(/\b(obra|infraestrutura|rede frigorigena|tubulacao)\b/.test(text))return "works";
 if(/\b(instalacao|instalar)\b/.test(text))return "installation";
 if(/\b(corretiva|defeito|nao gela|nao esta gelando|parou de funcionar|vazamento|falha)\b/.test(text))return "corrective";
 if(/\b(pmoc|plano de manutencao|manutencao preventiva)\b/.test(text))return "pmoc";
 if(/\b(higienizacao|limpeza|preventiva)\b/.test(text))return "cleaning";
 return "other";
}

export function OperationalAgenda<T extends AgendaOrder>({companyId,orders,onCreate,onSelect,onScheduleUpdate,customers=[],technicians:staff=[]}:{companyId:string;orders:T[];onCreate:(seed:OrderScheduleSeed)=>void;onSelect:(order:T)=>void;onScheduleUpdate?:(order:T)=>Promise<unknown>;customers?:Record<string,unknown>[];technicians?:string[]}){
 const narrow=useSyncExternalStore(subscribeNarrow,narrowSnapshot,serverNarrow);
 const [selectedMode,setMode]=useState<AgendaMode|null>(null),[day,setDay]=useState(agendaToday),[status,setStatus]=useState("Em aberto"),[tech,setTech]=useState(""),[query,setQuery]=useState(""),[overdue,setOverdue]=useState(false);
 const mode=useMemo(()=>preferredAgendaMode(narrow,selectedMode),[narrow,selectedMode]);
 const [editing,setEditing]=useState<T|null>(null),[quick,setQuick]=useState({date:"",time:"",tech:"",duration:""}),[quickBusy,setQuickBusy]=useState(false),[quickNotice,setQuickNotice]=useState("");
 const [serviceFilter,setServiceFilter]=useState<AgendaServiceKind|"all">("all");
 const [clock,setClock]=useState<Date|null>(null);
 const agendaRef=useRef<HTMLElement|null>(null);
 const [isFullscreen,setIsFullscreen]=useState(false),[fullscreenNotice,setFullscreenNotice]=useState("");
 useEffect(()=>{const tick=()=>setClock(new Date());tick();const timer=window.setInterval(tick,60000);return()=>window.clearInterval(timer);},[]);
 useEffect(()=>{const sync=()=>setIsFullscreen(document.fullscreenElement===agendaRef.current);document.addEventListener("fullscreenchange",sync);return()=>document.removeEventListener("fullscreenchange",sync);},[]);
 const nowTime=clock?new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"}).format(clock):"--:--";
 const today=agendaToday();
 const filtered=useMemo(()=>filterAgendaOrders(orders,{status,tech,query,today,overdueOnly:overdue}),[orders,status,tech,query,today,overdue]);
 const serviceFiltered=useMemo(()=>serviceFilter==="all"?filtered:filtered.filter(order=>serviceKind(order)===serviceFilter),[filtered,serviceFilter]);
 const dates=agendaDates(day,mode);
 const visible=mode==="Lista"?serviceFiltered:serviceFiltered.filter(order=>dates.includes(order.date));
 const technicians=[...new Set([...staff,...orders.map(order=>order.tech)].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 const insights=useMemo(()=>{const bounds=mode==="Lista"?orders.map(order=>order.date).filter(validAgendaDate).sort():agendaDates(day,mode);try{return{...agendaInsights(companyId,orders,bounds[0]||today,bounds.at(-1)||today),error:""};}catch(error){return{pending:[],conflicts:[],metrics:[],missingDuration:0,error:error instanceof Error?error.message:"Análise indisponível."};}},[companyId,orders,today,day,mode]);
 const open=orders.filter(order=>order.date&&!closedAgendaOrder(order));
 const past=open.filter(order=>order.date<today).length;
 async function toggleFullscreen(){try{if(document.fullscreenElement===agendaRef.current){await document.exitFullscreen();return;}if(!agendaRef.current?.requestFullscreen){setFullscreenNotice("Tela cheia não está disponível neste navegador.");return;}await agendaRef.current.requestFullscreen();}catch{setFullscreenNotice("Não foi possível abrir a Agenda em tela cheia.");}}
 function changeMode(value:AgendaMode){setMode(value);setOverdue(false);}
 function startQuick(order:T){setEditing(order);setQuick({date:order.date||"",time:order.time||"",tech:/^(não definido|a definir)$/i.test(order.tech)?"":order.tech||"",duration:String(order.estimatedDurationMinutes||order.durationMinutes||120)});setQuickNotice("");}
 async function saveQuick(){if(!editing||!onScheduleUpdate||quickBusy)return;setQuickBusy(true);setQuickNotice("");try{if(!validAgendaDate(quick.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(quick.time)||!quick.tech.trim())throw new Error("Informe data, horário e técnico para programar a OS.");const duration=Number(quick.duration);if(!Number.isInteger(duration)||duration<15||duration>480)throw new Error("Informe uma duração entre 15 e 480 minutos.");const next={...editing,date:quick.date,time:quick.time,tech:quick.tech,estimatedDurationMinutes:duration,durationMinutes:duration,status:["Rascunho","Aberta"].includes(editing.status)?"Agendada":editing.status,changeReason:"Programação ajustada pela Agenda"};const check=agendaInsights(companyId,orders.map(order=>order.id===editing.id?next:order),quick.date,quick.date);if(check.conflicts.some(pair=>pair.first.id===editing.id||pair.second.id===editing.id))throw new Error("Este horário coincide com outra OS do técnico. Escolha outro horário.");const result=await onScheduleUpdate(next);if(!result)throw new Error("Gravação sem confirmação. Confira a OS antes de repetir.");setEditing(null);setQuickNotice("✓ Programação salva no sistema.");}catch(error){setQuickNotice(error instanceof Error?error.message:"Não foi possível salvar a programação.");}finally{setQuickBusy(false);}}
 function clearFilters(){setQuery("");setTech("");setStatus("Em aberto");setOverdue(false);setServiceFilter("all");}
 const contactFor=(order:T)=>customers.find(customer=>customer.id&&customer.id===(order as unknown as Record<string,unknown>).customerId)||customers.find(customer=>customer.name===order.client);
 const currentClientName=(order:T)=>{const fields=order as unknown as Record<string,unknown>;const customer=customers.find(item=>item.id&&String(item.id)===String(fields.customerId||""))||customers.find(item=>String(item.name||"")===order.client);return String(customer?.name||order.client||"Cliente não informado");};
 const isDefaultLocation=(value:unknown)=>/^(unidade principal|cliente principal|endereço principal|local não informado|local de atendimento não selecionado|sala\s*\/\s*ambiente não informado|sala ou ambiente)$/i.test(String(value||"").trim());
 const technicianInfo=(name:string)=>{
  const normalized=name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
  const missing=!normalized||/^(a definir|nao definido|nao informado|sem tecnico|tecnico a definir)$/.test(normalized);
  if(missing)return{missing:true,initials:"!",tone:"techMissing"};
  const initials=name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toLocaleUpperCase("pt-BR");
  if(normalized==="tiago viana")return{missing:false,initials:"TV",tone:"techBlue"};
  if(normalized==="marin")return{missing:false,initials:"MA",tone:"techPurple"};
  if(normalized==="pedro crespo")return{missing:false,initials:"PC",tone:"techTeal"};
  const tones=["techGreen","techAmber","techPurple","techBlue","techTeal"];
  const hash=[...normalized].reduce((sum,char)=>sum+char.charCodeAt(0),0);
  return{missing:false,initials,tone:tones[hash%tones.length]};
 };
 const technicianBadge=(name:string)=>{
  const info=technicianInfo(name);
  return info.missing?<span className={styles.unassigned}><AlertCircle size={12}/>Definir técnico</span>:<span className={[styles.technicianBadge,styles[info.tone as keyof typeof styles]].join(" ")}><b>{info.initials}</b>{name}</span>;
 };
 const statusInfo=(order:T)=>{
  const record=order as unknown as Record<string,unknown>,raw=String(order.status||"").trim();
  if(/cancelad/i.test(raw))return{label:raw||"Cancelada",tone:"statusCancelled"};
  if(/conclu|finaliz|encerrad|faturad/i.test(raw))return{label:"Concluída",tone:"statusCompleted"};
  if(record.checkInAt||record.startedAt||/em campo|em andamento|executando/i.test(raw))return{label:"Em andamento",tone:"statusActive"};
  if(order.date<today&&!closedAgendaOrder(order))return{label:"Atrasada",tone:"statusOverdue"};
  return{label:raw||"Agendada",tone:"statusScheduled"};
 };
 const card=(order:T,compact=false)=>{
  const kind=serviceKind(order),status=statusInfo(order),urgency=kind==="urgent";
  const categoryClass=({cleaning:styles.serviceCleaning,pmoc:styles.servicePmoc,installation:styles.serviceInstallation,corrective:styles.serviceCorrective,urgent:styles.serviceUrgent,works:styles.serviceWorks,other:styles.serviceOther} as Record<AgendaServiceKind,string>)[kind];
  const readiness=orderReadiness(order as unknown as Record<string,unknown>,contactFor(order));
  const currentClient=currentClientName(order);
  const locationTitle=String(!isDefaultLocation(order.unit)?order.unit:!isDefaultLocation(order.room)?order.room:currentClient).trim();
  const locationContext=[currentClient,order.sector,order.unit&&!isDefaultLocation(order.unit)&&order.room&&!isDefaultLocation(order.room)?order.room:""].map(value=>String(value||"").trim()).filter(value=>value&&value!==locationTitle).join(" • ");
  return <button className={[styles.event,categoryClass,compact?styles.compact:"",urgency?styles.urgentEvent:""].join(" ")} key={order.id} onClick={()=>onSelect(order)} title={"Abrir "+order.id+" — "+locationTitle+(locationContext?" • "+locationContext:"")}>
   <span className={styles.eventTime}><Clock size={12}/>{order.time||"A definir"}{orderEndTime(order as unknown as Record<string,unknown>)?" – "+orderEndTime(order as unknown as Record<string,unknown>):""}<small>{order.id}</small></span>
   <strong>{locationTitle}</strong>{locationContext&&<small className={styles.eventContext}>{locationContext}</small>}<span>{order.service||"Serviço não informado"}</span>
   <span className={styles.eventTechnician}>{technicianBadge(order.tech||"")}</span>
   {!compact&&<span className={styles.eventAddress}><MapPin size={12}/>{order.address||order.unit||"Local a definir"}</span>}
   <span className={[styles.eventStatus,styles[status.tone as keyof typeof styles]].join(" ")}><i/> {status.label}{order.appointmentConfirmation?" • "+order.appointmentConfirmation:""}</span>
   {readiness.length>0&&<span className={styles.readinessBadge} title={readiness.join(", ")}>Dados a conferir</span>}
  </button>;
 };
 return <section ref={agendaRef} className={styles.agenda} aria-label="Agenda operacional">
  <header className={styles.hero}><div><span className={styles.kicker}><CalendarDays size={14}/> AGENDA OPERACIONAL</span><h2>Planeje os próximos atendimentos</h2><p>Ordens de serviço, equipe e horários em uma única agenda.</p></div><div className={styles.heroActions}><button className={styles.fullscreenButton} onClick={()=>{setFullscreenNotice("");void toggleFullscreen();}} aria-label={isFullscreen?"Sair da tela cheia":"Abrir Agenda em tela cheia"} title={isFullscreen?"Sair da tela cheia (Esc)":"Abrir Agenda em tela cheia"}>{isFullscreen?<Minimize2 size={16}/>:<Maximize2 size={16}/>}<span>{isFullscreen?"Sair da tela cheia":"Tela cheia"}</span></button><button className={styles.primary} onClick={()=>onCreate({date:day,tech:tech||undefined})}><Plus size={17}/>Agendar serviço</button></div></header>
  <QuickScheduleAssistant customers={customers as unknown as QuickScheduleCustomer[]} technicians={technicians} onCreate={onCreate}/>
  {fullscreenNotice&&<p className={styles.fullscreenNotice} role="status">{fullscreenNotice}</p>}
  <div className={styles.stats}><button onClick={()=>{setDay(today);changeMode("Dia");setStatus("Em aberto");setTech("");setQuery("");}}><span>Hoje • em aberto</span><b>{open.filter(order=>order.date===today).length}</b></button><button onClick={()=>{setMode("Lista");setStatus("Em aberto");setOverdue(true);setTech("");setQuery("");}}><span><AlertCircle size={13}/> Atrasadas</span><b>{past}</b></button><div><span>Sem técnico definido • em aberto</span><b>{open.filter(order=>!order.tech||/a definir|não definido/i.test(order.tech)).length}</b></div><div><span>Exibidas nesta visualização</span><b>{visible.length}</b></div></div>
  <div className={styles.toolbar}><div className={styles.navigation}><button disabled={mode==="Lista"} aria-label="Período anterior" onClick={()=>setDay(navigateAgenda(day,mode,-1))}><ChevronLeft size={18}/></button><button onClick={()=>{setDay(today);setOverdue(false);if(mode==="Lista")setMode("Semana");}}>Hoje</button><button disabled={mode==="Lista"} aria-label="Próximo período" onClick={()=>setDay(navigateAgenda(day,mode,1))}><ChevronRight size={18}/></button><strong>{mode==="Lista"?(overdue?"Atendimentos atrasados":"Todos os agendamentos filtrados"):mode==="Mês"?label(day,{month:"long",year:"numeric"}):mode==="Dia"?label(day,{weekday:"long",day:"2-digit",month:"long"}):`${label(dates[0])} — ${label(dates[6],{day:"2-digit",month:"short",year:"numeric"})}`}</strong></div><div className={styles.modes} role="group" aria-label="Visualização da agenda">{modes.map(item=><button key={item} aria-pressed={mode===item} onClick={()=>changeMode(item)}>{item}</button>)}</div></div>
  <div className={styles.filters}><label className={styles.search}><Search size={16}/><input aria-label="Buscar na agenda" placeholder="Cliente, OS, serviço ou endereço" value={query} onChange={event=>setQuery(event.target.value)}/></label><label>Data de referência<input aria-label="Data de referência" type="date" disabled={mode==="Lista"} value={day} onChange={event=>{if(event.target.value&&agendaDates(event.target.value,"Dia").length){setDay(event.target.value);setOverdue(false);}}}/></label><label>Técnico<select value={tech} onChange={event=>setTech(event.target.value)}><option value="">Toda a equipe</option>{technicians.map(item=><option key={item}>{item}</option>)}</select></label><label>Situação<select value={status} onChange={event=>setStatus(event.target.value)}>{["Em aberto","Todas","Concluídas","Canceladas"].map(item=><option key={item}>{item}</option>)}</select></label></div>
  {(query||tech||status!=="Em aberto"||overdue||serviceFilter!=="all")&&<div className={styles.activeFilters} aria-label="Filtros ativos">{query&&<button onClick={()=>setQuery("")}>Busca: {query} ×</button>}{tech&&<button onClick={()=>setTech("")}>Técnico: {tech} ×</button>}{status!=="Em aberto"&&<button onClick={()=>setStatus("Em aberto")}>Situação: {status} ×</button>}{overdue&&<button onClick={()=>setOverdue(false)}>Somente atrasadas ×</button>}{serviceFilter!=="all"&&<button onClick={()=>setServiceFilter("all")}>Serviço: {serviceOptions.find(item=>item.key===serviceFilter)?.label} ×</button>}<button onClick={clearFilters}>Limpar filtros</button></div>}
  {quickNotice&&!editing&&<p role="status">{quickNotice}</p>}
  {insights.error?<p role="alert">{insights.error}</p>:<div className={styles.insights}><details><summary>Programação pendente <b>{insights.pending.length}</b><span>OS em aberto sem data, horário ou técnico</span></summary><div className={styles.pendingList}>{insights.pending.slice(0,50).map(order=><div className={styles.pendingRow} key={order.id}><button onClick={()=>onSelect(order)}><strong>{order.id} • {order.client}</strong><small>{!order.date?"Data a definir":order.date.split("-").reverse().join("/")} • {order.time||"Horário a definir"} • {order.tech||"Técnico a definir"}</small></button>{onScheduleUpdate&&<button onClick={()=>startQuick(order)}>Programar</button>}</div>)}{!insights.pending.length&&<p>Nenhuma pendência de programação identificada.</p>}{insights.pending.length>50&&<p>Exibindo as primeiras 50 pendências da base carregada.</p>}</div></details><details><summary>Conflitos no período <b>{insights.conflicts.length}</b><span>Sobreposição de horário para o mesmo técnico</span></summary><p>Verificação apenas das OS com data, horário, técnico e duração estimada definidos. {insights.missingDuration} OS em aberto no período sem duração válida informada.</p><div className={styles.pendingList}>{insights.conflicts.map(pair=><article key={`${pair.first.id}:${pair.second.id}`}><button onClick={()=>onSelect(pair.first)}>{pair.first.id} • {pair.first.date.split("-").reverse().join("/")} • {pair.first.client} • {pair.first.time}</button><button onClick={()=>onSelect(pair.second)}>{pair.second.id} • {pair.second.client} • {pair.second.time}</button></article>)}{!insights.conflicts.length&&<p>Nenhum conflito detectado nos registros com programação completa.</p>}</div></details><details><summary>Resumo por técnico <b>{insights.metrics.length}</b><span>Todos os status no período exibido</span></summary><p>Contagens da base autorizada no período, sem aplicar os filtros de busca, técnico e situação. Duração é estimativa cadastrada, não tempo trabalhado.</p><div className={styles.metricsScroll}><table><thead><tr><th>Técnico</th><th>Agendadas / em aberto</th><th>Concluídas</th><th>Canceladas</th><th>Estimativa informada</th></tr></thead><tbody>{insights.metrics.map(row=><tr key={row.technicianId}><td>{row.name}</td><td>{row.scheduled}</td><td>{row.completed}</td><td>{row.cancelled}</td><td>{row.estimatedMinutes?`${Math.floor(row.estimatedMinutes/60)} h ${row.estimatedMinutes%60} min`:"Não informada"}</td></tr>)}</tbody></table></div></details></div>}
  <p className={styles.hint}>Horário de Brasília • Clique em um atendimento para abrir a OS. Os indicadores consideram a base carregada.</p>
  <div className={styles.serviceLegend} role="toolbar" aria-label="Filtrar agenda por tipo de serviço"><span>Serviços</span>{serviceOptions.map(option=><button key={option.key} className={[styles.legendItem,option.style].join(" ")} aria-pressed={serviceFilter===option.key} onClick={()=>setServiceFilter(current=>current===option.key?"all":option.key)}><i/> {option.label}</button>)}{serviceFilter!=="all"&&<button className={styles.legendClear} onClick={()=>setServiceFilter("all")}>Limpar</button>}</div>
  {(mode==="Semana"||mode==="Mês")?<div className={styles.calendarScroll}><div className={mode==="Mês"?styles.month:styles.week}>{dates.map(date=>{const daily=visible.filter(order=>order.date===date);return <section key={date} className={`${styles.day} ${date===today?styles.today:""} ${mode==="Mês"&&date.slice(0,7)!==day.slice(0,7)?styles.outside:""}`}><button className={styles.dayTitle} onClick={()=>{setDay(date);changeMode("Dia");}}><span>{label(date,{weekday:"short"})}</span><b>{label(date,{day:"2-digit"})}</b><small>{daily.length} serviço(s)</small></button>{date===today&&<div className={styles.nowMarker}><i/><span>Agora • {nowTime}</span></div>}{(mode==="Mês"?daily.slice(0,2):daily).map(order=>card(order,true))}{mode==="Mês"&&daily.length>2&&<button className={styles.more} onClick={()=>{setDay(date);changeMode("Dia");}}>+{daily.length-2} atendimentos</button>}{!daily.length&&<span className={styles.free}>Sem agendamentos</span>}</section>;})}</div></div>:mode==="Técnico"?<div className={styles.technicians}>{[...new Set(visible.map(order=>order.tech||"Técnico a definir"))].map(name=><section key={name}><h3><UserRound size={16}/>{name}<small>{visible.filter(order=>(order.tech||"Técnico a definir")===name).length}</small></h3>{visible.filter(order=>(order.tech||"Técnico a definir")===name).map(order=><div key={order.id}><small>{label(order.date,{weekday:"short",day:"2-digit",month:"short"})}</small>{card(order)}</div>)}</section>)}</div>:<div className={styles.list}>{visible.map(order=><article key={order.id}><div className={styles.dateBadge}><b>{label(order.date,{day:"2-digit"})}</b><span>{label(order.date,{month:"short"})}</span></div>{card(order)}</article>)}</div>}
  {!visible.length&&<div className={styles.empty}><CalendarDays size={30}/><h3>Nenhum atendimento neste filtro</h3><p>Escolha outro período, ajuste os filtros ou consulte as ordens atrasadas.</p><button onClick={()=>{setMode("Lista");setStatus("Em aberto");setOverdue(false);setTech("");setQuery("");}}>Ver todas as OS em aberto</button></div>}
  {editing&&typeof document!=="undefined"&&createPortal(<div className={styles.quickLayer} role="dialog" aria-modal="true" aria-label={`Programar ${editing.id}`}><section className={styles.quickPanel}><header><div><span>PROGRAMAÇÃO RÁPIDA</span><h3>{editing.id} • {editing.client}</h3></div><button disabled={quickBusy} onClick={()=>setEditing(null)} aria-label="Fechar programação">×</button></header><p>{editing.service}</p><form onSubmit={event=>{event.preventDefault();void saveQuick();}}><label>Data<input required disabled={quickBusy} type="date" value={quick.date} onChange={event=>setQuick({...quick,date:event.target.value})}/></label><label>Horário<input required disabled={quickBusy} type="time" value={quick.time} onChange={event=>setQuick({...quick,time:event.target.value})}/></label><label>Técnico<select required disabled={quickBusy} value={quick.tech} onChange={event=>setQuick({...quick,tech:event.target.value})}><option value="">Selecione o responsável</option>{technicians.filter(name=>!/^(não definido|a definir)$/i.test(name)).map(name=><option key={name}>{name}</option>)}</select></label><label>Duração em minutos<input required disabled={quickBusy} type="number" min={15} max={480} value={quick.duration} onChange={event=>setQuick({...quick,duration:event.target.value})}/></label><p>Confira endereço e contato na OS antes de confirmar a visita com o cliente.</p>{quickNotice&&<p role="alert">{quickNotice}</p>}<footer><button type="button" disabled={quickBusy} onClick={()=>setEditing(null)}>Cancelar</button><button className={styles.primary} disabled={quickBusy}>{quickBusy?"Salvando…":"Salvar programação"}</button></footer></form></section></div>,document.body)}
 </section>;
}
