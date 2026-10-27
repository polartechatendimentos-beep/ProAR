"use client";
import { useState } from "react";
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";
import type { ErpRecord, OperationalCommand } from "@/lib/operational-ledger";

type Props = {
  records: ErpRecord[];
  canApprove: boolean;
  onOperation: (command: OperationalCommand) => Promise<void>;
};

const money=(value:unknown)=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export function ApprovalCenter({ records, canApprove, onOperation }: Props) {
  const [reason,setReason]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState("");
  const [notice,setNotice]=useState("");
  const pending=records.filter(item=>item.status==="Pendente");
  const decided=records.filter(item=>item.status!=="Pendente");

  const decide=async(record:ErpRecord,decision:"Aprovado"|"Rejeitado")=>{
    const justification=String(reason[record.id]||"").trim();
    if(!justification){setNotice("Informe uma justificativa antes de decidir.");return;}
    setSaving(record.id);setNotice("");
    try{
      await onOperation({idempotencyKey:crypto.randomUUID(),action:"approval-decide",recordId:record.id,expectedRecord:record,data:{decision,reason:justification}});
      setNotice(`${decision}: ${record.name}`);
      setReason(current=>({...current,[record.id]:""}));
    }catch(error){setNotice(error instanceof Error?error.message:"Não foi possível registrar a decisão.");}
    finally{setSaving("");}
  };

  return <section className="module-page approval-center">
    <div className="management-hero"><div><span className="section-kicker"><ShieldCheck size={12}/> GOVERNANÇA OPERACIONAL</span><h2>Aprovações por alçada</h2><p>Compras, descontos e outras operações críticas ficam registradas antes de prosseguir.</p></div><div className="management-actions"><span className="approval-counter"><Clock3 size={15}/><b>{pending.length}</b> pendente(s)</span></div></div>
    {notice&&<div className="pdv-notice" role="status">{notice}</div>}
    <div className="approval-list">
      {pending.map(record=><article key={record.id} className="panel approval-card">
        <header><div><small>{record.sourceModule}</small><h3>{record.name}</h3><p>{record.reason}</p></div><strong>{money(record.value)}</strong></header>
        <div className="approval-meta"><span>Solicitado por <b>{record.requestedBy || "Sistema"}</b></span><span>{String(record.requestedAt||record.createdAt||"").slice(0,16).replace("T"," ")}</span></div>
        <label>Justificativa da decisão<textarea value={reason[record.id]||""} onChange={event=>setReason(current=>({...current,[record.id]:event.target.value}))} placeholder="Registre o motivo da aprovação ou rejeição."/></label>
        <footer><button className="outline-btn danger" disabled={!canApprove||saving===record.id} onClick={()=>void decide(record,"Rejeitado")}><XCircle size={14}/> Rejeitar</button><button className="primary-btn" disabled={!canApprove||saving===record.id} onClick={()=>void decide(record,"Aprovado")}><CheckCircle2 size={14}/> Aprovar</button></footer>
      </article>)}
      {!pending.length&&<div className="linked-empty"><CheckCircle2 size={24}/><h4>Nenhuma aprovação pendente</h4><p>Novas operações acima das alçadas aparecerão automaticamente.</p></div>}
    </div>
    {decided.length>0&&<div className="panel approval-history"><h3>Decisões recentes</h3>{[...decided].reverse().slice(0,20).map(record=><div key={record.id}><span><b>{record.name}</b><small>{record.sourceModule} • {record.decidedBy || "Sistema"}</small></span><em className={record.status==="Aprovado"?"ok":"rejected"}>{record.status}</em><p>{record.decisionReason}</p></div>)}</div>}
  </section>;
}
