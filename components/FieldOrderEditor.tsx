"use client";
import {FieldServicePicker} from "./FieldServicePicker";
import {automaticFieldEvidence, fieldOrderFunctionFor, fieldOrderFunctions, fieldOrderStepFor, fieldOrderSteps, type FieldOrderFunction, type FieldOrderStep} from "@/lib/mobile-order-steps";
import {reportConsistency} from "@/lib/mobile-workflow-insights";
import { useEffect, useRef, useState } from "react";
import { Camera, ClipboardCheck, FileText, PhoneCall, Save } from "lucide-react";
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
import {equipmentCompletionIssue,equipmentResultsIssue,updateEquipmentPhotoReferences,type EquipmentPhotoPhase,type FieldEquipmentResult} from "@/lib/mobile-equipment-results";
import type { FieldOrderCommand } from "@/lib/mobile-workday";
import styles from "./ProARFieldMobile.module.css";

async function gps(){const cap=(window as unknown as {Capacitor?:{isNativePlatform?:()=>boolean;isPluginAvailable?:(name:string)=>boolean;nativePromise?:(plugin:string,method:string,options:unknown)=>Promise<unknown>}}).Capacitor;
  if(cap?.isNativePlatform?.()&&cap.isPluginAvailable?.("WorkRoute")&&cap.nativePromise)return cap.nativePromise("WorkRoute","position",{});
  return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve({id:crypto.randomUUID(),capturedAt:new Date(p.timestamp).toISOString(),latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
}
export function FieldOrderEditor({order,requiresJourney,onSaved,scope,canApprove}:{order:MobileFieldOrder;requiresJourney:boolean;scope:string;canApprove:boolean;onSaved:(result?:{orderId:string;completedAt:string})=>Promise<void>}){
  const [report,setReport]=useState(order.executedService||""),[diagnosis,setDiagnosis]=useState(order.diagnosis||""),[checklist,setChecklist]=useState(order.mobileChecklist||{});
  const [before,setBefore]=useState(""),[after,setAfter]=useState(""),[signature,setSignature]=useState(""),[signerName,setSignerName]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  const [observations,setObservations]=useState(order.observations||""),[measurements,setMeasurements]=useState<FieldMeasurements>(order.measurements||{}),[beforePhotos,setBeforePhotos]=useState<string[]>([]),[afterPhotos,setAfterPhotos]=useState<string[]>([]),[equipmentLabelPhotos,setEquipmentLabelPhotos]=useState<string[]>([]),[equipmentLabelAbsent,setEquipmentLabelAbsent]=useState(Boolean(order.equipmentLabelAbsent)),[equipmentLabelAbsentReason,setEquipmentLabelAbsentReason]=useState(order.equipmentLabelAbsentReason||""),[template,setTemplate]=useState("");
  const [photoProcessing,setPhotoProcessing]=useState({before:false,after:false,equipmentLabel:false});
  const mediaBusy=photoProcessing.before||photoProcessing.after||photoProcessing.equipmentLabel;
  const [equipmentIds,setEquipmentIds]=useState(order.equipmentIds);
  const [equipmentResults,setEquipmentResults]=useState<FieldEquipmentResult[]>(order.equipmentResults||[]);
  const trackedEquipment=order.equipmentIds.length>1||Boolean(order.equipmentResults?.length);
  const beforeDraftPhotos=[...(before?[before]:[]),...beforePhotos],afterDraftPhotos=[...(after?[after]:[]),...afterPhotos];
  const counts={before:(order.photoCounts?.before||0)+beforeDraftPhotos.length,after:(order.photoCounts?.after||0)+afterDraftPhotos.length};
  const results=equipmentResults.filter(item=>equipmentIds.includes(item.equipmentId));
  const completionIssue=equipmentCompletionIssue(equipmentIds,results);
  const equipmentName=(id:string)=>order.equipmentOptions?.find(item=>item.id===id)?.label||id;
  function changeEquipmentResult(id:string,patch:Partial<Omit<FieldEquipmentResult,"equipmentId">>){
    setEquipmentResults(current=>{
      const row=current.find(item=>item.equipmentId===id);
      return [...current.filter(item=>item.equipmentId!==id),{equipmentId:id,status:"pending",note:"",...row,...patch}];
    });
  }
  function changePhotos(phase:EquipmentPhotoPhase,values:string[]){
    const count=order.photoCounts?.[phase]||0;
    setEquipmentResults(current=>updateEquipmentPhotoReferences(current,phase,count,phase==="before"?beforeDraftPhotos:afterDraftPhotos,values));
    if(phase==="before"){setBefore("");setBeforePhotos(values);}else{setAfter("");setAfterPhotos(values);}
  }
  const [step,setStep]=useState<FieldOrderStep>(order.checkInAt?"execucao":"chegada");
  const [workFunction,setWorkFunction]=useState<FieldOrderFunction>("relatorio");
  const functionNav=useRef<HTMLElement|null>(null);
  const [focusKey,setFocusKey]=useState<{key:string}|null>(null);
  const stageNav=useRef<HTMLElement|null>(null);
  const reviewPanel=useRef<HTMLElement|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [review,setReview]=useState(false),[pendingSubmission,setPendingSubmission]=useState<PendingOrderSubmission|undefined>();
  const submissionRef=useRef<PendingOrderSubmission|undefined>(undefined),operationLock=useRef(false);
  const noticeRef=useRef<HTMLParagraphElement|null>(null);
  const signatureDialog=useRef<HTMLDialogElement|null>(null);
  const canvas=useRef<HTMLCanvasElement|null>(null),drawing=useRef(false),drew=useRef(false);
  const approved=(kind:string)=>order.fieldExceptions?.some(item=>item.kind===kind&&item.status==="Aprovado"&&item.decidedBy&&item.decidedAt);
  const done={...checklist,equipmentLabel:Boolean(equipmentLabelAbsent||equipmentLabelPhotos.length||order.evidence.equipmentLabel||order.photoCounts?.equipmentLabel),equipment:equipmentIds.length>0||Boolean(approved("equipment")),checkin:Boolean(order.checkInAt),beforePhoto:Boolean(before||beforePhotos.length||order.evidence.before),afterPhoto:Boolean(after||afterPhotos.length||order.evidence.after),signature:Boolean((signature&&signerName.trim())||(!order.equipmentAcceptancePending&&order.evidence.signature))||Boolean(approved("signature")),executedService:Boolean(report.trim()),diagnosis:Boolean(diagnosis.trim())};

  const contextualChecklist=equipmentInspection((order.equipmentOptions||[]).filter(item=>equipmentIds.includes(item.id)).map(item=>item.label));
  const isCorrectiveOrDiagnostic=/corret|diagn[oó]st/i.test(order.service||"");
  const diagnosisFieldLabel=isCorrectiveOrDiagnostic?"Diagnóstico técnico":"Condição inicial do equipamento";
  const checklistItems=[...mobileChecklist(order.service),...contextualChecklist];
  const requirements=[...new Map([{key:"diagnosis",label:diagnosisFieldLabel,required:true},...checklistItems].map(item=>[item.key,item])).values()];
  const pendingRequirements=[...requirements.filter(item=>item.required&&!done[item.key as keyof typeof done]),...(completionIssue?[{key:"equipmentResults",label:"Revisar resultado por aparelho",required:true}]:[])];
  const [draftReady,setDraftReady]=useState(false),[draftNotice,setDraftNotice]=useState(""),[olderDraft,setOlderDraft]=useState<OrderDraft|null>(null);
  const latestDraft=useRef<OrderDraft|null>(null),suppressDraft=useRef(false);
  function restoreDraft(value:OrderDraft){submissionRef.current=value.pendingSubmission;setPendingSubmission(value.pendingSubmission);setEquipmentLabelPhotos(value.equipmentLabelPhotos||[]);setEquipmentLabelAbsent(Boolean(value.equipmentLabelAbsent));setEquipmentLabelAbsentReason(value.equipmentLabelAbsentReason||"");setReport(value.report);setDiagnosis(value.diagnosis);setChecklist(value.checklist);setEquipmentIds(trackedEquipment?[...new Set([...order.equipmentIds,...value.equipmentIds])]:value.equipmentIds);const stale=value.version!==order.fieldVersion||Boolean(value.editToken&&value.editToken!==order.editToken);const localResults=(value.equipmentResults||[]).map(item=>({...item,...(stale?{photo:undefined}:{})}));setEquipmentResults([...(order.equipmentResults||[]).filter(item=>!localResults.some(local=>local.equipmentId===item.equipmentId)),...localResults]);setBefore(value.before);setAfter(value.after);setSignature(value.signature);setSignerName(value.signerName);setObservations(value.observations||"");setMeasurements(value.measurements||{});setBeforePhotos(value.beforePhotos||[]);setAfterPhotos(value.afterPhotos||[]);}
  useEffect(()=>{
    let cancelled=false;
    void loadOrderDraft(scope,order.id).then(value=>{if(cancelled)return;if(value){if((value.version===order.fieldVersion&&(!value.editToken||value.editToken===order.editToken)) || value.pendingSubmission){restoreDraft(value);setDraftNotice("Rascunho recuperado neste aparelho.");}else{setOlderDraft(value);setDraftNotice("A OS mudou no servidor. Revise antes de recuperar o rascunho anterior.");}}setDraftReady(true);}).catch(()=>{if(!cancelled){setDraftNotice("Não foi possível acessar o rascunho local. Salve no servidor para preservar os dados.");setDraftReady(true);}});
    return()=>{cancelled=true;};
  },[scope,order.id,order.fieldVersion,order.editToken]);
  useEffect(()=>{
    if(!draftReady || olderDraft)return;
    const value={version:order.fieldVersion,editToken:order.editToken,observations,measurements,beforePhotos,afterPhotos,equipmentLabelPhotos,equipmentLabelAbsent,equipmentLabelAbsentReason,report,diagnosis,checklist,equipmentIds,equipmentResults,before,after,signature,signerName,pendingSubmission,orderSnapshot:order,savedAt:Date.now()};
    latestDraft.current=value;
    const persist=()=>{if(!suppressDraft.current)void saveOrderDraft(scope,order.id,latestDraft.current||value).then(()=>setDraftNotice("Rascunho salvo neste aparelho • ainda não enviado.")).catch(()=>setDraftNotice("Falha ao salvar rascunho. Salve no servidor."));};
    const timer=setTimeout(persist,500);
    return()=>{clearTimeout(timer);};
  },[scope,order.id,order.fieldVersion,draftReady,olderDraft,observations,measurements,beforePhotos,afterPhotos,equipmentLabelPhotos,equipmentLabelAbsent,equipmentLabelAbsentReason,report,diagnosis,checklist,equipmentIds,equipmentResults,before,after,signature,signerName,pendingSubmission,order]);
  useEffect(()=>{
    const flush=()=>{if(!suppressDraft.current&&latestDraft.current)void saveOrderDraft(scope,order.id,latestDraft.current).catch(()=>{});};
    const hidden=()=>{if(document.hidden)flush();};
    document.addEventListener("visibilitychange",hidden);
    window.addEventListener("pagehide",flush);
    return()=>{document.removeEventListener("visibilitychange",hidden);window.removeEventListener("pagehide",flush);flush();};
  },[scope,order.id]);
  function changeStep(next:FieldOrderStep){
    setStep(next);setReview(false);
    requestAnimationFrame(()=>stageNav.current?.scrollIntoView({block:"start"}));
  }
  function changeFunction(next:FieldOrderFunction){
    setWorkFunction(next);
    requestAnimationFrame(()=>functionNav.current?.scrollIntoView({block:"nearest"}));
  }
  function jumpTo(key:string){
    const targetStep=fieldOrderStepFor(key);
    setReview(false);setStep(targetStep);
    if(targetStep==="execucao")setWorkFunction(fieldOrderFunctionFor(key));
    setFocusKey({key});
  }
  useEffect(()=>{
    if(!focusKey)return;
    const frame=requestAnimationFrame(()=>{
      const target=document.getElementById(`field-${order.id}-${focusKey.key}`);
      for(let parent=target?.parentElement;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
      target?.scrollIntoView({block:"center"});
      const input=target?.matches("button,input,textarea,select")?target:target?.querySelector<HTMLElement>("input:not(:disabled),textarea:not(:disabled),select:not(:disabled),button:not(:disabled),summary");
      input?.focus({preventScroll:true});
    });
    return()=>cancelAnimationFrame(frame);
  },[focusKey,order.id]);
  useEffect(()=>{if(review){reviewPanel.current?.focus({preventScroll:true});reviewPanel.current?.scrollIntoView({block:"start"});}},[review]);
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
    return {version:order.fieldVersion,editToken:order.editToken,observations,measurements,beforePhotos,afterPhotos,equipmentLabelPhotos,equipmentLabelAbsent,equipmentLabelAbsentReason,report,diagnosis,checklist,equipmentIds,equipmentResults,before,after,signature,signerName,pendingSubmission:pending,orderSnapshot:order,savedAt:Date.now()};
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
      setConfirmed(true);setNotice(sent.command.action==="save"?"Progresso salvo no servidor, sem concluir a OS.":"OS confirmada no servidor.");
      await onSaved(sent.command.action==="finish"?{orderId:order.id,completedAt:body.completedAt}:undefined);
    } catch(error) {
      const failed=orderSubmissionFailure(sent,error instanceof Error?error.message:"Resposta não recebida. Consulte novamente este envio.");
      await persistSubmission(failed);setNotice(failed.error!);
    }
  }
  async function retrySubmission(){
    if(operationLock.current||!submissionRef.current||submissionRef.current.blocked)return;
    operationLock.current=true;setBusy(true);
    try{await transmit(submissionRef.current);}catch{setNotice("Não foi possível preservar o envio. Tente novamente sem fechar esta tela.");}finally{operationLock.current=false;setBusy(false);}
  }
  async function execute(action:"start"|"save"|"finish"){
    if(operationLock.current||submissionRef.current||confirmed||mediaBusy||!draftReady||olderDraft)return;
    const equipmentIssue=equipmentResultsIssue(results,equipmentIds,counts);
    if(equipmentIssue){setNotice(equipmentIssue);jumpTo("equipmentResults");return;}
    if(action==="finish" && (pendingRequirements.length || (signature&&!signerName.trim()))){setReview(false);setNotice("Preencha os requisitos indicados e identifique quem assina antes de concluir.");return;}
    operationLock.current=true;setBusy(true);setNotice("");
    try{
      const pending=queueOrderSubmission({requestId:crypto.randomUUID(),action,orderId:order.id,expectedVersion:order.fieldVersion,expectedToken:order.editToken,report,diagnosis,observations,measurements,beforePhotos:[...(before?[before]:[]),...beforePhotos],afterPhotos:[...(after?[after]:[]),...afterPhotos],equipmentLabelPhotos,equipmentLabelAbsent,equipmentLabelAbsentReason,equipmentIds,equipmentResults:results,checklist:done,signature,signerName});
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
  function pointer(event:React.PointerEvent<HTMLCanvasElement>,start:boolean){const c=canvas.current;if(!c||busy||confirmed||mediaBusy||submissionRef.current||olderDraft||!draftReady)return;const rect=c.getBoundingClientRect(),ctx=c.getContext("2d")!,x=(event.clientX-rect.left)*c.width/rect.width,y=(event.clientY-rect.top)*c.height/rect.height;ctx.strokeStyle="#122b47";ctx.lineWidth=2;
    if(start){drawing.current=true;drew.current=false;c.setPointerCapture(event.pointerId);ctx.beginPath();ctx.moveTo(x,y);}else if(drawing.current){ctx.lineTo(x,y);ctx.stroke();drew.current=true;}}
  return <article className={`${styles.detailCard} ${styles.orderEditor}`}><h2>Atendimento</h2>
    <p role="status" className={styles.syncBanner}>{confirmed?"Sincronizado • gravação confirmada no servidor.":pendingSubmission?"Envio preservado neste aparelho • aguardando confirmação.":draftNotice||"Preparando rascunho…"}</p>
    {olderDraft&&!pendingSubmission&&<section className={styles.reviewPanel}><h3>Comparar antes de recuperar</h3><p>A recuperação substitui os campos do rascunho em edição. Nada é enviado automaticamente.</p><div className={styles.photoComparison}><div><h4>Servidor atual</h4><p>Diagnóstico: {order.diagnosis||"Não informado"}</p><p>Serviço: {order.executedService||"Não informado"}</p></div><div><h4>Rascunho local</h4><p>Salvo em {new Date(olderDraft.savedAt).toLocaleString("pt-BR")}</p><p>Diagnóstico: {olderDraft.diagnosis||"Não informado"}</p><p>Serviço: {olderDraft.report||"Não informado"}</p><p>{(olderDraft.beforePhotos?.length||0)+Number(Boolean(olderDraft.before))} foto(s) antes e {(olderDraft.afterPhotos?.length||0)+Number(Boolean(olderDraft.after))} depois preservadas.</p></div></div></section>}
    {olderDraft&&!pendingSubmission&&<button type="button" className={styles.secondaryAction} onClick={()=>{restoreDraft(olderDraft);setOlderDraft(null);}}>Recuperar rascunho para revisão</button>}
    {olderDraft&&!pendingSubmission&&<button type="button" className={styles.secondaryAction} onClick={()=>{suppressDraft.current=true;void clearOrderDraft(scope,order.id).then(()=>{latestDraft.current=null;suppressDraft.current=false;setOlderDraft(null);setDraftNotice("Rascunho anterior descartado.");}).catch(()=>{suppressDraft.current=false;setNotice("Não foi possível descartar o rascunho.");});}}>Descartar rascunho anterior</button>}
    <nav ref={stageNav} className={styles.osStepNav} aria-label="Etapas da ordem de serviço">
      {fieldOrderSteps.map((item,index)=><button key={item.id} type="button" aria-current={step===item.id?"step":undefined} onClick={()=>changeStep(item.id)}>{index+1}. {item.label}</button>)}
    </nav>
    {notice&&<p ref={noticeRef} role="alert" className={styles.warning}>{notice}</p>}
    <fieldset className={styles.editorFields} disabled={busy||confirmed||!draftReady||Boolean(olderDraft)||Boolean(pendingSubmission)}>
    <section hidden={step!=="chegada"||review} className={styles.osStepPanel} aria-label="Chegada">
      <h3>Check-in</h3>
      <p>{order.checkInAt?"Check-in registrado. Você já pode continuar a execução.":"Quando chegar ao local, registre o check-in para iniciar."}</p>
      {requiresJourney&&!order.checkInAt&&<small>Mantenha a jornada ativa para gravar o check-in.</small>}
    <button type="button" className={styles.secondaryAction} onClick={()=>{const popup=window.open(`/api/mobile/orders/contact?orderId=${encodeURIComponent(order.id)}`,"_blank");if(popup)popup.opener=null;else setNotice("Permita a abertura de nova aba para acessar o WhatsApp.");}}><PhoneCall size={18} aria-hidden="true"/> WhatsApp</button>
    </section>
    <section hidden={step!=="execucao"||review} className={styles.osStepPanel} aria-label="Execução">
      <nav ref={functionNav} className={styles.osFunctionNav} aria-label="Funções da execução">
        {fieldOrderFunctions.map(({id,label})=>{
          const Icon=id==="relatorio"?FileText:id==="fotos"?Camera:ClipboardCheck;
          return <button key={id} type="button" aria-pressed={workFunction===id} aria-controls={`field-${order.id}-funcao-${id}`} onClick={()=>changeFunction(id)}><Icon size={17} aria-hidden="true"/>{label}</button>;
        })}
      </nav>
      <section id={`field-${order.id}-funcao-relatorio`} hidden={workFunction!=="relatorio"} className={styles.osFunctionPanel} aria-label="Relatório técnico">
    <label id={`field-${order.id}-diagnosis`} className={styles.formLabel}>{diagnosisFieldLabel}<textarea value={diagnosis} onChange={event=>setDiagnosis(event.target.value)} maxLength={4000} placeholder={isCorrectiveOrDiagnostic?"Sintoma, verificações e causa, se identificada.":"Como você encontrou o aparelho?"}/></label>
    <label id={`field-${order.id}-executedService`} className={styles.formLabel}>Serviço executado<textarea value={report} onChange={event=>setReport(event.target.value)} maxLength={8000} placeholder="O que foi feito?"/></label>
    {equipmentIds.length>0&&<section id={`field-${order.id}-equipmentResults`} className={styles.progressPanel} aria-label="Resultado por aparelho">
      <h3>Resultado por aparelho</h3>
      <p>{equipmentIds.length>1?"Informe o resultado de cada aparelho. Se algum ficar pendente, use Salvar para registrar o progresso sem concluir a OS.":"Se este aparelho ficar pendente, registre o motivo e salve sem concluir a OS."}</p>
      {equipmentIds.map(id=>{
        const result=results.find(item=>item.equipmentId===id);
        return <fieldset key={id} className={styles.progressPanel}><legend>{equipmentName(id)}</legend>
          <label className={styles.formLabel}>Resultado<select value={result?.status||""} onChange={event=>{const status=event.target.value;if(status==="completed"||status==="pending")changeEquipmentResult(id,{status});}}><option disabled value="">Selecione o resultado</option><option value="completed">Concluído</option><option value="pending">Pendente</option></select></label>
          {result&&<><label className={styles.formLabel}>{result.status==="pending"?"Motivo da pendência • obrigatório":"Relato do aparelho • opcional"}<textarea maxLength={500} value={result.note} onChange={event=>changeEquipmentResult(id,{note:event.target.value})}/></label>
          <label className={styles.formLabel}>Vincular foto da OS • opcional<select value={result.photo?`${result.photo.phase}:${result.photo.index}`:""} onChange={event=>{const [phase,index]=event.target.value.split(":");changeEquipmentResult(id,{photo:phase==="before"||phase==="after"?{phase,index:Number(index)}:undefined});}}><option value="">Sem foto vinculada</option>{(["before","after"] as const).flatMap(phase=>Array.from({length:Math.min(10,counts[phase])},(_,index)=><option key={`${phase}:${index}`} value={`${phase}:${index}`}>{phase==="before"?"Antes":"Depois"} {index+1}</option>))}</select></label></>}
        </fieldset>;
      })}
    </section>}
    <details className={styles.osDisclosure}><summary>Detalhes do relatório</summary>
    <label className={styles.formLabel}>Modelo de relatório<select value={template} onChange={e=>setTemplate(e.target.value)}><option value="">Selecionar modelo</option>{reportTemplates.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button type="button" className={styles.secondaryAction} disabled={!template||busy} onClick={()=>{const chosen=reportTemplates.find(item=>item.id===template);if(chosen)setReport(previous=>[previous,chosen.text].filter(Boolean).join("\n\n").slice(0,8000));}}>Inserir modelo para preencher</button>
    <label className={styles.formLabel}>Observações adicionais • opcional<textarea maxLength={4000} value={observations} onChange={e=>setObservations(e.target.value)}/></label>
    <h3>Medições técnicas do equipamento <small>preencha quando aplicável</small></h3><p>Informe os valores realmente medidos nos campos correspondentes: pressão, temperatura, tensão e corrente. Os campos ficam separados do texto de diagnóstico.</p><div className={styles.measurementGrid}>{fieldMeasurements.map(item=><label key={item.key} className={styles.formLabel}>{item.label} ({item.unit})<input type="number" inputMode="decimal" step="any" min={item.min} max={item.max} value={measurements[item.key]||""} onChange={e=>setMeasurements({...measurements,[item.key]:e.target.value})}/></label>)}</div>
    </details>
    </section>
    <section id={`field-${order.id}-funcao-fotos`} hidden={workFunction!=="fotos"} className={styles.osFunctionPanel} aria-label="Fotos e identificação">
    <section id={`field-${order.id}-equipmentLabel`} className={styles.progressPanel}><h3>Etiqueta do aparelho</h3><FieldPhotoCollection compact label="Foto da etiqueta" onProcessing={value=>setPhotoProcessing(current=>({...current,equipmentLabel:value}))} photos={equipmentLabelPhotos} onChange={values=>{setEquipmentLabelPhotos(values);if(values.length)setEquipmentLabelAbsent(false);}} disabled={busy||equipmentLabelAbsent} existingCount={order.photoCounts?.equipmentLabel||0}/><label className={styles.checkLabel}><input type="checkbox" checked={equipmentLabelAbsent} disabled={busy||Boolean(order.photoCounts?.equipmentLabel)||equipmentLabelPhotos.length>0} onChange={event=>setEquipmentLabelAbsent(event.target.checked)}/> Etiqueta ausente</label>{equipmentLabelAbsent&&<label className={styles.formLabel}>Motivo (opcional)<input maxLength={300} value={equipmentLabelAbsentReason} onChange={event=>setEquipmentLabelAbsentReason(event.target.value)} placeholder="Ex.: etiqueta removida ou ilegível"/></label>}</section>
    <div id={`field-${order.id}-beforePhoto`}><FieldPhotoCollection compact label="Fotos antes" onProcessing={value=>setPhotoProcessing(current=>({...current,before:value}))} photos={[...(before?[before]:[]),...beforePhotos]} onChange={values=>changePhotos("before",values)} disabled={busy} existingCount={order.photoCounts?.before||0}/></div>
    <details className={styles.osDisclosure} id={`field-${order.id}-equipment`}><summary>Equipamentos vinculados (opcional)</summary>
    {(order.equipmentOptions || []).map(item=><label key={item.id} className={styles.checkLabel}><input type="checkbox" checked={equipmentIds.includes(item.id)} disabled={busy||(trackedEquipment&&order.equipmentIds.includes(item.id))||(!equipmentIds.includes(item.id)&&equipmentIds.length>=20)} onChange={event=>{setEquipmentIds(event.target.checked?[...equipmentIds,item.id]:equipmentIds.filter(id=>id!==item.id));if(!event.target.checked)setEquipmentResults(current=>current.filter(row=>row.equipmentId!==item.id));}}/>{item.label}</label>)}
    {!order.equipmentOptions?.length&&!equipmentIds.length&&<p className={styles.warning}>Sem equipamentos cadastrados neste local. O vínculo é opcional.</p>}
    </details>
    </section>
    <section id={`field-${order.id}-funcao-checklist`} hidden={workFunction!=="checklist"} className={styles.osFunctionPanel} aria-label="Checklist do serviço">
    {checklistItems.some(item=>!automaticFieldEvidence.has(item.key))?<div className={styles.osChecklist}>
      <div className={styles.checklistGrid}>{checklistItems.filter(item=>!automaticFieldEvidence.has(item.key)&&item.required).map(item=><label id={`field-${order.id}-${item.key}`} key={item.key} className={styles.checkLabel}><input type="checkbox" checked={Boolean(done[item.key as keyof typeof done])} onChange={event=>setChecklist({...checklist,[item.key]:event.target.checked})}/>{item.label}</label>)}</div>
      {checklistItems.some(item=>!automaticFieldEvidence.has(item.key)&&!item.required)&&<details className={styles.osDisclosure}><summary>Verificações opcionais</summary>{checklistItems.filter(item=>!automaticFieldEvidence.has(item.key)&&!item.required).map(item=><label id={`field-${order.id}-${item.key}`} key={item.key} className={styles.checkLabel}><input type="checkbox" checked={Boolean(done[item.key as keyof typeof done])} onChange={event=>setChecklist({...checklist,[item.key]:event.target.checked})}/>{item.label}</label>)}</details>}
    </div>:<p>Nenhuma verificação extra para este serviço.</p>}
    </section>
    </section>
    <section hidden={step!=="conclusao"||review} className={styles.osStepPanel} aria-label="Conclusão">
      <details className={styles.osDisclosure}><summary>{pendingRequirements.length?"O que falta ("+pendingRequirements.length+")":"Requisitos preenchidos"}</summary>
       {pendingRequirements.length?<ul className={styles.osPending}>{pendingRequirements.map(item=><li key={item.key}><button type="button" className={styles.secondaryAction} onClick={()=>jumpTo(item.key)}>{item.label}</button></li>)}</ul>:<p>Nenhuma pendência de preenchimento. Confira antes de concluir.</p>}
      </details>
    <div id={`field-${order.id}-afterPhoto`}><FieldPhotoCollection compact label="Fotos depois" onProcessing={value=>setPhotoProcessing(current=>({...current,after:value}))} photos={[...(after?[after]:[]),...afterPhotos]} onChange={values=>changePhotos("after",values)} disabled={busy} existingCount={order.photoCounts?.after||0}/></div>
    <details className={styles.osDisclosure}><summary>Comparar fotos antes e depois</summary><FieldPhotoComparison before={[...(before?[before]:[]),...beforePhotos]} after={[...(after?[after]:[]),...afterPhotos]}/></details>
    <label id={`field-${order.id}-signature`} className={styles.formLabel}>Nome de quem dá o aceite • obrigatório ao assinar<input value={signerName} onChange={event=>setSignerName(event.target.value)} maxLength={120}/></label>
    <p>Assinatura de aceite do cliente {order.equipmentAcceptancePending?"(novo aceite necessário após resolver os aparelhos)":order.evidence.signature?"(já registrada)":""}</p>
    {signature&&<img src={signature} alt="Assinatura do rascunho" width={250} height={75}/>}
    <button type="button" className={styles.secondaryAction} onClick={()=>signatureDialog.current?.showModal()}>Abrir área para assinar</button><dialog ref={signatureDialog} className={styles.signatureDialog} aria-label="Assinatura de aceite do cliente"><h2>Assinatura do cliente</h2><p>Confira o atendimento antes de assinar. A assinatura será salva com o relatório.</p><div className={styles.signatureFrame}><span>Assine com o dedo no espaço abaixo</span><canvas ref={canvas} aria-label="Área para assinatura do cliente" width={500} height={150} className={styles.signatureCanvas} onPointerDown={event=>pointer(event,true)} onPointerMove={event=>pointer(event,false)} onPointerUp={()=>{drawing.current=false;if(!busy&&!submissionRef.current&&drew.current)setSignature(canvas.current!.toDataURL("image/png"));}} onPointerCancel={()=>{drawing.current=false;}}/></div><button type="button" className={styles.primaryAction} onClick={()=>signatureDialog.current?.close()}>Conferir assinatura e voltar</button><button type="button" className={styles.secondaryAction} onClick={()=>{canvas.current?.getContext("2d")?.clearRect(0,0,500,150);setSignature("");}}>Limpar área</button></dialog>
    {signature&&<button type="button" className={styles.osQuietAction} onClick={()=>{canvas.current?.getContext("2d")?.clearRect(0,0,500,150);setSignature("");}}>Limpar assinatura</button>}
    <details className={styles.osDisclosure}><summary>Assinatura do técnico</summary>{order.technicianSignaturePreview?<><img src={order.technicianSignaturePreview} alt="Assinatura padrão do técnico atribuído" width={250} style={{background:"white",borderRadius:8,maxWidth:"100%",maxHeight:100,objectFit:"contain"}}/><p>Assinatura padrão cadastrada. Será registrada no fechamento deste atendimento.</p></>:<p>O técnico ainda não possui assinatura padrão. Ela pode ser cadastrada na ficha do funcionário; assinaturas anteriores do atendimento são preservadas.</p>}</details>
    </section>

    {mediaBusy&&<p role="status">Preparando as fotos selecionadas. Aguarde antes de salvar ou concluir.</p>}
    {!review&&<details className={styles.osDisclosure}><summary>Outras ações da OS</summary>
    <FieldAttendanceControls order={order} busy={busy||mediaBusy||!draftReady||Boolean(olderDraft)} canApprove={canApprove} send={sendExtra}/>
    <LocalFieldAssistant diagnosis={diagnosis} report={report} disabled={busy||mediaBusy||!draftReady||Boolean(olderDraft)} onApply={setReport}/>
    <FieldServicePicker order={order} busy={busy||mediaBusy||!draftReady||Boolean(olderDraft)||Boolean(pendingSubmission)||confirmed} send={sendExtra}/>
    <FieldOrderTools scope={scope} order={order} busy={busy||mediaBusy||!draftReady||Boolean(olderDraft)} canApprove={canApprove} send={sendExtra}/>
    </details>}
    {!review&&!pendingSubmission&&!confirmed&&<div className={styles.osActions} data-compact="true">
      {step!=="chegada"&&<button type="button" className={styles.osSaveAction} disabled={busy||mediaBusy} onClick={()=>void execute("save")} aria-label="Salvar no servidor"><Save size={17} aria-hidden="true"/> Salvar</button>}
      {step==="chegada"?<button id={`field-${order.id}-checkin`} className={styles.primaryAction} type="button" disabled={busy||mediaBusy} onClick={()=>order.checkInAt?changeStep("execucao"):void execute("start")}>{order.checkInAt?"Continuar execução":"Fazer check-in"}</button>
       :step==="execucao"?<button className={styles.primaryAction} type="button" disabled={busy||mediaBusy} onClick={()=>changeStep("conclusao")}>Ir para conclusão</button>
       :<button className={styles.finishAction} type="button" disabled={busy||mediaBusy} onClick={()=>{if(pendingRequirements.length)jumpTo(pendingRequirements[0].key);else setReview(true);}}>{pendingRequirements.length?`Resolver próxima pendência (${pendingRequirements.length})`:"Revisar e concluir OS"}</button>}
    </div>}
    </fieldset>
    {confirmed&&<button type="button" className={styles.secondaryAction} onClick={()=>void onSaved()}>Atualizar dados após gravação</button>}
    {review&&!pendingSubmission&&!confirmed&&<section ref={reviewPanel} tabIndex={-1} className={styles.reviewPanel} aria-label="Revisar conclusão"><h3>Confira antes de concluir</h3>{reportConsistency({report,diagnosis,beforeCount:(order.photoCounts?.before||0)+beforePhotos.length+Number(Boolean(before)),afterCount:(order.photoCounts?.after||0)+afterPhotos.length+Number(Boolean(after)),materials:order.appliedMaterials?.length||0,measurements}).map(message=><p key={message} className={styles.warning}>{message}</p>)}<dl className={styles.detailList}><div><dt>Diagnóstico</dt><dd>{diagnosis}</dd></div><div><dt>Serviço executado</dt><dd>{report}</dd></div><div><dt>Equipamentos • opcional</dt><dd>{equipmentIds.map(id=>order.equipmentOptions?.find(item=>item.id===id)?.label||id).join(", ")||"Sem equipamento vinculado"}</dd></div><div><dt>Etiqueta do equipamento</dt><dd>{equipmentLabelPhotos.length+(order.photoCounts?.equipmentLabel||0)>0?"Foto anexada":equipmentLabelAbsent?"Marcada como ausente":"Pendente"}</dd></div><div><dt>Fotos antes / depois</dt><dd>{(order.photoCounts?.before||0)+beforePhotos.length+Number(Boolean(before))} / {(order.photoCounts?.after||0)+afterPhotos.length+Number(Boolean(after))}</dd></div><div><dt>Aceite</dt><dd>{signature?signerName||"Informe o nome de quem assina":(!order.equipmentAcceptancePending&&order.evidence.signature)?"Assinatura registrada":approved("signature")?"Dispensa aprovada pelo gestor":"Pendente"}</dd></div></dl>{results.length>0&&<><h4>Resultados por aparelho</h4><ul>{results.map(item=><li key={item.equipmentId}>{equipmentName(item.equipmentId)} • {item.status==="completed"?"Concluído":"Pendente"}{item.note?` • ${item.note}`:""}{item.photo?` • ${item.photo.phase==="before"?"Antes":"Depois"} ${item.photo.index+1}`:""}</li>)}</ul></>}<h4>Materiais aplicados</h4>{order.appliedMaterials?.length?<ul>{order.appliedMaterials.map((item,index)=><li key={index}>{item.quantity} × {item.name}</li>)}</ul>:<p>Nenhum material aplicado registrado.</p>}<h4>Solicitações</h4>{order.requests?.length?<ul>{order.requests.map(item=><li key={item.id}>{item.note} • {item.status}{item.date?` • ${item.date} ${item.time||""}`:""}</li>)}</ul>:<p>Nenhuma solicitação registrada.</p>}<button type="button" className={styles.finishAction} disabled={busy||mediaBusy} onClick={()=>void execute("finish")}>Confirmar conclusão{typeof navigator!=="undefined"&&!navigator.onLine?" quando sincronizar":""}</button><button type="button" className={styles.secondaryAction} disabled={busy} onClick={()=>changeStep("conclusao")}>Voltar para editar</button></section>}
    {pendingSubmission&&<section className={styles.pendingPanel} aria-label="Envio pendente" role="status"><h3>{busy?"Enviando…":pendingSubmission.blocked?"Envio precisa de revisão":"Aguardando confirmação do servidor"}</h3><p>{pendingSubmission.command.action==="finish"?"A OS só será considerada concluída após confirmação do servidor.":"O registro está preservado neste aparelho."} A jornada e as permissões serão verificadas no envio.</p>{pendingSubmission.error&&<p>{pendingSubmission.error}</p>}{pendingSubmission.blocked?<button type="button" disabled={busy} className={styles.secondaryAction} onClick={()=>void reviewConflict()}>Atualizar OS e revisar rascunho</button>:<button type="button" disabled={busy} className={styles.primaryAction} onClick={()=>void retrySubmission()}>Sincronizar / consultar envio</button>}{!pendingSubmission.sentAt&&<button type="button" disabled={busy} className={styles.secondaryAction} onClick={()=>void cancelUnsent()}>Voltar ao rascunho • envio ainda não transmitido</button>}</section>}
  </article>;
}
