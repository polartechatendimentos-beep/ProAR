"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, FileText, FolderLock, Landmark, ListChecks, MessageCircle, Sparkles, Target, Upload, X } from "lucide-react";

type BiddingTender = {
  numeroControlePNCP?: string;
  objetoCompra?: string;
  modalidadeNome?: string;
  dataEncerramentoProposta?: string;
  valorTotalEstimado?: number;
  sourcePortal?: string;
  orgaoEntidade?: { razaoSocial?: string };
  unidadeOrgao?: { municipioNome?: string; ufSigla?: string };
};

type InboxStatus = "Novas" | "Para analisar" | "Interessantes" | "Participaremos" | "Descartadas" | "Aguardando abertura" | "Em disputa" | "Habilitação" | "Homologadas";
type VaultDocument = { id: string; name: string; category: string; validUntil: string; issuer: string; status: "Válido" | "Vence em breve" | "Vencido" };

const inboxStatuses: InboxStatus[] = ["Novas", "Para analisar", "Interessantes", "Participaremos", "Descartadas", "Aguardando abertura", "Em disputa", "Habilitação", "Homologadas"];
const initialVault: VaultDocument[] = [
  { id: "vault-cnpj", name: "Cartão CNPJ.pdf", category: "CNPJ", validUntil: "Documento permanente", issuer: "Receita Federal", status: "Válido" },
  { id: "vault-social", name: "Contrato Social.pdf", category: "Contrato social", validUntil: "31/12/2026", issuer: "Junta Comercial", status: "Válido" },
  { id: "vault-federal", name: "Certidão Federal.pdf", category: "Certidão", validUntil: "18/09/2026", issuer: "Receita Federal", status: "Vencido" },
  { id: "vault-fgts", name: "CRF FGTS.pdf", category: "Certidão", validUntil: "04/10/2026", issuer: "Caixa Econômica", status: "Vence em breve" },
];

const tenderKey = (tender: BiddingTender, index: number) => tender.numeroControlePNCP || `${tender.orgaoEntidade?.razaoSocial || "certame"}-${index}`;
const classifyReason = (tender: BiddingTender) => {
  const text = `${tender.objetoCompra || ""}`.toLocaleLowerCase("pt-BR");
  const matched = ["ar-condicionado", "climatização", "manutenção", "pmoc", "refrigeração", "split", "chiller", "vrf", "ventilação"].filter(term => text.includes(term));
  return matched.length ? `Compatibilidade encontrada: ${matched.slice(0, 3).join(", ")}.` : "Oportunidade pública próxima à área de atuação monitorada.";
};

