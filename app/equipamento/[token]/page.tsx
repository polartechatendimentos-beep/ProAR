"use client";

import { use, useEffect, useState } from "react";
import { CalendarDays, ClipboardCheck, RefreshCw, ShieldCheck, Snowflake } from "lucide-react";

type Visit = { date: string; service: string; status: string };
type PublicHistory = {
  label: string;
  equipment: { type: string; brand: string; model: string; capacityBtus: number | null };
  history: Visit[];
  message: string;
};
function displayDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
  }
  return value || "Data não informada";
}

export default function PublicEquipmentHistory({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PublicHistory | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/public-equipment-history?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível consultar a etiqueta.");
        if (alive) { setData(result); setError(""); }
      } catch (reason) {
        if (alive) { setData(null); setError(reason instanceof Error ? reason.message : "Consulta indisponível."); }
      } finally { if (alive) setLoading(false); }
    };
    void load();
    return () => { alive = false; };
  }, [token]);
  return <main style={{ minHeight:"100vh", background:"#f3f7fc", color:"#0b2446", padding:"24px 14px", fontFamily:"Arial, sans-serif" }}>
    <meta name="robots" content="noindex,nofollow,noarchive"/>
    <div style={{ maxWidth:700, margin:"0 auto", display:"grid", gap:18 }}>
      <header style={{ background:"linear-gradient(125deg,#041c40,#06539a)", color:"white", padding:24, borderRadius:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, fontWeight:800, letterSpacing:1 }}><Snowflake size={20}/> PROAR • HISTÓRICO DO EQUIPAMENTO</div>
        <h1 style={{ margin:"18px 0 8px", fontSize:26 }}>Consulte as manutenções</h1>
        <p style={{ margin:0, lineHeight:1.6, color:"#d8e9ff" }}>Esta etiqueta identifica o mesmo equipamento em todos os atendimentos.</p>
      </header>
      {loading && <section role="status" style={{ background:"white", padding:25, borderRadius:16 }}>Consultando histórico atualizado...</section>}
      {error && <section role="alert" style={{ background:"white", padding:25, borderRadius:16, color:"#a12929" }}>{error}</section>}
      {data && <>
        <section style={{ background:"white", padding:22, borderRadius:16, border:"1px solid #d9e4f1" }}>
          <small style={{ color:"#5d7290", fontWeight:800 }}>ETIQUETA PERMANENTE</small>
          <h2 style={{ margin:"8px 0", fontSize:26 }}>{data.label}</h2>
          <p style={{ margin:0, lineHeight:1.6 }}>{[data.equipment.type, data.equipment.brand, data.equipment.model, data.equipment.capacityBtus ? `${data.equipment.capacityBtus.toLocaleString("pt-BR")} BTUs` : ""].filter(Boolean).join(" • ")}</p>
        </section>
        <section style={{ background:"white", padding:22, borderRadius:16, border:"1px solid #d9e4f1" }}>
          <h2 style={{ display:"flex", gap:9, alignItems:"center", fontSize:19, margin:"0 0 15px" }}><ClipboardCheck size={21}/> Últimas manutenções</h2>
          {data.history.length ? <div style={{ display:"grid", gap:12 }}>{data.history.map((visit, index) => <article key={index} style={{ padding:"14px 16px", border:"1px solid #e1eaf3", borderRadius:12 }}>
            <strong style={{ display:"block", marginBottom:6 }}>{visit.service}</strong>
            <div style={{ display:"flex", alignItems:"center", gap:7, color:"#55708f", fontSize:13 }}><CalendarDays size={15}/>{displayDate(visit.date)} • {visit.status}</div>
          </article>)}</div> : <p style={{ color:"#5d7290", lineHeight:1.6 }}>Ainda não há manutenções concluídas vinculadas a este equipamento.</p>}
          <p style={{ display:"flex", gap:8, margin:"20px 0 0", color:"#5d7290", fontSize:12, lineHeight:1.5 }}><ShieldCheck size={16}/>{data.message} Dados pessoais e informações financeiras não são publicados.</p>
        </section>
        <button type="button" onClick={()=>window.location.reload()} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:13, borderRadius:12, border:"1px solid #c9d8e9", background:"white", color:"#0b477f", cursor:"pointer", fontWeight:700 }}><RefreshCw size={16}/> Atualizar consulta</button>
      </>}
    </div>
  </main>;
}
