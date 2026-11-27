import type { BiddingDocument } from "./bidding-documents.ts";

export type TechnicalEvidence = { issuer:string; service:string; quantity:string; unit:string; startDate:string; endDate:string; professionalRecord:string };
export type EvidenceRequirement = { id:string; category:string; description:string; threshold:string; unit:string; documentId:string; sourcePage?:number; sourceQuote?:string; phase?:string; dueDate?:string; technicalEvidence?:TechnicalEvidence; evidenceRevision?:number };
type EvidenceDocument = Pick<BiddingDocument,"id"|"_revision"|"category"|"tenderId"|"uploaded"|"sha256"|"review"|"validUntil"|"noExpiry">;
type Assessment = { status:"comprovado"|"pendente"|"não atende"; detail:string };
const pending = (detail:string):Assessment => ({status:"pendente",detail});
const fails = (detail:string):Assessment => ({status:"não atende",detail});
function day(date?:string) {
 return typeof date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
}
const textKey=(x:string)=>x.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("pt-BR");
const quantity=(x:string)=>/^(?:\d+(?:[.,]\d+)?|\d{1,3}(?:\.\d{3})+,\d+)$/.test(x.trim())?Number(x.includes(",")?x.replace(/\./g,"").replace(",","."):x):NaN;
export function assessBiddingEvidence(req:EvidenceRequirement, doc:EvidenceDocument|undefined|null, tenderId:string, now=new Date(), requireConfirmation=true):Assessment{
 if(!req.sourceQuote?.trim())return pending("Informe a cláusula ou o trecho do edital vigente.");
 if(!doc||doc.id!==req.documentId||!doc.uploaded||!doc.sha256)return pending("Vincule um arquivo confirmado no cofre.");
 if(doc.tenderId&&doc.tenderId!==tenderId)return fails("Documento vinculado a outro edital.");
 if(req.category!=="Outros"&&doc.category!==req.category)return fails("A categoria do documento difere da exigência.");
 const today=now.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
 const phase=textKey(req.phase||"");
 const effective=phase==="validade documental"||phase==="habilitacao"?req.dueDate:undefined;
 if(effective&&!day(effective))return pending("Confira a data de referência da habilitação.");
 const due=effective&&effective>today?effective:today;
 if(doc.validUntil&&day(doc.validUntil)&&doc.validUntil<due)return fails("Documento vencido para a data de conferência.");
 if(doc.review==="rejected")return fails("Documento rejeitado na revisão do cofre.");
 if(doc.review!=="approved")return pending("Documento ainda não aprovado no cofre.");
 if(doc.validUntil?!day(doc.validUntil)||doc.noExpiry:!doc.noExpiry)return pending("Validade do documento não confirmada.");
 if(req.category==="Atestado técnico"){
  const evidence=req.technicalEvidence;
  if(!evidence?.issuer.trim()||!evidence.service.trim()||!evidence.unit.trim()||!day(evidence.startDate)||!day(evidence.endDate))return pending("Complete emitente, escopo, unidade e período do atestado.");
  if(evidence.endDate<evidence.startDate)return fails("Período do atestado inválido.");
  if(/\b(?:crea|cft|art|cat|trt)\b/i.test(req.sourceQuote+" "+req.description)&&!evidence.professionalRecord.trim())return pending("Complete o registro de responsabilidade exigido.");
  const actual=quantity(evidence.quantity);
  if(!Number.isFinite(actual)||actual<=0)return pending("Informe a quantidade comprovada no atestado.");
  if(req.unit.trim()&&textKey(evidence.unit)!==textKey(req.unit))return fails("A unidade comprovada difere da exigida.");
  if(req.threshold.trim()){
   const minimum=quantity(req.threshold);
   if(!Number.isFinite(minimum)||minimum<=0||!req.unit.trim())return pending("Confirme a quantidade mínima numérica e a unidade no edital.");
   if(actual<minimum)return fails("A quantidade comprovada é menor que o mínimo exigido.");
  }
 }
 if(requireConfirmation&&(!Number.isSafeInteger(req.evidenceRevision)||req.evidenceRevision!==doc._revision))return pending("Confirme a aderência à cláusula nesta versão do documento.");
 return {status:"comprovado",detail:"Evidência vinculada e conferida internamente; não equivale à decisão do órgão."};
}
