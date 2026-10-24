"use client";
import { useEffect, useRef, useState } from "react";
import type { MobileFieldOrder } from "@/lib/mobile-field";
import {equipmentInspection} from "@/lib/mobile-experience";
import {FieldPhotoComparison} from "./FieldPhotoComparison";
import { mobileChecklist } from "@/lib/mobile-service-checklists";
import { loadOrderDraft, saveOrderDraft, clearOrderDraft, type OrderDraft } from "@/lib/mobile-order-drafts";
import { LocalFieldAssistant } from "./LocalFieldAssistant";
import { FieldPhotoCollection } from "./FieldPhotoCollection";
import { fieldMeasurements, reportTemplates, type FieldMeasurements } from "@/lib/mobile-report-details";
import { FieldAttendanceControls } from "./FieldAttendanceControls";
import { FieldOrderTools } from "./FieldOrderTools";
import { queueOrderSubmission, orderSubmissionFailure, orderSubmissionConfirmed, type PendingOrderSubmission } from "@/lib/mobile-order-submission";
import type { FieldOrderCommand } from "@/lib/mobile-workday";
import styles from "./ProARFieldMobile.module.css";

async function gps(){const cap=(window as unknown as {Capacitor?:{isNativePlatform?:()=>boolean;isPluginAvailable?:(name:string)=>boolean;nativePromise?:(plugin:string,method:string,options:unknown)=>Promise<unknown>}}).Capacitor;
  if(cap?.isNativePlatform?.()&&cap.isPluginAvailable?.("WorkRoute")&&cap.nativePromise)return cap.nativePromise("WorkRoute","position",{});
  return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve({id:crypto.randomUUID(),capturedAt:new Date(p.timestamp).toISOString(),latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
}
export function FieldOrderEditor({order,requiresJourney,onSaved,scope,canApprove}:{order:MobileFieldOrder;requiresJourney:boolean;scope:string;canApprove:boolean;onSaved:(result?:{orderId:string;completedAt:string})=>Promise<void>}){
  const [report,setReport]=useState(order.executedService||""),[diagnosis,setDiagnosis]=useState(order.diagnosis||""),[checklist,setChecklist]=useState(order.mobileChecklist||{});
  const [before,setBefore]=useState(""),[after,setAfter]=useState(""),[signature,setSignature]=useState(""),[signerName,setSignerName]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  const [observations,setObservations]=useState(order.observations||""),[measurements,setMeasurements]=useState<FieldMeasurements>(order.measurements||{}),[beforePhotos,setBeforePhotos]=useState<string[]>([]),[afterPhotos,setAfterPhotos]=useState<string[]>([]),[template,setTemplate]=useState("");
  const [photoProcessing,setPhotoProcessing]=useState({before:false,after:false});
  const mediaBusy=photoProcessing.before||photoProcessing.after;
  const [equipmentIds,setEquipmentIds]=useState(order.equipmentIds);
  const [confirmed,setConfirmed]=useState(false);
  const [review,setReview]=useState(false),[pendingSubmission,setPendingSubmission]=useState<PendingOrderSubmission|undefined>();
  const submissionRef=useRef<PendingOrderSubmission|undefined>(undefined),operationLock=useRef(false);
  const noticeRef=useRef<HTMLParagraphElement|null>(null);
  const canvas=useRef<HTMLCanvasElement|null>(null),drawing=useRef(false),drew=useRef(false);
  const approved=(kind:string)=>order.fieldExceptions?.some(item=>item.kind===kind&&item.status==="Aprovado"&&item.decidedBy&&item.decidedAt);
  const done={...checklist,equipment:equipmentIds.length>0||Boolean(approved("equipment")),checkin:Boolean(order.checkInAt),beforePhoto:Boolean(before||beforePhotos.length||order.evidence.before),afterPhoto:Boolean(after||afterPhotos.length||order.evidence.after),signature:Boolean((signature&&signerName.trim())||order.evidence.signature)||Boolean(approved("signature")),executedService:Boolean(report.trim()),diagnosis:Boolean(diagnosis.trim())};

  const contextualChecklist=equipmentInspection((order.equipmentOptions||[]).filter(item=>equipmentIds.includes(item.id)).map(item=>item.label));
  const checklistItems=[...mobileChecklist(order.service),...contextualChecklist];
  const requirements=[...new Map([{key:"diagnosis",label:"Diagnóstico e medições",required:true},...checklistItems].map(item=>[item.key,item])).values()];
  const pendingRequirements=requirements.filter(item=>item.required&&!done[item.key as keyof typeof done]);
  const [draftReady,setDraftReady]=useState(false),[draftNotice,setDraftNotice]=useState(""),[olderDraft,setOlderDraft]=useState<OrderDraft|null>(null);
  const latestDraft=useRef<OrderDraft|null>(null),suppressDraft=useRef(false);
  function restoreDraft(value:OrderDraft){submissionRef.current=value.pendingSubmission;setPendingSubmission(value.pendingSubmission);setReport(value.report);setDiagnosis(value.diagnosis);setChecklist(value.checklist);setEquipmentIds(value.equipmentIds);setBefore(value.before);setAfter(value.after);setSignature(value.signature);setSignerName(value.signerName);setObservations(value.observations||"");setMeasurements(value.measurements||{});setBeforePhotos(value.beforePhotos||[]);setAfterPhotos(value.afterPhotos||[]);}
  useEffect(()=>{
    let cancelled=false;
    void loadOrderDraft(scope,order.id).then(value=>{if(cancelled)return;if(value){if((value.version===order.fieldVersion&&(!value.editToken||value.editToken===order.editToken)) || value.pendingSubmission){restoreDraft(value);setDraftNotice("Rascunho recuperado neste aparelho.");}else{setOlderDraft(value);setDraftNotice("A OS mudou no servidor. Revise antes de recuperar o rascunho anterior.");}}setDraftReady(true);}).catch(()=>{if(!cancelled){setDraftNotice("Não foi possível acessar o rascunho local. Salve no servidor para preservar os dados.");setDraftReady(true);}});
    return()=>{cancelled=true;};
  },[scope,order.id,order.fieldVersion,order.editToken]);
  useEffect(()=>{
    if(!draftReady || olderDraft)return;
    const value={version:order.fieldVersion,editToken:order.editToken,observations,measurements,beforePhotos,afterPhotos,report,diagnosis,checklist,equipmentIds,before,after,signature,signerName,pendingSubmission,orderSnapshot:order,savedAt:Date.now()};
    latestDraft.current=value;
    const persist=()=>{if(!suppressDraft.current)void saveOrderDraft(scope,order.id,latestDraft.current||value).then(()=>setDraftNotice("Rascunho salvo neste aparelho • ainda não enviado.")).catch(()=>setDraftNotice("Falha ao salvar rascunho. Salve no servidor."));};
    const timer=setTimeout(persist,500);
    return()=>{clearTimeout(timer);};
  },[scope,order.id,order.fieldVersion,draftReady,olderDraft,observations,measurements,beforePhotos,afterPhotos,report,diagnosis,checklist,equipmentIds,before,after,signature,signerName,pendingSubmission,order]);
  useEffect(()=>{
    const flush=()=>{if(!suppressDraft.current&&latestDraft.current)void saveOrderDraft(scope,order.id,latestDraft.current).catch(()=>{});};
    const hidden=()=>{if(document.hidden)flush();};
    document.addEventListener("visibilitychange",hidden);
    window.addEventListener("pagehide",flush);
    return()=>{document.removeEventListener("visibilitychange",hidden);window.removeEventListener("pagehide",flush);flush();};
  },[scope,order.id]);
  function jumpTo(key:string){const target=document.getElementById(`field-${order.id}-${key}`);target?.scrollIntoView({behavior:"smooth",block:"center"});if(target?.matches("button,input,textarea"))target.focus();else target?.querySelector<HTMLElement>("input,textarea,button")?.focus();}
  async function sendExtra(action:string,data:Record<string,unknown>){
    if(operationLock.current || submissionRef.current||confirmed||mediaBusy)return;
    operationLock.current=true;setBusy(true);setNotice("");
    try{
      if(!navigator.onLine)throw new Error("Esta ação precisa de conexão. Seu relatório permanece no rascunho.");
      const response=await fetch("/api/mobile/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:crypto.randomUUID(),action,orderId:order.id,expectedVersion:order.fieldVersion,expectedToken:order.editToken,...data})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||"Operação não confirmada.");
      suppressDraft.current=true;setConfirmed(true);
      if(latestDraft.current)await saveOrderDraft(scope,order.id,{...latestDraft.current,version:body.version,editToken:undefined,equipmentIds:action==="register-equipment"?body.equipmentIds:latestDraft.current.equipmentIds,savedAt:Date.now()});
      await onSaved();
    }catch(e){setNotice(e instanceof Error?e.message:"Operação não confirmada.");}finally{operationLock.current=false;setBusy(false);}
  }

  function snapshot(pending?:PendingOrderSubmission):OrderDraft {
    return {version:order.fieldVersion,editToken:order.editToken,observations,measurements,beforePhotos,afterPhotos,report,diagnosis,checklist,equipmentIds,before,after,signature,signerName,pendingSubmission:pending,orderSnapshot:order,savedAt:Date.now()};
  }
  async function persistSubmission(pending:PendingOrderSubmission) {
    submissionRef.current=pending;setPendingSubmission(pending);
    latestDraft.current=snapshot(pending);
    await saveOrderDraft(scope,order.id,latestDraft.current);
  }
  async function transmit(pending:PendingOrderSubmission) {
    if(!navigator.onLine){setNotice("Aguardando sincronização. O envio está salvo neste aparelho; a OS ainda não foi concluída no servidor.");return;}
    let sent=pending;
    try {
      if(!sent.sentAt){
        const point=requiresJourney&&["start","finish"].includes(sent.command.action)?await gps() as FieldOrderCommand["point"]:undefined;
        sent={...sent,command:{...sent.command,...(point?{point}:{})},sentAt:Date.now(),error:undefined};
        await persistSubmission(sent);
      }
      const response=await fetch("/api/mobile/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(sent.command),signal:AbortSignal.timeout(45000)});
      const body=await response.json();
      if(!response.ok){const failed=orderSubmissionFailure(sent,body.error||"Envio não confirmado.",response.status);await persistSubmission(failed);setNotice(failed.error!);return;}
      if(!orderSubmissionConfirmed(sent,body))throw new Error("Resposta incompleta. Consulte novamente o mesmo envio para confirmar.");
      suppressDraft.current=true;await clearOrderDraft(scope,order.id);submissionRef.current=undefined;setPendingSubmission(undefined);
      setConfirmed(true);setNotice("OS confirmada no servidor.");
      await onSaved(sent.command.action==="finish"?{orderId:order.id,completedAt:body.completedAt}:undefined);
    } catch(error) {
      const failed=orderSubmissionFailure(sent,error instanceof Error?error.message:"Resposta não recebida. Consulte novamente este envio.");
      await persistSubmission(failed);setNotice(failed.error!);
    }
  }
  useEffect(()=>{
    if(!pendingSubmission || pendingSubmission.blocked || !navigator.onLine || !draftReady || olderDraft || confirmed)return;
    // A pending save may retry on reconnection. Check-in and completion require explicit technician confirmation.
    if(pendingSubmission.command.action!=="save")return;
    const onReconnect=()=>{if(navigator.onLine&&!operationLock.current&&submissionRef.current&&!submissionRef.current.blocked)void retrySubmission();};
    window.addEventListener("online",onReconnect);
    if(navigator.onLine)onReconnect();
    return()=>window.removeEventListener("online",onReconnect);
  },[pendingSubmission,draftReady,olderDraft,confirmed]);
  async function retrySubmission(){
    if(operationLock.current||!submissionRef.current||submissionRef.current.blocked)return;
    operationLock.current=true;setBusy(true);
    try{await transmit(submissionRef.current);}catch{setNotice("Não foi possível preservar o envio. Tente novamente sem fechar esta tela.");}finally{operationLock.current=false;setBusy(false);}
  }
  async function execute(action:"start"|"save"|"finish"){
    if(operationLock.current||submissionRef.current||confirmed||mediaBusy||!draftReady||olderDraft)return;
    if(action==="finish" && (pendingRequirements.length || (signature&&!signerName.trim()))){setReview(false);setNotice("Preencha os requisitos indicados e identifique quem assina antes de concluir.");return;}
    operationLock.current=true;setBusy(true);setNotice("");
    try{
      const pending=queueOrderSubmission({requestId:crypto.randomUUID(),action,orderId:order.id,expectedVersion:order.fieldVersion,expectedToken:order.editToken,report,diagnosis,observations,measurements,beforePhotos:[...(before?[before]:[]),...beforePhotos],afterPhotos:[...(after?[after]:[]),...afterPhotos],equipmentIds,checklist:done,signature,signerName});
      await persistSubmission(pending);setReview(false);await transmit(pending);
    }catch(error){setNotice(error instanceof Error?error.message:"Não foi possível preservar o envio. O relatório permanece na tela.");}finally{operationLock.current=false;setBusy(false);}
  }
  async function cancelUnsent(){
    if(operationLock.current||!submissionRef.current||submissionRef.current.sentAt)return;
    operationLock.current=true;setBusy(true);
    try{latestDraft.current=snapshot();await saveOrderDraft(scope,order.id,latestDraft.current);submissionRef.current=undefined;setPendingSubmission(undefined);setNotice("Envio ainda não transmitido cancelado. Continue editando o rascunho.");}
    catch{setNotice("Não foi possível atualizar o rascunho. Tente novamente.");}
    finally{operationLock.current=false;setBusy(false);}
  }
  async function reviewConflict(){
    if(operationLock.current||!submissionRef.current?.blocked)return;
    operationLock.current=true;setBusy(true);
    try{await saveOrderDraft(scope,order.id,snapshot());submissionRef.current=undefined;setPendingSubmission(undefined);await onSaved();setNotice("Dados atualizados. Revise o rascunho antes de enviar novamente.");}
    catch{setNotice("Não foi possível atualizar. O rascunho permanece preservado.");}
    finally{operationLock.current=false;setBusy(false);}
  }
  function pointer(event:React.PointerEvent<HTMLCanvasElement>,start:boolean){const c=canvas.current;if(!c||busy||submissionRef.current||olderDraft||!draftReady)return;const rect=c.getBoundingClientRect(),ctx=c.getContext("2d")!,x=(event.clientX-rect.left)*c.width/rect.width,y=(event.clientY-rect.top)*c.height/rect.height;ctx.strokeStyle="#122b47";ctx.lineWidth=2;
    if(start){drawing.current=true;drew.current=false;c.setPointerCapture(event.pointerId);ctx.beginPath();ctx.moveTo(x,y);}else if(drawing.current){ctx.lineTo(x,y);ctx.stroke();drew.current=true;}}
  return <article className={styles.detailCard}><h2>Executar atendimento</h2>
    <p role="status" className={styles.syncBanner}>{confirmed?"Sincronizado • gravação confirmada no servidor.":pendingSubmission?"Envio preservado neste aparelho • aguardando confirmação.":draftNotice||"Preparando rascunho…"}</p>
    {olderDraft&&!pendingSubmission&&<button type="button" className={styles.secondaryAction} onClick={()=>{restoreDraft(olderDraft);setOlderDraft(null);}}>Recuperar rascunho para revisão</button>}
    {olderDraft&&!pendingSubmission&&<button type="button" className={styles.secondaryAction} onClick={()=>{suppressDraft.current=true;void clearOrderDraft(scope,order.id).then(()=>{latestDraft.current=null;suppressDraft.current=false;setOlderDraft(null);setDraftNotice("Rascunho anterior descartado.");}).catch(()=>{suppressDraft.current=false;setNotice("Não foi possível descartar o rascunho.");});}}>Descartar rascunho anterior</button>}
    <div className={styles.progressPanel}><p><strong>{requirements.filter(item=>item.required).length-pendingRequirements.length} de {requirements.filter(item=>item.required).length} requisitos preenchidos</strong></p>
    <progress aria-label="Progresso da conclusão" max={requirements.filter(item=>item.required).length} value={requirements.filter(item=>item.required).length-pendingRequirements.length}/>
    {pendingRequirements.map(item=><button type="button" className={styles.secondaryAction} key={item.key} onClick={()=>jumpTo(item.key)}>Preencher: {item.label}</button>)}
    </div>
    {requiresJourney&&<p>Para atuar, mantenha a jornada ativa. A pausa e o fim do expediente bloqueiam a gravação.</p>}
    {notice&&<p ref={noticeRef} role="alert" className={styles.warning}>{notice}</p>}
    <fieldset className={styles.editorFields} disabled={busy||confirmed||!draftReady||Boolean(olderDraft)||Boolean(pendingSubmission)}>
    {!order.checkInAt&&<button id={`field-${order.id}-checkin`} className={styles.primaryAction} type="button" disabled={busy||mediaBusy||!draftReady||Boolean(olderDraft)} onClick={()=>void execute("start")}>Iniciar atendimento com check-in</button>}
    <label id={`field-${order.id}-diagnosis`} className={styles.formLabel}>Diagnóstico e medições • obrigatório<textarea value={diagnosis} onChange={event=>setDiagnosis(event.target.value)} maxLength={4000}/></label>
    <label id={`field-${order.id}-executedService`} className={styles.formLabel}>Serviço executado • obrigatório<textarea value={report} onChange={event=>setReport(event.target.value)} maxLength={8000}/></label>
    <label className={styles.formLabel}>Modelo de relatório<select value={template} onChange={e=>setTemplate(e.target.value)}><option value="">Selecionar modelo</option>{reportTemplates.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button type="button" className={styles.secondaryAction} disabled={!template||busy} onClick={()=>{const chosen=reportTemplates.find(item=>item.id===template);if(chosen)setReport(previous=>[previous,chosen.text].filter(Boolean).join("\n\n").slice(0,8000));}}>Inserir modelo para preencher</button>
    <label className={styles.formLabel}>Observações adicionais • opcional<textarea maxLength={4000} value={observations} onChange={e=>setObservations(e.target.value)}/></label>
    <h3>Medições técnicas <small>opcionais</small></h3>{fieldMeasurements.map(item=><label key={item.key} className={styles.formLabel}>{item.label} ({item.unit})<input type="number" inputMode="decimal" step="any" min={item.min} max={item.max} value={measurements[item.key]||""} onChange={e=>setMeasurements({...measurements,[item.key]:e.target.value})}/></label>)}
    <h3 id={`field-${order.id}-equipment`}>Equipamentos do atendimento (opcional)</h3>
    {(order.equipmentOptions || []).map(item=><label key={item.id} className={styles.checkLabel}><input type="checkbox" checked={equipmentIds.includes(item.id)} disabled={busy} onChange={event=>setEquipmentIds(event.target.checked?[...equipmentIds,item.id]:equipmentIds.filter(id=>id!==item.id))}/>{item.label}</label>)}
    {!order.equipmentOptions?.length&&!equipmentIds.length&&<p className={styles.warning}>Não há equipamento cadastrado para este cliente e local. Você pode salvar e concluir a OS sem equipamento. Se desejar, use “Cadastrar equipamento nesta OS”.</p>}
    <h3>Checklist técnico</h3><p>As orientações específicas acompanham os equipamentos selecionados. Itens adicionais de inspeção são opcionais e não substituem o procedimento do fabricante.</p>{checklistItems.map(item=><label id={["equipment","checkin","beforePhoto","afterPhoto","signature","executedService","diagnosis"].includes(item.key)?undefined:`field-${order.id}-${item.key}`} key={item.key} className={styles.checkLabel}><input type="checkbox" checked={Boolean(done[item.key as keyof typeof done])} disabled={["equipment","checkin","beforePhoto","afterPhoto","signature","executedService","diagnosis"].includes(item.key)} onChange={event=>setChecklist({...checklist,[item.key]:event.target.checked})}/>{item.label}</label>)}
    <div id={`field-${order.id}-beforePhoto`}><FieldPhotoCollection label="Fotos antes" onProcessing={value=>setPhotoProcessing(current=>({...current,before:value}))} photos={[...(before?[before]:[]),...beforePhotos]} onChange={values=>{setBefore("");setBeforePhotos(values);}} disabled={busy} existingCount={order.photoCounts?.before||0}/></div>
    <div id={`field-${order.id}-afterPhoto`}><FieldPhotoCollection label="Fotos depois" onProcessing={value=>setPhotoProcessing(current=>({...current,after:value}))} photos={[...(after?[after]:[]),...afterPhotos]} onChange={values=>{setAfter("");setAfterPhotos(values);}} disabled={busy} existingCount={order.photoCounts?.after||0}/></div>
    <FieldPhotoComparison before={[...(before?[before]:[]),...beforePhotos]} after={[...(after?[after]:[]),...afterPhotos]}/>
    <label id={`field-${order.id}-signature`} className={styles.formLabel}>Nome de quem dá o aceite • obrigatório ao assinar<input value={signerName} onChange={event=>setSignerName(event.target.value)} maxLength={120}/></label>
    <p>Assinatura de aceite do cliente {order.evidence.signature?"(já registrada)":""}</p>
    {signature&&<img src={signature} alt="Assinatura do rascunho" width={250} height={75}/>}
    <canvas ref={canvas} width={500} height={150} className={styles.signatureCanvas} onPointerDown={event=>pointer(event,true)} onPointerMove={event=>pointer(event,false)} onPointerUp={()=>{drawing.current=false;if(!busy&&!submissionRef.current&&drew.current)setSignature(canvas.current!.toDataURL("image/png"));}} onPointerCancel={()=>{drawing.current=false;}}/>
    <h3>Assinatura do técnico</h3>{order.technicianSignaturePreview?<><img src={order.technicianSignaturePreview} alt="Assinatura padrão do técnico atribuído" width={250} style={{background:"white",borderRadius:8,maxWidth:"100%",maxHeight:100,objectFit:"contain"}}/><p>Assinatura padrão cadastrada. Será registrada no fechamento deste atendimento.</p></>:<p>O técnico ainda não possui assinatura padrão. Ela pode ser cadastrada na ficha do funcionário; assinaturas anteriores do atendimento são preservadas.</p>}
    <button type="button" className={styles.secondaryAction} onClick={()=>{canvas.current?.getContext("2d")?.clearRect(0,0,500,150);setSignature("");}}>Limpar assinatura</button>
    {mediaBusy&&<p role="status">Preparando as fotos selecionadas. Aguarde antes de salvar ou concluir.</p>}
    <button type="button" className={styles.primaryAction} disabled={busy||mediaBusy||!draftReady||Boolean(olderDraft)} onClick={()=>void execute("save")}>Salvar relatório e evidências</button>
    <button type="button" className={styles.finishAction} disabled={busy||mediaBusy||!draftReady||Boolean(olderDraft)} onClick={()=>{if(mediaBusy)return;if(pendingRequirements.length){setNotice("Complete os requisitos indicados antes de concluir.");jumpTo(pendingRequirements[0].key);}else setReview(true);}}>Revisar e concluir OS</button>
    <FieldAttendanceControls order={order} busy={busy||mediaBusy||!draftReady||Boolean(olderDraft)} canApprove={canApprove} send={sendExtra}/>
    <LocalFieldAssistant diagnosis={diagnosis} report={report} disabled={busy||mediaBusy||!draftReady||Boolean(olderDraft)} onApply={setReport}/>
    <FieldOrderTools scope={scope} order={order} busy={busy||mediaBusy||!draftReady||Boolean(olderDraft)} canApprove={canApprove} send={sendExtra}/>
    </fieldset>
    {confirmed&&<button type="button" className={styles.secondaryAction} onClick={()=>void onSaved()}>Atualizar dados após gravação</button>}
    {review&&!pendingSubmission&&!confirmed&&<section className={styles.reviewPanel} aria-label="Revisar conclusão"><h3>Confira antes de concluir</h3><dl className={styles.detailList}><div><dt>Diagnóstico</dt><dd>{diagnosis}</dd></div><div><dt>Serviço executado</dt><dd>{report}</dd></div><div><dt>Equipamentos • opcional</dt><dd>{equipmentIds.map(id=>order.equipmentOptions?.find(item=>item.id===id)?.label||id).join(", ")||"Sem equipamento vinculado"}</dd></div><div><dt>Fotos antes / depois</dt><dd>{(order.photoCounts?.before||0)+beforePhotos.length+Number(Boolean(before))} / {(order.photoCounts?.after||0)+afterPhotos.length+Number(Boolean(after))}</dd></div><div><dt>Aceite</dt><dd>{signature?signerName||"Informe o nome de quem assina":order.evidence.signature?"Assinatura registrada":approved("signature")?"Dispensa aprovada pelo gestor":"Pendente"}</dd></div></dl><h4>Materiais aplicados</h4>{order.appliedMaterials?.length?<ul>{order.appliedMaterials.map((item,index)=><li key={index}>{item.quantity} × {item.name}</li>)}</ul>:<p>Nenhum material aplicado registrado.</p>}<h4>Solicitações</h4>{order.requests?.length?<ul>{order.requests.map(item=><li key={item.id}>{item.note} • {item.status}{item.date?` • ${item.date} ${item.time||""}`:""}</li>)}</ul>:<p>Nenhuma solicitação registrada.</p>}<button type="button" className={styles.finishAction} disabled={busy||mediaBusy} onClick={()=>void execute("finish")}>Confirmar conclusão{typeof navigator!=="undefined"&&!navigator.onLine?" quando sincronizar":""}</button><button type="button" className={styles.secondaryAction} disabled={busy} onClick={()=>setReview(false)}>Voltar para editar</button></section>}
    {pendingSubmission&&<section className={styles.pendingPanel} aria-label="Envio pendente" role="status"><h3>{busy?"Enviando…":pendingSubmission.blocked?"Envio precisa de revisão":"Aguardando confirmação do servidor"}</h3><p>{pendingSubmission.command.action==="finish"?"A OS só será considerada concluída após confirmação do servidor.":"O registro está preservado neste aparelho."} A jornada e as permissões serão verificadas no envio.</p>{pendingSubmission.error&&<p>{pendingSubmission.error}</p>}{pendingSubmission.blocked?<button type="button" disabled={busy} className={styles.secondaryAction} onClick={()=>void reviewConflict()}>Atualizar OS e revisar rascunho</button>:<button type="button" disabled={busy} className={styles.primaryAction} onClick={()=>void retrySubmission()}>Sincronizar / consultar envio</button>}{!pendingSubmission.sentAt&&<button type="button" disabled={busy} className={styles.secondaryAction} onClick={()=>void cancelUnsent()}>Voltar ao rascunho • envio ainda não transmitido</button>}</section>}
  </article>;
}
