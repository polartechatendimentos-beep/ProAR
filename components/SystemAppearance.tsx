"use client";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {normalizeMobileTheme,resolveMobileTheme,type MobileTheme} from "@/lib/mobile-experience";
export function SystemAppearance(){
  const path=usePathname(),enabled=path==="/"||path==="/login";
  const [theme,setTheme]=useState<MobileTheme>("dark"),[systemDark,setSystemDark]=useState(true),[compact,setCompact]=useState(false);
  useEffect(()=>{if(!enabled)return;try{const stored=localStorage.getItem("proar-system-theme");if(stored)setTheme(normalizeMobileTheme(stored));}catch{}
    const media=matchMedia("(prefers-color-scheme: dark)"),update=()=>setSystemDark(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);
  },[enabled]);
  useEffect(()=>{if(!enabled)return;document.documentElement.dataset.proarSystemTheme=resolveMobileTheme(theme,systemDark);document.documentElement.dataset.proarSidebarCompact=String(compact);return()=>{delete document.documentElement.dataset.proarSystemTheme;delete document.documentElement.dataset.proarSidebarCompact;};},[theme,systemDark,compact,enabled]);
  if(!enabled)return null;
  return <aside className="proar-appearance-toolbar" aria-label="Aparência do sistema completo"><button type="button" onClick={()=>setCompact(v=>!v)} aria-pressed={compact} title="Recolher ou expandir o menu lateral">{compact?"Expandir menu":"Recolher menu"}</button><label>Tema<select value={theme} onChange={e=>{const next=normalizeMobileTheme(e.target.value);setTheme(next);try{localStorage.setItem("proar-system-theme",next);}catch{}}}><option value="dark">Escuro</option><option value="light">Claro</option><option value="auto">Automático</option></select></label></aside>;
}
