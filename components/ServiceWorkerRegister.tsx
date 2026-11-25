"use client";

import { useEffect } from "react";
import { startOfflineRuntime } from "@/lib/offline-runtime";

export function ServiceWorkerRegister() {
  useEffect(() => {
    startOfflineRuntime();
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Online use continues normally if the browser does not allow PWA installation.
    });
  }, []);

  return null;
}
