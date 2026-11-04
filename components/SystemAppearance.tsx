"use client";
import {useEffect,useState} from "react";
import {clearOfflineLease} from "@/lib/mobile-day-policy";
import {usePathname} from "next/navigation";
import {normalizeMobileTheme,resolveMobileTheme,type MobileTheme} from "@/lib/mobile-experience";

type TableDensity="comfortable"|"compact";

export function SystemAppearance(){
  const path=usePathname(),enabled=path==="/"||path==="/login";
  useEffect(()=>{if(!path.startsWith("/mobile")&&!window.location.hostname.startsWith("mobile.")){try{clearOfflineLease(sessionStorage);}catch{}}},[path]);
  const [theme,setTheme]=useState<MobileTheme>("dark"),[systemDark,setSystemDark]=useState(true),[compact,setCompact]=useState(false);
  const [highContrast,setHighContrast]=useState(false),[density,setDensity]=useState<TableDensity>("comfortable"),[toolbarOpen,setToolbarOpen]=useState(false);
  useEffect(()=>{
    if(!enabled)return;
    try{
      const stored=localStorage.getItem("proar-system-theme");
      if(stored)setTheme(normalizeMobileTheme(stored));
      setHighContrast(localStorage.getItem("proar-high-contrast")==="true");
      setDensity(localStorage.getItem("proar-table-density")==="compact"?"compact":"comfortable");
    }catch{}
    const media=matchMedia("(prefers-color-scheme: dark)"),update=()=>setSystemDark(media.matches);
    update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);
  },[enabled]);
  useEffect(()=>{
    if(!enabled)return;
    const root=document.documentElement;
    root.dataset.proarSystemTheme=resolveMobileTheme(theme,systemDark);
    root.dataset.proarSidebarCompact=String(compact);
    root.dataset.proarHighContrast=String(highContrast);
    root.dataset.proarDensity=density;
    return()=>{
      delete root.dataset.proarSystemTheme;
      delete root.dataset.proarSidebarCompact;
      delete root.dataset.proarHighContrast;
      delete root.dataset.proarDensity;
    };
  },[theme,systemDark,compact,highContrast,density,enabled]);
  if(!enabled)return null;
  const saveHighContrast=(value:boolean)=>{setHighContrast(value);try{localStorage.setItem("proar-high-contrast",String(value));}catch{}};
  const saveDensity=(value:TableDensity)=>{setDensity(value);try{localStorage.setItem("proar-table-density",value);}catch{}};
  return <aside className="proar-appearance-toolbar" data-open={toolbarOpen ? "true" : "false"} aria-label="Aparência do sistema completo">
    <button className="appearance-toolbar-trigger" type="button" aria-expanded={toolbarOpen} aria-controls="proar-appearance-controls" onClick={()=>setToolbarOpen(value=>!value)}>{toolbarOpen ? "Fechar ajustes" : "Aparência"}</button>
    {toolbarOpen && <div id="proar-appearance-controls" className="appearance-toolbar-controls">
      <button type="button" onClick={()=>setCompact(v=>!v)} aria-pressed={compact} title="Recolher ou expandir o menu lateral">{compact ? "Expandir menu" : "Recolher menu"}</button>
      <label>Tema<select aria-label="Tema do sistema" value={theme} onChange={e=>{const next=normalizeMobileTheme(e.target.value);setTheme(next);try{localStorage.setItem("proar-system-theme",next);}catch{}}}><option value="dark">Escuro</option><option value="light">Claro</option><option value="auto">Automático</option></select></label>
      <details className="proar-appearance-advanced">
        <summary>Acessibilidade e densidade</summary>
        <div className="proar-appearance-advanced__body">
          <label><input type="checkbox" checked={highContrast} onChange={e=>saveHighContrast(e.target.checked)}/> Alto contraste para campo</label>
          <label>Densidade das tabelas<select aria-label="Densidade das tabelas" value={density} onChange={e=>saveDensity(e.target.value==="compact"?"compact":"comfortable")}><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></label>
        </div>
      </details>
    </div>}
  </aside>;
}
