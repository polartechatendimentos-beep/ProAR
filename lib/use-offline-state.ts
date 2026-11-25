"use client";

import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

const SCOPE_KEY = "proar-offline-scope";
const storageKey = (scope: string, key: string) => `proar-offline-state:${location.host}:${scope}:${key}`;

function getScope() {
  try { return localStorage.getItem(SCOPE_KEY) || "device"; } catch { return "device"; }
}

function readValue<T>(scope: string, key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey(scope, key));
    return raw === null ? fallback : JSON.parse(raw) as T;
  } catch { return fallback; }
}

export function useOfflineState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const initial = useRef(initialValue);
  const [scope, setScope] = useState(() => typeof window === "undefined" ? "device" : getScope());
  const [value, setValue] = useState(initialValue);
  const [ready, setReady] = useState(false);
  const activeKey = useRef("");

  useEffect(() => {
    const refreshScope = () => setScope(getScope());
    window.addEventListener("proar:offline-state", refreshScope);
    return () => window.removeEventListener("proar:offline-state", refreshScope);
  }, []);

  useEffect(() => {
    const fullKey = storageKey(scope, key);
    activeKey.current = "";
    setReady(false);
    setValue(readValue(scope, key, initial.current));
    activeKey.current = fullKey;
    setReady(true);
  }, [scope, key]);

  useEffect(() => {
    if (!ready || !activeKey.current) return;
    try { localStorage.setItem(activeKey.current, JSON.stringify(value)); } catch { /* Keep editing if device storage is full. */ }
  }, [value, ready]);

  return [value, setValue];
}
