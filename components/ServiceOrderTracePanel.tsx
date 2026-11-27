"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { deriveServiceOrderTrace, type TraceAccess } from "@/lib/service-order-trace";

type Row=Record<string,unknown>;
type Lookup={id:string;status:"loading"|"error"|"done";attempt?:Row|null};
const label=(value:unknown)=>typeof value==="string"?value:"";

export function ServiceOrderTracePanel({orders,modules,access}:{orders:Row[];modules:Record<string,Row[]>;access:TraceAccess}){
 const [id,setId]=useState("");
 const [lookup,setLookup]=useState<Lookup|null>(null);
 const [version,setVersion]=useState(0);
 const order=orders.find(item=>item.id===id);
 useEffect(()=>{
  if(!id||!access.fiscal)return;
  const controller=new AbortController();
  void (async()=>{
   try{
    const response=await fetch("/api/nfse/issue?serviceOrderId="+encodeURIComponent(id),{cache:"no-store",signal:controller.signal});
    if(!response.ok)throw new Error("Consulta indisponível");
    const content=await response.json();
    if(!controller.signal.aborted)setLookup({id,status:"done",attempt:content.attempt});
   }catch{if(!controller.signal.aborted)setLookup({id,status:"error"});}
  })();
  return ()=>controller.abort();
 },[id,access.fiscal,version]);
 const attempt=lookup?.id===id&&lookup.status==="done"?lookup.attempt:undefined;
 const steps=order?deriveServiceOrderTrace(order,modules,access,attempt):[];
 return <section className="fiscal-list-panel" aria-label="Rastreabilidade da ordem de serviço">
  <header><div><small>CONSULTA INTERNA • SEM TRANSMISSÃO</small><h3>Rastreabilidade da ordem de serviço</h3><p>Confira materiais, nota, título e recebimento. A trilha usa vínculos registrados; não infere associação por nome, valor ou número de nota.</p></div></header>
  <div className="erp-card">
   <label>Ordem de serviço <select value={id} onChange={event=>{setId(event.target.value);setLookup(null);}}>
    <option value="">Selecione uma OS</option>
    {orders.filter(row=>label(row.id)).map((row,index)=><option key={label(row.id)+"-"+index} value={label(row.id)}>{label(row.id)}{label(row.client)?" • "+label(row.client):""}</option>)}
   </select></label>
   {!orders.length&&<p>Nenhuma OS disponível no seu perfil.</p>}
   {order&&orders.filter(item=>item.id===id).length>1?<p role="alert">Mais de uma OS usa este identificador. Corrija o cadastro antes de usar a trilha.</p>:order&&<>
    {access.fiscal&&<p aria-live="polite">{lookup?.id!==id?"Consultando registro local da transmissão...":lookup.status==="error"?"O registro local da transmissão não pôde ser consultado. O resumo abaixo reflete apenas os dados já carregados.":lookup.attempt?"Registro local da transmissão consultado.":"Sem tentativa registrada por este controle local; isso não confirma ausência de emissão no provedor."} <button type="button" className="outline-btn" onClick={()=>{setLookup(null);setVersion(v=>v+1);}}>Consultar registro local</button></p>}
    <div className="table-wrap"><table>
     <thead><tr><th>Etapa</th><th>Situação</th><th>Conferência</th><th>Referências</th></tr></thead>
     <tbody>{steps.map(row=><tr key={row.label}><th scope="row">{row.label}</th><td><span className={"fiscal-state "+(row.status==="registrado"?"ok":"pending")}>{row.status}</span></td><td>{row.detail}</td><td>{row.references.slice(0,6).join(" • ")||"—"}{row.references.length>6?` (+${row.references.length-6})`:""}</td></tr>)}</tbody>
    </table></div>
   </>}
  </div>
  <div className="fiscal-flow-note"><ShieldCheck size={17}/><span><b>Nenhuma operação é repetida nesta tela</b><small>Quando faltar evidência ou houver divergência, confira o registro de origem e o provedor antes de emitir ou dar baixa.</small></span></div>
 </section>;
}
