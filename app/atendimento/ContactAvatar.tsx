"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import styles from "./workspace.module.css";

export function ContactAvatar({ company, name, phone, prominent = false }: { company: string; name: string; phone: string; prominent?: boolean }) {
  const [unavailable, setUnavailable] = useState(false);
  const initials = name.trim().split(/\s+/u).slice(0, 2).map(word => [...word][0] || "").join("").toLocaleUpperCase("pt-BR");
  return <span aria-hidden="true" className={`${styles.clientAvatar} ${prominent ? styles.clientAvatarLarge : ""}`}>
    {initials || <UserRound size={prominent ? 18 : 15}/>}
    {!unavailable && (
      // A same-origin authenticated route resolves the provider photo; it is not a public optimization target.
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" loading={prominent ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer"
        src={`/api/atendimento/foto?company=${encodeURIComponent(company)}&phone=${encodeURIComponent(phone)}`} onError={() => setUnavailable(true)}/>
    )}
  </span>;
}
