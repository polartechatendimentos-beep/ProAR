"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BookOpen, Calculator, CheckCircle2, Clock3, Gauge, History, Home, Search, ShieldAlert, Sparkles, Thermometer, Wrench } from "lucide-react";
import { findDiagnosticMatches, normalizeDiagnosticRecord, parseDiagnosticSearch, type DiagnosticCodeRecord } from "@/lib/diagnostic-engine";
import { HVAC_REFERENCE_PORTAL, mergeDiagnosticCatalog } from "@/lib/hvac-error-code-catalog";
import { validateManufacturerCode } from "@/lib/diagnostic-brand-rules";
import { DiagnosticAdvancedPanel } from "@/components/DiagnosticAdvancedPanel";
import { calculateSubcooling, calculateSuperheat } from "@/lib/refrigerant-tools";
import "./hvac-diagnostic-workspace.css";

type RecordItem=Record<string,unknown>;
type DiagnosticResult={
  summary?:string;
  severity?:string;
  referenceConfidence?:string;
  codeMeaning?:string;
  probableCauses?:{cause?:string;probability?:number;why?:string}[];
  verificationTests?:{test?:string;expected?:string;tools?:string[]}[];
  solutions?:{action?:string;condition?:string}[];
  requiredTools?:string[];
  safetyWarnings?:string[];
  sourceUrls?:string[];
  technicalNote?:string;
};
type HistoryItem={id:string;createdAt:string;brand?:string;model?:string;code?:string;blinkPattern?:string;symptoms?:string;result?:DiagnosticResult};
type Props={
  order:RecordItem;
  linkedEquipment?:RecordItem[];
  errorCodes?:RecordItem[];
  manuals?:RecordItem[];
  canEdit:boolean;
  onApply:(payload:{diagnosis:string;diagnosticHistory:HistoryItem[];diagnosticLastResult:DiagnosticResult})=>void;
  onPatch?:(payload:RecordItem)=>void;
};
const pages=["Início","Códigos","Diagnóstico","Ferramentas","Histórico"] as const;
type Page=typeof pages[number];
const brands=["TCL","Midea","Carrier","Elgin","Daikin","LG","Samsung","Gree","Fujitsu","Hitachi","Mitsubishi Electric","Springer","York","Trane","Philco"];
const symptoms=["Não gela","Pingando água","Não liga","Desarma disjuntor","Evaporadora congelando","Condensadora não parte","Ruído anormal","Erro no display"];
const txt=(r:RecordItem|undefined,...keys:string[])=>{for(const k of keys){const v=r?.[k];if(typeof v==="string"&&v.trim())return v.trim();}return""};

