"use client";

import { useEffect, useState } from "react";
import { computeBidFloor, evaluateAssistedBid, type ApprovedFloor, type FloorInput } from "@/lib/bidding-assisted-floor";

const endpoint="/api/bidding-workflow";
const fields = {materials:"Materiais",labor:"Mão de obra",travel:"Deslocamento",other:"Outros custos",taxes:"Tributos sobre a venda (%)",margin:"Margem sobre a venda (%)"} as const;
const initial:FloorInput={scope:"lote",reference:"",materials:"",labor:"",travel:"",other:"",taxes:"",margin:""};
const money=(cents:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents/100);
type FloorList = {revision:number; canEdit:boolean; canApprove:boolean; actor:string; floors:ApprovedFloor[]};

export function BiddingAssistedFloor({tenderId}:{tenderId:string}){
 const [draft,setDraft]=useState<FloorInput>(initial);
 const [data,setData]=useState<FloorList|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [confirmed,setConfirmed]=useState(false);
 const [selection,setSelection]=useState("");
 const [candidate,setCandidate]=useState("");
 const [decisionNote,setDecisionNote]=useState("");
 const [evaluation,setEvaluation]=useState<ReturnType<typeof evaluateAssistedBid>|null>(null);
 const selected=data?.floors.find(f=>f.key===selection);
 let calculation:ReturnType<typeof computeBidFloor>|null=null;
 let validation="";
 try{calculation=computeBidFloor(draft);}catch(error){validation=error instanceof Error?error.message:"Revise os campos.";}
 const reload=async(signal?:AbortSignal)=>{
  const response=await fetch(endpoint+"?floorTender="+encodeURIComponent(tenderId),{cache:"no-store",signal});
  const payload=await response.json();
  if(!response.ok)throw new Error(payload.error||"Não foi possível carregar os pisos.");
  return payload as FloorList;
 };
 useEffect(()=>{
  const controller=new AbortController();
  reload(controller.signal).then(setData).catch(error=>{if(!controller.signal.aborted)setNotice(error.message);});
  return()=>controller.abort();
  // The containing view remounts this section when the tender changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[tenderId]);
 async function act(action:"submit-bid-floor"|"decide-bid-floor",fields:Record<string,unknown>){
  if(!data||busy)return false;
  setBusy(true);setNotice("");setEvaluation(null);
  try{
   const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,tenderId,expectedRevision:data.revision,...fields})});
   const payload=await response.json();
   if(!response.ok){
    if(response.status===409)try{setData(await reload());}catch{/* Preserve the original error. */}
    throw new Error(payload.error||"Não foi possível registrar a revisão.");
   }
   setData({...data,revision:payload.revision,floors:payload.floors});setNotice(action==="submit-bid-floor"?"Piso salvo para revisão de outra pessoa autorizada.":"Decisão registrada no fluxo interno.");return true;
  }catch(error){setNotice(error instanceof Error?error.message:"Falha no fluxo de revisão.");return false;}
  finally{setBusy(false);}
 }
 async function checkCandidate(){
  if(busy||!candidate||!selection)return;
  setBusy(true);setNotice("");setEvaluation(null);
  try{
   const latest=await reload();
   setData(latest);
   const floor=latest.floors.find(f=>f.key===selection);
   setEvaluation(evaluateAssistedBid(floor,candidate));
  }catch(error){setNotice(error instanceof Error?error.message:"Não foi possível confirmar o piso atual.");}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-label="Disputa assistida" style={{padding:14,marginTop:12,border:"1px solid #36536a",borderRadius:10}}>
  <h4>Disputa assistida: piso interno por item ou lote</h4>
  <p>Use a mesma base do edital: custo e valor do lance por unidade do item ou pelo total do lote. Se mudar o edital ou o custo, envie um novo piso para aprovação. O ProAR não acompanha a sala nem envia lances.</p>
  {notice&&<p role="status">{notice}</p>}
  {!data&&!notice&&<p>Carregando pisos deste edital…</p>}
  {data?.canEdit&&<>
   <div className="form-grid">
    <label>Base da disputa<select value={draft.scope} onChange={e=>{setDraft({...draft,scope:e.target.value as FloorInput["scope"]});setConfirmed(false);}}><option value="item">Item (valor unitário)</option><option value="lote">Lote (valor total)</option></select></label>
    <label>Número ou código no edital<input maxLength={50} value={draft.reference} onChange={e=>{setDraft({...draft,reference:e.target.value});setConfirmed(false);}}/></label>
    {Object.entries(fields).map(([key,label])=><label key={key}>{label}<input inputMode="decimal" maxLength={22} value={draft[key as keyof typeof fields]} onChange={e=>{setDraft({...draft,[key]:e.target.value});setConfirmed(false);}}/></label>)}
   </div>
   {calculation?<p>Equilíbrio sem margem: <strong>{money(calculation.breakEvenCents)}</strong> · Piso com margem: <strong>{money(calculation.floorCents)}</strong></p>:<small>{validation}</small>}
   <label style={{display:"block",margin:"8px 0"}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Conferi o item ou lote, a unidade de preço e os custos com os documentos comerciais e financeiros.</label>
   <button type="button" className="primary-btn" disabled={busy||!calculation||!confirmed} onClick={()=>void act("submit-bid-floor",{floor:draft,costsReviewed:confirmed}).then(ok=>{if(ok){setConfirmed(false);setDraft(initial);}})}>Enviar piso para revisão interna</button>
  </>}
  {data&&<>
   <h5>Pisos deste edital</h5>
   {data.floors.length?<ul>{data.floors.map(f=><li key={f.key}><strong>{f.scope==="lote"?"Lote":"Item"} {f.reference}: {money(f.floorCents)}</strong> · {f.status==="approved"?"Aprovado":f.status==="rejected"?"Devolvido":"Aguardando revisão"}
    <small style={{display:"block"}}>Custos: materiais {f.materials} • mão de obra {f.labor} • deslocamento {f.travel} • outros {f.other} (R$). Tributos: {f.taxes}% · margem: {f.margin}%. Proposto por {f.submittedBy}.</small>
    {f.decidedBy&&<small style={{display:"block"}}>{f.decidedBy}: {f.decisionNote}</small>}
    {data.canApprove&&f.status==="pending"&&f.submittedBy!==data.actor&&<div><label>Justificativa da revisão<input maxLength={500} value={selection===f.key?decisionNote:""} onChange={e=>{setSelection(f.key);setDecisionNote(e.target.value);setCandidate("");}}/></label>
     <button type="button" className="outline-btn" disabled={busy||selection!==f.key||decisionNote.trim().length<5} onClick={()=>void act("decide-bid-floor",{floorKey:f.key,decision:"approved",note:decisionNote}).then(ok=>{if(ok)setDecisionNote("");})}>Aprovar piso</button>{" "}
     <button type="button" className="outline-btn" disabled={busy||selection!==f.key||decisionNote.trim().length<5} onClick={()=>void act("decide-bid-floor",{floorKey:f.key,decision:"rejected",note:decisionNote}).then(ok=>{if(ok)setDecisionNote("");})}>Devolver</button>
    </div>}
   </li>)}</ul>:<p>Nenhum piso registrado.</p>}
   <div className="form-grid">
    <label>Piso aprovado para comparar<select disabled={busy} value={selected?.status==="approved"?selection:""} onChange={e=>{setSelection(e.target.value);setCandidate("");setDecisionNote("");setEvaluation(null);}}><option value="">Selecione</option>{data.floors.filter(f=>f.status==="approved").map(f=><option value={f.key} key={f.key}>{f.scope==="lote"?"Lote":"Item"} {f.reference} · {money(f.floorCents)}</option>)}</select></label>
    <label>Valor pretendido (R$)<input disabled={busy||selected?.status!=="approved"} inputMode="decimal" maxLength={22} value={candidate} onChange={e=>{setCandidate(e.target.value);setEvaluation(null);}}/></label>
   </div>
   <button type="button" className="outline-btn" disabled={busy||selected?.status!=="approved"||!candidate.trim()} onClick={()=>void checkCandidate()}>Conferir com o piso aprovado</button>
   {evaluation&&<p role={evaluation.status==="abaixo"?"alert":"status"}>{evaluation.detail}</p>}
  </>}
 </section>;
}