export function BiddingOperationsWorkspace({ tenders, onOpen }: { tenders: BiddingTender[]; onOpen: (tender: BiddingTender) => void }) {
  const [activeStatus, setActiveStatus] = useState<InboxStatus>("Novas");
  const [statuses, setStatuses] = useState<Record<string, InboxStatus>>({});
  const [vaultOpen, setVaultOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try { setStatuses(JSON.parse(localStorage.getItem("proar.licitacoes.inbox.v1") || "{}") as Record<string, InboxStatus>); } catch { setStatuses({}); }
  }, []);
  const updateStatus = (key: string, status: InboxStatus) => {
    setStatuses(current => { const next = { ...current, [key]: status }; localStorage.setItem("proar.licitacoes.inbox.v1", JSON.stringify(next)); return next; });
    setNotice(`Certame movido para “${status}”.`);
  };
  const getStatus = (key: string) => statuses[key] || "Novas";
  const filtered = useMemo(() => tenders.filter((tender, index) => getStatus(tenderKey(tender, index)) === activeStatus), [activeStatus, statuses, tenders]);
  const counts = useMemo(() => inboxStatuses.reduce((result, status) => ({ ...result, [status]: tenders.filter((tender, index) => getStatus(tenderKey(tender, index)) === status).length }), {} as Record<InboxStatus, number>), [statuses, tenders]);
  const askEdital = () => {
    const normalized = question.toLocaleLowerCase("pt-BR");
    if (!question.trim()) return;
    const answerText = /visita/.test(normalized) ? "Procure no resumo por “VISITA TÉCNICA”. A conferência final deve ser feita no edital e anexos originais." : /crea|qualifica/.test(normalized) ? "A análise assistida procura exigências de qualificação técnica, CREA e atestados. Confirme a página no documento oficial antes de decidir." : "A pergunta foi registrada para análise. Abra o edital original para validar a resposta e a referência de página antes de qualquer envio.";
    setAnswer(answerText);
  };
  return <section className="bidding-operations-workspace">
    <header className="bidding-operations-header"><div><span className="section-kicker"><Target size={13}/> FLUXO OPERACIONAL DE LICITAÇÕES</span><h2>O que preciso fazer hoje?</h2><p>O Radar encontra oportunidades; a equipe decide, revisa e confirma cada etapa.</p></div><div className="bidding-operations-actions"><button className="outline-btn" onClick={() => setVaultOpen(value => !value)}><FolderLock size={15}/> Cofre de documentos</button><button className="primary-btn" onClick={() => setNotice("Checklist de habilitação atualizado com os documentos do cofre.")}><ListChecks size={15}/> Verificar se estamos aptos</button></div></header>
    <div className="bidding-today-grid"><article><span className="bidding-today-icon cyan"><Target size={17}/></span><div><b>{counts.Novas}</b><small>Novas oportunidades</small></div></article><article><span className="bidding-today-icon amber"><Clock3 size={17}/></span><div><b>{counts["Para analisar"]}</b><small>Editais para analisar</small></div></article><article><span className="bidding-today-icon violet"><FileCheck2 size={17}/></span><div><b>{counts.Habilitação}</b><small>Em habilitação</small></div></article><article><span className="bidding-today-icon red"><AlertTriangle size={17}/></span><div><b>{initialVault.filter(doc => doc.status === "Vencido").length}</b><small>Documento vencido</small></div></article></div>
    <div className="bidding-inbox panel"><div className="bidding-inbox-tabs" role="tablist">{inboxStatuses.map(status => <button key={status} role="tab" aria-selected={activeStatus === status} className={activeStatus === status ? "active" : ""} onClick={() => setActiveStatus(status)}>{status}<em>{counts[status]}</em></button>)}</div>{notice && <div className="bidding-inline-notice"><CheckCircle2 size={14}/>{notice}<button aria-label="Fechar aviso" onClick={() => setNotice("")}><X size={13}/></button></div>}{filtered.length ? <div className="bidding-inbox-list">{filtered.slice(0, 8).map((tender, index) => { const key = tenderKey(tender, index); return <article key={key}><div className="bidding-inbox-main"><span className="bidding-source-badge"><Landmark size={14}/>{tender.sourcePortal || "PNCP"}</span><div><b>{tender.objetoCompra || "Objeto não informado"}</b><small>{tender.orgaoEntidade?.razaoSocial || "Órgão não informado"} • {tender.unidadeOrgao?.municipioNome || "Cidade não informada"}/{tender.unidadeOrgao?.ufSigla || ""}</small><p><Sparkles size={12}/> {classifyReason(tender)}</p></div></div><div className="bidding-inbox-actions"><span className="bidding-status-pill">{getStatus(key)}</span><button className="outline-btn" onClick={() => onOpen(tender)}>Analisar edital</button><select value={getStatus(key)} onChange={event => updateStatus(key, event.target.value as InboxStatus)} aria-label="Etapa do certame">{inboxStatuses.map(item => <option key={item}>{item}</option>)}</select></div></article> })}</div> : <div className="bidding-inbox-empty"><Target size={22}/><b>Nenhum certame nesta etapa</b><span>Use o Radar acima ou mova uma oportunidade para iniciar o fluxo.</span></div>}</div>
    <div className="bidding-assistant-grid"><article className="bidding-assistant-card"><header><div><span className="assistant-icon"><Sparkles size={17}/></span><div><b>Analisar edital com IA</b><small>Resumo estruturado com revisão humana</small></div></div><button onClick={() => { setActiveStatus("Para analisar"); setNotice("Selecione “Analisar edital” para consultar edital e anexos oficiais."); }}>Abrir fila</button></header><div className="bidding-analysis-preview"><span>RESUMO EXECUTIVO</span><p>Órgão, objeto, modalidade, disputa, valor estimado, visita técnica, documentos exigidos e pontos de atenção.</p><small>As informações devem apontar para página/trecho do documento original.</small></div></article><article className="bidding-assistant-card"><header><div><span className="assistant-icon"><MessageCircle size={17}/></span><div><b>Pergunte ao Edital</b><small>Respostas com validação no documento oficial</small></div></div></header><div className="bidding-question"><input value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => event.key === "Enter" && askEdital()} placeholder="Ex.: exige visita técnica?"/><button onClick={askEdital}>Perguntar</button></div>{answer && <p className="bidding-answer"><CheckCircle2 size={14}/>{answer}</p>}</article></div>
    {vaultOpen && <section className="bidding-vault panel"><header><div><span className="section-kicker"><FolderLock size={13}/> DOCUMENTOS FIXOS DA EMPRESA</span><h3>Cofre de documentos</h3><p>Documentos reutilizáveis, com validade e situação visíveis antes de preparar um pacote.</p></div><button className="outline-btn" onClick={() => setNotice("O upload será associado ao cofre local-first após a revisão do usuário.")}><Upload size={14}/> Adicionar documento</button></header><div className="bidding-vault-grid">{initialVault.map(document => <article key={document.id}><span className={`vault-status ${document.status.toLocaleLowerCase().replaceAll(" ", "-")}`}><FileText size={16}/></span><div><b>{document.name}</b><small>{document.category} • {document.issuer}</small><p>Validade: {document.validUntil}</p></div><strong>{document.status}</strong></article>)}</div></section>}
  </section>;
}

export type { BiddingTender };
