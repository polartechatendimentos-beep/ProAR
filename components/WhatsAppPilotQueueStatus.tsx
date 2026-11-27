"use client";

import {useState} from "react";

type Health={enabled:boolean;pending:number;failed:number;processing:boolean};

export function WhatsAppPilotQueueStatus({companyId}:{companyId:string}){
 const [status,setStatus]=useState<Health|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function refresh(){
  setBusy(true);setError("");setStatus(null);
  try{
   const response=await fetch("/api/atendimento/recebimento",{cache:"no-store",headers:{"X-Proar-Company-ID":companyId}});
   const value=await response.json();
   if(!response.ok)throw new Error(value.error||"Não foi possível consultar a fila.");
   setStatus(value as Health);
  }catch(error){setError(error instanceof Error?error.message:"Não foi possível consultar a fila.");}
  finally{setBusy(false);}
 }
 return <section aria-label="Estado da fila de mensagens">
  <button className="secondary-btn" type="button" disabled={busy} onClick={()=>void refresh()}>{busy?"Consultando…":"Conferir fila de mensagens"}</button>
  {error&&<p role="alert">{error}</p>}
  {status&&<div role="status">
   <p>Fila do piloto: <strong>{status.enabled?"ativa":"desativada"}</strong> · {status.pending} pendente(s){status.processing?" · em processamento":""} · {status.failed} requer(em) conferência.</p>
   {!!status.failed&&<p>Confira o WhatsApp e o histórico antes de responder. A fila não reenvia mensagens com entrega incerta.</p>}
  </div>}
 </section>;
}