export function HvacDiagnosticWorkspace({order,linkedEquipment=[],errorCodes=[],manuals=[],canEdit,onApply,onPatch}:Props){
  const [page,setPage]=useState<Page>("Início");
  const equipment=linkedEquipment[0];
  const [brand,setBrand]=useState(txt(equipment,"brand","manufacturer"));
  const [equipmentType,setEquipmentType]=useState(txt(equipment,"equipmentType","type")||"Split Hi-Wall");
  const [model,setModel]=useState(txt(equipment,"model"));
  const [code,setCode]=useState("");
  const [blinkPattern,setBlinkPattern]=useState("");
  const [symptom,setSymptom]=useState(String(order.request||order.customerRequest||""));
  const [measurements,setMeasurements]=useState("");
  const patch=(payload:RecordItem)=>onPatch?.(payload);
  const [search,setSearch]=useState("");
  const [brandFilter,setBrandFilter]=useState("Todas");
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [result,setResult]=useState<DiagnosticResult|null>((order.diagnosticLastResult as DiagnosticResult)||null);
  const history=Array.isArray(order.diagnosticHistory)?order.diagnosticHistory as HistoryItem[]:[];
  const codes=useMemo(()=>mergeDiagnosticCatalog(errorCodes.map(normalizeDiagnosticRecord).filter((item):item is DiagnosticCodeRecord=>Boolean(item))),[errorCodes]);
  const parsedSearch=useMemo(()=>parseDiagnosticSearch(search),[search]);
  const searchMatches=useMemo(()=>{
    const effectiveBrand=brandFilter==="Todas"?(parsedSearch.brand||""):brandFilter;
    const source=effectiveBrand?codes.filter(item=>item.brand.toLocaleLowerCase("pt-BR")===effectiveBrand.toLocaleLowerCase("pt-BR")):codes;
    return findDiagnosticMatches(source,{...parsedSearch,brand:effectiveBrand},40).filter(item=>item.score>5);
  },[codes,parsedSearch,brandFilter]);
  const manufacturerValidation=useMemo(()=>validateManufacturerCode({brand,model,code,blinkPattern}),[brand,model,code,blinkPattern]);
  const directReference=useMemo(()=>{
    if(manufacturerValidation.status==="needs-extraction"||manufacturerValidation.status==="invalid") return null;
    return findDiagnosticMatches(codes,{brand,model,code,blinkPattern,symptoms:symptom},1)[0]?.record||null;
  },[codes,brand,model,code,blinkPattern,symptom,manufacturerValidation.status]);

  const runDiagnosis=async()=>{
    if(!symptom.trim()&&!code.trim()&&!blinkPattern.trim()){setMessage("Informe um sintoma, código de erro ou padrão de piscadas.");return;}
    setLoading(true);setMessage("");
    try{
      const response=await fetch("/api/diagnostic/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        brand,equipmentType,model,serialNumber:txt(equipment,"serialNumber","serial"),code,blinkPattern,symptoms:symptom,
        serviceRequest:String(order.request||order.customerRequest||""),measurements,matchedReference:directReference,manufacturerValidation,
      })});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"Não foi possível concluir o diagnóstico.");
      setResult(payload.diagnostic||null);
      setPage("Diagnóstico");
    }catch(error){setMessage(error instanceof Error?error.message:"Falha no diagnóstico assistido.");}
    finally{setLoading(false);}
  };

  const applyResult=()=>{
    if(!result||!canEdit)return;
    const record:HistoryItem={id:`DIA-${Date.now()}`,createdAt:new Date().toISOString(),brand,model,code,blinkPattern,symptoms:symptom,result};
    const technical=[result.technicalNote||result.summary,result.codeMeaning&&`Código/piscadas: ${result.codeMeaning}`].filter(Boolean).join("\n");
    onApply({diagnosis:technical,diagnosticHistory:[record,...history].slice(0,50),diagnosticLastResult:result});
    setMessage("Diagnóstico anexado à Ordem de Serviço. Salve a OS para confirmar no banco.");
  };

  const selectSymptom=(value:string)=>{setSymptom(value);setPage("Diagnóstico");};
  const selectCode=(item:DiagnosticCodeRecord)=>{setBrand(item.brand);setCode(item.code||"");setBlinkPattern(item.blinkPattern||"");setPage("Diagnóstico");};

  return <section className="hvac-diagnostic">
    <header className="diagnostic-top"><div><span><Sparkles size={14}/> PROAR DIAGNOSTIC</span><h3>Assistente técnico HVAC-R</h3><p>Códigos, piscadas, sintomas, testes de verificação e ferramentas de campo dentro da própria OS.</p></div><div className="diagnostic-context"><Wrench size={18}/><span><b>{brand||"Marca não informada"} {model&&`• ${model}`}</b><small>{equipmentType} • {txt(equipment,"serialNumber","serial")||"série não informada"}</small></span></div></header>

    {page==="Início"&&<div className="diagnostic-page diagnostic-home">
      <div className="diagnostic-hero-search"><Search size={20}/><input value={symptom} onChange={e=>setSymptom(e.target.value)} placeholder="Me diga o problema, código ou sequência de piscadas..."/><button onClick={()=>void runDiagnosis()} disabled={loading}>{loading?"Analisando...":"Diagnosticar"} <ArrowRight size={15}/></button></div>
      <div className="diagnostic-quick-grid">
        <button onClick={()=>setPage("Diagnóstico")}><Sparkles/><b>Diagnóstico IA</b><small>Análise guiada e testes</small></button>
        <button onClick={()=>setPage("Códigos")}><BookOpen/><b>Códigos</b><small>Banco por marca e falha</small></button>
        <button onClick={()=>setPage("Ferramentas")}><Calculator/><b>Ferramentas</b><small>Cálculos de campo</small></button>
      </div>
      <article className="diagnostic-panel"><header><div><b>Sintomas comuns</b><small>Comece o diagnóstico com um toque</small></div></header><div className="symptom-chips">{symptoms.map(item=><button key={item} onClick={()=>selectSymptom(item)}>{item}</button>)}</div></article>
      <article className="diagnostic-panel"><header><div><b>Marcas</b><small>Filtro rápido para consulta de códigos</small></div></header><div className="brand-strip">{brands.map(item=><button key={item} onClick={()=>{setBrandFilter(item);setSearch("");setPage("Códigos")}}>{item}</button>)}</div></article>
      <article className="diagnostic-panel"><header><div><b>Diagnósticos recentes desta OS</b><small>{history.length} registro(s)</small></div><button onClick={()=>setPage("Histórico")}>Ver todos</button></header>{history.slice(0,3).length?<div className="diagnostic-recent">{history.slice(0,3).map(item=><button key={item.id} onClick={()=>{setResult(item.result||null);setPage("Histórico")}}><Clock3 size={14}/><span><b>{item.result?.summary||item.symptoms||"Diagnóstico"}</b><small>{new Date(item.createdAt).toLocaleString("pt-BR")}</small></span></button>)}</div>:<p className="diagnostic-empty">Nenhum diagnóstico salvo nesta OS.</p>}</article>
    </div>}

    {page==="Códigos"&&<div className="diagnostic-page">
      <div className="code-search-row"><label><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder='Ex.: "Elgin condensadora piscando 5 vezes piso teto 60 mil"'/></label><select value={brandFilter} onChange={e=>setBrandFilter(e.target.value)}><option>Todas</option>{brands.map(item=><option key={item}>{item}</option>)}</select></div>
      {search.trim()&&<div className="smart-query-readout"><b>Filtro entendido pelo ProAR:</b>{parsedSearch.brand&&<span>Marca: {parsedSearch.brand}</span>}{parsedSearch.equipmentType&&<span>Tipo: {parsedSearch.equipmentType}</span>}{parsedSearch.unit&&<span>Unidade: {parsedSearch.unit}</span>}{parsedSearch.capacityBtus&&<span>Capacidade: {Number(parsedSearch.capacityBtus).toLocaleString("pt-BR")} BTU/h</span>}{parsedSearch.code&&<span>Código: {parsedSearch.code}</span>}{parsedSearch.blinkPattern&&<span>Sinal: {parsedSearch.blinkPattern}</span>}</div>}
      <div className="code-results">{searchMatches.map(({record,score})=><article key={record.id}><div><span>{record.brand}</span><b>{record.code||record.blinkPattern||"Falha"}</b></div><section><h4>{record.title||"Código técnico"}</h4><p>{record.notes||record.causes?.[0]||"Abra para consultar causas e verificações."}</p><small>{record.verified?"Referência verificada":"Referência cadastrada"} • compatibilidade {score}{record.equipmentTypes?.length?` • ${record.equipmentTypes.join("/")}`:""}{record.unit?` • sinal na ${record.unit}`:""}</small></section><button onClick={()=>selectCode(record)}>Usar no diagnóstico</button></article>)}</div>
      {!searchMatches.length&&<div className="diagnostic-empty"><BookOpen size={24}/><b>Nenhuma referência suficientemente compatível.</b><span>O ProAR não encontrou combinação segura entre marca, tipo, unidade, capacidade e sinal. Ele não vai reaproveitar um código de outro equipamento só porque a quantidade de piscadas coincide.</span><small>Fonte complementar configurada: {HVAC_REFERENCE_PORTAL.name} • {HVAC_REFERENCE_PORTAL.brands.length} marcas catalogadas.</small><button className="diagnostic-primary" onClick={()=>{setBrand(parsedSearch.brand||brand);setEquipmentType(parsedSearch.equipmentType||equipmentType);setCode(parsedSearch.code||"");setBlinkPattern(parsedSearch.blinkPattern||"");setSymptom(search);setPage("Diagnóstico")}}>Pesquisar manuais com IA</button></div>}
    </div>}

    {page==="Diagnóstico"&&<div className="diagnostic-page diagnose-layout">
      <article className="diagnostic-panel diagnose-form"><header><div><b>Dados para análise</b><small>O equipamento da OS é usado como contexto automaticamente.</small></div></header>
        <div className="diagnose-fields"><label>Marca<input value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Marca"/></label><label>Tipo<select value={equipmentType} onChange={e=>setEquipmentType(e.target.value)}><option>Split Hi-Wall</option><option>Cassete</option><option>Piso Teto</option><option>VRF / VRV</option><option>Janela</option><option>Chiller</option><option>Fan Coil</option><option>Outro</option></select></label><label>Modelo<input value={model} onChange={e=>setModel(e.target.value)} placeholder="Modelo"/></label><label>Código de erro<input value={code} onChange={e=>setCode(e.target.value)} placeholder="Ex.: E0"/></label><label>Padrão de piscadas<input value={blinkPattern} onChange={e=>setBlinkPattern(e.target.value)} placeholder="Ex.: LED timer pisca 5x"/></label><label className="wide">Sintoma<textarea value={symptom} onChange={e=>setSymptom(e.target.value)} placeholder="Descreva o comportamento observado..."/></label><label className="wide">Medições realizadas<textarea value={measurements} onChange={e=>setMeasurements(e.target.value)} placeholder="Tensão, corrente, pressões, temperaturas, resistência de sensores..."/></label></div>
        {manufacturerValidation.status!=="empty"&&<div className={`manufacturer-rule ${manufacturerValidation.status}`}><ShieldAlert size={16}/><span><b>{manufacturerValidation.title}</b><small>{manufacturerValidation.message}</small>{manufacturerValidation.instructions.length>0&&<ul>{manufacturerValidation.instructions.map((item,index)=><li key={index}>{item}</li>)}</ul>}</span></div>}
        {directReference&&<div className="reference-hit"><CheckCircle2 size={16}/><span><b>Referência localizada no banco</b><small>{directReference.brand} • {directReference.code||directReference.blinkPattern} • {directReference.title}</small></span></div>}
        <button className="diagnostic-primary" onClick={()=>void runDiagnosis()} disabled={loading}><Sparkles size={15}/>{loading?"Consultando referências e analisando...":"Executar diagnóstico assistido"}</button>
      </article>
      <article className="diagnostic-panel diagnose-result"><header><div><b>Resultado técnico</b><small>{result?"Revise antes de anexar à OS.":"Aguardando análise."}</small></div>{result?.severity&&<span className={`severity ${String(result.severity).toLowerCase()}`}>{result.severity}</span>}</header>
        {result?<div className="diagnostic-result-body">
          <h4>{result.summary}</h4>
          <div className={`confidence ${result.referenceConfidence||""}`}><ShieldAlert size={15}/><span><b>Referência: {result.referenceConfidence||"não informada"}</b><small>{result.codeMeaning||"Significado do código não confirmado."}</small></span></div>
          <section><b>Causas prováveis</b>{(result.probableCauses||[]).map((item,index)=><div className="cause-row" key={index}><span>{Math.round(Number(item.probability)||0)}%</span><div><b>{item.cause}</b><small>{item.why}</small></div></div>)}</section>
          <section><b>Testes de verificação</b><ol>{(result.verificationTests||[]).map((item,index)=><li key={index}><strong>{item.test}</strong><span>{item.expected}</span><small>{(item.tools||[]).join(" • ")}</small></li>)}</ol></section>
          <section><b>Soluções condicionais</b><ol>{(result.solutions||[]).map((item,index)=><li key={index}><strong>{item.action}</strong><span>{item.condition}</span></li>)}</ol></section>
          {(result.safetyWarnings||[]).length>0&&<section className="safety-box"><AlertTriangle size={18}/><div><b>Segurança</b>{(result.safetyWarnings||[]).map((item,index)=><p key={index}>{item}</p>)}</div></section>}
          {(result.sourceUrls||[]).length>0&&<section><b>Fontes consultadas</b><div className="source-links">{(result.sourceUrls||[]).map((url,index)=><a key={index} href={url} target="_blank" rel="noreferrer">Fonte {index+1}</a>)}</div></section>}
          <button className="diagnostic-primary" disabled={!canEdit} onClick={applyResult}><CheckCircle2 size={15}/> Aplicar ao diagnóstico da OS</button>
          <DiagnosticAdvancedPanel order={order} equipment={equipment} manuals={manuals} brand={brand} model={model} equipmentType={equipmentType} code={code} blinkPattern={blinkPattern} symptom={symptom} result={result} canEdit={canEdit} onPatch={patch} onApplyPhotoContext={data=>{if(data.brand)setBrand(data.brand);if(data.model)setModel(data.model);if(data.code)setCode(data.code);if(data.notes)setMeasurements(current=>current?current+"\nFoto: "+data.notes:"Foto: "+data.notes);}}/>
        </div>:<div className="diagnostic-empty"><Sparkles size={26}/><b>Preencha os dados ao lado.</b><span>A análise combina sintomas, código/piscadas, equipamento vinculado e referências técnicas encontradas.</span></div>}
      </article>
    </div>}

    {page==="Ferramentas"&&<DiagnosticTools/>}

    {page==="Histórico"&&<div className="diagnostic-page"><article className="diagnostic-panel"><header><div><b>Histórico desta Ordem de Serviço</b><small>Os resultados ficam vinculados à OS e acompanham a rastreabilidade do atendimento.</small></div></header>{history.length?<div className="diagnostic-history">{history.map(item=><article key={item.id}><span><History size={15}/></span><div><b>{item.result?.summary||item.symptoms||"Diagnóstico técnico"}</b><small>{[item.brand,item.model,item.code,item.blinkPattern].filter(Boolean).join(" • ")}</small><time>{new Date(item.createdAt).toLocaleString("pt-BR")}</time></div><button onClick={()=>{setResult(item.result||null);setBrand(item.brand||"");setModel(item.model||"");setCode(item.code||"");setBlinkPattern(item.blinkPattern||"");setSymptom(item.symptoms||"");setPage("Diagnóstico")}}>Abrir</button></article>)}</div>:<div className="diagnostic-empty"><History size={25}/><b>Nenhum diagnóstico salvo.</b><span>Ao aplicar uma análise à OS, ela aparecerá aqui.</span></div>}</article></div>}

    {message&&<div className="diagnostic-message">{message}</div>}
    <nav className="diagnostic-bottom-nav">{pages.map(item=>{const Icon=item==="Início"?Home:item==="Códigos"?BookOpen:item==="Diagnóstico"?Sparkles:item==="Ferramentas"?Calculator:History;return <button key={item} className={page===item?"active":""} onClick={()=>setPage(item)}><Icon size={17}/><span>{item}</span></button>})}</nav>
  </section>;
}

