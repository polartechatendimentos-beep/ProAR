"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ConversationBottlenecks, DailyActionableDigest } from "../../../lib/daily-actionable-digest";
import styles from "../workspace.module.css";
import { useAttendancePalette } from "../useAttendancePalette";

const dayLabel = (day: string) => day.split("-").reverse().join("/");
const timeLabel = (instant: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(instant));

const metrics = [
  ["unanswered", "Sem resposta registrada"],
  ["repeatedQuestions", "Pergunta repetida pelo assistente"],
  ["agendaFailures", "Falha na confirmação da agenda"],
  ["transfers", "Transferida para equipe ou setor"],
] as const satisfies readonly (readonly [keyof ConversationBottlenecks, string])[];

function BottleneckCounts({ heading, counts }: { heading: string; counts: ConversationBottlenecks }) {
  return <div>
    <h3>{heading} <small>({counts.inspected} {counts.inspected === 1 ? "conversa" : "conversas"})</small></h3>
    <ul>{metrics.map(([key, label]) => <li key={key}><strong>{counts[key]}</strong> • {label}</li>)}</ul>
  </div>;
}

export default function DailyPendingDigestPage() {
  const { darkMode } = useAttendancePalette();
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<DailyActionableDigest | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/atendimento/pendencias", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Resumo indisponível.");
        if (!controller.signal.aborted) setData(body as DailyActionableDigest);
      })
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Resumo indisponível."); });
    return () => controller.abort();
  }, [refresh]);

  const sections = data ? [
    { heading: "Mensagens novas sem resposta registrada", ...data.conversations, href: "/atendimento", link: "Abrir atendimentos" },
    { heading: "Orçamentos enviados com validade vencida", ...data.quotes, href: "/?tab=orcamento", link: "Abrir orçamentos" },
    { heading: `Visitas de ${dayLabel(data.tomorrow)} sem presença confirmada`, ...data.visits, href: "/?tab=agenda", link: "Abrir agenda" },
  ] : [];
  const hasItems = sections.some(item => item.total > 0);
  return <main className={`${styles.workspace} ${darkMode ? styles.workspaceDark : ""}`}>
    <div className={styles.content}>
      <header className={styles.header}>
        <div><Link href="/atendimento">Voltar ao Atendimento</Link><h1>Pendências do dia</h1><p>Conferência da empresa para fechar o expediente. Nenhuma mensagem é enviada por esta tela.</p></div>
        <button className={styles.refresh} disabled={!data && !error} onClick={() => { setData(null); setError(""); setRefresh(current => current + 1); }}>Atualizar pendências</button>
      </header>
      {error && <section className={styles.panel} role="alert"><p>{error}</p></section>}
      {!data && !error && <section className={styles.panel} role="status"><p>Conferindo mensagens, orçamentos e agenda…</p></section>}
      {data && <div className={styles.panel}>
        <p>Dados de {dayLabel(data.today)}, consultados às {timeLabel(data.generatedAt)} (Brasília).</p>
        {!data.complete && <p role="alert">Consulta parcial: o limite de conversas da busca foi atingido. Confira a fila antes de concluir que não há pendências.</p>}
        {data.bottlenecks && <section aria-label="Gargalos do WhatsApp">
          <h2>Gargalos do WhatsApp</h2>
          <p>Contagem por conversa na janela de hoje. Uma conversa pode aparecer em mais de uma categoria.</p>
          <BottleneckCounts heading="Clientes" counts={data.bottlenecks.customers} />
          {data.bottlenecks.pilot && <BottleneckCounts heading="Número de teste" counts={data.bottlenecks.pilot} />}
          <small>Considera apenas sinais registrados no ProAR. Pergunta repetida é a mesma pergunta feita novamente pelo assistente; falhas de agenda e transferências não registradas não entram na contagem.</small>
        </section>}
        {!hasItems && data.complete && <p role="status">Nenhuma pendência acionável encontrada.</p>}
        {sections.map(({ heading, total, items, href, link }) => <section key={heading}>
          <h2>{heading}</h2>
          {total > 0 ? <ul>{items.map(item => <li key={item.reference}>{item.kind === "quote" || item.kind === "visit" ? <Link href={`/?tab=${item.kind === "quote" ? "orcamento" : "os"}&registro=${encodeURIComponent(item.reference)}`}><strong>{item.title}</strong></Link> : <strong>{item.title}</strong>} • {item.detail}{item.urgent ? " • prioridade" : ""}</li>)}</ul> : <p>{data.complete ? "Nenhuma encontrada." : "Nenhuma encontrada nos dados conferidos."}</p>}
          {total > items.length && <p>Mostrando {items.length} de {total} pendências nesta seção.</p>}
          <Link href={href}>{link}</Link>
        </section>)}
      </div>}
    </div>
  </main>;
}
