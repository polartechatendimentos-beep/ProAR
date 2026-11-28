"use client";
import {useState} from "react";
import type {DesktopOsDraft} from "../lib/desktop-os-offline";

export function DesktopOsDrafts({drafts,error,busy,online,canCreate,technicians,onSend,onDiscard,onRevise}:{drafts:DesktopOsDraft[];error?:string;busy:string;online:boolean;canCreate:boolean;technicians:string[];onSend:(draft:DesktopOsDraft)=>void;onDiscard:(draft:DesktopOsDraft)=>void;onRevise:(id:string,fields:{date:string;time:string;tech:string})=>void}){
 const [editing,setEditing]=useState("");
 const [notice,setNotice]=useState("");
 if(!error&&!drafts.length)return null;
 return <section className="panel" aria-label="Ordens guardadas neste aparelho">
  <h3>Ordens guardadas neste aparelho</h3>
  <p>Não aparecem na Agenda. O horário e o responsável só são reservados quando o banco confirma.</p>
  {error&&<p role="alert">{error}</p>}
  {drafts.map(draft=>{
   const {intent}=draft,id=intent.creationRequestId;
   const date=String(intent.date||""),time=String(intent.time||""),tech=String(intent.tech||"");
   return <details key={id}>
    <summary>{intent.client} • {String(intent.service||"Atendimento técnico")} • {draft.review?"Revisar":"Não confirmada"}</summary>
    <p>{date||"Sem data"} {time} • {tech||"Sem técnico"} • {String(intent.address||"Sem endereço")}</p>
    {draft.review&&<p role="status">{draft.review}</p>}
    {canCreate&&editing===id?<form onSubmit={event=>{
     event.preventDefault();
     const form=new FormData(event.currentTarget);
     try{onRevise(id,{date:String(form.get("date")||""),time:String(form.get("time")||""),tech:String(form.get("tech")||"")});setEditing("");setNotice("");}
     catch(e){setNotice(e instanceof Error?e.message:"Não foi possível guardar o ajuste.");}
    }}>
     <label>Data<input name="date" type="date" defaultValue={date} required/></label>
     <label>Horário<input name="time" type="time" defaultValue={time} required/></label>
     <label>Técnico<select name="tech" defaultValue={tech} required><option value="">Selecione</option>{technicians.map(name=><option key={name}>{name}</option>)}</select></label>
     {notice&&<p role="alert">{notice}</p>}
     <button className="primary-btn" disabled={Boolean(busy)}>Guardar ajuste local</button>
     <button type="button" className="outline-btn" onClick={()=>setEditing("")}>Voltar</button>
    </form>:<>
     {canCreate&&<button type="button" className="primary-btn" disabled={!online||Boolean(busy)} onClick={()=>onSend(draft)}>{busy===id?"Conferindo…":intent.status==="Agendada"?"Enviar e verificar horário":"Enviar rascunho"}</button>}{" "}
     {canCreate&&intent.status==="Agendada"&&<button type="button" className="outline-btn" disabled={Boolean(busy)} onClick={()=>{setEditing(id);setNotice("");}}>Ajustar horário ou técnico</button>}{" "}
     <button type="button" className="outline-btn" disabled={Boolean(busy)} onClick={()=>onDiscard(draft)}>Descartar do aparelho</button>
    </>}
   </details>;
  })}
 </section>;
}
