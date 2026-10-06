"use client";

import Home from "@/app/page";
import {useEffect} from "react";

// /mobile uses the same authenticated domain data as the desktop ProAR,
// but the visual shell is intentionally different and optimized for touch.
export function ProARMobile(){
  useEffect(()=>{
    document.documentElement.dataset.proarExperience="mobile";
    document.body.classList.add("proar-mobile-route");
    return()=>{
      delete document.documentElement.dataset.proarExperience;
      document.body.classList.remove("proar-mobile-route");
    };
  },[]);

  return <div className="proar-mobile-entry"><Home/></div>;
}
