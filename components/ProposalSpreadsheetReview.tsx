"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import {
  formatProposalValue,
  parseOfficialProposalSpreadsheet,
  PROPOSAL_CSV_MAX_BYTES,
  proposalCsvTemplate,
  proposalDraftCsv,
  reviewProposalSpreadsheet,
  type ProposalOfficialItem,
  type ProposalSpreadsheetIssue,
} from "@/lib/proposal-spreadsheet";
import styles from "./ProposalSpreadsheetReview.module.css";

type Props = {
  tenderLabel?: string;
  officialItems?: readonly ProposalOfficialItem[];
};
type LoadedFile = { name: string; text: string; error: string };
const pageSize = 25;
const emptyFile: LoadedFile = { name: "", text: "", error: "" };

function downloadCsv(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function readCsv(file: File | undefined): Promise<LoadedFile> {
  if (!file) return emptyFile;
  if (!file.name.toLowerCase().endsWith(".csv") || !file.size || file.size > PROPOSAL_CSV_MAX_BYTES) {
    return { ...emptyFile, name: file.name, error: "Selecione um CSV de até 256 KB. No Excel, use Salvar como CSV UTF-8." };
  }
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    return { name: file.name, text: decoded, error: "" };
  } catch {
    return { ...emptyFile, name: file.name, error: "Não foi possível ler o arquivo. Salve como CSV UTF-8 e tente novamente." };
  }
}

