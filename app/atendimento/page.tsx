"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { WhatsAppWebConnection } from "../../components/WhatsAppWebConnection";
import { chatSectors, chatStages, localTriage, localOrderDraft, type ChatActor, type ChatConversation, type LocalChatSettings } from "../../lib/chatdesk-local";
import styles from "./workspace.module.css";

type HistoryItem = { status: string; recipient: string; createdAt: string; error?: string };
type Queue = { companyId: string; actor: ChatActor; items: ChatConversation[]; hasMore: boolean; nextOffset: number; settings: LocalChatSettings; history: HistoryItem[] };
const tabs = ["Atendimentos", "CRM", "Lembretes", "Assistente local", "Conexão"] as const;
const stamp = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const statusLabel = (value?: string) => value === "accepted" ? "Aceito pelo servidor" : value === "processing" ? "Em processamento" : value === "blocked-optout" ? "Bloqueado por pedido do cliente" : value === "disconnected" ? "Desconectado; confira antes de reenviar" : value ? "Sem confirmação; conferir" : "";
export default function Atendimento() {
  const [tab, setTab] = useState<typeof tabs[number]>("Atendimentos");
  const [queue, setQueue] = useState<Queue | null>(null);
  const [selected, setSelected] = useState("");
  const [chat, setChat] = useState<ChatConversation | null>(null);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("Todos");
  const [mine, setMine] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [settings, setSettings] = useState<LocalChatSettings | null>(null);
  const [orderId, setOrderId] = useState("");
  const [consentReason, setConsentReason] = useState("");
  const selection = useRef("");
  const pending = useRef<{ key: string; id: string } | null>(null);
  const companyId = queue?.companyId || "";
  const requestHeaders = useCallback((): Record<string, string> => companyId ? { "X-Proar-Company-ID": companyId } : {}, [companyId]);
  const loadQueue = useCallback(async (offset = 0) => {
    try {
      const response = await fetch(`/api/atendimento?offset=${offset}`, { cache: "no-store", headers: requestHeaders() });
      const data: Queue & { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || "Central indisponível.");
      setQueue(previous => ({ ...data, items: offset && previous ? [...new Map([...previous.items, ...data.items].map(item => [item.phone, item])).values()] : data.items }));
      setSettings(previous => previous || data.settings);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Falha ao carregar."); }
  }, [requestHeaders]);
  const loadChat = useCallback(async (phone: string) => {
    if (!phone) return;
    try {
      const response = await fetch(`/api/atendimento?phone=${encodeURIComponent(phone)}`, { cache: "no-store", headers: requestHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Atendimento indisponível.");
      if (selection.current === phone) setChat(data.chat);
    } catch (error) { if (selection.current === phone) { setChat(null); setFeedback(error instanceof Error ? error.message : "Falha ao carregar."); } }
  }, [requestHeaders]);
  // Initial synchronization with server data; state updates follow the HTTP response.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadQueue(); }, [loadQueue]);
  function selectConversation(phone: string) { selection.current = phone; setSelected(phone); setChat(null); setText(""); setConsentReason(""); pending.current = null; if (phone) void loadChat(phone); }
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") { void loadQueue(); if (selected) void loadChat(selected); } }, 15000);
    return () => window.clearInterval(timer);
  }, [loadQueue, loadChat, selected]);
  const filtered = useMemo(() => (queue?.items || []).filter(item => (!mine || item.assignee === queue?.actor.username) && (sector === "Todos" || item.sector === sector) && `${item.name} ${item.phone} ${item.messages.at(-1)?.text || ""}`.toLowerCase().includes(search.toLowerCase())), [queue, mine, sector, search]);
  const assistant = localTriage(chat?.messages.filter(item => item.direction === "in").at(-1)?.text || "");
  const draft = chat ? localOrderDraft(chat) : null;
  const canWrite = Boolean(queue?.actor.admin || (chat && queue?.actor.writeSectors.includes(chat.sector)));
  async function command(action: string, extra: Record<string, unknown> = {}) {
    if (!chat || !queue) return;
    const body = { phone: chat.phone, action, ...extra };
    const key = JSON.stringify(body);
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    setBusy(true); setFeedback("");
    try {
      const response = await fetch("/api/atendimento", { method: "POST", headers: { ...requestHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ ...body, requestId: pending.current.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.");
      setFeedback(data.message || "Alteração efetuada.");
      if (data.saved || data.status === "accepted") { pending.current = null; if (action === "note" || action === "send") setText(""); }
      if (action === "transfer") { selectConversation(""); } else await loadChat(chat.phone);
      await loadQueue();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Solicitação sem confirmação. Confira o histórico antes de repetir."); }
    finally { setBusy(false); }
  }
  async function saveSettings() {
    if (!settings) return;
    setBusy(true);
    try {
      const response = await fetch("/api/atendimento", { method: "POST", headers: { ...requestHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ ...settings, action: "settings" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setSettings(data.settings); setFeedback("Configuração da empresa salva.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  async function configureInbound() {
    setBusy(true);
    try {
      const response = await fetch("/api/atendimento/recebimento", { method: "POST", headers: requestHeaders() });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setFeedback("Recebimento seguro confirmado para esta empresa.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Recebimento indisponível."); }
    finally { setBusy(false); }
  }
  return <main className={styles.workspace}>
    <header className={styles.header}><div><Link href="/">← Voltar ao ProAR</Link><small>CENTRAL DE ATENDIMENTO</small><h1>{settings?.companyName || "Atendimento da empresa"}</h1><p>WhatsApp, equipe, CRM e lembretes no mesmo lugar.</p></div><div><span className={styles.operator}>{queue ? `${queue.actor.displayName} — ${queue.actor.role}` : "Sessão necessária"}</span><button disabled={busy} onClick={() => void loadQueue()}>Atualizar</button></div></header>
    <nav className={styles.tabs} aria-label="Áreas da central">{tabs.filter(item => queue?.actor.admin || !["Lembretes", "Assistente local", "Conexão"].includes(item)).map(item => <button key={item} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    {!queue && <section className={styles.empty}><h2>Entre com sua conta do ProAR</h2><p>A central usa somente os atendimentos da empresa autenticada.</p><Link href="/">Acessar o ProAR</Link></section>}
    {queue && tab === "Atendimentos" && <div className={styles.desk}>
      <aside className={styles.queue}><h2>Fila de atendimento <small>{filtered.length} carregado(s)</small></h2><input aria-label="Buscar atendimento" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cliente, telefone ou mensagem"/><div className={styles.filters}><select aria-label="Filtrar setor" value={sector} onChange={event => setSector(event.target.value)}><option>Todos</option>{queue.actor.sectors.map(item => <option key={item}>{item}</option>)}</select><label><input type="checkbox" checked={mine} onChange={event => setMine(event.target.checked)}/> Meus</label></div>
        {!filtered.length && <p>Nenhum atendimento recebido nesta fila. Os dados aparecem após a ativação do recebimento seguro.</p>}
        {filtered.map(item => <button key={item.phone} className={`${styles.contact} ${selected === item.phone ? styles.selected : ""}`} onClick={() => { selectConversation(item.phone); setTab("Atendimentos"); }}><strong>{item.name}</strong><small>{item.sector} • {item.stage}</small><span>{item.messages.at(-1)?.text || "Sem mensagens"}</span><small>{item.assignee ? `Responsável: ${item.assignee}` : "Aguardando responsável"}</small></button>)}
        {queue.hasMore && <button disabled={busy} onClick={() => void loadQueue(queue.nextOffset)}>Carregar mais atendimentos</button>}
      </aside>
      <section className={styles.conversation} aria-label="Conversa">{!chat ? <div className={styles.empty}><h2>Selecione um atendimento</h2><p>Respostas são assinadas com seu nome e cargo. Notas internas ficam apenas na equipe.</p></div> : <>
        <header className={styles.chatHeader}><div><h2>{chat.name}</h2><p>+{chat.phone} • {chat.sector} • {chat.assignee || "Sem responsável"}</p></div><button disabled={busy || !canWrite} onClick={() => void command("claim")}>Assumir atendimento</button></header>
        <div className={styles.actions}><select aria-label="Etapa do atendimento" disabled={busy || !canWrite} value={chat.stage} onChange={event => void command("stage", { stage: event.target.value })}>{chatStages.map(item => <option key={item}>{item}</option>)}</select><select aria-label="Transferir para setor" disabled={busy || !canWrite} value="" onChange={event => { if (event.target.value) void command("transfer", { sector: event.target.value }); }}><option value="">Transferir para…</option>{chatSectors.filter(item => item !== chat.sector).map(item => <option key={item}>{item}</option>)}</select></div>
        {chat.optOut && <p className={styles.warning}>O cliente pediu a interrupção das mensagens. O envio está bloqueado.</p>}
        <div className={styles.messages}>{chat.messages.map(item => <article key={`${item.direction}-${item.id}`} className={item.direction === "in" ? styles.incoming : item.direction === "out" ? styles.outgoing : item.direction === "note" ? styles.note : styles.event}><small>{item.direction === "in" ? chat.name : item.direction === "note" ? `Nota interna • ${item.actor}` : item.actor || "Sistema"}</small><p>{item.text}</p><time dateTime={item.at}>{stamp(item.at)}{item.status ? ` • ${statusLabel(item.status)}` : ""}</time></article>)}</div>
        <div className={styles.composer}><div className={styles.actions}><button aria-pressed={!note} onClick={() => setNote(false)}>Mensagem ao cliente</button><button aria-pressed={note} onClick={() => setNote(true)}>Nota interna</button></div><label className={styles.srOnly} htmlFor="chat-message">{note ? "Nota interna" : "Mensagem ao cliente"}</label><textarea id="chat-message" value={text} maxLength={3000} onChange={event => setText(event.target.value)} placeholder={note ? "Observação visível somente para a equipe" : "Sua assinatura será adicionada pelo ProAR"}/><div className={styles.sendBar}><small>{note ? "Não será enviada ao WhatsApp" : `${queue.actor.displayName} — ${queue.actor.role}`}</small><button disabled={busy || !canWrite || !text.trim() || (!note && chat.optOut)} onClick={() => void command(note ? "note" : "send", { text })}>{busy ? "Salvando…" : note ? "Salvar nota" : "Enviar resposta"}</button></div></div>
      </>}</section>
      <aside className={styles.assistant}><span className={styles.badge}>ASSISTENTE LOCAL • SEM API DE IA</span><h2>Próxima ação</h2>{chat ? <><strong>{assistant.sector}{assistant.urgent ? " • Atenção prioritária" : ""}</strong><p>{assistant.reason}</p>{assistant.mixed && <p>A mensagem envolve mais de um setor. Confira antes de transferir.</p>}<blockquote>{assistant.reply}</blockquote><button disabled={!canWrite} onClick={() => { setNote(false); setText(assistant.reply); }}>Usar sugestão na resposta</button><p>São sugestões por regras, sem diagnóstico técnico automático.</p><button disabled={!canWrite || busy} onClick={() => void command("bot", { paused: !chat.botPaused })}>{chat.botPaused ? "Liberar para assistente" : "Pausar assistente"}</button><details><summary>Rascunho da solicitação de OS</summary><p>{draft?.client} • +{draft?.phone}</p><pre>{draft?.symptoms}</pre><p>{draft?.notes}</p></details><label>Vincular OS existente<input value={orderId} maxLength={80} onChange={event => setOrderId(event.target.value)} placeholder="Número da OS"/></label><button disabled={busy || !canWrite || !orderId.trim()} onClick={() => void command("linkOrder", { orderId })}>Vincular OS</button>{chat.orderId && <p>OS vinculada: <b>{chat.orderId}</b></p>}{chat.optOut && queue.actor.admin && <details><summary>Registrar nova autorização do cliente</summary><label>Como o cliente autorizou a retomada?<textarea value={consentReason} maxLength={500} onChange={event => setConsentReason(event.target.value)}/></label><button disabled={busy || consentReason.trim().length < 10} onClick={() => void command("consent", { text: consentReason })}>Registrar autorização e manter assistente pausado</button></details>}</> : <p>Selecione uma conversa para ver a triagem e as sugestões.</p>}</aside>
    </div>}
    {queue && tab === "CRM" && <section><h2>Funil dos atendimentos carregados</h2><p>As etapas refletem os registros reais da central. Selecione um cartão para continuar o atendimento.</p><div className={styles.kanban}>{chatStages.map(stage => <section key={stage}><h3>{stage} <small>{queue.items.filter(item => item.stage === stage).length}</small></h3>{queue.items.filter(item => item.stage === stage).map(item => <button key={item.phone} onClick={() => { selectConversation(item.phone); setTab("Atendimentos"); }}><b>{item.name}</b><small>{item.sector}</small><span>{item.orderId ? `OS ${item.orderId}` : "Sem OS vinculada"}</span></button>)}</section>)}</div>{queue.hasMore && <button onClick={() => void loadQueue(queue.nextOffset)}>Carregar mais cartões</button>}</section>}
    {queue?.actor.admin && tab === "Lembretes" && <section className={styles.panel}><h2>Histórico de mensagens e lembretes</h2><p>Tentativas registradas exclusivamente nesta empresa. Aceitação pelo servidor não comprova entrega.</p>{!queue.history.length && <p>Nenhuma tentativa registrada.</p>}<div className={styles.tableWrap}><table><thead><tr><th>Data</th><th>Destinatário</th><th>Estado</th><th>Observação</th></tr></thead><tbody>{queue.history.map((item, index) => <tr key={`${item.createdAt}-${index}`}><td>{stamp(item.createdAt)}</td><td>{item.recipient}</td><td>{statusLabel(item.status)}</td><td>{item.error || "—"}</td></tr>)}</tbody></table></div></section>}
    {queue?.actor.admin && tab === "Assistente local" && settings && <section className={styles.panel}><span className={styles.badge}>REGRAS E MODELOS DE RESPOSTA</span><h2>Assistente da empresa</h2><p>Não usa OpenAI, Gemini nem chave de IA. Classifica assuntos e responde com modelos conservadores; não interpreta fotos, não confirma defeitos e não promete preços ou horários.</p><label>Nome da empresa nas respostas<input maxLength={100} value={settings.companyName} onChange={event => setSettings({ ...settings, companyName: event.target.value })}/></label><label>Saudação opcional<textarea maxLength={500} value={settings.greeting} onChange={event => setSettings({ ...settings, greeting: event.target.value })}/></label><label className={styles.check}><input type="checkbox" checked={settings.botEnabled} onChange={event => setSettings({ ...settings, botEnabled: event.target.checked })}/> Preparar respostas automáticas para novas conversas sem responsável</label><p>O envio também exige a conexão ativa e a liberação geral das automações. Assumir o atendimento pausa o assistente; há intervalo mínimo entre respostas automáticas.</p><button disabled={busy} onClick={() => void saveSettings()}>Salvar configuração da empresa</button></section>}
    {queue?.actor.admin && tab === "Conexão" && <section className={styles.panel}><WhatsAppWebConnection key={companyId} companyId={companyId}/><hr/><h2>Recebimento de mensagens</h2><p>Ative após a publicação do endereço público da central. A configuração será aplicada somente à instância desta empresa.</p><button disabled={busy} onClick={() => void configureInbound()}>Ativar recebimento nesta empresa</button></section>}
  </main>;
}
