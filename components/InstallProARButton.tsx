"use client";

import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome:"accepted"|"dismissed"; platform:string }>;
};

export function InstallProARButton({ className="" }: { className?:string }) {
  const [promptEvent,setPromptEvent]=useState<InstallPromptEvent|null>(null);
  const [installed,setInstalled]=useState(false);

  useEffect(()=>{
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || (window.navigator as Navigator & {standalone?:boolean}).standalone;
    if(standalone) setInstalled(true);
    const onPrompt=(event:Event)=>{event.preventDefault();setPromptEvent(event as InstallPromptEvent);};
    const onInstalled=()=>{setInstalled(true);setPromptEvent(null);};
    window.addEventListener("beforeinstallprompt",onPrompt);
    window.addEventListener("appinstalled",onInstalled);
    return()=>{window.removeEventListener("beforeinstallprompt",onPrompt);window.removeEventListener("appinstalled",onInstalled);};
  },[]);

  const install=async()=>{
    if(!promptEvent){
      window.alert("Para instalar o ProAR, abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.");
      return;
    }
    await promptEvent.prompt();
    const choice=await promptEvent.userChoice;
    if(choice.outcome==="accepted") setInstalled(true);
    setPromptEvent(null);
  };

  return <button type="button" className={className} onClick={()=>void install()} disabled={installed}>
    {installed?<><Smartphone size={18}/> ProAR instalado</>:<><Download size={18}/> Instalar ProAR</>}
  </button>;
}
