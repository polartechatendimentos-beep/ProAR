"use client";

import { safeTenderOrigin, tenderPncpLink, tenderPncpSearch, type TenderIdentity } from "@/lib/tender-links";
import { TenderSubmissionCheck } from "./TenderSubmissionCheck";

type TenderPortalRecord = TenderIdentity & { dataEncerramentoProposta?: string; sourcePortal?: string };

export function TenderPortalLinks({ tender }: { tender: TenderPortalRecord }) {
  const origin = safeTenderOrigin(tender.linkSistemaOrigem);
  const pncp = tenderPncpLink(tender);
  const key = JSON.stringify([pncp, tender.numeroControlePNCP, tender.linkSistemaOrigem, tender.objetoCompra]);
  return <div style={{ minWidth: 0, width: "100%" }}>
    <details key={key} style={{ textAlign: "left" }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>Checagem antes da proposta</summary>
      <TenderSubmissionCheck tender={tender}/>
    </details>
    <div className="dossier-actions" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 0" }}>
      {origin && <a className="primary-btn" href={origin} target="_blank" rel="noopener noreferrer">Abrir pregão no portal de origem ↗</a>}
      <a className="outline-btn" href={pncp || tenderPncpSearch(tender)} target="_blank" rel="noopener noreferrer">{pncp ? "Ver edital no PNCP" : "Pesquisar correspondência no PNCP"} ↗</a>
      {!pncp && <small>Confirme órgão, número e ano antes de vincular outro resultado.</small>}
    </div>
  </div>;
}
