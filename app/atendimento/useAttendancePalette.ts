"use client";

import { useEffect, useState } from "react";

const storageKey = "proar-chatdesk-theme";
export function useAttendancePalette() {
  const [darkMode, setDarkMode] = useState(true);
  useEffect(() => {
    const sync = () => {
      try { setDarkMode(localStorage.getItem(storageKey) !== "light"); } catch { /* Keep this session's choice. */ }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) sync();
    };
    sync();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    try { localStorage.setItem(storageKey, next ? "dark" : "light"); } catch { /* Session-only preference. */ }
  }
  return { darkMode, toggleTheme };
}
