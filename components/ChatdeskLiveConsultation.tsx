"use client";
import {useState} from "react";
type Service={id:string;name:string;price:number|null;description:string};
type Slot={time:string;technician:string;durationMinutes:number};
type Snapshot={catalog:{items:Service[];total:number};occupied:Slot[];notice:string;source:string};
export function ChatdeskLiveConsultation(){
 const [query,setQuery]=useState("");
 const [date,setDate]=useState("");
 const [data,setData]=useState<Snapshot|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [selected,setSelected]=useState("");
 const [draft,setDraft]=useState("");
 async function consult(){
  setBusy(true);setError("");setData(null);setDraft("");
  try{
   const response=await fetch("/api/atendimento/consulta-ia?"+new URLSearchParams({q:query,date}),{cache:"no-store"});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Consulta indisponível.");
   setData(result);setSelected("");
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível consultar os dados.");}finally{setBusy(false);}
 }
 const service=data?.catalog.items.find(item=>item.id===selected);
 function prepare(){
  if(!service)return;
  setDraft(service.price===null
   ? \`Olá! Localizei o serviço "\${service.name}" no nosso catálogo, mas o preço de venda não está preenchido. Vou confirmar o valor antes de informar o orçamento. Posso verificar a data e o melhor período para o atendimento?\`
   : \`Olá! O serviço "\${service.name}" está cadastrado por \${service.price.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}. \${service.description||""} Para verificar o agendamento, informe o dia e o período desejado. A disponibilidade será confirmada pela equipe antes da reserva.\`);
 }
 return <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-white space-y-3" aria-label="Consulta real para atendimento">
  <h3 className="text-lg font-bold">Catálogo e agenda do ProAR</h3>
  <p className="text-sm text-slate-300">Consulte os preços registrados e os horários já ocupados. Não há preços ou horários demonstrativos; uma vaga só pode ser confirmada pelo fluxo de agendamento.</p>
  <div className="grid gap-3 md:grid-cols-3">
   <label className="text-sm md:col-span-2">Pesquisar serviço<input value={query} maxLength={100} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: instalação 12000, higienização" className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-white"/></label>
   <label className="text-sm">Consultar ocupações da data<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-white"/></label>
  </div>
  <button type="button" disabled={busy} onClick={()=>void consult()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy?"Consultando...":"Consultar dados reais"}</button>
  {error&&<p role="alert" className="text-amber-300">{error}</p>}
  {data&&<div className="space-y-3" aria-live="polite">
   <p className="text-xs text-slate-400">Fonte: {data.source} · {data.catalog.total} serviço(s) encontrado(s)</p>
   {data.catalog.total===0?<p className="text-sm text-amber-200">Nenhum serviço encontrado no catálogo ativo da empresa. Cadastre o serviço antes de informar um preço.</p>:<label className="block text-sm">Serviço cadastrado
    <select className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-white" value={selected} onChange={e=>{setSelected(e.target.value);setDraft("");}}>
     <option value="">Selecione um serviço para preparar a resposta</option>
     {data.catalog.items.map(s=><option key={s.id} value={s.id}>{s.name} — {s.price===null?"Preço não cadastrado":s.price.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</option>)}
    </select>
   </label>}
   {date&&<div className="rounded-lg border border-slate-700 p-3 text-sm"><strong>OS já registradas para {date.split("-").reverse().join("/")}</strong>
    {data.occupied.length?<ul className="mt-2 list-disc pl-5">{data.occupied.map((slot,i)=><li key={i}>{slot.time} · {slot.technician||"Técnico não definido"} · {slot.durationMinutes} min</li>)}</ul>:<p className="mt-1 text-slate-300">Nenhuma ocupação localizada nessa data. Isso não garante disponibilidade.</p>}
   </div>}
   <p className="text-xs text-amber-200">{data.notice}</p>
   <button disabled={!service} type="button" onClick={prepare} className="rounded-lg border border-blue-500 px-3 py-2 text-sm text-blue-200 disabled:opacity-50">Preparar sugestão para o cliente</button>
   {draft&&<div className="space-y-2"><label className="block text-sm">Rascunho para revisão humana<textarea readOnly rows={5} value={draft} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white"/></label><p className="text-xs text-slate-300">O texto não foi enviado. Revise-o e use a conversa para responder ao cliente.</p></div>}
  </div>}
 </section>;
}
