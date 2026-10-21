"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {listOrderDrafts,type OrderDraft} from "@/lib/mobile-order-drafts";
import {fieldQueueSummary} from "@/lib/field-offline-queue";
import {prepareMobileShell} from "@/lib/mobile-shell";
import {loadDayPackage,saveDayHistories} from "@/lib/mobile-day-cache";
import {clearOfflineLease,draftRecoveryState,type CachedHistory,type MobileDayPackage} from "@/lib/mobile-day-policy";
import styles from "./ProARFieldMobile.module.css";
const labels={DRAFT:"Rascunho local • ainda não enviado",PENDING:"Preparado • aguardando envio",AWAITING_CONFIRMATION:"Enviado • confirmação pendente",BLOCKED:"Bloqueado • precisa de revisão"};
type QueueRow=Awaited<ReturnType<typeof fieldQueueSummary>>[number];
export function MobileRecoveryPanel({scope,orderIds,readAt,onResume,onCentral,onSessionExpired}:{scope:string;orderIds:string[];readAt:string;onResume:(draft:OrderDraft)=>void;onCentral:()=>void;onSessionExpired:()=>void}){
  const [drafts,setDrafts]=useState<OrderDraft[]>([]),[queue,setQueue]=useState<QueueRow[]>([]),[pack,setPack]=useState<MobileDayPackage|null>(null),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  const abort=useRef<AbortController|null>(null);
  const refresh=useCallback(async()=>{try{const [d,q,p]=await Promise.allSettled([listOrderDrafts(scope),fieldQueueSummary(scope),loadDayPackage(scope)]);if(d.status==="fulfilled")setDrafts(d.value.sort((a,b)=>b.savedAt-a.savedAt));if(q.status==="fulfilled")setQueue(q.value);if(p.status==="fulfilled")setPack(p.value);if([d,q,p].some(r=>r.status==="rejected"))setNotice("Parte do armazenamento local não respondeu. Os registros que puderam ser lidos continuam disponíveis. Não apague os dados do navegador.");}catch{setNotice("Não foi possível consultar o armazenamento local. Não apague os dados do navegador.");}},[scope]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>{clearInterval(timer);abort.current?.abort();};},[refresh,readAt]);
  async function prepareHistories(){
    if(busy)return;if(!navigator.onLine){setNotice("Conecte para preparar os históricos do dia.");return;}
    setBusy(true);const controller=new AbortController();abort.current=controller;
    try{
      const current=await loadDayPackage(scope);if(!current)throw new Error("Atualize os atendimentos para preparar um pacote com sessão válida.");
      setNotice("Preparando os arquivos da interface para recarregar sem internet…");
      const shellReady=await prepareMobileShell();
      if(controller.signal.aborted)throw new Error("Preparo interrompido.");
      const selected=current.data.orders.slice(0,20),histories:Record<string,CachedHistory[]>={};let failed=0,completed=0;
      for(let i=0;i<selected.length;i+=2){await Promise.all(selected.slice(i,i+2).map(async order=>{
        try{const response=await fetch(`/api/mobile/orders?orderId=${encodeURIComponent(order.id)}&view=customer-history`,{cache:"no-store",credentials:"same-origin",signal:controller.signal});
          if(response.status===401||response.status===403){try{clearOfflineLease(sessionStorage);}catch{}controller.abort();onSessionExpired();throw new Error("Sessão ou permissão precisa ser atualizada.");}
          if(!response.ok)throw new Error();const body=await response.json();if(!Array.isArray(body.history))throw new Error();
          histories[order.id]=body.history.slice(0,30).map((r:Record<string,unknown>)=>({id:String(r.id??"").slice(0,150),date:String(r.date??"").slice(0,80),service:String(r.service??"").slice(0,1000),diagnosis:String(r.diagnosis??"").slice(0,4000),report:String(r.report??"").slice(0,8000),unit:String(r.unit??"").slice(0,250)}));
        }catch{failed++;}finally{completed++;if(!controller.signal.aborted)setNotice(`Preparando históricos: ${completed}/${selected.length}…`);}
      }));if(controller.signal.aborted)throw new Error("Preparo interrompido. Atualize a sessão antes de continuar.");}
      if(!await saveDayHistories(scope,current.preparedAt,histories))throw new Error("A lista foi atualizada durante o preparo. Tente novamente para usar a versão atual.");
      setNotice(`${shellReady?"Interface offline confirmada.":"Interface offline não confirmada; reabrir o aplicativo pode exigir internet."} ${Object.keys(histories).length} histórico(s) preparado(s) no aparelho. ${failed} falha(s). ${current.data.orders.length>20?"Limite de 20 OS por preparo; pacote parcial.":""} Fotos e PDFs externos precisam de conexão.`);await refresh();
    }catch(error){setNotice(error instanceof Error?error.message:"Preparo não confirmado.");}finally{setBusy(false);}
  }
  return <section className={styles.detailCard} aria-label="Central de sincronização"><h2>Central de sincronização e recuperação</h2>
    <p>Os dados abaixo são deste aparelho, empresa e usuário. Uma OS só é concluída após confirmação do servidor.</p>
    <button type="button" className={styles.secondaryAction} onClick={()=>void refresh()}>Atualizar estado local</button>
    <h3>Pacote do dia</h3>{pack?<><p>{pack.data.orders.length} OS do dia ou em atendimento • {Object.keys(pack.histories).length} histórico(s). Preparado em {new Date(pack.preparedAt).toLocaleString("pt-BR")}. Leitura offline até {new Date(pack.validUntil).toLocaleString("pt-BR")}.{pack.truncated?" Pacote parcial: limite de 200 OS.":""}</p><button type="button" disabled={busy} className={styles.primaryAction} onClick={()=>void prepareHistories()}>{busy?"Preparando históricos…":"Preparar acesso offline e históricos"}</button></>:<p>Atualize os atendimentos com conexão para preparar as OS autorizadas do dia. A cópia expira com a sessão ou a mudança do dia.</p>}
    {notice&&<p role="status" className={styles.warning}>{notice}</p>}
    <h3>OS neste aparelho • {drafts.length}</h3>{!drafts.length&&<p>Nenhum rascunho recuperável neste usuário.</p>}
    {drafts.map((draft,index)=>{const id=draft.orderSnapshot?.id||draft.pendingSubmission?.command.orderId||"",state=draftRecoveryState(draft),canResume=Boolean(id&&draft.orderSnapshot&&(orderIds.includes(id)||draft.pendingSubmission));return <article key={`${id}-${index}`} className={styles.supportItem}><strong>{id||"Rascunho sem identificação"}</strong><p>{labels[state]} • salvo em {new Date(draft.savedAt).toLocaleString("pt-BR")}</p>{draft.pendingSubmission?.error&&<p>{draft.pendingSubmission.error}</p>}<p>{(draft.beforePhotos?.length||0)+(draft.afterPhotos?.length||0)+(draft.before?1:0)+(draft.after?1:0)} foto(s) no rascunho.</p><button type="button" className={styles.secondaryAction} disabled={!canResume} onClick={()=>onResume(draft)}>Retomar e revisar OS</button>{!canResume&&<p>A OS não está na lista autorizada atual; o rascunho permanece no aparelho.</p>}</article>;})}
    <h3>Frota e jornada • {queue.length} registro(s)</h3>{queue.map(row=><p key={row.id}>{row.state==="FAILED"?"Bloqueado para revisão":row.state==="SYNCING"?"Envio em andamento":"Aguardando envio"} • {row.attempts} tentativa(s){row.error?` • ${row.error}`:""}</p>)}{queue.length>0&&<button type="button" className={styles.secondaryAction} onClick={onCentral}>Abrir Central de campo para sincronizar</button>}
  </section>;
}
