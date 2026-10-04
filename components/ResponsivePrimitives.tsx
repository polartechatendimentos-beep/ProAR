"use client";
import type {ReactNode} from "react";
import {WifiOff} from "lucide-react";
import {useOnlineState} from "@/lib/mobile-operations";

export function ConnectivityBanner(){const online=useOnlineState();if(online)return null;return <div className="proar-connectivity-banner" role="status"><WifiOff size={16}/><span><b>Sem conexão</b><small>Continue o preenchimento. Confirme operações financeiras, fiscais e de estoque quando a conexão voltar.</small></span></div>}
export function StickyActionBar({summary,children}:{summary?:ReactNode;children:ReactNode}){return <div className="proar-sticky-action"><div>{summary}</div><nav>{children}</nav></div>}
export function ResponsiveTable({children,label}:{children:ReactNode;label?:string}){return <div className="proar-responsive-table" role="region" aria-label={label||"Tabela"} tabIndex={0}>{children}</div>}
export function TouchTabs({children}:{children:ReactNode}){return <div className="proar-touch-tabs">{children}</div>}
