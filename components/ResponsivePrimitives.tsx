"use client";
import type {ReactNode} from "react";
import {WifiOff} from "lucide-react";
import {useOfflineQueue,useOnlineState} from "@/lib/mobile-operations";

export function ConnectivityBanner(){
 const online=useOnlineState();
 const queue=useOfflineQueue();
 if(online&&!queue.length)return null;
 const title=online?`${queue.length} item(ns) local(is) aguardando revisão`:"Sem conexão";
 const detail=online?"Abra a fila para ver os dados pendentes. A transmissão é feita a partir do registro de origem.":queue.length?`${queue.length} item(ns) salvo(s) neste dispositivo. Financeiro, fiscal e estoque não são confirmados offline.`:"Rascunhos locais só aparecem aqui quando a tela os adiciona à fila offline.";
 return <details className={"proar-connectivity-banner "+(online?"sync-pending":"")} role="status">
   <summary aria-label={`${title}. ${detail}`}>
     <WifiOff size={16}/>
     <span><b>{title}</b><small>{detail}</small></span>
     {queue.length>0&&<span className="proar-connectivity-count">{queue.length}</span>}
   </summary>
   <div className="proar-connectivity-queue">
     {queue.length>0?<ul>{queue.map(item=><li key={item.id}><strong>{item.label||"Registro sem descrição"}</strong><small>{item.kind==="draft"?"Rascunho":"Atualização de campo"} • {new Date(item.createdAt).toLocaleString("pt-BR")}</small></li>)}</ul>:<p>Nenhum item foi adicionado à fila local nesta sessão.</p>}
     {online&&queue.length>0&&<p className="proar-connectivity-note">Para evitar duplicidade, reabra cada registro na tela de origem e confirme o salvamento quando estiver conectado. O reenvio automático ainda não está disponível para esta fila genérica.</p>}
   </div>
 </details>
}
export function StickyActionBar({summary,children}:{summary?:ReactNode;children:ReactNode}){return <div className="proar-sticky-action"><div>{summary}</div><nav>{children}</nav></div>}
export function ResponsiveTable({children,label}:{children:ReactNode;label?:string}){return <div className="proar-responsive-table" role="region" aria-label={label||"Tabela"} tabIndex={0}>{children}</div>}
export function TouchTabs({children}:{children:ReactNode}){return <div className="proar-touch-tabs">{children}</div>}
