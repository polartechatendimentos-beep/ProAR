"use client";

import Home from "@/app/page";
import {useEffect, useState} from "react";

// The mobile route retains the authenticated desktop app and its existing
// business logic. All additional UI is scoped to /mobile.
export function ProARMobile(){
  const [online,setOnline]=useState(true);
  useEffect(()=>{
    document.documentElement.dataset.proarExperience="mobile";
    document.body.classList.add("proar-mobile-route");
    const update=()=>setOnline(navigator.onLine);
    update();
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
    </div>
    <Home/>
  </div>;
}
