"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, LayoutGrid, Bell, Bot, Plug, RefreshCw, Inbox, Search, Headphones, Building2, UserRound, ShieldCheck, Send, StickyNote, ChevronRight } from "lucide-react";
import { WhatsAppWebConnection } from "../../components/WhatsAppWebConnection";
import { chatSectors, chatStages, localTriage, localOrderDraft, chatQueuePriority, sortChatQueue, type ChatActor, type ChatConversation, type LocalChatSettings } from "../../lib/chatdesk-local";
import styles from "./workspace.module.css";

type HistoryItem = { status: string; recipient: string; createdAt: string; error?: string };
type Queue = { companyId: string; actor: ChatActor; items: ChatConversation[]; hasMore: boolean; nextOffset: number; settings: LocalChatSettings; history: HistoryItem[] };
const tabs = ["Atendimentos", "CRM", "Lembretes", "Assistente local", "Conexão"] as const;
const tabIcons = { Atendimentos: MessageSquare, CRM: LayoutGrid, Lembretes: Bell, "Assistente local": Bot, Conexão: Plug };
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
const stamp = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const statusLabel = (value?: string) => value === "accepted" ? "Aceito pelo servidor" : value === "processing" ? "Em processamento" : value === "blocked-optout" ? "Bloqueado por pedido do cliente" : value === "disconnected" ? "Desconectado; confira antes de reenviar" : value ? "Sem confirmação; conferir" : "";
export default function Atendimento() {
  const [tab, setTab] = useState<typeof tabs[number]>("Atendimentos");
  const [queue, setQueue] = useState<Queue | null>(null);
  const [queueClock, setQueueClock] = useState(0);
  const [selected, setSelected] = useState("");
  const [chat, setChat] = useState<ChatConversation | null>(null);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("Todos");
  const [mine, setMine] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
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
      setQueueClock(Date.now());
      setLoadError("");
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Falha ao carregar."); }
    finally { setLoading(false); }
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
  const filtered = useMemo(() => sortChatQueue((queue?.items || []).filter(item => (!mine || item.assignee === queue?.actor.username) && (sector === "Todos" || item.sector === sector) && `${item.name} ${item.phone} ${item.messages.at(-1)?.text || ""}`.toLowerCase().includes(search.toLowerCase())), queueClock), [queue, mine, sector, search, queueClock]);
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
  return <main className={styles.workspace} aria-busy={loading || busy}>
    <aside className={styles.rail} aria-label="Navegação ProAR"><Link className={styles.brandMark} href="/" title="Voltar ao ProAR">P<span className={styles.srOnly}>ProAR</span></Link><span className={styles.railDivider}/><button className={tab === "Atendimentos" ? styles.railActive : ""} title="Atendimentos" aria-label="Atendimentos" onClick={() => setTab("Atendimentos")}><MessageSquare size={21}/></button><button className={tab === "CRM" ? styles.railActive : ""} title="CRM" aria-label="CRM" onClick={() => setTab("CRM")}><LayoutGrid size={20}/></button>{queue?.actor.admin && <button title="Conexão WhatsApp" aria-label="Conexão WhatsApp" onClick={() => setTab("Conexão")}><Plug size={21}/></button>}<Link className={styles.railBack} href="/" title="Voltar ao sistema" aria-label="Voltar ao sistema"><ArrowLeft size={20}/></Link></aside>
    <div className={styles.content}>
    <header className={styles.header}><div><div className={styles.breadcrumb}><Link href="/">ProAR</Link><ChevronRight size={12}/><span>Relacionamento com o cliente</span></div><h1>Central de atendimento</h1><p>Organize conversas, acompanhe sua equipe e dê continuidade a cada solicitação.</p></div><div className={styles.headerActions}><span className={styles.company}><Building2 size={15}/>{settings?.companyName || "Sua empresa"}</span><div className={styles.operator}><span className={styles.avatar}>{queue ? initials(queue.actor.displayName) : <UserRound size={17}/>}</span><span><b>{queue?.actor.displayName || (loading ? "Carregando…" : "Acesse sua conta")}</b><small>{queue?.actor.role || "Acesso por empresa"}</small></span></div><button className={styles.refresh} disabled={busy || loading} title="Atualizar atendimentos" onClick={() => void loadQueue()}><RefreshCw size={16}/><span>Atualizar</span></button></div></header>
    <nav className={styles.tabs} aria-label="Áreas da central">{tabs.filter(item => queue?.actor.admin || !["Lembretes", "Assistente local", "Conexão"].includes(item)).map(item => { const Icon = tabIcons[item]; return <button key={item} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}><Icon size={17} aria-hidden="true"/>{item === "Assistente local" ? "Assistente" : item}{item === "Atendimentos" && queue && <span className={styles.tabCount}>{queue.items.length}</span>}</button>; })}<span className={styles.privateBadge}><ShieldCheck size={14}/> Ambiente da empresa</span></nav>
    {loadError && <p className={styles.loadError} role="alert">{loadError}</p>}
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    {!queue && <section className={styles.loginEmpty}><span className={styles.emptyIcon}><Headphones size={30}/></span><h2>{loading ? "Preparando sua central" : "Seu atendimento começa aqui"}</h2><p>{loading ? "Carregando as configurações da empresa e suas permissões de atendimento." : "Entre com sua conta para acessar as conversas, os lembretes e as configurações da sua empresa."}</p>{!loading && <Link href="/">Acessar o ProAR <ChevronRight size={15}/></Link>}</section>}
    {queue && tab === "Atendimentos" && <div className={styles.desk}>
      <aside className={styles.queue}><div className={styles.queueTitle}><div><span className={styles.eyebrow}>CAIXA DE ENTRADA</span><h2>Conversas <span>{filtered.length}</span></h2></div><Inbox size={20}/></div><label className={styles.searchField}><Search size={16}/><input aria-label="Buscar atendimento" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar cliente ou conversa"/></label><div className={styles.filters}><select aria-label="Filtrar setor" value={sector} onChange={event => setSector(event.target.value)}><option>Todos</option>{queue.actor.sectors.map(item => <option key={item}>{item}</option>)}</select><label><input type="checkbox" checked={mine} onChange={event => setMine(event.target.checked)}/> Meus</label></div>
        {!filtered.length && <div className={styles.queueEmpty}><span><Inbox size={26}/></span><b>{search || mine || sector !== "Todos" ? "Nenhum resultado" : "Sua fila está organizada"}</b><p>{search || mine || sector !== "Todos" ? "Experimente outro termo ou ajuste os filtros para encontrar o atendimento." : "As novas conversas aparecerão aqui quando o WhatsApp da empresa estiver conectado."}</p>{queue.actor.admin && !search && <button onClick={() => setTab("Conexão")}><Plug size={14}/> Configurar WhatsApp</button>}</div>}
        {filtered.map(item => <button key={item.phone} className={`${styles.contact} ${selected === item.phone ? styles.selected : ""}`} onClick={() => { selectConversation(item.phone); setTab("Atendimentos"); }}><strong>{item.name}</strong>{(() => { const priority = chatQueuePriority(item, queueClock); return priority.urgent ? <small role="status">⚠ Urgência técnica • aguardando resposta</small> : priority.waiting ? <small>Aguardando resposta • {priority.waitingMinutes < 60 ? `${priority.waitingMinutes} min` : `${Math.floor(priority.waitingMinutes / 60)} h`}</small> : null; })()}<small>{item.sector} • {item.stage}</small><span>{item.messages.at(-1)?.text || "Sem mensagens"}</span><small>{item.assignee ? `Responsável: ${item.assignee}` : "Aguardando responsável"}</small></button>)}
        {queue.hasMore && <button disabled={busy} onClick={() => void loadQueue(queue.nextOffset)}>Carregar mais atendimentos</button>}
      </aside>
      <section className={styles.conversation} aria-label="Conversa">{!chat ? <div className={styles.chatEmpty}><div className={styles.emptyIllustration} aria-hidden="true"><span/><MessageSquare size={39}/><i><ShieldCheck size={17}/></i></div><span className={styles.eyebrow}>CONVERSAS COM CONTEXTO</span><h2>Um atendimento mais próximo,<br/>do início ao próximo passo.</h2><p>Selecione uma conversa na caixa de entrada para responder, consultar o histórico ou encaminhar à equipe certa.</p><div className={styles.emptyFeatures}><span><UserRound size={15}/> Respostas identificadas</span><span><StickyNote size={15}/> Notas da equipe</span><span><ShieldCheck size={15}/> Histórico por empresa</span></div></div> : <>
        <header className={styles.chatHeader}><div><h2>{chat.name}</h2><p>+{chat.phone} • {chat.sector} • {chat.assignee || "Sem responsável"}</p></div><button disabled={busy || !canWrite} onClick={() => void command("claim")}>Assumir atendimento</button></header>
        <div className={styles.actions}><select aria-label="Etapa do atendimento" disabled={busy || !canWrite} value={chat.stage} onChange={event => void command("stage", { stage: event.target.value })}>{chatStages.map(item => <option key={item}>{item}</option>)}</select><select aria-label="Transferir para setor" disabled={busy || !canWrite} value="" onChange={event => { if (event.target.value) void command("transfer", { sector: event.target.value }); }}><option value="">Transferir para…</option>{chatSectors.filter(item => item !== chat.sector).map(item => <option key={item}>{item}</option>)}</select></div>
        {chat.optOut && <p className={styles.warning}>O cliente pediu a interrupção das mensagens. O envio está bloqueado.</p>}
        <div className={styles.messages}>{chat.messages.map(item => <article key={`${item.direction}-${item.id}`} className={item.direction === "in" ? styles.incoming : item.direction === "out" ? styles.outgoing : item.direction === "note" ? styles.note : styles.event}><small>{item.direction === "in" ? chat.name : item.direction === "note" ? `Nota interna • ${item.actor}` : item.actor || "Sistema"}</small><p>{item.text}</p><time dateTime={item.at}>{stamp(item.at)}{item.status ? ` • ${statusLabel(item.status)}` : ""}</time></article>)}</div>
        <div className={styles.composer}><div className={styles.actions}><button aria-pressed={!note} onClick={() => setNote(false)}><MessageSquare size={14}/> Mensagem ao cliente</button><button aria-pressed={note} onClick={() => setNote(true)}><StickyNote size={14}/> Nota interna</button></div><label className={styles.srOnly} htmlFor="chat-message">{note ? "Nota interna" : "Mensagem ao cliente"}</label><textarea id="chat-message" value={text} maxLength={3000} onChange={event => setText(event.target.value)} placeholder={note ? "Observação visível somente para a equipe" : "Sua assinatura será adicionada pelo ProAR"}/><div className={styles.sendBar}><small>{note ? "Não será enviada ao WhatsApp" : `${queue.actor.displayName} — ${queue.actor.role}`}</small><button disabled={busy || !canWrite || !text.trim() || (!note && chat.optOut)} onClick={() => void command(note ? "note" : "send", { text })}>{note ? <StickyNote size={15}/> : <Send size={15}/>} {busy ? "Salvando…" : note ? "Salvar nota" : "Enviar resposta"}</button></div></div>
      </>}</section>
      <aside className={styles.assistant}><div className={styles.assistantTitle}><span className={styles.botIcon}><Bot size={22}/></span><div><h2>Assistente de atendimento</h2><span>Orientações para a próxima ação</span></div></div><span className={styles.badge}>ASSISTENTE LOCAL</span>{chat ? <><strong>{assistant.sector}{assistant.urgent ? " • Atenção prioritária" : ""}</strong><p>{assistant.reason}</p>{assistant.mixed && <p>A mensagem envolve mais de um setor. Confira antes de transferir.</p>}<blockquote>{assistant.reply}</blockquote><button disabled={!canWrite} onClick={() => { setNote(false); setText(assistant.reply); }}>Usar sugestão na resposta</button><p>São sugestões por regras, sem diagnóstico técnico automático.</p><button disabled={!canWrite || busy} onClick={() => void command("bot", { paused: !chat.botPaused })}>{chat.botPaused ? "Liberar para assistente" : "Pausar assistente"}</button><details><summary>Rascunho da solicitação de OS</summary><p>{draft?.client} • +{draft?.phone}</p><pre>{draft?.symptoms}</pre><p>{draft?.notes}</p></details><label>Vincular OS existente<input value={orderId} maxLength={80} onChange={event => setOrderId(event.target.value)} placeholder="Número da OS"/></label><button disabled={busy || !canWrite || !orderId.trim()} onClick={() => void command("linkOrder", { orderId })}>Vincular OS</button>{chat.orderId && <p>OS vinculada: <b>{chat.orderId}</b></p>}{chat.optOut && queue.actor.admin && <details><summary>Registrar nova autorização do cliente</summary><label>Como o cliente autorizou a retomada?<textarea value={consentReason} maxLength={500} onChange={event => setConsentReason(event.target.value)}/></label><button disabled={busy || consentReason.trim().length < 10} onClick={() => void command("consent", { text: consentReason })}>Registrar autorização e manter assistente pausado</button></details>}</> : <div className={styles.assistantEmpty}><p>Selecione uma conversa para receber uma sugestão de encaminhamento.</p><div><span>01</span><section><b>Entenda a solicitação</b><small>Identifique o assunto e o setor responsável.</small></section></div><div><span>02</span><section><b>Prepare uma resposta</b><small>Revise a sugestão antes de enviar ao cliente.</small></section></div><div><span>03</span><section><b>Continue o atendimento</b><small>Registre notas, vincule uma OS ou transfira para a equipe.</small></section></div><p className={styles.assistantFoot}><ShieldCheck size={14}/> O colaborador mantém o controle do atendimento.</p></div>}</aside>
    </div>}
    {queue && tab === "CRM" && <section className={styles.crmPanel}><h2>Funil dos atendimentos carregados</h2><p>As etapas refletem os registros reais da central. Selecione um cartão para continuar o atendimento.</p><div className={styles.kanban}>{chatStages.map(stage => <section key={stage}><h3>{stage} <small>{queue.items.filter(item => item.stage === stage).length}</small></h3>{queue.items.filter(item => item.stage === stage).map(item => <button key={item.phone} onClick={() => { selectConversation(item.phone); setTab("Atendimentos"); }}><b>{item.name}</b><small>{item.sector}</small><span>{item.orderId ? `OS ${item.orderId}` : "Sem OS vinculada"}</span></button>)}</section>)}</div>{queue.hasMore && <button onClick={() => void loadQueue(queue.nextOffset)}>Carregar mais cartões</button>}</section>}
    {queue?.actor.admin && tab === "Lembretes" && <section className={styles.panel}><h2>Histórico de mensagens e lembretes</h2><p>Tentativas registradas exclusivamente nesta empresa. Aceitação pelo servidor não comprova entrega.</p>{!queue.history.length && <p>Nenhuma tentativa registrada.</p>}<div className={styles.tableWrap}><table><thead><tr><th>Data</th><th>Destinatário</th><th>Estado</th><th>Observação</th></tr></thead><tbody>{queue.history.map((item, index) => <tr key={`${item.createdAt}-${index}`}><td>{stamp(item.createdAt)}</td><td>{item.recipient}</td><td>{statusLabel(item.status)}</td><td>{item.error || "—"}</td></tr>)}</tbody></table></div></section>}
    {queue?.actor.admin && tab === "Assistente local" && settings && <section className={styles.panel}><span className={styles.badge}>REGRAS E MODELOS DE RESPOSTA</span><h2>Assistente da empresa</h2><p>Configure a saudação e o atendimento automático com regras da sua empresa. O assistente identifica assuntos e prepara respostas para a equipe; não confirma defeitos, preços ou horários.</p><label>Nome da empresa nas respostas<input maxLength={100} value={settings.companyName} onChange={event => setSettings({ ...settings, companyName: event.target.value })}/></label><label>Saudação opcional<textarea maxLength={500} value={settings.greeting} onChange={event => setSettings({ ...settings, greeting: event.target.value })}/></label><label className={styles.check}><input type="checkbox" checked={settings.botEnabled} onChange={event => setSettings({ ...settings, botEnabled: event.target.checked })}/> Ativar assistente em novas conversas sem responsável</label><p>Conecte o WhatsApp da empresa para receber e responder às novas mensagens. Ao assumir uma conversa, o colaborador pausa o assistente naquele atendimento.</p><button disabled={busy} onClick={() => void saveSettings()}>Salvar configuração da empresa</button></section>}
    {queue?.actor.admin && tab === "Conexão" && <section className={styles.panel}><WhatsAppWebConnection key={companyId} companyId={companyId}/><hr/><h2>Recebimento de mensagens</h2><p>Sincronize as novas mensagens do WhatsApp com a central de atendimento desta empresa.</p><button disabled={busy} onClick={() => void configureInbound()}>Ativar recebimento de mensagens</button></section>}
    <footer className={styles.footer}><span>ProAR • Central de relacionamento</span><span><ShieldCheck size={12}/> Informações protegidas por empresa e perfil de acesso</span></footer>
    </div>
  </main>;
}
