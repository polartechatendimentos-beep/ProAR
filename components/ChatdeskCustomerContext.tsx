"use client";
import { useEffect, useState } from "react";
import { Building2, Wrench, CalendarDays } from "lucide-react";
import styles from "../app/atendimento/workspace.module.css";
type Context = { customer: {id:string;name:string;address?:string;phone?:string}|null;ambiguous:boolean;orderCount:number;equipmentCount:number;orders:{id:string;service?:string;status?:string;date?:string;time?:string}[];equipment:{id:string;name?:string;brand?:string;model?:string;capacityBtus?:number;serialNumber?:string}[] };
export function ChatdeskCustomerContext({companyId,phone,onAction}:{companyId:string;phone:string;onAction:()=>void}) {
  const [data,setData] = useState<Context|null>(null);
  const [error,setError] = useState("");
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/api/atendimento/acoes?contextPhone=${encodeURIComponent(phone)}`,{headers:{"X-Proar-Company-ID":companyId},cache:"no-store",signal:controller.signal}).then(async response=>{const result=await response.json();if(!response.ok||!result.context)throw new Error(result.error||"Ficha indisponível.");return result.context;}).then(result=>{if(!controller.signal.aborted)setData(result);}).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Ficha indisponível.");});
    return()=>controller.abort();
  },[companyId,phone]);
  return <section className={styles.customerContext} aria-label="Ficha do cliente"><span className={styles.eyebrow}><Building2 size={13}/> FICHA DO CLIENTE</span>{error?<p role="alert">{error}</p>:!data?<p>Consultando cadastro e histórico…</p>:data.customer?<><h3>{data.customer.name}</h3><small>{data.customer.id}</small><p>{data.customer.address||"Endereço não informado."}</p><div className={styles.contextStats}><span><Wrench size={13}/>{data.equipmentCount} equipamento(s)</span><span><CalendarDays size={13}/>{data.orderCount} OS</span></div><details><summary>Últimas ordens de serviço</summary>{data.orders.length?data.orders.map(order=><article key={order.id}><b>{order.id}</b><span>{order.service}</span><small>{order.date?.split("-").reverse().join("/")} {order.time} • {order.status}</small></article>):<p>Nenhuma OS disponível ao seu perfil.</p>}</details><details><summary>Equipamentos • até 5 registros</summary>{data.equipment.length?data.equipment.map(item=><article key={item.id}><b>{item.name||item.id}</b><span>{[item.brand,item.model,item.capacityBtus?`${item.capacityBtus} BTUs`:""].filter(Boolean).join(" • ")}</span>{item.serialNumber&&<small>Série: {item.serialNumber}</small>}</article>):<p>Nenhum equipamento disponível ao seu perfil.</p>}</details></>:<p>{data.ambiguous?"Mais de um cadastro usa este telefone. Confira o cliente em Ações no sistema.":"Cadastro não localizado para este telefone. Você pode consultar ou iniciar um cadastro."}</p>}<button onClick={onAction}>{data?.customer?"Consultar ou agendar atendimento":"Consultar ou cadastrar cliente"}</button></section>;
}
