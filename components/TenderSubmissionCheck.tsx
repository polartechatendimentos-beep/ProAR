"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, ListChecks } from "lucide-react";
import { disputeDestination, extractSubmissionCheck, proposalTimeLabel, radarDeadlineKey, submissionDifferences } from "@/lib/tender-submission-check";
import { tenderPncpLink, type TenderIdentity } from "@/lib/tender-links";
import styles from "./TenderSubmissionCheck.module.css";

type Tender = TenderIdentity & { dataEncerramentoProposta?: string; sourcePortal?: string };
type Result = { filename: string; partial: boolean; facts: ReturnType<typeof extractSubmissionCheck> };

export function TenderSubmissionCheck({ tender }: { tender: Tender }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const pncp = tenderPncpLink(tender);
  const portal = disputeDestination(tender.linkSistemaOrigem);
  const date = radarDeadlineKey(tender.dataEncerramentoProposta);
  const facts = result?.facts;
  const expectedPortal = facts?.platforms.length === 1 ? facts.platforms[0] : null;
  const differences = facts ? submissionDifferences(date, portal?.platform || "", facts) : null;
  const needsReview = differences?.deadline || differences?.platform;
  const destination = portal?.url || expectedPortal?.url;

  async function read() {
    if (!file || progress) return;
    setError("");
    setResult(null);
    if (!file.name.toLowerCase().endsWith(".pdf") || file.size > 8 * 1024 * 1024 || !file.size) {
      setError("Escolha o PDF do edital, de até 8 MB. Se baixou um ZIP, extraia o PDF primeiro.");
      return;
    }
    setProgress("Preparando leitura local…");
    let reader: ReturnType<typeof import("@/lib/browser-document-reader").createDocumentReader> | undefined;
    try {
      const { createDocumentReader } = await import("@/lib/browser-document-reader");
      reader = createDocumentReader();
      const pdf = new File([file], file.name, { type: "application/pdf" });
      const { text, extraction } = await reader.read(pdf, setProgress);
      if (extraction.source === "unreadable") throw new Error("Não foi possível ler este PDF. Consulte o edital original.");
      setResult({ filename: file.name, partial: extraction.partial, facts: extractSubmissionCheck(text) });
    } catch {
      setError("Não foi possível ler o PDF. Verifique se o arquivo abre e consulte o edital original.");
    } finally {
      try { await reader?.dispose(); } catch { /* A falha de limpeza não cancela a leitura. */ }
      setProgress("");
    }
  }

  return <section className={styles.panel} aria-label="Checagem antes da proposta">
    <header><ListChecks size={19} aria-hidden="true"/><div><h3>Checagem antes da proposta</h3><p>Confira onde enviar, o prazo e o que pode impedir a participação.</p></div></header>
    <div className={styles.grid}>
      <div><h4>Onde enviar</h4><strong>{differences?.platform ? "Plataformas divergentes" : expectedPortal?.value || portal?.platform || "A confirmar no edital"}</strong>
        {portal && <p><a href={portal.url} target="_blank" rel="noopener noreferrer">{tender.sourcePortal || "Radar"}: {portal.platform}</a></p>}
        {!portal && pncp && <p>PNCP é fonte de publicação, não confirmação da plataforma de disputa.</p>}
        {facts?.platforms.map(f => <p key={f.value}>PDF (p. {f.page}): <b>{f.value}</b><q>{f.excerpt}</q></p>)}
      </div>
      <div><h4>Prazo para enviar</h4><strong>{differences?.deadline ? "Prazos divergentes" : facts?.deadlines.length === 1 ? proposalTimeLabel(facts.deadlines[0].value) : date ? proposalTimeLabel(date) : "A confirmar no edital"}</strong>
        {date && <p>{pncp ? <a href={pncp} target="_blank" rel="noopener noreferrer">Radar ({tender.sourcePortal || "PNCP"})</a> : "Radar"}: {proposalTimeLabel(date)}{tender.dataEncerramentoProposta && /(?:Z|[+-]\d{2}:\d{2})$/i.test(tender.dataEncerramentoProposta) ? " (Brasília)" : " (horário informado pela fonte)"}</p>}
        {facts?.deadlines.map(f => <p key={f.value}>PDF (p. {f.page}): <b>{proposalTimeLabel(f.value)}</b>{facts.brasilia ? " (Brasília)" : " (fuso não identificado)"}<q>{f.excerpt}</q></p>)}
        {facts?.deadlines.length && date && !facts.brasilia ? <p>Confira o fuso no original antes de comparar as fontes.</p> : null}
        {facts && !facts.deadlines.length && <p>Prazo de envio não localizado no PDF. Não use o horário da sessão como prazo de envio.</p>}
      </div>
      <div><h4>O que conferir antes de pagar</h4><strong>{facts?.lots ? `${facts.lots} lotes de climatização identificados` : "A conferência não atesta habilitação"}</strong>
        {facts?.requirements.length ? <ul>{facts.requirements.map(item => <li key={item.key}>{item.label} <small>(PDF, p. {item.page})</small><q>{item.excerpt}</q></li>)}</ul> : <p>Confira participação, documentos e se a cotação é por item ou lote na versão atual do edital.</p>}
        <p>Confirme no portal se já há acesso ativo e o custo, se houver.</p>
      </div>
    </div>
    {needsReview && <p className={styles.warning} role="status"><AlertTriangle size={16}/> Divergência {differences?.platform && differences?.deadline ? "de plataforma e de prazo" : differences?.platform ? "de plataforma" : "de prazo"}. Compare as fontes e as retificações antes de pagar ou enviar.</p>}
    <div className={styles.actions}>
      {destination && !differences?.platform && <a className="outline-btn" href={destination} target="_blank" rel="noopener noreferrer">Abrir plataforma da proposta <ExternalLink size={14}/></a>}
      {pncp && <a className="outline-btn" href={pncp} target="_blank" rel="noopener noreferrer">Consultar edital e anexos no PNCP <ExternalLink size={14}/></a>}
    </div>
    <details>
      <summary>Conferir com o PDF do edital</summary>
      <p>Selecione a versão oficial mais recente deste processo. A leitura é local e não envia o documento para IA. Se o download vier em ZIP, extraia o PDF.</p>
      <div className={styles.actions}>
        <input aria-label="PDF do edital" type="file" accept=".pdf,application/pdf" disabled={!!progress} onChange={event => { setFile(event.target.files?.[0] || null); setResult(null); setError(""); }}/>
        <button type="button" className="outline-btn" disabled={!file || !!progress} onClick={() => void read()}>Conferir PDF</button>
      </div>
      {progress && <p role="status">{progress}</p>}
      {error && <p role="alert">{error}</p>}
      {result && <p role="status">Leitura de {result.filename}{result.partial ? " parcial" : ""}. Confirme o processo, os trechos e eventuais retificações no original. A ausência de um achado não dispensa a conferência.</p>}
    </details>
    <p className={styles.footer}>Nenhum pagamento, proposta ou lance é enviado por esta checagem.</p>
  </section>;
}
