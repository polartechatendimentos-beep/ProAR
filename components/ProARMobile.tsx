"use client";

import Home from "@/app/page";
import {useEffect, useState} from "react";

type DeviceHealth = {storagePercent: number | null; storageWarning: string | null};

// This component is exclusive to /mobile. No writes, cached OS claims,
// or background synchronization are performed until the durable queue exists.
export function ProARMobile(){
  const [online,setOnline]=useState(true);
  const [health,setHealth]=useState<DeviceHealth>({storagePercent:null,storageWarning:null});
  useEffect(()=>{
    document.documentElement.dataset.proarExperience="mobile";
    document.body.classList.add("proar-mobile-route");
    const update=()=>setOnline(navigator.onLine);
    const checkStorage=async()=>{
      try {
        if (!navigator.storage?.estimate) return;
        const {usage,quota}=await navigator.storage.estimate();
        if (!quota || usage == null) return;
        const percent=Math.min(100,Math.round(usage/quota*100));
        const warning=percent>=95?"Armazenamento quase cheio: não descarte dados pendentes.":percent>=85?"Armazenamento alto: verifique o espaço disponível no aparelho.":percent>=70?"Atenção ao espaço de armazenamento do aplicativo.":null;
        setHealth({storagePercent:percent,storageWarning:warning});
      } catch { /* storage estimate is optional in some browsers */ }
    };
    update();
    void checkStorage();
    window.addEventListener("online",update);
    window.addEventListener("offline",update);
    return()=>{
      window.removeEventListener("online",update);
      window.removeEventListener("offline",update);
      delete document.documentElement.dataset.proarExperience;
      document.body.classList.remove("proar-mobile-route");
    };
  },[]);

  return <div className="proar-mobile-entry">
    <div role="status" aria-live="polite" style={{position:"sticky",top:0,zIndex:80,padding:"calc(env(safe-area-inset-top, 0px) + 7px) 14px 8px",background:online?"#eaf6ef":"#fff0df",color:online?"#145c36":"#8a4800",fontSize:12,fontWeight:700,textAlign:"center",borderBottom:"1px solid rgba(0,0,0,.09)"}}>
      {online?"Conexão disponível":"Sem conexão — confirme o salvamento antes de sair. Operações não enviadas podem não estar disponíveis offline."}
      {health.storageWarning && <div style={{paddingTop:5}}>{health.storageWarning} {health.storagePercent !== null ? `(${health.storagePercent}% da cota do navegador)` : ""}</div>}
    </div>
    <Home/>
  </div>;
}
