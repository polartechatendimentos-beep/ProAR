"use client";
import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";

/** Shared shell for editing dialogs. Keep existing form state and persistence in the owning module. */
export function UnifiedEditShell({title,subtitle,children,footer,onClose,dirty=false,busy=false,className=""}:{title:string;subtitle?:string;children:ReactNode;footer:ReactNode;onClose:()=>void;dirty?:boolean;busy?:boolean;className?:string}){
 const titleId=useId();const dialogRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;dialogRef.current?.focus();return()=>previous?.focus()},[]);
 useEffect(()=>{const handler=(event:KeyboardEvent)=>{if(event.key!=="Escape"||event.defaultPrevented||busy)return;event.preventDefault();if(!dirty||window.confirm("Existem alterações não salvas. Deseja descartar e fechar?"))onClose()};document.addEventListener("keydown",handler);return()=>document.removeEventListener("keydown",handler)},[onClose,dirty,busy]);
 return <div className="proar-edit-overlay"><div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`proar-edit-shell ${className}`}><header className="proar-edit-header"><div><h2 id={titleId}>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" aria-label="Fechar edição" disabled={busy} onClick={()=>{if(!dirty||window.confirm("Descartar alterações não salvas?"))onClose()}}>×</button></header><div className="proar-edit-content">{children}</div><footer className="proar-edit-footer"><span role="status" aria-live="polite">{busy?"Salvando…":dirty?"Alterações não salvas":""}</span><div>{footer}</div></footer></div></div>;
}
