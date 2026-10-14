"use client";
import { useState } from "react";
import type { MobileFieldOrder } from "@/lib/mobile-field";
import { compressFieldPhoto } from "@/lib/field-media";
import styles from "./ProARFieldMobile.module.css";
type History={id:string;date:string;service:string;diagnosis:string;report:string;before:string;after:string};
export function FieldOrderTools({order,busy,canApprove,send}:{order:MobileFieldOrder;busy:boolean;canApprove:boolean;send:(action:string,data:Record<string,unknown>)=>Promise<void>}){
  const [name,setName]=useState(""),[brand,setBrand]=useState(""),[model,setModel]=useState(""),[serial,setSerial]=useState(""),[photo,setPhoto]=useState(""),[error,setError]=useState("");
  const [kind,setKind]=useState("signature"),[reason,setReason]=useState(""),[decisions,setDecisions]=useState<Record<string,string>>({});
  const [history,setHistory]=useState<History[]|null>(null),[historyId,setHistoryId]=useState(""),[historyBusy,setHistoryBusy]=useState(false);
  async function showHistory(id:string){setHistoryId(id);setHistory(null);setHistoryBusy(true);setError("");try{const response=await fetch(`/api/mobile/orders?orderId=${encodeURIComponent(order.id)}&equipmentId=${encodeURIComponent(id)}`,{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error);setHistory(body.history);}catch(e){setError(e instanceof Error?e.message:"Histórico indisponível.");}finally{setHistoryBusy(false);}}
  return <>
    {error&&<p role="alert" className={styles.warning}>{error}</p>}
    <details className={styles.journeyPanel}><summary>Cadastrar equipamento nesta OS</summary>
      <p>O cadastro será vinculado ao cliente e local deste atendimento.</p>
      <label className={styles.formLabel}>Identificação do equipamento<input value={name} onChange={e=>setName(e.target.value)} maxLength={150}/></label>
      <label className={styles.formLabel}>Marca<input value={brand} onChange={e=>setBrand(e.target.value)} maxLength={100}/></label>
      <label className={styles.formLabel}>Modelo<input value={model} onChange={e=>setModel(e.target.value)} maxLength={100}/></label>
      <label className={styles.formLabel}>Número de série<input value={serial} onChange={e=>setSerial(e.target.value)} maxLength={120}/></label>
      <label className={styles.formLabel}>Foto de identificação • câmera ou galeria<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)void compressFieldPhoto(file).then(setPhoto).catch(e=>setError(e.message));}}/></label>
      <button type="button" disabled={busy||!name.trim()||!photo} className={styles.primaryAction} onClick={()=>void send("register-equipment",{equipment:{name,brand,model,serialNumber:serial,photo}})}>Cadastrar e vincular equipamento</button>
    </details>
    <details className={styles.journeyPanel}><summary>Exceções e aprovação do gestor</summary>
      <p>Cliente ausente ou recusa de assinatura, ou serviço sem equipamento: registre o motivo. A dispensa só vale após aprovação.</p>
      <label className={styles.formLabel}>Requisito<select value={kind} onChange={e=>setKind(e.target.value)}><option value="signature">Assinatura do cliente</option><option value="equipment">Equipamento vinculado</option></select></label>
      <label className={styles.formLabel}>Justificativa<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000}/></label>
      <button type="button" className={styles.secondaryAction} disabled={busy||reason.trim().length<10} onClick={()=>void send("request-exception",{kind,reason})}>Solicitar aprovação</button>
      {(order.fieldExceptions||[]).map(item=><article key={item.id} className={styles.detailCard}><strong>{item.kind==="signature"?"Assinatura":"Equipamento"} • {item.status}</strong><p>{item.reason}</p><small>Solicitado por {item.requestedBy}</small>{item.decisionReason&&<p>Decisão de {item.decidedBy}: {item.decisionReason}</p>}{canApprove&&item.status==="Pendente"&&<><label className={styles.formLabel}>Justificativa da decisão<textarea maxLength={1000} value={decisions[item.id]||""} onChange={e=>setDecisions({...decisions,[item.id]:e.target.value})}/></label>{["Aprovado","Rejeitado"].map(decision=><button key={decision} type="button" disabled={busy||(decisions[item.id]||"").trim().length<10} className={styles.secondaryAction} onClick={()=>void send("decide-exception",{exceptionId:item.id,decision,reason:decisions[item.id]})}>{decision==="Aprovado"?"Aprovar exceção":"Rejeitar exceção"}</button>)}</>}</article>)}
    </details>
    <details className={styles.journeyPanel}><summary>Histórico dos equipamentos</summary>
      {(order.equipmentOptions||[]).map(item=><button key={item.id} type="button" className={styles.secondaryAction} disabled={historyBusy} onClick={()=>void showHistory(item.id)}>Consultar {item.label}</button>)}
      {!order.equipmentOptions?.length&&<p>Cadastre ou vincule um equipamento para consultar o histórico.</p>}
      {historyBusy&&<p role="status">Carregando histórico…</p>}
      {history&&<><p>{history.length} atendimento(s) anterior(es) • {historyId}</p>{history.map(item=><article className={styles.detailCard} key={item.id}><strong>{item.id} • {new Date(item.date).toLocaleDateString("pt-BR")}</strong><p>{item.service}</p><p>Diagnóstico: {item.diagnosis||"Não registrado"}</p><p>Serviço: {item.report||"Não registrado"}</p>{item.before&&<a href={item.before} download={`${item.id}-antes.jpg`}>Baixar foto antes</a>}{item.after&&<a href={item.after} download={`${item.id}-depois.jpg`}>Baixar foto depois</a>}</article>)}</>}
    </details>
  </>;
}
