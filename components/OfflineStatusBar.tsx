"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudUpload, Wifi, WifiOff } from "lucide-react";
import { getOfflineStatus, syncOfflineQueue } from "@/lib/offline-runtime";

type Status = { online: boolean; pending: number; failed: number; scopeReady: boolean };

export function OfflineStatusBar() {
  const [status, setStatus] = useState<Status | null>(null);
  const originalBodyPadding = useRef<string | null>(null);
  const refresh = useCallback(() => { void getOfflineStatus().then(setStatus); }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("proar:offline-state", refresh);
    const timer = window.setInterval(refresh, 5000);
    return () => { window.removeEventListener("proar:offline-state", refresh); window.clearInterval(timer); };
  }, [refresh]);

  useEffect(() => {
    if (originalBodyPadding.current === null) originalBodyPadding.current = document.body.style.paddingBottom;
    const base = originalBodyPadding.current;
    document.body.style.paddingBottom = status && (!status.online || status.pending > 0) ? "48px" : base;
    return () => { document.body.style.paddingBottom = base; };
  }, [status]);

  if (!status || (status.online && status.pending === 0)) return null;
  const offline = !status.online;

  return <div role="status" className={`fixed inset-x-0 bottom-0 z-[100] flex min-h-10 items-center justify-center gap-2 px-3 py-2 text-center text-xs font-bold shadow-lg ${offline ? "bg-amber-100 text-amber-950" : "bg-blue-100 text-blue-950"}`}>
    {offline ? <WifiOff size={15}/> : <Wifi size={15}/>}
    <span>{offline ? "Sem internet: dados carregados ficam disponíveis; alterações compatíveis são salvas neste aparelho." : `Conexão ativa · ${status.pending} alteração${status.pending === 1 ? "" : "ões"} aguardando sincronização${status.failed ? " (verifique a sessão ou os conflitos)" : ""}.`}</span>
    {!offline && status.pending > 0 && <button type="button" onClick={() => {
      if (status.failed > 0 && !window.confirm("Algumas ações tiveram erro ou resposta incerta. Confira no ProAR se já foram aplicadas antes de reenviar, para evitar duplicidade. Deseja tentar novamente?")) return;
      void syncOfflineQueue(status.failed > 0);
    }} className="ml-1 inline-flex min-h-8 items-center gap-1 rounded-lg bg-blue-700 px-2.5 text-white"><CloudUpload size={14}/>{status.failed ? "Revisar e tentar" : "Sincronizar"}</button>}
  </div>;
}
