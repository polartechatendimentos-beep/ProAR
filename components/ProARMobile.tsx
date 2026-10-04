"use client";

import { MobileRouteControls } from "./MobileRouteControls";
import { MobileToday } from "./MobileToday";
import Home from "@/app/page";
import { useEffect } from "react";

// A operação de campo usa as telas e os fluxos de gravação do próprio ERP.
// A sessão, as permissões, o isolamento por empresa e a resolução de conflitos
// permanecem sob responsabilidade do ProAR, sem uma segunda base local de OS.
export function ProARMobile() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("proar:navigate", { detail: "Ordens de serviço" }));
  }, []);
  return <><MobileToday /><MobileRouteControls /><Home /></>;
}
