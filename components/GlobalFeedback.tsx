"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { feedbackEventName, type FeedbackMessage, type FeedbackTone } from "@/lib/ui-feedback";

type Toast = Required<Pick<FeedbackMessage,"id"|"message"|"title"|"tone"|"duration">> & { detail?: string };

const iconFor = (tone: FeedbackTone) => tone === "success" ? CheckCircle2 : tone === "error" ? XCircle : tone === "warning" ? AlertTriangle : Info;

export function GlobalFeedback() {
  const [items,setItems]=useState<Toast[]>([]);
  const timers=useRef(new Map<string,number>());

  const remove=(id:string)=>{
    const timer=timers.current.get(id);
    if(timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setItems(current=>current.filter(item=>item.id!==id));
  };

  useEffect(()=>{
    const handler=(event:Event)=>{
      const input=(event as CustomEvent<FeedbackMessage>).detail;
      if(!input?.message) return;
      const toast:Toast={
        id:input.id ?? `feedback-${Date.now()}`,
        message:input.message,
        title:input.title ?? "Informação",
        tone:input.tone ?? "info",
        duration:input.duration ?? 3600,
        detail:input.detail,
      };
      setItems(current=>[...current.filter(item=>item.id!==toast.id),toast].slice(-4));
      const existing=timers.current.get(toast.id);
      if(existing) window.clearTimeout(existing);
      if(toast.duration>0) timers.current.set(toast.id,window.setTimeout(()=>remove(toast.id),toast.duration));
    };
    window.addEventListener(feedbackEventName,handler);
    return()=>{
      window.removeEventListener(feedbackEventName,handler);
      timers.current.forEach(timer=>window.clearTimeout(timer));
      timers.current.clear();
    };
  },[]);

  if(!items.length) return null;
  return <aside className="global-feedback-stack" aria-live="polite" aria-relevant="additions">
    {items.map(item=>{
      const Icon=iconFor(item.tone);
      return <article key={item.id} className={`global-feedback-toast ${item.tone}`} role={item.tone==="error"?"alert":"status"}>
        <span className="global-feedback-icon"><Icon size={19}/></span>
        <div className="global-feedback-copy">
          <strong>{item.title}</strong>
          <p>{item.message}</p>
          {item.detail&&<small>{item.detail}</small>}
        </div>
        <button type="button" aria-label="Fechar notificação" onClick={()=>remove(item.id)}><X size={15}/></button>
        <i className="global-feedback-progress" style={{animationDuration:`${item.duration}ms`}}/>
      </article>;
    })}
  </aside>;
}
