"use client";

import { useEffect, useState } from "react";
import { ClipboardCopy, Printer, QrCode, ShieldCheck } from "lucide-react";

type LabelInfo = { enabled: boolean; code: string; historyCount: number; publicPath?: string; printPath?: string };
type Props = {
  equipmentId: string;
  enabled: boolean;
  canManage: boolean;
  onToggle?: (equipmentId: string, enabled: boolean) => Promise<boolean>;
};

export function EquipmentLabelControl({ equipmentId, enabled, canManage, onToggle }: Props) {
  const [info, setInfo] = useState<LabelInfo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    setInfo(null); setError("");
    fetch(`/api/equipment-maintenance-label?equipmentId=${encodeURIComponent(equipmentId)}`, { cache:"no-store" })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Falha ao consultar etiqueta."); return data as LabelInfo; })
      .then(data => { if (active) setInfo(data); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Etiqueta indisponível."); });
    return () => { active = false; };
  }, [equipmentId, enabled]);

  const toggle = async () => {
    if (!onToggle || !canManage || busy) return;
    const next = !enabled;
    if (!window.confirm(next
      ? "Ativar consulta pública de manutenções concluídas deste equipamento? O QR Code poderá ser lido por qualquer pessoa que tenha acesso à etiqueta."
      : "Desativar a consulta pública desta etiqueta? O QR Code impresso deixará de mostrar o histórico.")) return;
    setBusy(true); setNotice("");
    try {
      const saved = await onToggle(equipmentId, next);
      if (!saved) throw new Error("Não foi possível confirmar a alteração no banco.");
      setNotice(next ? "Consulta ativada. A etiqueta permanece a mesma nas próximas OS." : "Consulta desativada.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Falha ao alterar etiqueta.");
    } finally { setBusy(false); }
  };
  const copy = async () => {
    if (!info?.publicPath) return;
    try { await navigator.clipboard.writeText(window.location.origin + info.publicPath); setNotice("Link de consulta copiado."); }
    catch { setNotice("Não foi possível copiar. Abra o link para compartilhar."); }
  };
  return <section style={{ gridColumn:"1 / -1", borderTop:"1px solid #dce6f2", paddingTop:12, display:"grid", gap:9 }}>
    <div style={{ display:"flex", gap:7, alignItems:"center", fontWeight:800, fontSize:13 }}><QrCode size={16}/> Etiqueta permanente do equipamento</div>
    <div style={{ fontSize:12, color:"#58708c" }}>O mesmo QR Code acompanha todas as manutenções. Somente serviços concluídos são exibidos ao cliente.</div>
    {info && <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:9, fontSize:12 }}>
      <strong style={{ color:"#064b93", letterSpacing:1 }}>{info.code}</strong>
      <span>{info.historyCount} manutenção(ões) concluída(s)</span>
      <span>{info.enabled ? "Consulta pública ativa" : "Consulta pública desativada"}</span>
    </div>}
    {error && <small role="alert" style={{ color:"#a22929" }}>{error}</small>}
    {notice && <small role="status">{notice}</small>}
    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
      {info?.enabled && info.printPath && <a className="os-secondary-button" href={info.printPath} target="_blank" rel="noopener noreferrer"><Printer size={14}/> Imprimir etiqueta</a>}
      {info?.enabled && info.publicPath && <a className="os-secondary-button" href={info.publicPath} target="_blank" rel="noopener noreferrer"><ShieldCheck size={14}/> Ver histórico público</a>}
      {info?.enabled && info.publicPath && <button className="os-secondary-button" type="button" onClick={()=>void copy()}><ClipboardCopy size={14}/> Copiar link</button>}
      {canManage && onToggle && <button className="os-secondary-button" type="button" disabled={busy} onClick={()=>void toggle()}>{busy ? "Salvando..." : enabled ? "Desativar consulta" : "Ativar etiqueta e histórico"}</button>}
    </div>
  </section>;
}