function DiagnosticTools(){
  const [area,setArea]=useState("20");
  const [people,setPeople]=useState("2");
  const [devices,setDevices]=useState("1");
  const [value,setValue]=useState("1");
  const [conversion,setConversion]=useState("kw-btu");
  const [suctionLineTemp,setSuctionLineTemp]=useState("12");
  const [evapSatTemp,setEvapSatTemp]=useState("5");
  const [liquidLineTemp,setLiquidLineTemp]=useState("32");
  const [condSatTemp,setCondSatTemp]=useState("40");
  const areaN=Math.max(0,Number(area)||0),peopleN=Math.max(1,Number(people)||1),devicesN=Math.max(0,Number(devices)||0);
  const estimate=Math.round(areaN*600+Math.max(0,peopleN-2)*600+devicesN*600);
  const v=Number(value)||0;
  const converted=conversion==="kw-btu"?v*3412.142:conversion==="btu-kw"?v/3412.142:conversion==="psi-bar"?v*0.0689476:conversion==="bar-psi"?v*14.5038:conversion==="c-f"?v*9/5+32:(v-32)*5/9;
  const superheat=calculateSuperheat(Number(suctionLineTemp)||0,Number(evapSatTemp)||0);
  const subcooling=calculateSubcooling(Number(condSatTemp)||0,Number(liquidLineTemp)||0);
  return <div className="diagnostic-page tools-grid">
    <article className="diagnostic-panel tool-card"><Gauge size={22}/><h4>Estimativa rápida de BTU/h</h4><p>Triagem preliminar. Dimensionamento definitivo deve considerar carga térmica e critérios técnicos do projeto.</p><div className="tool-fields"><label>Área (m²)<input type="number" value={area} onChange={e=>setArea(e.target.value)}/></label><label>Pessoas<input type="number" value={people} onChange={e=>setPeople(e.target.value)}/></label><label>Equipamentos/cargas<input type="number" value={devices} onChange={e=>setDevices(e.target.value)}/></label></div><strong>{estimate.toLocaleString("pt-BR")} BTU/h</strong></article>
    <article className="diagnostic-panel tool-card"><Calculator size={22}/><h4>Conversor técnico</h4><select value={conversion} onChange={e=>setConversion(e.target.value)}><option value="kw-btu">kW → BTU/h</option><option value="btu-kw">BTU/h → kW</option><option value="psi-bar">psi → bar</option><option value="bar-psi">bar → psi</option><option value="c-f">°C → °F</option><option value="f-c">°F → °C</option></select><input type="number" value={value} onChange={e=>setValue(e.target.value)}/><strong>{Number.isFinite(converted)?converted.toLocaleString("pt-BR",{maximumFractionDigits:3}):"—"}</strong></article>
    <article className="diagnostic-panel tool-card"><Thermometer size={22}/><h4>Superaquecimento e sub-resfriamento</h4><div className="tool-fields"><label>Linha sucção °C<input type="number" value={suctionLineTemp} onChange={e=>setSuctionLineTemp(e.target.value)}/></label><label>Saturação evap. °C<input type="number" value={evapSatTemp} onChange={e=>setEvapSatTemp(e.target.value)}/></label><label>Saturação cond. °C<input type="number" value={condSatTemp} onChange={e=>setCondSatTemp(e.target.value)}/></label><label>Linha líquido °C<input type="number" value={liquidLineTemp} onChange={e=>setLiquidLineTemp(e.target.value)}/></label></div><strong>Superaquecimento {superheat.toFixed(1)} K • Sub-resfriamento {subcooling.toFixed(1)} K</strong><small>Use temperatura de saturação obtida de referência P×T verificada para o refrigerante do equipamento.</small></article>\n    <article className="diagnostic-panel tool-card pt-card"><Thermometer size={22}/><h4>Pressão × Temperatura</h4><p>O ProAR não usa uma tabela genérica embutida para evitar referência errada entre refrigerantes, escalas e condições de saturação. Consulte a referência P×T específica do fluido/fabricante durante o diagnóstico assistido.</p><div className="pt-refrigerants"><span>R-410A</span><span>R-32</span><span>R-22</span></div><small>Melhoria de segurança: a tela prioriza dados rastreáveis a uma fonte técnica em vez de valores aproximados sem origem.</small></article>
  </div>;
}
