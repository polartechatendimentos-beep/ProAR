"use client";
import type {ReactNode} from "react";
import {WifiOff} from "lucide-react";
import {useOfflineQueue,useOnlineState} from "@/lib/mobile-operations";

export function ConnectivityBanner(){const online=useOnlineState();const queue=useOfflineQueue();if(online&&!queue.length)return null;const title=online?queue.length+" alteração(ões) de campo aguardando sincronização":"Sem conexão";const detail=online?"Revise e envie as alterações pendentes. Operações sensíveis continuam dependentes do servidor.":queue.length?queue.length+" alteração(ões) de campo preservada(s). Financeiro, fiscal e estoque não serão confirmados offline.":"Continue o preenchimento. Confirme operações financeiras, fiscais e de estoque quando a conexão voltar.";return <div className={"proar-connectivity-banner "+(online?"sync-pending":"")} role="status"><WifiOff size={16}/><span><b>{title}</b><small>{detail}</small></span></div>}
export function StickyActionBar({summary,children}:{summary?:ReactNode;children:ReactNode}){return <div className="proar-sticky-action"><div>{summary}</div><nav>{children}</nav></div>}
export function ResponsiveTable({children,label}:{children:ReactNode;label?:string}){return <div className="proar-responsive-table" role="region" aria-label={label||"Tabela"} tabIndex={0}>{children}</div>}
export function TouchTabs({children}:{children:ReactNode}){return <div className="proar-touch-tabs">{children}</div>}
