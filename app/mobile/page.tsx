"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarClock, Check, CheckCircle2, ClipboardCheck, Clock3, CloudUpload, MapPin, RefreshCw, Search, Smartphone, Wifi, WifiOff, X } from "lucide-react";

type ServiceOrder = {
  id: number;
  numeroTarefa: string;
  clienteNome: string;
  equipe: string | null;
  tipoTarefa: string;
  dataAgendamento: string | null;
  endereco: string;
  orientacao: string | null;
  relatoExecucao: string | null;
  status: string;
  checkIn: string | null;
  checklist: Record<string, boolean> | null;
};

const CHECKLIST = [
  ["localConfirmado", "Confirmei o endereço e o local do equipamento"],
  ["servicoExecutado", "Executei o serviço descrito na ordem"],
  ["testeFinalizado", "Testei o equipamento e conferi o resultado"],
] as const;

type MobileAction = {
  id: string;
  orderId: number;
  action: "checkin" | "complete";
  criadoEm: string;
  relatoExecucao?: string;
  checklist?: Record<string, boolean>;
};

const CACHE_POINTER_KEY = "proar_mobile_last_scope_v1";
const cacheKey = (scope: string) => `proar_mobile_orders_v1_${scope}`;
const queueKey = (scope: string) => `proar_mobile_queue_v1_${scope}`;
const draftKey = (scope: string, orderId: number) => `proar_mobile_draft_v1_${scope}_${orderId}`;

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Keep the online workflow available if storage is full. */ }
}

function readMobileCache(scope: string) {
  return readStored<{ orders: ServiceOrder[]; savedAt: string } | null>(cacheKey(scope), null);
}

function readPending(scope: string) {
  return readStored<MobileAction[]>(queueKey(scope), []);
}

function applyPendingActions(orders: ServiceOrder[], actions: MobileAction[]) {
  return [...actions].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).reduce((current, action) => {
    if (action.action === "complete") return current.filter((order) => order.id !== action.orderId);
    return current.map((order) => order.id === action.orderId
      ? { ...order, checkIn: action.criadoEm, status: "Em andamento" }
      : order);
  }, orders);
}

const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "Horário a combinar";

