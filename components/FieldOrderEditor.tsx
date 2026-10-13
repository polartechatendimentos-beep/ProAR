"use client";
import { useRef, useState } from "react";
import type { MobileFieldOrder } from "@/lib/mobile-field";
import { mobileChecklist } from "@/lib/mobile-service-checklists";
import styles from "./ProARFieldMobile.module.css";

async function compressed(file:File) {
  if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error("Use foto JPEG, PNG ou WebP.");
  const bitmap=await createImageBitmap(file);const canvas=document.createElement("canvas"),scale=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext("2d")!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const value=canvas.toDataURL("image/jpeg",0.65);if(value.length>350000)throw new Error("Foto muito grande. Faça uma foto mais próxima do equipamento.");return value;
}
async function gps(){const cap=(window as unknown as {Capacitor?:{isNativePlatform?:()=>boolean;isPluginAvailable?:(name:string)=>boolean;nativePromise?:(plugin:string,method:string,options:unknown)=>Promise<unknown>}}).Capacitor;
  if(cap?.isNativePlatform?.()&&cap.isPluginAvailable?.("WorkRoute")&&cap.nativePromise)return cap.nativePromise("WorkRoute","position",{});
  return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve({id:crypto.randomUUID(),capturedAt:new Date(p.timestamp).toISOString(),latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
}
export function FieldOrderEditor({order,requiresJourney,onSaved}:{order:MobileFieldOrder;requiresJourney:boolean;onSaved:()=>Promise<void>}){
  const [report,setReport]=useState(order.executedService||""),[diagnosis,setDiagnosis]=useState(order.diagnosis||""),[checklist,setChecklist]=useState(order.mobileChecklist||{});
  const [before,setBefore]=useState(""),[after,setAfter]=useState(""),[signature,setSignature]=useState(""),[signerName,setSignerName]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  const [equipmentIds,setEquipmentIds]=useState(order.equipmentIds);
  const noticeRef=useRef<HTMLParagraphElement|null>(null);
  const canvas=useRef<HTMLCanvasElement|null>(null),drawing=useRef(false),drew=useRef(false);
  const done={...checklist,equipment:equipmentIds.length>0,checkin:Boolean(order.checkInAt),beforePhoto:Boolean(before||order.evidence.before),afterPhoto:Boolean(after||order.evidence.after),signature:Boolean(signature||order.evidence.signature),executedService:Boolean(report.trim()),diagnosis:Boolean(diagnosis.trim())};
  async function execute(action:"start"|"save"|"finish"){
    if(action==="finish"){
      const missing=[...(!done.diagnosis?["Diagnóstico e medições"]:[]),...mobileChecklist(order.service).filter(item=>item.required&&!done[item.key as keyof typeof done]).map(item=>item.label)];
      if(missing.length){setNotice(`Para concluir, preencha: ${missing.join("; ")}.`);requestAnimationFrame(()=>noticeRef.current?.scrollIntoView({behavior:"smooth",block:"center"}));return;}
    }
    if(action==="finish"&&!window.confirm("Concluir esta OS com o relatório, checklist, fotos e aceite registrados?"))return;
    setBusy(true);setNotice("");try{
      const point=requiresJourney&&(action==="start"||action==="finish")?await gps():undefined;
      const response=await fetch("/api/mobile/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:crypto.randomUUID(),action,orderId:order.id,expectedVersion:order.fieldVersion,expectedToken:order.editToken,report,diagnosis,equipmentIds,checklist:done,beforePhoto:before,afterPhoto:after,signature,signerName,point})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||"Gravação não confirmada.");setNotice("OS confirmada no servidor.");await onSaved();
    }catch(error){setNotice(error instanceof Error?error.message:"Não foi possível confirmar a OS.");}finally{setBusy(false);}
  }
  async function photo(kind:"before"|"after",file:File|undefined){if(!file)return;try{const value=await compressed(file);if(kind==="before")setBefore(value);else setAfter(value);}catch(error){setNotice(error instanceof Error?error.message:"Foto indisponível.");}}
  function pointer(event:React.PointerEvent<HTMLCanvasElement>,start:boolean){const c=canvas.current;if(!c)return;const rect=c.getBoundingClientRect(),ctx=c.getContext("2d")!,x=(event.clientX-rect.left)*c.width/rect.width,y=(event.clientY-rect.top)*c.height/rect.height;ctx.strokeStyle="#122b47";ctx.lineWidth=2;
    if(start){drawing.current=true;drew.current=false;c.setPointerCapture(event.pointerId);ctx.beginPath();ctx.moveTo(x,y);}else if(drawing.current){ctx.lineTo(x,y);ctx.stroke();drew.current=true;}}
  return <article className={styles.detailCard}><h2>Executar atendimento</h2>
    {requiresJourney&&<p>Para atuar, mantenha a jornada ativa. A pausa e o fim do expediente bloqueiam a gravação.</p>}
    {notice&&<p ref={noticeRef} role="alert" className={styles.warning}>{notice}</p>}
    {!order.checkInAt&&<button className={styles.primaryAction} type="button" disabled={busy} onClick={()=>void execute("start")}>Iniciar atendimento com check-in</button>}
    <label className={styles.formLabel}>Diagnóstico e medições<textarea value={diagnosis} onChange={event=>setDiagnosis(event.target.value)} maxLength={4000}/></label>
    <label className={styles.formLabel}>Serviço executado<textarea value={report} onChange={event=>setReport(event.target.value)} maxLength={8000}/></label>
    <h3>Equipamentos do atendimento</h3>
    {(order.equipmentOptions || []).map(item=><label key={item.id} className={styles.checkLabel}><input type="checkbox" checked={equipmentIds.includes(item.id)} disabled={busy} onChange={event=>setEquipmentIds(event.target.checked?[...equipmentIds,item.id]:equipmentIds.filter(id=>id!==item.id))}/>{item.label}</label>)}
    {!order.equipmentOptions?.length&&!equipmentIds.length&&<p className={styles.warning}>Não há equipamento cadastrado para este cliente e local. Solicite o cadastro do equipamento para vincular nesta OS.</p>}
    <h3>Checklist técnico</h3>{mobileChecklist(order.service).map(item=><label key={item.key} className={styles.checkLabel}><input type="checkbox" checked={Boolean(done[item.key as keyof typeof done])} disabled={["equipment","checkin","beforePhoto","afterPhoto","signature","executedService","diagnosis"].includes(item.key)} onChange={event=>setChecklist({...checklist,[item.key]:event.target.checked})}/>{item.label}</label>)}
    <label className={styles.formLabel}>Foto antes {order.evidence.before?"(já registrada)":""}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event=>void photo("before",event.target.files?.[0])}/></label>
    <label className={styles.formLabel}>Foto depois {order.evidence.after?"(já registrada)":""}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event=>void photo("after",event.target.files?.[0])}/></label>
    <label className={styles.formLabel}>Nome de quem dá o aceite<input value={signerName} onChange={event=>setSignerName(event.target.value)} maxLength={120}/></label>
    <p>Assinatura de aceite do cliente {order.evidence.signature?"(já registrada)":""}</p>
    <canvas ref={canvas} width={500} height={150} className={styles.signatureCanvas} onPointerDown={event=>pointer(event,true)} onPointerMove={event=>pointer(event,false)} onPointerUp={()=>{drawing.current=false;if(drew.current)setSignature(canvas.current!.toDataURL("image/png"));}} onPointerCancel={()=>{drawing.current=false;}}/>
    <button type="button" className={styles.secondaryAction} onClick={()=>{canvas.current?.getContext("2d")?.clearRect(0,0,500,150);setSignature("");}}>Limpar assinatura</button>
    <button type="button" className={styles.primaryAction} disabled={busy} onClick={()=>void execute("save")}>Salvar relatório e evidências</button>
    <button type="button" className={styles.secondaryAction} disabled={busy} onClick={()=>void execute("finish")}>Concluir OS</button>
  </article>;
}
