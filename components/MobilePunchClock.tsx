"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { loadPunchCache, savePunchCache, type MobilePunchCommand, type MobilePunchDay } from "@/lib/mobile-punch-cache";
import styles from "./MobilePunchClock.module.css";

type Cache = { days: Record<string, MobilePunchDay>; pending: MobilePunchCommand[] };
type Props = { scope: string; employeeId?: string; employeeName?: string; manager: boolean };
type Review = { id: string; employeeId: string; employeeName: string; type: string; requestedAt: string; reason: string; status: string; date: string };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const emptyDay = (date: string, employeeId = "", employeeName = ""): MobilePunchDay => ({ companyId: "", employeeId, employeeName, date, _revision: 0, punches: [], corrections: [], adjustments: [] });
const format = (value: string) => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
function statusOf(punches: MobilePunchDay["punches"]): "off" | "active" | "break" {
  const ordered = [...punches].sort((a, b) => a.at.localeCompare(b.at));\n  const last = ordered[ordered.length - 1];
  if (!last || last.type === "clock-out") return "off";
  if (last.type === "break-start") return "break";
  return "active";
}
function getLocation() {
  return new Promise<NonNullable<MobilePunchCommand["location"]>>((resolve, reject) => navigator.geolocation.getCurrentPosition(p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, capturedAt: new Date(p.timestamp).toISOString() }), reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }));
}
export function MobilePunchClock({ scope, employeeId, employeeName, manager }: Props) {
  const [date, setDate] = useState(today);
  const [cache, setCache] = useState<Cache>({ days: {}, pending: [] });
  const [serverDay, setServerDay] = useState<MobilePunchDay | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [withLocation, setWithLocation] = useState(false);
  const [correctionType, setCorrectionType] = useState<"clock-in" | "break-start" | "break-end" | "clock-out">("clock-in");
  const [correctionAt, setCorrectionAt] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const day = cache.days[date] || serverDay || emptyDay(date, employeeId, employeeName);
  const queued = cache.pending.filter(item => item.date === date);
  const projectedPunches = useMemo(() => [...day.punches, ...queued.filter(item => item.action !== "correction-request").map(item => ({ id: item.requestId, type: item.action, at: item.at, recordedAt: item.at, offline: true }))].sort((a, b) => a.at.localeCompare(b.at)), [day, queued]);
  const status = statusOf(projectedPunches);
  const syncPending = useCallback(async (initial: Cache) => {
    if (!navigator.onLine || !initial.pending.length) return initial;
    let next = { days: { ...initial.days }, pending: [...initial.pending] };
    for (const item of initial.pending) {
      try {
        const response = await fetch("/api/mobile/attendance", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
        const result = await response.json();
        if (!response.ok) { if (response.status < 500) { setError(result.error || "Uma marcação precisa de revisão antes de sincronizar."); break; } continue; }
        next = { ...next, pending: next.pending.filter(row => row.requestId !== item.requestId) };
        if (result.day) next.days[item.date] = result.day;
      } catch { break; }
    }
    await savePunchCache(scope, next);
    setCache(next);
    return next;
  }, [scope]);
  const refresh = useCallback(async () => {
    setError("");
    try {
      const local = await loadPunchCache(scope);
      setCache(local);
      if (navigator.onLine) {
        const response = await fetch("/api/mobile/attendance?date=" + encodeURIComponent(date), { credentials: "same-origin", cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar as marcações.");
        const next = { ...local, days: { ...local.days, [date]: result.day } };
        setServerDay(result.day);
        setCache(next);
        await savePunchCache(scope, next);
        await syncPending(next);
        if (manager) {
          const reviewResponse = await fetch("/api/mobile/attendance?review=1", { credentials: "same-origin", cache: "no-store" });
          const reviewData = await reviewResponse.json();
          if (reviewResponse.ok) setReviews(reviewData.requests || []);
        }
      } else {
        setServerDay(local.days[date] || null);
        setNotice("Sem internet: usando cópia local. As marcações novas ficam pendentes até sincronizar.");
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o ponto."); }
  }, [date, manager, scope, syncPending]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const online = () => { setNotice("Conexão restabelecida. Sincronizando marcações…"); void refresh(); }; window.addEventListener("online", online); return () => window.removeEventListener("online", online); }, [refresh]);
  async function persist(next: Cache) { setCache(next); await savePunchCache(scope, next); }
  async function mark(action: MobilePunchCommand["action"]) {
    if (action === "correction-request") return;
    setBusy(true); setError(""); setNotice("");
    try {
      let location: MobilePunchCommand["location"] | undefined;
      if (withLocation) {
        try { location = await getLocation(); }
        catch { setNotice("Não foi possível obter a localização. A marcação será registrada sem GPS."); }
      }
      const command: MobilePunchCommand = { action, requestId: crypto.randomUUID(), date: today(), at: new Date().toISOString(), offline: !navigator.onLine, ...(location ? { location } : {}) };
      if (!navigator.onLine) {
        const next = { ...cache, pending: [...cache.pending, command] };
        await persist(next); setNotice("Ponto salvo neste aparelho. Sincronização pendente.");
      } else {
        try {
          const response = await fetch("/api/mobile/attendance", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
          const result = await response.json();
          if (response.ok) { const next = { ...cache, days: { ...cache.days, [command.date]: result.day } }; setServerDay(result.day); await persist(next); setNotice("Marcação confirmada pelo servidor."); }
          else if (response.status >= 500) { const pending = { ...command, offline: true }; await persist({ ...cache, pending: [...cache.pending, pending] }); setNotice("Servidor indisponível. Marcação guardada para sincronizar."); }
          else throw new Error(result.error || "Não foi possível registrar o ponto.");
        } catch (reason) {
          if (reason instanceof TypeError || !navigator.onLine) { const pending = { ...command, offline: true }; await persist({ ...cache, pending: [...cache.pending, pending] }); setNotice("Conexão perdida. Marcação guardada para sincronizar."); }
          else throw reason;
        }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível registrar a marcação."); }
    finally { setBusy(false); }
  }
  async function requestCorrection(event: FormEvent) {
    event.preventDefault();
    if (!correctionAt || correctionReason.trim().length < 8) { setError("Informe o horário e explique o motivo com pelo menos 8 caracteres."); return; }
    const command: MobilePunchCommand = { action: "correction-request", requestId: crypto.randomUUID(), date, at: new Date().toISOString(), offline: !navigator.onLine, correctionType, requestedAt: new Date(correctionAt).toISOString(), reason: correctionReason.trim() };
    setBusy(true); setError("");
    try {
      if (!navigator.onLine) { await persist({ ...cache, pending: [...cache.pending, command] }); setNotice("Pedido de correção salvo neste aparelho para sincronizar."); }
      else {
        const response = await fetch("/api/mobile/attendance", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível enviar o pedido.");
        const next = { ...cache, days: { ...cache.days, [date]: result.day } }; await persist(next); setServerDay(result.day); setCorrectionReason(""); setCorrectionAt(""); setNotice("Pedido enviado para aprovação do gestor.");
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao enviar pedido."); }
    finally { setBusy(false); }
  }
  async function review(item: Review, decision: "approve" | "reject") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/mobile/attendance", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review", employeeId: item.employeeId, date: item.date, requestId: item.id, decision, reason: reviewReason.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível revisar o pedido.");
      setReviews(previous => previous.filter(row => row.id !== item.id)); setReviewReason(""); setNotice(decision === "approve" ? "Correção aprovada e registrada no histórico." : "Pedido recusado e registrado no histórico.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao revisar pedido."); }
    finally { setBusy(false); }
  }
  const pendingCount = cache.pending.length;
  return <section className={styles.card} aria-label="Ponto e jornada">
    <div className={styles.heading}><div><small>PONTO PELO APP</small><h2>{employeeName ? "Olá, " + employeeName.split(" ")[0] : "Minha jornada"}</h2></div><span className={status === "active" ? styles.active : status === "break" ? styles.break : styles.off}>{status === "active" ? "EM JORNADA" : status === "break" ? "EM PAUSA" : "FORA DA JORNADA"}</span></div>
    <p className={styles.notice}>Ponto independente do rastreamento de rota. Localização opcional e coletada apenas ao confirmar uma marcação. Sem coleta em segundo plano.</p>
    <div className={styles.actions}>
      {status === "off" && <button disabled={busy || !employeeId} onClick={() => void mark("clock-in")}>Registrar entrada</button>}
      {status === "active" && <><button disabled={busy} onClick={() => void mark("break-start")}>Iniciar pausa</button><button className={styles.secondary} disabled={busy} onClick={() => void mark("clock-out")}>Registrar saída</button></>}
      {status === "break" && <><button disabled={busy} onClick={() => void mark("break-end")}>Retornar da pausa</button><button className={styles.secondary} disabled={busy} onClick={() => setError("Finalize a pausa antes de registrar a saída.")}>Registrar saída</button></>}
    </div>
    <label className={styles.location}><input type="checkbox" checked={withLocation} onChange={event => setWithLocation(event.target.checked)}/> Incluir localização nesta marcação (opcional)</label>
    <label className={styles.date}>Consultar dia <input type="date" value={date} max={today()} onChange={event => setDate(event.target.value)}/></label>
    <div className={styles.summary}><b>{projectedPunches.length} marcação(ões)</b><span>{pendingCount ? pendingCount + " pendente(s) de sincronização" : "Sincronizado"}</span><button type="button" onClick={() => void refresh()} disabled={busy}>Atualizar</button></div>
    <ul className={styles.list}>{projectedPunches.map(item => <li key={item.id}><span>{({ "clock-in": "Entrada", "break-start": "Início da pausa", "break-end": "Retorno da pausa", "clock-out": "Saída" } as Record<string, string>)[item.type] || item.type}</span><time>{format(item.at)}</time><small>{queued.some(q => q.requestId === item.id) ? "Pendente" : item.offline ? "Sincronizado após uso offline" : "Confirmado"}{item.location ? " • localização anexada" : ""}</small></li>)}</ul>
    {day.adjustments?.length > 0 && <div className={styles.corrections}><b>Ajustes aprovados</b>{day.adjustments.map(item => <p key={item.id}>{item.type} • {format(item.at)} • aprovado por {item.approvedBy}</p>)}</div>}
    {day.corrections?.length > 0 && <div className={styles.corrections}><b>Pedidos de correção</b>{day.corrections.map(item => <p key={item.id}>{item.type} • {format(item.requestedAt)} • {item.status === "pending" ? "Aguardando gestor" : item.status === "approved" ? "Aprovado" : "Recusado"}{item.reviewReason ? " • " + item.reviewReason : ""}</p>)}</div>}
    <details className={styles.correctionForm}><summary>Solicitar correção de marcação</summary><form onSubmit={event => void requestCorrection(event)}><label>Tipo<select value={correctionType} onChange={event => setCorrectionType(event.target.value as typeof correctionType)}><option value="clock-in">Entrada</option><option value="break-start">Início da pausa</option><option value="break-end">Retorno da pausa</option><option value="clock-out">Saída</option></select></label><label>Horário correto<input type="datetime-local" value={correctionAt} onChange={event => setCorrectionAt(event.target.value)}/></label><label>Motivo<textarea value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} maxLength={500} placeholder="Explique o que aconteceu"/></label><button disabled={busy}>Enviar para aprovação</button></form></details>
    {manager && <details className={styles.correctionForm}><summary>Pedidos aguardando aprovação ({reviews.length})</summary><label>Observação do gestor<input value={reviewReason} onChange={event => setReviewReason(event.target.value)} maxLength={500} placeholder="Opcional"/></label>{reviews.map(item => <article key={item.id} className={styles.review}><b>{item.employeeName}</b><span>{item.date} • {item.type} • {format(item.requestedAt)}</span><p>{item.reason}</p><div><button disabled={busy} onClick={() => void review(item, "approve")}>Aprovar</button><button className={styles.secondary} disabled={busy} onClick={() => void review(item, "reject")}>Recusar</button></div></article>)}</details>}
    {notice && <p role="status" className={styles.statusMessage}>{notice}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
    <small className={styles.foot}>Registro operacional. Não substitui comprovante REP-P assinado.</small>
  </section>;
}
