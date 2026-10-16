"use client";
import { useMemo, useState } from "react";
import { BookOpen, Calculator, ClipboardCheck, Search, ShieldAlert, Wrench } from "lucide-react";
type Resource = { id: string; category: "manual" | "erro" | "procedimento"; title: string; brand?: string; model?: string; url?: string; notes: string };
const procedures: Resource[] = [
  { id:"vacuo", category:"procedimento", title:"Vácuo e desidratação", notes:"Seguir fabricante; usar vacuômetro calibrado e registrar microns e teste de subida." },
  { id:"estanqueidade", category:"procedimento", title:"Estanqueidade com nitrogênio", notes:"Confirmar limites de pressão do equipamento/projeto; nunca utilizar oxigênio. Registrar início, fim e temperatura ambiente." },
  { id:"eletrica", category:"procedimento", title:"Segurança elétrica", notes:"Aplicar bloqueio, etiquetagem, verificação de ausência de tensão e procedimentos NR-10." },
];
export function TechnicalBasePanel() {
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("todos");
  const [resources,setResources]=useState<Resource[]>(procedures);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const visible=useMemo(()=>resources.filter(r=>(category==="todos"||r.category===category)&&[r.title,r.brand,r.model,r.notes].join(" ").toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))),[resources,category,query]);
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
  return <section className="space-y-4">
    <div className="rounded-2xl bg-slate-900 p-5 text-white"><div className="flex items-center gap-3"><Wrench className="h-6 w-6"/><div><h2 className="text-xl font-black">Base Técnica</h2><p className="text-sm text-slate-300">Manuais, códigos, procedimentos e apoio à OS — sem dados fictícios de clientes</p></div></div></div>
    <div className="flex flex-wrap gap-2"><label className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border bg-white px-3"><Search className="h-4 w-4"/><input aria-label="Pesquisar Base Técnica" className="w-full py-3 text-sm outline-none" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Marca, modelo, código, procedimento"/></label><select aria-label="Categoria técnica" className="rounded-xl border bg-white px-3" value={category} onChange={e=>setCategory(e.target.value)}><option value="todos">Todos</option><option value="manual">Manuais</option><option value="erro">Códigos de erro</option><option value="procedimento">Procedimentos</option></select><button onClick={()=>void refresh()} disabled={loading} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{loading?"Carregando...":"Atualizar biblioteca"}</button></div>
    {error&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error} Os procedimentos locais continuam disponíveis.</p>}
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{visible.map(r=><article key={r.id} className="rounded-xl border bg-white p-4"><div className="mb-2 flex items-center gap-2 text-blue-700">{r.category==="manual"?<BookOpen/>:r.category==="erro"?<ShieldAlert/>:<ClipboardCheck/>}<span className="text-xs font-bold uppercase">{r.category}</span></div><h3 className="font-bold">{r.title}</h3>{r.brand&&<p className="text-xs text-slate-500">{r.brand} {r.model}</p>}<p className="mt-2 text-sm text-slate-600">{r.notes}</p>{r.url&&<a className="mt-3 inline-block text-sm font-semibold text-blue-700 underline" href={r.url} target="_blank" rel="noopener noreferrer">Abrir fonte técnica</a>}</article>)}</div>
    {!visible.length&&<p className="text-sm text-slate-500">Nenhum resultado para esta busca.</p>}
    <div className="rounded-xl border bg-slate-50 p-4"><div className="flex items-center gap-2 font-bold"><Calculator className="h-4 w-4"/> Calculadoras HVAC</div><p className="mt-2 text-sm text-slate-600">Motor de superaquecimento e sub-resfriamento em desenvolvimento. Os cálculos somente serão liberados com tabelas pressão–temperatura verificadas por refrigerante; não inferir carga de gás apenas por uma medição.</p></div>
  </section>;
}
