"use client";
import { useEffect, useState } from "react";
import { normalizeMobileTheme, resolveMobileTheme, type MobileTheme } from "@/lib/mobile-experience";
import styles from "./ProARFieldMobile.module.css";

/** Mounted only inside /mobile; never changes the full-system theme. */
export function useMobileTheme() {
  const [theme,setTheme] = useState<MobileTheme>("auto");
  const [systemDark,setSystemDark] = useState(true);
  const [storageNotice,setStorageNotice] = useState("");
  useEffect(()=>{
    try { setTheme(normalizeMobileTheme(localStorage.getItem("proar-mobile-theme"))); }
    catch { setStorageNotice("A preferência será mantida apenas nesta sessão."); }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = ()=>setSystemDark(media.matches);
    const stored = (event:StorageEvent)=>{if(event.key==="proar-mobile-theme")setTheme(normalizeMobileTheme(event.newValue));};
    update(); media.addEventListener("change",update); window.addEventListener("storage",stored);
    return ()=>{media.removeEventListener("change",update);window.removeEventListener("storage",stored);};
  },[]);
  function changeTheme(value:string) {
    const next = normalizeMobileTheme(value); setTheme(next);
    try {localStorage.setItem("proar-mobile-theme",next);setStorageNotice("");}
    catch {setStorageNotice("A preferência será mantida apenas nesta sessão.");}
  }
  return {theme,resolved:resolveMobileTheme(theme,systemDark),changeTheme,storageNotice};
}
export function MobileThemeControl({theme,onChange,notice}:{theme:MobileTheme;onChange:(value:string)=>void;notice:string}) {
  return <div className={styles.detailCard}><h2>Aparência do ProAR Mobile</h2>
    <label className={styles.formLabel}>Tema<select value={theme} onChange={e=>onChange(e.target.value)}><option value="auto">Automático • acompanha o aparelho</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label>
    <p>O modo sol forte tem prioridade enquanto estiver ativado.</p>{notice&&<p role="status">{notice}</p>}
  </div>;
}
