"use client";
import {useMemo,useState} from "react";
import {monthAgendaGrid,unscheduledOrders,type CalendarOrder} from "../lib/agenda-month-grid";

type Props<T extends CalendarOrder>={orders:T[];onSelect:(order:T)=>void;onNew:(date?:string)=>void};
const weekdays=["DOM","SEG","TER","QUA","QUI","SEX","SÁB"];
export function AgendaMonthCalendar<T extends CalendarOrder>({orders,onSelect,onNew}:Props<T>){
 const [month,setMonth]=useState(()=>{const now=new Date();return new Date(now.getFullYear(),now.getMonth(),1)});
 const [visibility,setVisibility]=useState("Em aberto");
 const [showUnscheduled,setShowUnscheduled]=useState(false);
 const grid=useMemo(()=>monthAgendaGrid(orders,month.getFullYear(),month.getMonth()+1,visibility),[orders,month,visibility]);
 const pending=useMemo(()=>unscheduledOrders(orders),[orders]);
 const move=(offset:number)=>setMonth(current=>new Date(current.getFullYear(),current.getMonth()+offset,1));
 return <section aria-label="Agenda mensal" style={{display:"grid",gap:12}}>
  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
   <button type="button" onClick={()=>move(-1)} aria-label="Mês anterior">‹</button>
   <strong style={{minWidth:145,textTransform:"capitalize"}}>{month.toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</strong>
   <button type="button" onClick={()=>move(1)} aria-label="Próximo mês">›</button>
   <button type="button" onClick={()=>setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))}>Hoje</button>
   <select aria-label="Filtrar agendamentos" value={visibility} onChange={e=>setVisibility(e.target.value)}><option>Em aberto</option><option>Todas</option><option>Concluídas</option><option>Canceladas</option></select>
   <button type="button" onClick={()=>onNew()}>+ Agendar cliente</button>
   <button type="button" onClick={()=>setShowUnscheduled(v=>!v)} aria-expanded={showUnscheduled}>Sem agendamento ({pending.length})</button>
  </div>
  {showUnscheduled&&<div role="region" aria-label="Ordens sem agendamento">{pending.length?pending.map(order=><button key={order.id} type="button" onClick={()=>onSelect(order)} style={{margin:4}}>{order.client} — {order.id}</button>):"Nenhuma OS pendente de agendamento."}</div>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:2,overflowX:"auto"}}>
   {weekdays.map(day=><div key={day} style={{padding:8,textAlign:"center",fontWeight:700}}>{day}</div>)}
   {grid.map((cell,index)=><div key={cell.date||`empty-${index}`} style={{minHeight:110,border:"1px solid var(--border,#d5e1ec)",borderRadius:5,padding:5,background:cell.date?"var(--card,#fff)":"transparent",minWidth:0}}>
    {cell.date&&<><button type="button" onClick={()=>onNew(cell.date)} title="Agendar cliente neste dia" style={{fontWeight:700,marginBottom:5}}>{Number(cell.date.slice(-2))} +</button>
     {cell.orders.map(order=><button key={order.id} type="button" title={`${order.client} — ${order.tech||"Sem técnico"}`} onClick={()=>onSelect(order)} style={{display:"block",width:"100%",textAlign:"left",fontSize:11,padding:"4px 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",borderLeft:"3px solid #2563eb",marginBottom:3}}><b>{order.time||"—"}</b> {order.client}</button>)}
    </>}
   </div>)}
  </div>
 </section>;
}
