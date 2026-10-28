"use client";
import {useEffect,useRef,useState} from "react";
import type {MobileFieldOrder} from "@/lib/mobile-field";
import type {FieldServiceOption} from "@/lib/mobile-service-catalog";
import styles from "./ProARFieldMobile.module.css";
export function FieldServicePicker({order,busy,send}:{order:MobileFieldOrder;busy:boolean;send:(action:string,data:Record<string,unknown>)=>Promise<void>}){
 const [query,setQuery]=useState(""),[services,setServices]=useState<FieldServiceOption[]>([]),[selected,setSelected]=useState(""),[quantity,setQuantity]=useState("1"),[loading,setLoading]=useState(false),[error,setError]=useState(""),[total,setTotal]=useState<number|null>(null),[offset,setOffset]=useState(0),[hasMore,setHasMore]=useState(false),[loadedQuery,setLoadedQuery]=useState("");
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>{request.current?.abort();request.current=null;},[]);
 async function load(q:string,start=0){
  request.current?.abort();const controller=new AbortController();request.current=controller;
  setLoading(true);setError("");setSelected("");
  try{
   if(!navigator.onLine)throw new Error("Conecte à internet para carregar os serviços cadastrados.");
   const params=new URLSearchParams({orderId:order.id,view:"service-catalog",q,offset:String(start)});
   const response=await fetch("/api/mobile/orders?"+params,{cache:"no-store",signal:controller.signal});
   const body=await response.json();if(!response.ok)throw new Error(body.error||"Não foi possível carregar os serviços.");
   if(request.current!==controller||controller.signal.aborted)return;
   if(!Array.isArray(body.services))throw new Error("Resposta do catálogo inválida.");
   setServices(body.services);setTotal(body.total);setOffset(body.offset);setHasMore(body.hasMore===true);setLoadedQuery(q);
  }catch(e){if(!controller.signal.aborted&&request.current===controller){setServices([]);setTotal(null);setError(e instanceof Error?e.message:"Falha ao carregar serviços.");}}
  finally{if(request.current===controller&&!controller.signal.aborted)setLoading(false);}
 }
 const amount=Number(quantity),included=(order.appliedServices||[]).some(item=>item.id===selected);
 return <details className={styles.journeyPanel} onToggle={e=>{if(e.currentTarget.open&&total===null&&!loading)void load(query);}}>
  <summary>Serviços da OS • {order.appliedServices?.length||0} item(ns)</summary>
  {(order.appliedServices||[]).map(item=><p key={item.id}><strong>{item.name}</strong> • Quantidade: {item.quantity}</p>)}
  {!order.appliedServices?.length&&<p>Nenhum item de serviço vinculado ao catálogo. A descrição original do atendimento permanece preservada.</p>}
  <label className={styles.formLabel}>Buscar serviço cadastrado<input value={query} maxLength={120} onChange={e=>setQuery(e.target.value)} placeholder="Nome ou código do serviço"/></label>
  <button type="button" className={styles.secondaryAction} disabled={loading||busy} onClick={()=>void load(query)}>Buscar / atualizar serviços</button>
  {loading&&<p role="status">Carregando serviços…</p>}{error&&<p role="alert" className={styles.warning}>{error}</p>}
  {total!==null&&<p>{total} serviço(s) encontrado(s){total>0?` • exibindo ${offset+1} a ${offset+services.length}`:""}</p>}
  <label className={styles.formLabel}>Serviço<select value={selected} disabled={busy||loading||services.length===0} onChange={e=>setSelected(e.target.value)}><option value="">Selecione um serviço</option>{services.map(item=><option key={item.id} value={item.id}>{item.name} • {item.id}</option>)}</select></label>
  <div>{offset>0&&<button type="button" className={styles.secondaryAction} disabled={loading||busy} onClick={()=>void load(loadedQuery,Math.max(0,offset-50))}>Página anterior</button>}{hasMore&&<button type="button" className={styles.secondaryAction} disabled={loading||busy} onClick={()=>void load(loadedQuery,offset+50)}>Próxima página</button>}</div>
  <label className={styles.formLabel}>Quantidade<input type="number" inputMode="decimal" min="0.001" max="10000" step="0.001" value={quantity} disabled={busy} onChange={e=>setQuantity(e.target.value)}/></label>
  {included&&<p>Este serviço já está incluído nesta OS.</p>}
  <p>A inclusão registra o serviço no atendimento e não altera o valor aprovado da OS.</p>
  <button type="button" className={styles.primaryAction} disabled={busy||loading||!selected||included||!Number.isFinite(amount)||amount<=0||amount>10000} onClick={()=>void send("add-service",{serviceId:selected,quantity:amount})}>Incluir serviço na OS</button>
 </details>;
}
