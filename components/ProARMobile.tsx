"use client";

import { useEffect } from "react";
import { ProARFieldMobile } from "@/components/ProARFieldMobile";

/**
 * /mobile uses the authenticated ProAR tenant database and a dedicated
 * field-work UI, without exposing demo orders or simulating sync success.
 * Preserve the route flags expected by existing responsive integrations.
 */
export function ProARMobile() {
  useEffect(() => {
    if("serviceWorker" in navigator&&window.isSecureContext)void navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).catch(()=>{});
    document.documentElement.dataset.proarExperience="mobile";
    document.body.classList.add("proar-mobile-route");
    return () => {
      delete document.documentElement.dataset.proarExperience;
      document.body.classList.remove("proar-mobile-route");
    };
  }, []);
  return <ProARFieldMobile />;
}
