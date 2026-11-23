"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Bot, Eraser, LoaderCircle, MessageCircle, Send, Sparkles, X } from "lucide-react";
import styles from "./ChatGPTAssistant.module.css";

type Message = { role: "user" | "assistant"; content: string };
const suggestions = ["Como usar a agenda do ProAR?", "Revise este texto para um cliente", "Resuma estas informações", "Explique este problema de climatização"];

export function ChatGPTAssistant() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("ProAR");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(false);
  const [configured, setConfigured] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy, open]);
  useEffect(() => {
    let active = true;
    void fetch("/api/ai-assistant", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const result = await response.json();
      if (active) { setAvailable(result.authenticated === true); setConfigured(result.configured === true); }
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const send = async (text = draft) => {
    const content = text.trim();
    if (!content || busy) return;
    setError("");
    setDraft("");
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setBusy(true);
    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, topic, history: messages.slice(-8) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível responder.");
      setMessages(current => [...current, { role: "assistant", content: String(result.answer || "") }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao consultar o ChatGPT.");
      setMessages(current => current.filter((item, index) => !(index === current.length - 1 && item.role === "user" && item.content === content)));
      setDraft(content);
    } finally { setBusy(false); }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); }
  };

  return <div className={styles.root}>
    {open ? <section className={styles.panel} role="dialog" aria-label="Assistente ChatGPT do ProAR" aria-modal="false">
      <header className={styles.header}>
        <div className={styles.identity}><span className={styles.mark}><Sparkles size={17}/></span><div><h2>Assistente ChatGPT</h2><p>Ajuda e rascunhos para sua operação</p></div></div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.iconButton} title="Nova conversa" aria-label="Limpar conversa" onClick={() => { setMessages([]); setError(""); setDraft(""); }}><Eraser size={15}/></button>
          <button type="button" className={styles.iconButton} title="Fechar" aria-label="Fechar assistente" onClick={() => setOpen(false)}><X size={17}/></button>
        </div>
      </header>
      <div className={styles.topic}><label><span className="sr-only">Área de ajuda</span><select value={topic} onChange={event => setTopic(event.target.value)}><option>ProAR</option><option>Climatização</option><option>Atendimento</option><option>Comercial</option><option>Licitações</option><option>Relatórios</option></select></label></div>
      <div className={styles.messages} aria-live="polite">
        {!configured && <p className={styles.error} role="status">A chave da OpenAI ainda não está configurada para esta empresa. Um administrador deve acessar Configurações → Inteligência Artificial.</p>}
        {!messages.length && <div className={styles.welcome}><strong>Olá! Como posso ajudar?</strong>Posso explicar como usar o sistema, revisar mensagens, resumir textos e ajudar com dúvidas de climatização. Cole apenas as informações necessárias.</div>}
        {messages.map((message, index) => <div key={`${index}-${message.role}`} className={`${styles.message} ${message.role === "user" ? styles.user : styles.assistant}`}>{message.content}</div>)}
        {!messages.length && <div className={styles.prompts}>{suggestions.map(item => <button type="button" key={item} onClick={() => void send(item)}>{item}</button>)}</div>}
        {busy && <div className={`${styles.message} ${styles.assistant}`}><LoaderCircle size={14} className="spin"/> Consultando...</div>}
        <div ref={endRef}/>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <p className={styles.notice}>A IA não consulta cadastros nem altera ou envia dados. Revise as respostas antes de usá-las. A conversa não é salva no ProAR.</p>
      <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send(); }}>
        <textarea ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder={configured ? "Escreva sua pergunta..." : "Configure a chave da OpenAI primeiro"} maxLength={2500} aria-label="Pergunte ao Assistente ChatGPT" disabled={!configured} />
        <button type="submit" className={styles.send} disabled={!configured || busy || !draft.trim()} aria-label="Enviar pergunta"><Send size={17}/></button>
      </form>
    </section> : available ? <button type="button" className={styles.launcher} onClick={() => { setOpen(true); window.setTimeout(() => inputRef.current?.focus(), 0); }} aria-label="Abrir Assistente ChatGPT"><Bot size={18}/><span>ChatGPT</span><MessageCircle size={15}/></button> : null}
  </div>;
}
