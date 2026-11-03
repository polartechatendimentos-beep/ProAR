import {documentChecklist,documentStatus,type BiddingDocument} from "./bidding-documents";
export type QualificationRisk={level:"critical"|"warning"|"info";title:string;detail:string;documentId?:string};
export function qualificationRisks(documents:BiddingDocument[],tenderId:string,today=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})){
 const scoped=documents.filter(doc=>tenderId?doc.tenderId===tenderId:!doc.tenderId);
 const risks:QualificationRisk[]=[];
 for(const item of documentChecklist(scoped,tenderId,today))if(!item.approved)risks.push({level:item.received?"warning":"critical",title:item.category,detail:item.received?"Há arquivo recebido, mas nenhum aprovado e vigente.":"Nenhum documento aprovado e vigente para esta categoria."});
 for(const doc of scoped){const status=documentStatus(doc,today);if(status==="Vencido")risks.push({level:"critical",title:"Documento vencido: "+doc.name,detail:"Validade informada: "+doc.validUntil,documentId:doc.id});else if(doc.validUntil&&doc.validUntil>=today){const days=Math.round((Date.parse(doc.validUntil+"T12:00:00Z")-Date.parse(today+"T12:00:00Z"))/86400000);if(days<=30)risks.push({level:"warning",title:"Vencimento próximo: "+doc.name,detail:"Restam "+days+" dia(s).",documentId:doc.id});}}
 return risks;
}
export function qualificationDossier(documents:BiddingDocument[],tenderId:string,companyName:string,tenderName:string,today=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})){
 const scoped=documents.filter(doc=>tenderId?doc.tenderId===tenderId:!doc.tenderId),risks=qualificationRisks(documents,tenderId,today);
 const lines=["PROAR — DOSSIÊ PRELIMINAR DE HABILITAÇÃO","Empresa: "+companyName,"Edital: "+tenderName,"Data-base: "+today,"","DOCUMENTOS"];
 for(const doc of scoped)lines.push([doc.name,doc.category,documentStatus(doc,today),doc.validUntil||"Validade não informada","Revisor: "+(doc.reviewedBy||"Pendente")].join(" | "));
 lines.push("","RISCOS E PENDÊNCIAS",...risks.map(r=>r.level.toUpperCase()+" | "+r.title+" | "+r.detail),"","A lista é referência geral; os requisitos definitivos devem ser extraídos e conferidos no edital. A análise não substitui revisão técnica, contábil, jurídica ou autenticação oficial.");
 return lines.join("\n");
}
