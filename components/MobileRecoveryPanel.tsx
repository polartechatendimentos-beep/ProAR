"use client";
import {MobileCloudDrafts} from "./MobileCloudDrafts";
import {useCallback,useEffect,useRef,useState} from "react";
import {clearOrderDraft,listOrderDrafts,saveOrderDraft,type OrderDraft} from "@/lib/mobile-order-drafts";
import {fieldQueueSummary} from "@/lib/field-offline-queue";
import {prepareMobileShell} from "@/lib/mobile-shell";
import {loadDayPackage,loadOfflineSnapshot,saveDayHistories,saveDayPackage} from "@/lib/mobile-day-cache";
import {createDayPackage,rememberOfflineLease,clearOfflineLease,draftRecoveryState,type MobileDayData,type CachedHistory,type MobileDayPackage,type MobileOfflineSnapshot} from "@/lib/mobile-day-policy";
import {orderSubmissionConfirmed,orderSubmissionFailure} from "@/lib/mobile-order-submission";
import {isOpenMobileOrder} from "@/lib/mobile-field";
import styles from "./ProARFieldMobile.module.css";
const labels={DRAFT:"Rascunho local • ainda não enviado",PENDING:"Preparado • aguardando envio",AWAITING_CONFIRMATION:"Enviado • confirmação pendente",BLOCKED:"Bloqueado • precisa de revisão"};
type QueueRow=Awaited<ReturnType<typeof fieldQueueSummary>>[number];
export function MobileRecoveryPanel({scope,orderIds,readAt,onResume,onCentral,onSessionExpired,onRefreshOnline,data}:{data?:MobileDayData;scope:string;orderIds:string[];readAt:string;onResume:(draft:OrderDraft)=>void;onCentral:()=>void;onSessionExpired:()=>void;onRefreshOnline:()=>Promise<void>}){
  const [drafts,setDrafts]=useState<OrderDraft[]>([]),[queue,setQueue]=useState<QueueRow[]>([]),[pack,setPack]=useState<MobileDayPackage|null>(null),[snapshot,setSnapshot]=useState<MobileOfflineSnapshot|null>(null),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const abort=useRef<AbortController|null>(null);
  const refresh=useCallback(async()=>{try{const [d,q,p,o]=await Promise.allSettled([listOrderDrafts(scope),fieldQueueSummary(scope),loadDayPackage(scope),loadOfflineSnapshot(scope)]);if(d.status==="fulfilled")setDrafts(d.value.sort((a,b)=>b.savedAt-a.savedAt));if(q.status==="fulfilled")setQueue(q.value);if(p.status==="fulfilled")setPack(p.value);if(o.status==="fulfilled")setSnapshot(o.value);if([d,q,p,o].some(r=>r.status==="rejected"))setNotice("Parte do armazenamento local não respondeu. Os registros que puderam ser lidos continuam disponíveis. Não apague os dados do navegador.");}catch{setNotice("Não foi possível consultar o armazenamento local. Não apague os dados do navegador.");}},[scope]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>{clearInterval(timer);abort.current?.abort();};},[refresh,readAt]);
  async function refreshOfflineCopy(){
    if(busy)return;if(!navigator.onLine||data?.connected!==true){setNotice("Conecte ao ProAR antes de atualizar a cópia offline.");return;}
    setBusy(true);setNotice("Atualizando as O.S. autorizadas para uso offline…");
    const previous=snapshot?.preparedAt||0;
    try{
      await onRefreshOnline();
      const updated=await loadOfflineSnapshot(scope);
      if(!updated||updated.preparedAt<=previous)throw new Error("A cópia offline não foi atualizada. Confirme a conexão e tente novamente.");
      setSnapshot(updated);await refresh();
      setNotice(`${updated.data.orders.length} O.S. autorizadas atualizadas em ${new Date(updated.preparedAt).toLocaleString("pt-BR")}. Disponíveis até ${new Date(updated.validUntil).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}.`);
    }catch(error){setNotice(error instanceof Error?error.message:"Não foi possível atualizar a cópia offline.");}
    finally{setBusy(false);}
  }
  async function retryPending(draft:OrderDraft){
    const pending=draft.pendingSubmission,id=pending?.command.orderId;
    if(!pending||!id||busy)return;
    if(!navigator.onLine||data?.connected!==true){setNotice("Conecte e atualize os dados antes de reenviar esta O.S.");return;}
    if(!orderIds.includes(id)){setNotice("Esta O.S. não está mais autorizada para o usuário atual. O rascunho foi preservado.");return;}
    setBusy(true);setNotice(`Reenviando a operação original de ${id}…`);
    let status:number|undefined;
    try{
      const response=await fetch("/api/mobile/orders",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(pending.command)});
      status=response.status;const body=await response.json().catch(()=>({}));
      if(status===401||status===403){onSessionExpired();throw new Error(body.error||"A sessão ou a permissão precisa ser atualizada.");}
      if(!response.ok){
        const conflict=body?.conflict;
        const message=conflict? `${body.error||"A O.S. mudou no servidor."} Versão local: ${conflict.expectedVersion}; versão atual: ${conflict.currentVersion}. Revise antes de reenviar.` : String(body?.error||"Envio não confirmado.");
        await saveOrderDraft(scope,id,{...draft,pendingSubmission:orderSubmissionFailure(pending,message,status),savedAt:Date.now()});
        setNotice(message);await refresh();return;
      }
      if(!orderSubmissionConfirmed(pending,body))throw new Error("O servidor não confirmou completamente esta operação. O identificador original foi mantido.");
      await clearOrderDraft(scope,id);
      await onRefreshOnline();await refresh();
      setNotice(`O.S. ${id}: envio confirmado pelo servidor.`);
    }catch(error){
      const message=error instanceof Error?error.message:"Não foi possível confirmar o envio.";
      if(status===401||status===403){setNotice(message);return;}
      await saveOrderDraft(scope,id,{...draft,pendingSubmission:orderSubmissionFailure(pending,message,status),savedAt:Date.now()}).catch(()=>{});
      setNotice(message);await refresh();
    }finally{setBusy(false);}
  }
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
  async function prepareSelected(){
    if(!data||busy)return;setBusy(true);
    try{if(!navigator.onLine)throw new Error("Conecte para preparar a seleção autorizada.");
      const value=createDayPackage(data,Date.now(),selectedIds);if(!value.data.orders.length)throw new Error("Selecione ao menos uma OS em aberto.");
      await saveDayPackage(value);rememberOfflineLease(sessionStorage,value);await refresh();setNotice(`${value.data.orders.length} OS selecionada(s) preparadas. Prepare também a interface e os históricos abaixo. Fotos e PDFs externos não foram baixados.`);
    }catch(error){setNotice(error instanceof Error?error.message:"Não foi possível preparar a seleção.");}finally{setBusy(false);}
  }
  function diagnostic(){const value={version:1,generatedAt:new Date().toISOString(),online:navigator.onLine,orders:pack?.data.orders.length||0,histories:Object.keys(pack?.histories||{}).length,drafts:drafts.length,blocked:drafts.filter(d=>draftRecoveryState(d)==="BLOCKED").length,pending:drafts.filter(d=>Boolean(d.pendingSubmission)).length,fleetQueue:queue.length,expiresAt:pack?.validUntil||null};const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="proar-mobile-diagnostico.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className={styles.detailCard} aria-label="Central de sincronização"><h2>Central de sincronização e recuperação</h2>
    <p>Os dados abaixo são deste aparelho, empresa e usuário. Uma OS só é concluída após confirmação do servidor.</p>
    <button type="button" className={styles.secondaryAction} onClick={()=>void refresh()}>Atualizar estado local</button>
    <button type="button" className={styles.secondaryAction} onClick={diagnostic}>Baixar diagnóstico de sincronização • sem dados de clientes</button>
    {data&&<details className={styles.requirementsList}><summary>Escolher OS de qualquer data para uso offline</summary><p>Selecionadas: {selectedIds.length}/200. A seleção substitui o pacote anterior; os rascunhos são preservados.</p>{data.orders.filter(o=>isOpenMobileOrder(o.status)).slice(0,200).map(o=><label key={o.id} className={styles.checkLabel}><input type="checkbox" checked={selectedIds.includes(o.id)} onChange={e=>setSelectedIds(ids=>e.target.checked?[...ids,o.id]:ids.filter(id=>id!==o.id))}/>{o.id} • {o.client} • {o.date||"Sem data"}</label>)}{data.orders.filter(o=>isOpenMobileOrder(o.status)).length>200&&<p>Mostrando as primeiras 200 OS abertas autorizadas.</p>}<button type="button" className={styles.primaryAction} disabled={busy||!selectedIds.length} onClick={()=>void prepareSelected()}>Preparar seleção no aparelho</button></details>}
    <h3>Prontidão offline</h3>
    <article className={styles.supportItem} aria-live="polite"><strong>Cópia completa das O.S.</strong>{snapshot?<p>{snapshot.data.orders.length} O.S. salvas neste aparelho. Atualizada em {new Date(snapshot.preparedAt).toLocaleString("pt-BR")}; disponível até {new Date(snapshot.validUntil).toLocaleString("pt-BR")}.</p>:<p>Nenhuma cópia offline válida foi encontrada para este usuário.</p>}<button type="button" disabled={busy||data?.connected!==true} className={styles.primaryAction} onClick={()=>void refreshOfflineCopy()}>{busy?"Atualizando…":"Atualizar O.S. para uso offline"}</button></article>
    {pack?<><p>{pack.data.orders.length} OS autorizada(s) no pacote do dia • {Object.keys(pack.histories).length} histórico(s). Preparado em {new Date(pack.preparedAt).toLocaleString("pt-BR")}. Leitura offline até {new Date(pack.validUntil).toLocaleString("pt-BR")}.{pack.truncated?" Pacote parcial: limite de 200 OS.":""}</p><button type="button" disabled={busy} className={styles.primaryAction} onClick={()=>void prepareHistories()}>{busy?"Preparando históricos…":"Preparar históricos e interface offline"}</button></>:<p>Prepare históricos e interface com conexão. Fotos e PDFs externos precisam ser baixados separadamente.</p>}
    <details className={styles.requirementsList}><summary>Estado de sincronização por O.S. ({(data?.orders||snapshot?.data.orders||[]).length})</summary>{(data?.orders||snapshot?.data.orders||[]).slice(0,100).map(order=>{
      const local=drafts.find(item=>(item.orderSnapshot?.id||item.pendingSubmission?.command.orderId)===order.id);
      const pending=local?.pendingSubmission;
      const expected=pending?.command.expectedVersion??local?.version;
      const current=Number(order.fieldVersion||0);
      const changed=Number.isFinite(expected)&&Number(expected)!==current;
      const status=pending?.blocked||changed?"Conflito ou revisão necessária":pending?.sentAt?"Confirmação do servidor pendente":pending?"Aguardando envio":local?"Rascunho salvo neste aparelho":data?.connected?"Carregada do servidor":"Disponível na cópia offline";
      return <article key={order.id} className={styles.supportItem}><strong>{order.id} • {order.client}</strong><p>{status}{expected!==undefined? ` • versão local ${expected}, servidor ${current}`:""}</p>{pending?.error&&<p>{pending.error}</p>}{pending&&!pending.blocked&&<button type="button" className={styles.secondaryAction} disabled={busy||!navigator.onLine||data?.connected!==true||!orderIds.includes(order.id)} onClick={()=>void retryPending(local!)}>Reenviar operação original</button>}{(pending?.blocked||changed)&&<p>Não substituímos dados automaticamente. Abra a O.S. para comparar e revisar antes de salvar.</p>}</article>;
    })}{(data?.orders||snapshot?.data.orders||[]).length>100&&<p>Mostrando as primeiras 100 O.S. O pacote offline conserva a lista completa autorizada.</p>}</details>
    {notice&&<p role="status" className={styles.warning}>{notice}</p>}
    <MobileCloudDrafts key={scope} scope={scope} drafts={drafts} orderIds={orderIds} canEdit={data?.user.canEdit===true} onResume={onResume} onRefresh={()=>void refresh()}/>
    <h3>OS neste aparelho • {drafts.length}</h3>{!drafts.length&&<p>Nenhum rascunho recuperável neste usuário.</p>}
    {drafts.map((draft,index)=>{const id=draft.orderSnapshot?.id||draft.pendingSubmission?.command.orderId||"",state=draftRecoveryState(draft),canResume=Boolean(id&&draft.orderSnapshot&&(orderIds.includes(id)||draft.pendingSubmission));return <article key={`${id}-${index}`} className={styles.supportItem}><strong>{id||"Rascunho sem identificação"}</strong><p>{labels[state]} • salvo em {new Date(draft.savedAt).toLocaleString("pt-BR")}</p>{draft.pendingSubmission?.error&&<p>{draft.pendingSubmission.error}</p>}<p>{(draft.beforePhotos?.length||0)+(draft.afterPhotos?.length||0)+(draft.before?1:0)+(draft.after?1:0)} foto(s) no rascunho.</p><button type="button" className={styles.secondaryAction} disabled={!canResume} onClick={()=>onResume(draft)}>Retomar e revisar OS</button>{!canResume&&<p>A OS não está na lista autorizada atual; o rascunho permanece no aparelho.</p>}</article>;})}
    <h3>Frota e jornada • {queue.length} registro(s)</h3>{queue.map(row=><p key={row.id}>{row.state==="FAILED"?"Bloqueado para revisão":row.state==="SYNCING"?"Envio em andamento":"Aguardando envio"} • {row.attempts} tentativa(s){row.error?` • ${row.error}`:""}</p>)}{queue.length>0&&<button type="button" className={styles.secondaryAction} onClick={onCentral}>Abrir Central de campo para sincronizar</button>}
  </section>;
}
