"use client";

import { useMemo, useState } from "react";
import { BookOpen, Camera, CheckCircle2, ClipboardList, PackagePlus, RefreshCcw, ShieldAlert, ShoppingCart, Stethoscope } from "lucide-react";
import {
  buildGuidedSteps, buildPurchaseHandoff, buildQuoteHandoff, calculateDeltaT, confirmFieldSolution,
  diagnosticConfidence, summarizeRecurrence, type DiagnosticMeasurements, type GuidedStep,
} from "@/lib/diagnostic-workflow";
import { normalizeDiagnosticManual, rankDiagnosticManuals } from "@/lib/diagnostic-manual-library";

type RecordItem=Record<string,unknown>;
type DiagnosticResult={
  summary?:string; referenceConfidence?:string; codeMeaning?:string; sourceUrls?:string[];
  probableCauses?:{cause?:string;probability?:number;why?:string}[];
  verificationTests?:{test?:string;expected?:string;tools?:string[]}[];
  solutions?:{action?:string;condition?:string}[];
  recommendedParts?:{part?:string;reason?:string;onlyIf?:string}[];
  manualReference?:{title?:string;url?:string;matchedModel?:string};
  technicalNote?:string;
};

type Props={
  order:RecordItem;
  equipment?:RecordItem;
  manuals?:RecordItem[];
  brand:string;
  model:string;
  equipmentType:string;
  code:string;
  blinkPattern:string;
  symptom:string;
  result:DiagnosticResult|null;
  canEdit:boolean;
  onPatch:(patch:RecordItem)=>void;
  onApplyPhotoContext:(data:{brand?:string;model?:string;code?:string;notes?:string})=>void;
};

const numberValue=(value:string)=>value.trim()===""?undefined:Number(value.replace(",","."));
const text=(record:RecordItem|undefined,...keys:string[])=>{for(const key of keys){const value=record?.[key];if(typeof value==="string"&&value.trim())return value.trim();}return""};