export default function ProARMobilePage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [selected, setSelected] = useState<ServiceOrder | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [relato, setRelato] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(true);
  const [offlineCache, setOfflineCache] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState("");
  const [cacheScope, setCacheScope] = useState("");
  const syncing = useRef(false);

  const syncPending = useCallback(async (scope: string) => {
    if (!scope || !navigator.onLine || syncing.current) return false;
    syncing.current = true;
    let queue = readPending(scope);
    setPendingCount(queue.length);
    try {
      while (queue.length > 0) {
        const action = queue[0];
        const response = await fetch("/api/mobile/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: action.orderId, action: action.action, relatoExecucao: action.relatoExecucao, checklist: action.checklist }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          setNotice(result.error || "Uma ação continua aguardando sincronização.");
          break;
        }
        const cached = readMobileCache(scope);
        if (cached) writeStored(cacheKey(scope), { orders: applyPendingActions(cached.orders, [action]), savedAt: new Date().toISOString() });
        queue = queue.slice(1);
        writeStored(queueKey(scope), queue);
        setPendingCount(queue.length);
      }
      if (queue.length === 0) {
        setLastSync(new Date().toISOString());
        setNotice((current) => current.includes("sincronização") ? "" : current);
        return true;
      }
      return false;
    } catch {
      setNotice("Sem conexão. As ações continuam salvas neste aparelho.");
      return false;
    } finally {
      syncing.current = false;
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/mobile/orders", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        if (response.status === 401) {
          setOrders([]);
          throw new Error(result.error || "Entre no ProAR enquanto estiver conectado para liberar o modo offline.");
        }
        throw new Error(result.error || "Não foi possível carregar a agenda.");
      }
      const scope = String(result.cacheScope || "");
      const nextOrders = result.data as ServiceOrder[];
      setCacheScope(scope);
      setOfflineCache(false);
      setLastSync(new Date().toISOString());
      if (scope) {
        writeStored(CACHE_POINTER_KEY, scope);
        writeStored(cacheKey(scope), { orders: nextOrders, savedAt: new Date().toISOString() });
        const queue = readPending(scope);
        setPendingCount(queue.length);
        const fullySynced = queue.length ? await syncPending(scope) : true;
        if (!fullySynced && queue.length) {
          const remainingQueue = readPending(scope);
          const localOrders = applyPendingActions(nextOrders, remainingQueue);
          setOrders(localOrders);
          setSelected((current) => current ? localOrders.find((order) => order.id === current.id) || null : null);
          setError("");
          return;
        }
        if (queue.length) {
          const freshResponse = await fetch("/api/mobile/orders", { cache: "no-store" });
          const freshResult = await freshResponse.json();
          if (freshResponse.ok && freshResult.success) {
            const freshOrders = freshResult.data as ServiceOrder[];
            writeStored(cacheKey(scope), { orders: freshOrders, savedAt: new Date().toISOString() });
            setOrders(freshOrders);
            setSelected((current) => current ? freshOrders.find((order) => order.id === current.id) || null : null);
          } else {
            const locallySyncedOrders = applyPendingActions(nextOrders, queue);
            writeStored(cacheKey(scope), { orders: locallySyncedOrders, savedAt: new Date().toISOString() });
            setOrders(locallySyncedOrders);
            setSelected((current) => current ? locallySyncedOrders.find((order) => order.id === current.id) || null : null);
          }
        } else {
          setOrders(nextOrders);
          setSelected((current) => current ? nextOrders.find((order) => order.id === current.id) || null : null);
        }
      } else {
        setOrders(nextOrders);
      }
      setError("");
    } catch (reason) {
      const networkLost = !navigator.onLine || reason instanceof TypeError;
      const scope = String(readStored<string>(CACHE_POINTER_KEY, ""));
      const cached = networkLost && scope ? readMobileCache(scope) : null;
      const queue = scope ? readPending(scope) : [];
      if (cached) {
        const cachedOrders = applyPendingActions(cached.orders, queue);
        setCacheScope(scope);
        setOfflineCache(true);
        setOrders(cachedOrders);
        setPendingCount(queue.length);
        setLastSync(cached.savedAt);
        setSelected((current) => current ? cachedOrders.find((order) => order.id === current.id) || null : null);
        setError("");
        setNotice("Você está offline. As OS salvas continuam disponíveis neste aparelho.");
      } else {
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar a agenda.");
      }
    } finally {
      setLoading(false);
    }
  }, [syncPending]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  useEffect(() => {
    const refreshConnection = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void loadOrders();
    };
    window.addEventListener("online", refreshConnection);
    window.addEventListener("offline", refreshConnection);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", refreshConnection);
      window.removeEventListener("offline", refreshConnection);
    };
  }, [loadOrders]);

  useEffect(() => {
    if (!cacheScope) return;
    writeStored(cacheKey(cacheScope), { orders, savedAt: lastSync || new Date().toISOString() });
  }, [orders, cacheScope, lastSync]);

  const visibleOrders = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("pt-BR");
    return orders.filter((order) => !search || [order.numeroTarefa, order.clienteNome, order.tipoTarefa, order.endereco]
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(search)));
  }, [orders, query]);

  const openOrder = (order: ServiceOrder) => {
    setSelected(order);
    const draft = cacheScope ? readStored<{ checklist?: Record<string, boolean>; relato?: string } | null>(draftKey(cacheScope, order.id), null) : null;
    setChecklist(draft?.checklist || { localConfirmado: false, servicoExecutado: false, testeFinalizado: false });
    setRelato(draft?.relato ?? order.relatoExecucao ?? "");
    setNotice("");
  };

  const runAction = async (action: "checkin" | "complete") => {
    if (!selected) return;
    if (!cacheScope) {
      setNotice("Conecte-se uma vez para carregar e liberar a agenda offline.");
      return;
    }
    if (action === "complete" && (!allStepsDone || relato.trim().length < 10)) return;

    const queuedAction: MobileAction = {
      id: `${selected.id}-${action}-${Date.now()}`,
      orderId: selected.id,
      action,
      criadoEm: new Date().toISOString(),
      ...(action === "complete" ? { relatoExecucao: relato.trim(), checklist: { ...checklist } } : {}),
    };
    const queue = [...readPending(cacheScope), queuedAction];
    writeStored(queueKey(cacheScope), queue);
    if (action === "complete") {
      try { localStorage.removeItem(draftKey(cacheScope, selected.id)); } catch { /* Ignore unavailable local storage. */ }
    }
    setPendingCount(queue.length);

    setSaving(true);
    setNotice("");
    const updatedOrders = action === "complete"
      ? orders.filter((order) => order.id !== selected.id)
      : orders.map((order) => order.id === selected.id ? { ...order, checkIn: queuedAction.criadoEm, status: "Em andamento" } : order);
    setOrders(updatedOrders);
    writeStored(cacheKey(cacheScope), { orders: updatedOrders, savedAt: lastSync || new Date().toISOString() });
    if (action === "complete") {
      setSelected(null);
    } else {
      setSelected({ ...selected, checkIn: queuedAction.criadoEm, status: "Em andamento" });
    }

    if (!navigator.onLine) {
      setNotice(action === "complete"
        ? `Conclusão da OS ${selected.numeroTarefa} salva neste aparelho. Será enviada quando a conexão voltar.`
        : "Check-in salvo neste aparelho. Será enviado quando a conexão voltar.");
      setSaving(false);
      return;
    }

    const synced = await syncPending(cacheScope);
    if (synced) {
      setNotice(action === "complete" ? `OS ${selected.numeroTarefa} concluída e sincronizada.` : "Check-in sincronizado. Agora siga as etapas do atendimento.");
      await loadOrders();
    } else {
      setNotice("A ação ficou salva neste aparelho e aguarda sincronização.");
    }
    setSaving(false);
  };

  const allStepsDone = CHECKLIST.every(([key]) => checklist[key]);

  return (
    <main className="min-h-screen bg-slate-100 pb-10 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950 text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600"><Smartphone size={21}/></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-300">ProAR</p><h1 className="text-lg font-black leading-tight">Área do Técnico</h1></div>
          </div>
          <button type="button" onClick={() => void loadOrders()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50" aria-label="Atualizar ordens">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""}/><span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <div role="status" className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-xs font-semibold ${online ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
          <div className="flex min-w-0 items-center gap-2.5">
            {online ? <Wifi size={17} className="shrink-0"/> : <WifiOff size={17} className="shrink-0"/>}
            <span className="truncate">{online ? "Conectado" : offlineCache ? "Sem internet · usando agenda salva neste aparelho" : "Sem internet · conecte-se para carregar a agenda"}</span>
            {pendingCount > 0 && <span className="shrink-0 rounded-full bg-amber-200 px-2 py-1 text-[10px] font-black text-amber-950">{pendingCount} pendente{pendingCount === 1 ? "" : "s"}</span>}
          </div>
          {pendingCount > 0 && online && cacheScope && <button type="button" onClick={() => { void syncPending(cacheScope).then(() => loadOrders()); }} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 font-black text-blue-800 shadow-sm"><CloudUpload size={15}/>Enviar</button>}
        </div>

        <section className="rounded-2xl bg-blue-700 p-5 text-white shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-100">Sua jornada de hoje</p>
          <h2 className="mt-1 text-2xl font-black">Atenda com segurança e clareza</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100">Abra uma ordem, confira o endereço, faça o check-in e siga o passo a passo até registrar a conclusão. A agenda é guardada no aparelho após o primeiro acesso conectado.</p>
          <div className="mt-5 grid grid-cols-4 gap-2 text-center text-[10px] font-bold sm:text-xs">
            {["1 · Abrir OS", "2 · Check-in", "3 · Executar", "4 · Concluir"].map((step) => <div key={step} className="rounded-lg bg-blue-600/70 px-1.5 py-2.5">{step}</div>)}
          </div>
        </section>

        {notice && !selected && <div role="status" className={`rounded-xl border p-3 text-sm font-semibold ${/salva neste aparelho|aguarda sincronização|offline/i.test(notice) ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{notice}</div>}
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-bold">Agenda indisponível</p><p className="mt-1">{error}</p><button type="button" onClick={() => void loadOrders()} className="mt-3 rounded-lg bg-rose-700 px-4 py-2 font-bold text-white">Tentar novamente</button></div>}

        <section aria-labelledby="orders-title" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Agenda da empresa</p><h2 id="orders-title" className="mt-0.5 text-xl font-black">Ordens em aberto <span className="text-slate-400">{orders.length}</span></h2></div>
            <span className="text-right text-xs text-slate-500">{lastSync ? <>Última sincronização<br/>{dateLabel(lastSync)}</> : "Sincronizado após login"}</span>
          </div>
          <label className="relative block">
            <Search size={17} className="absolute left-3.5 top-3.5 text-slate-400"/>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, OS ou endereço" className="min-h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
          </label>

          {loading && !orders.length ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Carregando suas ordens...</div> : null}
          {!loading && !error && visibleOrders.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-7 text-center">
              <CheckCircle2 className="mx-auto text-emerald-600" size={32}/>
              <h3 className="mt-3 font-black">{orders.length ? "Nenhuma OS encontrada" : "Tudo em dia por aqui"}</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-500">{orders.length ? "Tente buscar por outro cliente, número ou endereço." : "Quando houver ordens em aberto para sua empresa, elas aparecerão nesta lista."}</p>
            </div>
          )}

          <div className="space-y-3">
            {visibleOrders.map((order) => <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-xs font-bold text-blue-700">OS {order.numeroTarefa}</p><h3 className="mt-1 truncate text-base font-black">{order.clienteNome}</h3><p className="mt-1 text-sm text-slate-600">{order.tipoTarefa}</p></div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${order.checkIn ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>{order.checkIn ? "EM ATENDIMENTO" : order.status.toUpperCase()}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p className="flex items-start gap-2"><CalendarClock size={16} className="mt-0.5 shrink-0 text-slate-400"/>{dateLabel(order.dataAgendamento)}</p>
                <p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-slate-400"/><span>{order.endereco}</span></p>
                {order.orientacao && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900"><b>Orientação:</b> {order.orientacao}</p>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.endereco)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"><MapPin size={16}/>Como chegar</a>
                <button type="button" onClick={() => openOrder(order)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 text-xs font-black text-white hover:bg-blue-800">{order.checkIn ? "Continuar OS" : "Abrir passo a passo"}<ArrowRight size={16}/></button>
              </div>
            </article>)}
          </div>
        </section>
        <p className="text-center text-[11px] leading-relaxed text-slate-500">O telefone do cliente não é exibido nesta tela. Se precisar de ajuda, fale com o responsável operacional da sua equipe.</p>
      </div>

      {selected && <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelected(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="order-dialog-title" className="flex max-h-[96dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div><p className="text-xs font-bold text-blue-700">OS {selected.numeroTarefa}</p><h2 id="order-dialog-title" className="text-lg font-black">Passo a passo do atendimento</h2></div>
            <button type="button" onClick={() => setSelected(null)} disabled={saving} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><X size={20}/></button>
          </header>
          <div className="overflow-y-auto px-5 py-4">
            <div className="rounded-xl bg-slate-50 p-3"><p className="font-bold">{selected.clienteNome}</p><p className="mt-1 text-sm text-slate-600">{selected.tipoTarefa}</p><p className="mt-2 text-xs text-slate-500">{selected.endereco}</p></div>
            {notice && <p role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-800">{notice}</p>}
            {!selected.checkIn ? <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-700 text-sm font-black text-white">1</span><div><h3 className="font-black">Chegue ao local e confira a OS</h3><p className="mt-1 text-sm leading-relaxed text-slate-600">Confirme cliente, endereço e serviço solicitado. Depois registre seu início de atendimento.</p></div></div>
              <button type="button" onClick={() => void runAction("checkin")} disabled={saving} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-60"><Clock3 size={17}/>{saving ? "Registrando..." : "Fazer check-in"}</button>
            </div> : <>
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-700 text-sm font-black text-white"><Check size={16}/></span><div><h3 className="font-black">Check-in registrado</h3><p className="mt-1 text-sm text-slate-600">{dateLabel(selected.checkIn)} · faça o serviço e conclua os passos abaixo.</p></div></div>
              </div>
              <div className="mt-5 space-y-3"><h3 className="flex items-center gap-2 text-sm font-black"><ClipboardCheck size={17} className="text-blue-700"/>Checklist simples</h3>
                {CHECKLIST.map(([key, label], index) => <label key={key} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-sm font-semibold leading-snug hover:bg-slate-50"><input type="checkbox" checked={Boolean(checklist[key])} onChange={(event) => {
                  const next = { ...checklist, [key]: event.target.checked };
                  setChecklist(next);
                  if (cacheScope && selected) writeStored(draftKey(cacheScope, selected.id), { checklist: next, relato });
                }} className="h-5 w-5 shrink-0 accent-blue-700"/><span className="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-600">{index + 1}</span>{label}</label>)}
              </div>
              <label className="mt-5 block text-sm font-black">O que foi realizado?<span className="ml-1 text-rose-600">*</span>
                <span className="mt-1 block text-xs font-normal leading-relaxed text-slate-500">Descreva o serviço e qualquer observação importante para o histórico.</span>
                <textarea value={relato} onChange={(event) => {
                  const next = event.target.value;
                  setRelato(next);
                  if (cacheScope && selected) writeStored(draftKey(cacheScope, selected.id), { checklist, relato: next });
                }} rows={4} maxLength={2000} placeholder="Ex.: limpeza dos filtros e da serpentina; dreno testado; equipamento funcionando normalmente." className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
                <span className="mt-1 block text-right text-[11px] font-normal text-slate-400">{relato.length}/2000</span>
              </label>
              <button type="button" onClick={() => void runAction("complete")} disabled={saving || !allStepsDone || relato.trim().length < 10} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"><CheckCircle2 size={18}/>{saving ? "Salvando conclusão..." : "Concluir e registrar saída"}</button>
              {!allStepsDone && <p className="mt-2 text-center text-xs text-slate-500">Marque os três passos para habilitar a conclusão.</p>}
            </>}
          </div>
          <footer className="border-t border-slate-200 px-5 py-3 text-center text-[11px] text-slate-500">Se precisar sair, feche esta janela. A OS permanece em aberto.</footer>
        </section>
      </div>}
    </main>
  );
}
