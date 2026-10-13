"use client";

import { useEffect, useState } from "react";
import { ClipboardCopy, Printer, QrCode, ShieldCheck } from "lucide-react";

type LabelInfo = { enabled: boolean; code: string; historyCount: number; publicPath?: string; printPath?: string; publicOrigin?: string };
type Props = {
  equipmentId: string;
  enabled: boolean;
  canManage: boolean;
  customerId?: string;
  historicalOrderIds?: string[];
  orders?: Record<string, unknown>[];
  onLinkHistoricalOrder?: (equipmentId: string, orderId: string, linked: boolean) => Promise<boolean>;
  onToggle?: (equipmentId: string, enabled: boolean) => Promise<boolean>;
};

export function EquipmentLabelControl({ equipmentId, enabled, canManage, customerId = "", historicalOrderIds = [], orders = [], onToggle, onLinkHistoricalOrder }: Props) {
  const [info, setInfo] = useState<LabelInfo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedHistoricalOrder, setSelectedHistoricalOrder] = useState("");
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
  const previousOrders = orders.filter(order =>
    customerId && String(order.customerId || "") === customerId &&
    /conclu[ií]d|finalizad|encerrad/i.test(String(order.status || "")) &&
    /^[A-Za-z0-9_-]{1,120}$/.test(String(order.id || "")),
  );
  const eligiblePreviousOrders = previousOrders.filter(order => {
    const id = String(order.id);
    if (historicalOrderIds.includes(id)) return false;
    const linked = Array.isArray(order.equipmentIds) ? order.equipmentIds.map(String) : [];
    if (order.equipmentId) linked.push(String(order.equipmentId));
    return !linked.includes(equipmentId);
  }).slice(0, 100);
  const changeHistoricalLink = async (orderId: string, linked: boolean) => {
    if (!onLinkHistoricalOrder || !canManage || busy) return;
    if (linked && !window.confirm("Confirma que esta OS anterior pertence ao MESMO equipamento físico e ao mesmo cliente? O serviço passará a aparecer no QR Code público.")) return;
    if (!linked && !window.confirm("Desvincular esta OS do histórico público da etiqueta? O registro original da OS será preservado.")) return;
    setBusy(true); setNotice("");
    try {
      if (!await onLinkHistoricalOrder(equipmentId, orderId, linked)) throw new Error("Vínculo não autorizado ou não confirmado no banco. Verifique cliente, status e vínculos existentes.");
      setSelectedHistoricalOrder("");
      setNotice(linked ? "OS anterior vinculada ao histórico permanente." : "Vínculo anterior removido sem excluir a OS.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Falha ao salvar vínculo.");
    } finally { setBusy(false); }
  };
  const copy = async () => {
    if (!info?.publicPath) return;
    try { await navigator.clipboard.writeText((info.publicOrigin || window.location.origin) + info.publicPath); setNotice("Link de consulta copiado."); }
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
      {info?.enabled && info.printPath && <a className="os-secondary-button" href={(info.publicOrigin || "") + info.printPath} target="_blank" rel="noopener noreferrer"><Printer size={14}/> Imprimir etiqueta</a>}
      {info?.enabled && info.publicPath && <a className="os-secondary-button" href={(info.publicOrigin || "") + info.publicPath} target="_blank" rel="noopener noreferrer"><ShieldCheck size={14}/> Ver histórico público</a>}
      {info?.enabled && info.publicPath && <button className="os-secondary-button" type="button" onClick={()=>void copy()}><ClipboardCopy size={14}/> Copiar link</button>}
      {canManage && onToggle && <button className="os-secondary-button" type="button" disabled={busy} onClick={()=>void toggle()}>{busy ? "Salvando..." : enabled ? "Desativar consulta" : "Ativar etiqueta e histórico"}</button>}
    </div>
    {canManage && onLinkHistoricalOrder && customerId && <div style={{ borderTop:"1px dashed #dce6f2", paddingTop:12, display:"grid", gap:8 }}>
      <strong style={{ fontSize:12 }}>Vínculos com manutenções anteriores</strong>
      <small style={{ color:"#58708c" }}>As OS atuais vinculadas pelo ID aparecem automaticamente. Para OS antigas sem vínculo com este cadastro, selecione e confirme que pertencem ao mesmo equipamento físico.</small>
      {historicalOrderIds.length > 0 && <div style={{ display:"grid", gap:5 }}>
        {historicalOrderIds.map(id => {
          const previous = previousOrders.find(order => String(order.id) === id);
          return <div key={id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, fontSize:12 }}>
            <span>OS {id}{previous ? ` • ${String(previous.date || "")} • ${String(previous.service || "Atendimento")}` : " • vínculo antigo"}</span>
            <button type="button" className="os-secondary-button" disabled={busy} onClick={()=>void changeHistoricalLink(id,false)}>Desvincular</button>
          </div>;
        })}
      </div>}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <select aria-label="Selecionar OS anterior do mesmo cliente" value={selectedHistoricalOrder} onChange={event=>setSelectedHistoricalOrder(event.target.value)} style={{ maxWidth:360, minWidth:190, padding:"8px", border:"1px solid #c9d8e9", borderRadius:8 }}>
          <option value="">Selecionar OS anterior concluída...</option>
          {eligiblePreviousOrders.map(order => <option key={String(order.id)} value={String(order.id)}>OS {String(order.id)} • {String(order.date || "")} • {String(order.service || "Atendimento").slice(0,60)}</option>)}
        </select>
        <button type="button" className="os-secondary-button" disabled={busy || !selectedHistoricalOrder || historicalOrderIds.length >= 100} onClick={()=>void changeHistoricalLink(selectedHistoricalOrder,true)}>Vincular OS anterior</button>
      </div>
      {!customerId && <small>Vincule o equipamento a um cliente com ID antes de recuperar o histórico.</small>}
    </div>}
  </section>;
}
