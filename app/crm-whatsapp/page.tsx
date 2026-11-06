"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { InboxMessage } from "../../lib/whatsapp-inbox";
import styles from "./workspace.module.css";

export default function WhatsAppInbox() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const load = useCallback(async (next = 0) => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/whatsapp/inbox?offset=${next}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao carregar conversas.");
      setMessages(previous => {
        const all = next ? [...previous, ...result.messages] : result.messages;
        return [...new Map<string, InboxMessage>(all.map((item: InboxMessage) => [item.messageId, item])).values()];
      });
      setHasMore(result.hasMore); setOffset(next + result.messages.length);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar conversas."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const contacts = [...new Set(messages.map(item => item.phone))];
  const filtered = contacts.filter(contact => messages.some(item => item.phone === contact &&
    `${item.phone} ${item.text}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))));
  const selected = phone || filtered[0] || "";
  const history = messages.filter(item => item.phone === selected).sort((a, b) => a.timestamp - b.timestamp);

  return <main className={styles.workspace}>
    <header><div><Link href="/?tab=clientes">Voltar ao ProAR</Link><h1>CRM WhatsApp</h1><p>Caixa de entrada • {contacts.length} contato(s) carregado(s)</p></div>
      <button disabled={busy} onClick={() => void load()}>{busy ? "Carregando…" : "Atualizar"}</button></header>
    <p>Mensagens recebidas após a ativação do webhook. Anexos e respostas enviadas pelo aplicativo devem ser consultados no WhatsApp.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.grid}>
      <aside><label>Buscar nas mensagens carregadas<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Telefone ou mensagem"/></label>
        {!busy && !filtered.length && <p>{messages.length ? "Nenhum resultado para a busca." : "Nenhuma mensagem recebida disponível."}</p>}
        {filtered.map(contact => <button key={contact} aria-pressed={selected === contact} onClick={() => setPhone(contact)}>
          <strong>+{contact}</strong><span>{messages.find(item => item.phone === contact)?.text}</span></button>)}
        {hasMore && <button disabled={busy} onClick={() => void load(offset)}>Carregar mensagens anteriores</button>}
      </aside>
      <section aria-label="Histórico da conversa">
        <h2>{selected ? `+${selected}` : "Selecione uma conversa"}</h2>
        {selected && <a href={`https://wa.me/${selected}`} target="_blank" rel="noopener noreferrer">Responder no WhatsApp ↗</a>}
        <div className={styles.history}>{history.map(item => <article key={item.messageId}>
          <p>{item.text}</p><time dateTime={new Date(item.timestamp * 1000).toISOString()}>{new Date(item.timestamp * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>
        </article>)}</div>
      </section>
    </div>
  </main>;
}