export function DiagnosticAdvancedPanel({order,equipment,manuals=[],brand,model,equipmentType,code,blinkPattern,symptom,result,canEdit,onPatch,onApplyPhotoContext}:Props){
  const initialMeasurements=(order.diagnosticMeasurements as DiagnosticMeasurements)||{};
  const [measurements,setMeasurements]=useState<DiagnosticMeasurements>(initialMeasurements);
  const [steps,setSteps]=useState<GuidedStep[]>(()=>Array.isArray(order.diagnosticGuidedSteps)?order.diagnosticGuidedSteps as GuidedStep[]:[]);
  const [solution,setSolution]=useState("");
  const [photoLoading,setPhotoLoading]=useState(false);
  const [photoResult,setPhotoResult]=useState<RecordItem|null>((order.diagnosticPhotoAnalysis as RecordItem)||null);
  const equipmentHistory=Array.isArray(equipment?.diagnosticHistory)?equipment?.diagnosticHistory as unknown[]:[];
  const orderHistory=Array.isArray(order.diagnosticHistory)?order.diagnosticHistory as unknown[]:[];
  const recurrence=useMemo(()=>summarizeRecurrence([...equipmentHistory,...orderHistory],{code,symptom}),[equipmentHistory,orderHistory,code,symptom]);
  const normalizedManuals=useMemo(()=>manuals.map(normalizeDiagnosticManual).filter(Boolean),[manuals]);
  const manualMatches=useMemo(()=>rankDiagnosticManuals(normalizedManuals as NonNullable<ReturnType<typeof normalizeDiagnosticManual>>[],{
    brand,equipmentType,model,capacityBtus:Number(text(equipment,"capacityBtus","capacityBtu","capacity").replace(/\D/g,""))||undefined,
  }),[normalizedManuals,brand,equipmentType,model,equipment]);
  const confidence=useMemo(()=>diagnosticConfidence({
    referenceConfidence:result?.referenceConfidence,sourceUrls:result?.sourceUrls,model,code,blinkPattern,
    manualMatched:Boolean(result?.manualReference?.url||manualMatches.some(item=>item.manual.source==="Fabricante")),
    measurements,guidedSteps:steps,
  }),[result,model,code,blinkPattern,manualMatches,measurements,steps]);
  const deltaT=calculateDeltaT(measurements);

  const updateMeasurement=(key:keyof DiagnosticMeasurements,value:string)=>{
    const next={...measurements,[key]:key==="refrigerant"||key==="pressureUnit"||key==="temperatureUnit"||key==="notes"?value:numberValue(value)};
    setMeasurements(next);
    onPatch({diagnosticMeasurements:next});
  };

  const generateSteps=()=>{
    const next=buildGuidedSteps({symptom,code,blinkPattern,equipmentType,refrigerant:measurements.refrigerant,probableCauses:result?.probableCauses,verificationTests:result?.verificationTests});
    setSteps(next); onPatch({diagnosticGuidedSteps:next});
  };
  const updateStep=(id:string,status:GuidedStep["status"],observation?:string)=>{
    const next=steps.map(step=>step.id===id?{...step,status,observation:observation??step.observation}:step);
    setSteps(next); onPatch({diagnosticGuidedSteps:next});
  };

  const analyzePhoto=async(file?:File)=>{
    if(!file)return;
    setPhotoLoading(true);
    try{
      const image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Falha ao ler imagem"));reader.readAsDataURL(file);});
      const response=await fetch("/api/diagnostic/photo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image,brand,model,equipmentType,symptom})});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"Falha na análise da foto.");
      const analysis=(payload.analysis||{}) as RecordItem;
      setPhotoResult(analysis); onPatch({diagnosticPhotoAnalysis:analysis});
    }finally{setPhotoLoading(false);}
  };

  const prepareQuote=()=>{
    const parts=(result?.recommendedParts||[]).map(item=>item.part||"").filter(Boolean);
    onPatch({diagnosticQuoteHandoff:buildQuoteHandoff({
      orderId:String(order.id||""),equipmentId:String(equipment?.id||""),diagnosis:result?.technicalNote||result?.summary,
      solutions:result?.solutions,parts,
    })});
  };
  const preparePurchase=()=>{
    const parts=(result?.recommendedParts||[]).map(item=>item.part||"").filter(Boolean);
    onPatch({diagnosticPurchaseHandoff:buildPurchaseHandoff({orderId:String(order.id||""),equipmentId:String(equipment?.id||""),parts})});
  };
  const confirmSolution=()=>{
    if(!solution.trim())return;
    const previous=Array.isArray(order.diagnosticConfirmedSolutions)?order.diagnosticConfirmedSolutions as RecordItem[]:[];
    const record=confirmFieldSolution({orderId:String(order.id||""),equipmentId:String(equipment?.id||""),brand,model,code,symptom,solution,technician:String(order.tech||"")});
    onPatch({diagnosticConfirmedSolutions:[record,...previous].slice(0,30)});
    setSolution("");
  };

  return <div className="diagnostic-advanced">
    <article className="diagnostic-panel">
      <header><div><b>Confiança técnica</b><small>Calculada por referência, modelo, medições e testes executados.</small></div><span className="confidence-score">{confidence.score}%</span></header>
      <div className="confidence-level"><ShieldAlert size={16}/><div><b>{confidence.level}</b><small>{confidence.reasons.join(" • ")||"Adicione modelo, referência e medições para aumentar a confiança."}</small></div></div>
      {recurrence.warning&&<div className="recurrence-warning"><RefreshCcw size={16}/><div><b>Reincidência detectada</b><small>{recurrence.warning}</small></div></div>}
      <div className="recurrence-stats"><span>Histórico <b>{recurrence.count}</b></span><span>180 dias <b>{recurrence.within180Days}</b></span><span>Mesmo código <b>{recurrence.sameCode}</b></span><span>Sintoma semelhante <b>{recurrence.sameSymptom}</b></span></div>
    </article>

    <article className="diagnostic-panel">
      <header><div><b>Medições estruturadas</b><small>Dados objetivos passam a fazer parte do diagnóstico da OS.</small></div>{deltaT!==null&&<span className="delta-t">ΔT {deltaT.toFixed(1)}°</span>}</header>
      <div className="measurement-grid">
        <label>Tensão (V)<input type="number" value={measurements.voltage??""} onChange={e=>updateMeasurement("voltage",e.target.value)}/></label>
        <label>Corrente (A)<input type="number" value={measurements.current??""} onChange={e=>updateMeasurement("current",e.target.value)}/></label>
        <label>Ambiente (°C)<input type="number" value={measurements.ambientTemperature??""} onChange={e=>updateMeasurement("ambientTemperature",e.target.value)}/></label>
        <label>Retorno (°C)<input type="number" value={measurements.returnTemperature??""} onChange={e=>updateMeasurement("returnTemperature",e.target.value)}/></label>
        <label>Insuflamento (°C)<input type="number" value={measurements.supplyTemperature??""} onChange={e=>updateMeasurement("supplyTemperature",e.target.value)}/></label>
        <label>Pressão sucção<input type="number" value={measurements.suctionPressure??""} onChange={e=>updateMeasurement("suctionPressure",e.target.value)}/></label>
        <label>Pressão descarga<input type="number" value={measurements.dischargePressure??""} onChange={e=>updateMeasurement("dischargePressure",e.target.value)}/></label>
        <label>Superaquecimento (K)<input type="number" value={measurements.superheat??""} onChange={e=>updateMeasurement("superheat",e.target.value)}/></label>
        <label>Sub-resfriamento (K)<input type="number" value={measurements.subcooling??""} onChange={e=>updateMeasurement("subcooling",e.target.value)}/></label>
        <label>Resistência sensor (Ω)<input type="number" value={measurements.sensorResistance??""} onChange={e=>updateMeasurement("sensorResistance",e.target.value)}/></label>
        <label>Fluido<input value={measurements.refrigerant??""} onChange={e=>updateMeasurement("refrigerant",e.target.value)} placeholder="R-32"/></label>
        <label>Pressão<select value={measurements.pressureUnit||"psi"} onChange={e=>updateMeasurement("pressureUnit",e.target.value)}><option>psi</option><option>bar</option></select></label>
      </div>
    </article>

    <article className="diagnostic-panel">
      <header><div><b>Árvore de diagnóstico guiada</b><small>Execute testes e elimine hipóteses antes de substituir componentes.</small></div><button className="diagnostic-secondary" onClick={generateSteps}><Stethoscope size={14}/> Gerar sequência</button></header>
      {!steps.length?<p className="diagnostic-empty">Gere a sequência depois de informar o sintoma e, quando houver, executar a análise IA.</p>:<div className="guided-steps">{steps.map((step,index)=><div className="guided-step" key={step.id}><span>{index+1}</span><div><b>{step.title}</b><p>{step.instruction}</p>{step.expected&&<small>Esperado: {step.expected}</small>}{step.safety&&<small className="step-safety">{step.safety}</small>}<input value={step.observation||""} onChange={e=>updateStep(step.id,step.status,e.target.value)} placeholder="Resultado/observação do teste"/></div><div className="step-actions"><button className={step.status==="ok"?"active":""} onClick={()=>updateStep(step.id,"ok")}>OK</button><button className={step.status==="abnormal"?"active abnormal":""} onClick={()=>updateStep(step.id,"abnormal")}>Anormal</button><button onClick={()=>updateStep(step.id,"not-applicable")}>N/A</button></div></div>)}</div>}
    </article>

    <article className="diagnostic-panel">
      <header><div><b>Foto técnica</b><small>Display, LEDs, placa ou etiqueta. A imagem não substitui confirmação por manual.</small></div></header>
      <label className="diagnostic-photo-upload"><Camera size={18}/>{photoLoading?"Analisando foto...":"Fotografar ou escolher imagem"}<input type="file" accept="image/*" capture="environment" disabled={photoLoading} onChange={e=>void analyzePhoto(e.target.files?.[0])}/></label>
      {photoResult&&<div className="photo-analysis"><b>Leitura visual</b><span>{String(photoResult.visibleText||"Sem texto legível")}</span><small>Código detectado: {String(photoResult.detectedCode||"não confirmado")} • confiança {String(photoResult.confidence||"não informada")}</small><button className="diagnostic-secondary" onClick={()=>onApplyPhotoContext({brand:String(photoResult.detectedBrand||""),model:String(photoResult.detectedModel||""),code:String(photoResult.detectedCode||""),notes:String(photoResult.visibleText||"")})}>Usar dados confirmáveis</button></div>}
    </article>

    <article className="diagnostic-panel">
      <header><div><b>Manuais e fontes</b><small>Prioridade para fabricante; fontes complementares ficam identificadas.</small></div><BookOpen size={17}/></header>
      <div className="manual-list">{manualMatches.map(({manual,score})=><a key={manual.id} href={manual.url} target="_blank" rel="noreferrer"><span><b>{manual.title}</b><small>{manual.source} • compatibilidade {score}</small></span><BookOpen size={14}/></a>)}</div>
    </article>

    {result&&<article className="diagnostic-panel">
      <header><div><b>Próximas ações</b><small>Crie rascunhos ligados à OS sem executar compras ou orçamento automaticamente.</small></div><ClipboardList size={17}/></header>
      <div className="diagnostic-handoffs"><button disabled={!canEdit} onClick={prepareQuote}><ShoppingCart size={15}/> Preparar orçamento</button><button disabled={!canEdit} onClick={preparePurchase}><PackagePlus size={15}/> Preparar solicitação de material</button></div>
      {(result.recommendedParts||[]).length>0&&<div className="parts-hypothesis"><b>Peças condicionais</b>{(result.recommendedParts||[]).map((part,index)=><p key={index}><strong>{part.part}</strong> — {part.reason} <small>{part.onlyIf?"Somente se: "+part.onlyIf:""}</small></p>)}</div>}
      <div className="confirmed-solution"><label>Solução confirmada em campo<textarea value={solution} onChange={e=>setSolution(e.target.value)} placeholder="Ex.: sensor da serpentina medido fora da curva; substituído e equipamento normalizado."/></label><button disabled={!canEdit||!solution.trim()} onClick={confirmSolution}><CheckCircle2 size={14}/> Confirmar solução PolarTech</button></div>
    </article>}
  </div>;
}
