"use client";
import { useMemo, useState } from "react";
import { BookOpen, Calculator, ClipboardCheck, Search, ShieldAlert, Wrench } from "lucide-react";
import { referenceTemperature, refrigerantKeys, technicalDifference, technicalSources, type RefrigerantKey } from "@/lib/mobile-technical-library";
type Resource = { id: string; category: "manual" | "erro" | "procedimento"; title: string; brand?: string; model?: string; url?: string; notes: string };
const procedures: Resource[] = [
  { id:"vacuo", category:"procedimento", title:"Vácuo e desidratação", notes:"Seguir fabricante; usar vacuômetro calibrado e registrar microns e teste de subida." },
  { id:"estanqueidade", category:"procedimento", title:"Estanqueidade com nitrogênio", notes:"Confirmar limites de pressão do equipamento/projeto; nunca utilizar oxigênio. Registrar início, fim e temperatura ambiente." },
  { id:"eletrica", category:"procedimento", title:"Segurança elétrica", notes:"Aplicar bloqueio, etiquetagem, verificação de ausência de tensão e procedimentos NR-10." },
];
export function TechnicalBasePanel() {
  const [query,setQuery]=useState("");
  const [assistantQuestion,setAssistantQuestion]=useState("");
  const [brand,setBrand]=useState("");
  const [model,setModel]=useState("");
  const [errorCode,setErrorCode]=useState("");
  const [assistantResult,setAssistantResult]=useState<{answer:string;sources:{title:string;reference:string}[];notice:string;nextQuestions?:string[];diagnosticStatus?:string}|null>(null);
  const [assistantBusy,setAssistantBusy]=useState(false);
  const [assistantError,setAssistantError]=useState("");
  const [category,setCategory]=useState("todos");
  const [calcFluid,setCalcFluid]=useState("R-410A");
  const [suctionPressure,setSuctionPressure]=useState("");
  const [suctionLine,setSuctionLine]=useState("");
  const [liquidPressure,setLiquidPressure]=useState("");
  const [liquidLine,setLiquidLine]=useState("");
  const [resources,setResources]=useState<Resource[]>(procedures);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const visible=useMemo(()=>resources.filter(r=>(category==="todos"||r.category===category)&&[r.title,r.brand,r.model,r.notes].join(" ").toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))),[resources,category,query]);
  const calculatorResult = (kind:"superheat"|"subcool", pressureText:string, lineText:string) => {
    const pressure=Number(pressureText.trim().replace(",","."));
    const line=Number(lineText.trim().replace(",","."));
    const options=refrigerantKeys[calcFluid]||[];
    const key=(calcFluid==="R-407C"?(kind==="superheat"?"r407cVapor":"r407cLiquid"):options[0]) as RefrigerantKey|undefined;
    if(!key||!Number.isFinite(pressure)||!Number.isFinite(line)) return null;
    const saturation=referenceTemperature(pressure,key);
    if(saturation===null) return null;
    try { return technicalDifference(kind,line,saturation); } catch { return null; }
  };
  const superheat=calculatorResult("superheat",suctionPressure,suctionLine);
  const subcool=calculatorResult("subcool",liquidPressure,liquidLine);
  async function askAssistant() {
    if (!assistantQuestion.trim() || assistantBusy) return;
    setAssistantBusy(true);setAssistantError("");setAssistantResult(null);
    try { const response=await fetch("/api/technical-base/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:assistantQuestion,brand,model,code:errorCode})});const json=await response.json();if(!response.ok||!json.success)throw new Error(json.error||"Consulta indisponível");setAssistantResult(json); }
    catch(e){setAssistantError(e instanceof Error?e.message:"Falha na consulta");}
    finally{setAssistantBusy(false);}
  }
  async function refresh() {
    setLoading(true);setError("");
    try {
      const response=await fetch("/api/technical-base",{cache:"no-store"});
      if (!response.ok) throw new Error("Biblioteca autenticada indisponível.");
      const json=await response.json();
      if (!json.success||!Array.isArray(json.data)) throw new Error("Resposta inválida da biblioteca.");
      setResources([...procedures,...json.data.filter((r:Resource)=>r&&typeof r.id==="string"&&typeof r.title==="string")]);
    } catch(e) { setError(e instanceof Error?e.message:"Falha ao carregar"); }
    finally {setLoading(false);}
  }
  return <section className="technical-base-panel space-y-4 text-slate-900">
    <div className="rounded-2xl bg-slate-900 p-5 text-white"><div className="flex items-center gap-3"><Wrench className="h-6 w-6"/><div><h2 className="text-xl font-black">Base Técnica</h2><p className="text-sm text-slate-300">Manuais, códigos, procedimentos e apoio à OS — sem dados fictícios de clientes</p></div></div></div>
    <div className="flex flex-wrap gap-2"><label className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border bg-white px-3"><Search className="h-4 w-4"/><input aria-label="Pesquisar Base Técnica" className="w-full py-3 text-sm outline-none" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Marca, modelo, código, procedimento"/></label><select aria-label="Categoria técnica" className="rounded-xl border bg-white px-3" value={category} onChange={e=>setCategory(e.target.value)}><option value="todos">Todos</option><option value="manual">Manuais</option><option value="erro">Códigos de erro</option><option value="procedimento">Procedimentos</option></select><button onClick={()=>void refresh()} disabled={loading} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{loading?"Carregando...":"Atualizar biblioteca"}</button></div>
    {error&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error} Os procedimentos locais continuam disponíveis.</p>}
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{visible.map(r=><article key={r.id} className="rounded-xl border bg-white p-4"><div className="mb-2 flex items-center gap-2 text-blue-700">{r.category==="manual"?<BookOpen/>:r.category==="erro"?<ShieldAlert/>:<ClipboardCheck/>}<span className="text-xs font-bold uppercase">{r.category}</span></div><h3 className="font-bold">{r.title}</h3>{r.brand&&<p className="text-xs text-slate-500">{r.brand} {r.model}</p>}<p className="mt-2 text-sm text-slate-600">{r.notes}</p>{r.url?.startsWith("https://")&&<a className="mt-3 inline-block text-sm font-semibold text-blue-700 underline" href={r.url} target="_blank" rel="noopener noreferrer">Abrir fonte técnica</a>}</article>)}</div>
    {!visible.length&&<p className="text-sm text-slate-500">Nenhum resultado para esta busca.</p>}
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3"><h3 className="font-bold text-blue-950">Auxiliar Técnico Inteligente — consulta assistida</h3><p className="text-xs text-blue-900">Primeira etapa: pesquisa orientada por regras e procedimentos internos. A IA generativa ainda não está habilitada; respostas devem ser conferidas pelo técnico.</p><div className="grid gap-2 sm:grid-cols-3"><input disabled={assistantBusy} aria-label="Fabricante" value={brand} onChange={e=>{setBrand(e.target.value);setAssistantResult(null);}} maxLength={120} placeholder="Fabricante (ex.: Elgin)" className="rounded-lg border bg-white px-3 py-2 text-sm"/><input disabled={assistantBusy} aria-label="Modelo" value={model} onChange={e=>{setModel(e.target.value);setAssistantResult(null);}} maxLength={120} placeholder="Modelo exato" className="rounded-lg border bg-white px-3 py-2 text-sm"/><input disabled={assistantBusy} aria-label="Código de erro" value={errorCode} onChange={e=>{setErrorCode(e.target.value);setAssistantResult(null);}} maxLength={32} placeholder="Código ou piscadas" className="rounded-lg border bg-white px-3 py-2 text-sm"/></div><form onSubmit={e=>{e.preventDefault();void askAssistant();}} className="flex flex-col gap-2 sm:flex-row"><input disabled={assistantBusy} aria-label="Pergunta ao auxiliar técnico" maxLength={1500} value={assistantQuestion} onChange={e=>{setAssistantQuestion(e.target.value);setAssistantResult(null);}} placeholder="Ex.: Como executar teste de estanqueidade?" className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm"/><button type="submit" disabled={assistantBusy||!assistantQuestion.trim()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{assistantBusy?"Consultando...":"Consultar"}</button></form>{assistantError&&<p role="alert" className="text-sm text-red-700">{assistantError}</p>}{assistantResult&&<div aria-live="polite" className="rounded-lg bg-white p-3 text-sm"><p>{assistantResult.answer}</p>{assistantResult.nextQuestions&&assistantResult.nextQuestions.length>0&&<p className="mt-2 text-xs font-semibold text-blue-900">Para aprofundar, informe: {assistantResult.nextQuestions.join(", ")}.</p>}{assistantResult.sources.map((s,i)=><p key={i} className="mt-2 text-xs text-slate-600">Fonte: {s.title} — {s.reference}</p>)}<p className="mt-2 text-xs font-semibold text-amber-800">{assistantResult.notice}</p></div>}</div>
    <section className="rounded-xl border bg-slate-50 p-4 space-y-3" aria-labelledby="hvac-calc-title">
      <div className="flex items-center gap-2 font-bold"><Calculator className="h-4 w-4"/><h3 id="hvac-calc-title">Calculadora HVAC — superaquecimento e sub-resfriamento</h3></div>
      <p className="text-sm text-slate-600">Use pressão manométrica (psig) medida no ponto correspondente. Superaquecimento usa pressão de sucção; sub-resfriamento exige pressão da linha líquida. A tabela não extrapola fora da faixa publicada.</p>
      <label className="flex flex-col gap-1 text-sm font-semibold">Refrigerante<select className="rounded-lg border bg-white px-3 py-2" value={calcFluid} onChange={event=>setCalcFluid(event.target.value)}>{["R-410A","R-32","R-22","R-134a","R-407C"].map(item=><option key={item}>{item}</option>)}</select></label>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <fieldset className="min-w-0 rounded-lg border bg-white p-3"><legend className="px-1 text-sm font-bold">Superaquecimento (sucção)</legend><div className="grid min-w-0 gap-2 sm:grid-cols-2"><label className="text-xs">Pressão de sucção (psig)<input inputMode="decimal" className="w-full rounded-lg border px-3 py-2" value={suctionPressure} onChange={event=>setSuctionPressure(event.target.value)}/></label><label className="text-xs">Temperatura da linha (°C)<input inputMode="decimal" className="w-full rounded-lg border px-3 py-2" value={suctionLine} onChange={event=>setSuctionLine(event.target.value)}/></label></div><output className="mt-3 block font-bold" aria-live="polite">{superheat===null?"Informe valores na faixa da tabela":`${superheat.toFixed(1)} °C — referência usual 4–8 °C`}</output></fieldset>
        <fieldset className="min-w-0 rounded-lg border bg-white p-3"><legend className="px-1 text-sm font-bold">Sub-resfriamento (linha líquida)</legend><div className="grid min-w-0 gap-2 sm:grid-cols-2"><label className="text-xs">Pressão da linha líquida (psig)<input inputMode="decimal" className="w-full rounded-lg border px-3 py-2" value={liquidPressure} onChange={event=>setLiquidPressure(event.target.value)}/></label><label className="text-xs">Temperatura da linha (°C)<input inputMode="decimal" className="w-full rounded-lg border px-3 py-2" value={liquidLine} onChange={event=>setLiquidLine(event.target.value)}/></label></div><output className="mt-3 block font-bold" aria-live="polite">{subcool===null?"Informe valores na faixa da tabela":`${subcool.toFixed(1)} °C — referência usual 3–5 °C`}</output></fieldset>
      </div>
      <p className="text-xs text-slate-600">Referência de consulta: <a className="underline" href={technicalSources.pt.url} target="_blank" rel="noopener noreferrer">{technicalSources.pt.title}</a>. Resultados são indicativos; prevalecem as especificações do fabricante, o método de medição e as condições de operação. Não usar o valor isolado para definir carga de refrigerante.</p>
    </section>
  </section>;
}

