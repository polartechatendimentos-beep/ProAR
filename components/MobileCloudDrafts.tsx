"use client";
import {useEffect,useRef,useState} from "react";
import {loadOrderDraft,saveOrderDraft,type OrderDraft} from "@/lib/mobile-order-drafts";
import styles from "./ProARFieldMobile.module.css";
type Copy={orderId:string;savedAt:number;revision:number;expiresAt:number};
export function MobileCloudDrafts({scope,drafts,orderIds,canEdit,onResume,onRefresh}:{scope:string;drafts:OrderDraft[];orderIds:string[];canEdit:boolean;onResume:(draft:OrderDraft)=>void;onRefresh:()=>void}){
 const [copies,setCopies]=useState<Copy[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>{request.current?.abort();request.current=null;},[]);
 async function run(task:(signal:AbortSignal)=>Promise<void>){
  if(request.current)return;
  if(!navigator.onLine){setNotice("Conecte à internet para guardar ou recuperar uma cópia em nuvem.");return;}
  const controller=new AbortController();request.current=controller;setBusy(true);setNotice("");
  try{await task(controller.signal);}catch(error){if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:"Cópia não confirmada. O rascunho local foi preservado.");}finally{if(request.current===controller){request.current=null;setBusy(false);}}
 }
 async function json(url:string,signal:AbortSignal,init:RequestInit={}){
  const response=await fetch(url,{...init,signal,cache:"no-store",credentials:"same-origin"});
  const body=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(body?.error||"Não foi possível confirmar a cópia.");
  return body;
 }
 async function list(signal:AbortSignal,page=0){
  const body=await json("/api/mobile/drafts?offset="+page,signal);
  if(!Array.isArray(body?.drafts))throw new Error("Resposta de cópias inválida.");
  setCopies(body.drafts);setOffset(page);setMore(body.hasMore===true);
 }
 async function backup(draft:OrderDraft,signal:AbortSignal){
  const id=draft.orderSnapshot?.id;
  if(!id||!orderIds.includes(id)||draft.pendingSubmission)throw new Error("Revise a identificação e os envios pendentes desta OS antes de guardar a cópia.");
  const before=await json("/api/mobile/drafts?orderId="+encodeURIComponent(id),signal);
  if(before.available&&!window.confirm("Substituir a cópia de texto já guardada em nuvem para "+id+"?"))return;
  const {version,editToken,report,diagnosis,observations,measurements,checklist,equipmentIds,savedAt}=draft;
  const result=await json("/api/mobile/drafts",signal,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:id,expectedRevision:before.revision,draft:{version,editToken,report,diagnosis,observations,measurements,checklist,equipmentIds,savedAt}})});
  if(result?.saved!==true)throw new Error("O servidor não confirmou a cópia.");
  await list(signal,0);setNotice("Cópia de texto confirmada em nuvem para "+id+". A OS ainda não foi salva ou concluída.");
 }
 async function restore(copy:Copy,signal:AbortSignal){
  const body=await json("/api/mobile/drafts?orderId="+encodeURIComponent(copy.orderId),signal);
  if(!body.available||!body.draft?.orderSnapshot)throw new Error("A cópia expirou ou a OS não está mais disponível.");
  const local=await loadOrderDraft(scope,copy.orderId);
  if(local?.pendingSubmission)throw new Error("Existe um envio pendente neste aparelho. Revise a confirmação antes de recuperar outra cópia.");
  if(!window.confirm("Recuperar o texto de "+copy.orderId+" salvo em "+new Date(copy.savedAt).toLocaleString("pt-BR")+"? O texto local será substituído para revisão. Fotos locais serão preservadas."))return;
  const value:OrderDraft={...body.draft,before:local?.before||"",after:local?.after||"",signature:local?.signature||"",signerName:local?.signerName||"",beforePhotos:local?.beforePhotos||[],afterPhotos:local?.afterPhotos||[]};
  await saveOrderDraft(scope,copy.orderId,value);onRefresh();onResume(value);
 }
 return <details className={styles.journeyPanel}><summary>Cópias de texto em nuvem • recuperar em outro aparelho</summary>
  <p>Guarda diagnóstico, relatório, observações, checklist, medições e equipamentos por até 30 dias, somente para o mesmo usuário e empresa. Fotos e assinaturas permanecem no aparelho ou nas evidências já enviadas da OS.</p>
  <p>Recuperar exige revisar os dados antes de salvar. Nenhuma OS é concluída por esta opção.</p>
  <button type="button" className={styles.secondaryAction} disabled={busy} onClick={()=>void run(signal=>list(signal,0))}>Consultar minhas cópias em nuvem</button>
  {notice&&<p role="status" className={styles.warning}>{notice}</p>}
  <h4>Guardar texto deste aparelho</h4>
  {drafts.filter(d=>d.orderSnapshot&&orderIds.includes(d.orderSnapshot.id)).map(draft=><div key={draft.orderSnapshot!.id}><span>{draft.orderSnapshot!.id} • {new Date(draft.savedAt).toLocaleString("pt-BR")}</span><button type="button" className={styles.secondaryAction} disabled={busy||!canEdit||Boolean(draft.pendingSubmission)} onClick={()=>void run(signal=>backup(draft,signal))}>Guardar cópia de texto</button>{draft.pendingSubmission&&<p>Revise o envio pendente antes de guardar outra cópia.</p>}</div>)}
  <h4>Recuperar cópia em nuvem</h4>
  {copies.map(copy=><div key={copy.orderId}><span>{copy.orderId} • salvo em {new Date(copy.savedAt).toLocaleString("pt-BR")} • disponível até {new Date(copy.expiresAt).toLocaleDateString("pt-BR")}</span><button type="button" className={styles.secondaryAction} disabled={busy||!orderIds.includes(copy.orderId)} onClick={()=>void run(signal=>restore(copy,signal))}>Recuperar texto e revisar</button></div>)}
  {offset>0&&<button type="button" disabled={busy} className={styles.secondaryAction} onClick={()=>void run(signal=>list(signal,Math.max(0,offset-50)))}>Página anterior</button>}
  {more&&<button type="button" disabled={busy} className={styles.secondaryAction} onClick={()=>void run(signal=>list(signal,offset+50))}>Próxima página</button>}
 </details>;
}