export function ProposalSpreadsheetReview({ tenderLabel, officialItems }: Props) {
  const [proposal, setProposal] = useState(emptyFile), [reference, setReference] = useState(emptyFile);
  const [proposalLoading, setProposalLoading] = useState(false), [referenceLoading, setReferenceLoading] = useState(false);
  const [page, setPage] = useState(0), [showAllIssues, setShowAllIssues] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const proposalRead = useRef(0), referenceRead = useRef(0);
  const proposalInput = useRef<HTMLInputElement>(null), referenceInput = useRef<HTMLInputElement>(null);

  function clearFile(type: "proposal" | "reference") {
    const input = (type === "proposal" ? proposalInput : referenceInput).current;
    if (input) input.value = "";
    void chooseFile(undefined, type);
  }

  async function chooseFile(file: File | undefined, type: "proposal" | "reference") {
    const state = type === "proposal"
      ? { setFile: setProposal, setLoading: setProposalLoading, cursor: proposalRead }
      : { setFile: setReference, setLoading: setReferenceLoading, cursor: referenceRead };
    const attempt = ++state.cursor.current;
    state.setLoading(Boolean(file));
    state.setFile(emptyFile);
    setPage(0);
    setShowAllIssues(false);
    setDownloadError("");
    const result = await readCsv(file);
    if (state.cursor.current !== attempt) return;
    state.setFile(result);
    state.setLoading(false);
  }

  const referenceReview = useMemo(
    () => reference.text ? parseOfficialProposalSpreadsheet(reference.text) : null, [reference.text],
  );
  const usedReference = referenceReview?.officialItems.length ? referenceReview.officialItems : officialItems;
  const result = useMemo(
    () => proposal.text ? reviewProposalSpreadsheet(proposal.text, usedReference) : null, [proposal.text, usedReference],
  );
  const referenceErrors = referenceReview?.issues ?? [];
  const errors: ProposalSpreadsheetIssue[] = [...(result?.issues ?? [])];
  const validDraft = Boolean(result?.items.length && !errors.length && !referenceErrors.length && !reference.error && !referenceLoading && !proposalLoading);
  const pages = Math.ceil((result?.items.length ?? 0) / pageSize);
  const currentPage = Math.min(page, Math.max(pages - 1, 0));

  function exportDraft() {
    if (!validDraft || !result) return;
    try { downloadCsv(proposalDraftCsv(result), "ProAR-rascunho-interno-da-proposta.csv"); }
    catch (error) { setDownloadError(error instanceof Error ? error.message : "Falha ao baixar o rascunho."); }
  }

  return <section className={styles.panel} aria-label="Conferência da planilha de proposta">
    <header className={styles.header}><FileSpreadsheet size={20} aria-hidden="true"/><div>
      <h4>Conferência da planilha de proposta</h4>
      {tenderLabel && <small>{tenderLabel}</small>}
    </div></header>
    <p>Importe os itens cotados para conferir quantidades, unidades e totais. Os arquivos ficam neste navegador: nada é enviado ao ProAR ou ao portal de disputa.</p>
    <div className={styles.files}>
      <div>
        <label>Planilha de preços (CSV UTF-8)
          <input ref={proposalInput} type="file" accept=".csv,text/csv" onChange={event => { void chooseFile(event.currentTarget.files?.[0], "proposal"); }}/>
        </label>
        {proposalLoading && <p role="status">Lendo a planilha de preços…</p>}
        {proposal.error && <p role="alert" className={styles.error}>{proposal.error}</p>}
        <button type="button" className="outline-btn" onClick={() => downloadCsv(proposalCsvTemplate, "ProAR-modelo-de-proposta.csv")}><Download size={14}/> Baixar modelo CSV</button>
        {(proposal.name || proposalLoading) && <button type="button" className="outline-btn" onClick={() => clearFile("proposal")}>Remover planilha de preços</button>}
      </div>
      <div>
        <label>Referência do edital (opcional, CSV UTF-8)
          <input ref={referenceInput} type="file" accept=".csv,text/csv" onChange={event => { void chooseFile(event.currentTarget.files?.[0], "reference"); }}/>
        </label>
        <small>Use apenas os dados conferidos no edital vigente: item, descrição, quantidade, unidade e lote, se houver. Inclua todos os itens dos lotes cotados. Para itens disputados separadamente, não preencha a coluna lote.</small>
        {(reference.name || referenceLoading) && <button type="button" className="outline-btn" onClick={() => clearFile("reference")}>Remover referência</button>}
        {referenceLoading && <p role="status">Lendo a referência do edital…</p>}
        {reference.error && <p role="alert" className={styles.error}>{reference.error}</p>}
        {referenceErrors.length > 0 && <div role="alert" className={styles.error}>
          <strong>Revise a referência antes de usar.</strong>
          <ul>{referenceErrors.slice(0, 5).map(({ linha, mensagem }, index) => <li key={index}>{linha ? `Linha ${linha}: ` : ""}{mensagem}</li>)}</ul>
          {referenceErrors.length > 5 && <small>Mais {referenceErrors.length - 5} alerta(s). Corrija as linhas indicadas e importe de novo.</small>}
        </div>}
        {!reference.name && officialItems?.length ? <p>Usando a referência vinculada ao processo.</p> : null}
        {referenceReview?.officialItems.length ? <p>{referenceReview.officialItems.length} item(ns) na referência: {reference.name}.</p> : null}
      </div>
    </div>
    <details><summary>Formato aceito</summary><p>Colunas obrigatórias da proposta: item, descricao, quantidade, unidade, valor_unitario. Colunas opcionais: lote, marca, modelo e total. Use vírgula nos decimais, como <code>1.250,50</code>; se o separador do arquivo também for vírgula, coloque valores decimais entre aspas. Salve fórmulas como valores antes de exportar. Colunas extras não são importadas e nenhuma declaração é preenchida.</p></details>

    {result && <div className={styles.result} aria-live="polite">
      <p><strong>{proposal.name}</strong> • {result.items.length} linha(s) válida(s) • Total das linhas válidas: <strong>{formatProposalValue(result.totalCentavos)}</strong></p>
      {result.officialStatus === "not-reviewed" && <p><strong>Não conferido com o edital.</strong> Nenhuma referência de itens do edital está disponível para comparação.</p>}
      {result.officialStatus === "matched" && <p><strong>Sem divergências na referência fornecida.</strong> Confirme a versão e o lote no edital antes de usar.</p>}
      {result.officialStatus === "differences" && <p><strong>Conferência pendente.</strong> Revise as linhas e a referência fornecida.</p>}
      {errors.length > 0 && <div className={styles.error} role="alert">
        <strong>{errors.length} pendência(s) na proposta</strong>
        <ul>{(showAllIssues ? errors : errors.slice(0, 10)).map(({ linha, mensagem }, index) => <li key={index}>{linha ? `Linha ${linha}: ` : ""}{mensagem}</li>)}</ul>
        {errors.length > 10 && <button type="button" className="outline-btn" onClick={() => setShowAllIssues(current => !current)}>{showAllIssues ? "Mostrar menos" : "Mostrar todas as pendências"}</button>}
      </div>}
      {result.items.length > 0 && <div className={styles.scroll}><table>
        <caption>Prévia das linhas válidas {pages > 1 && ` • Página ${currentPage + 1} de ${pages}`}</caption>
        <thead><tr><th scope="col">Lote / item</th><th scope="col">Descrição</th><th scope="col">Quantidade</th><th scope="col">Unidade</th><th scope="col">Unitário</th><th scope="col">Total</th><th scope="col">Marca / modelo</th></tr></thead>
        <tbody>{result.items.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(item => <tr key={item.linha}>
          <td>{item.lote || "—"} / {item.item}</td><td>{item.descricao}</td><td>{item.quantidade}</td><td>{item.unidade}</td>
          <td>{formatProposalValue(item.unitarioCentavos)}</td><td>{formatProposalValue(item.totalCentavos)}</td>
          <td>{[item.marca, item.modelo].filter(Boolean).join(" / ") || "—"}</td>
        </tr>)}</tbody>
      </table></div>}
      {pages > 1 && <div className={styles.actions}>
        <button type="button" className="outline-btn" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button>
        <button type="button" className="outline-btn" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Próxima</button>
      </div>}
      <div className={styles.actions}>
        <button type="button" className="outline-btn" disabled={!validDraft} onClick={exportDraft}><Download size={14}/> Baixar rascunho interno</button>
        <small>Não serve como importação oficial e não grava no dossiê.</small>
      </div>
      {downloadError && <p role="alert" className={styles.error}>{downloadError}</p>}
    </div>}
  </section>;
}
