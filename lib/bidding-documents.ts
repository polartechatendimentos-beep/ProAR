export const DOCUMENT_LIMIT=10*1024*1024;
export const DOCUMENT_TYPES={"application/pdf":"pdf","image/png":"png","image/jpeg":"jpg"} as const;
export const DOCUMENT_CATEGORIES=["CND Federal","CND Estadual","CND Municipal","FGTS","Trabalhista","CREA / CFT","ART","Atestado técnico","Outros"] as const;
export type DocumentCategory=typeof DOCUMENT_CATEGORIES[number];
export type ReviewState="received"|"approved"|"rejected";
export type DocumentAudit={at:string;actor:string;action:string;note:string};
export type BiddingDocument={id:string;companyId:string;_revision:number;name:string;filename:string;mime:string;size:number;category:DocumentCategory;tenderId:string;pathname:string;uploaded:boolean;sha256?:string;validUntil:string;noExpiry:boolean;review:ReviewState;reviewNote:string;createdAt:string;createdBy:string;reviewedAt?:string;reviewedBy?:string;audit:DocumentAudit[]};
export function documentFileInput(value:{filename:unknown;mime:unknown;size:unknown}){
 const filename=String(value.filename??"").trim(),mime=String(value.mime??"");
 if(!filename||filename.length>180||/[\/\\\r\n\0]/.test(filename))throw new Error("Nome de arquivo inválido.");
 if(!Object.hasOwn(DOCUMENT_TYPES,mime))throw new Error("Use PDF, JPG ou PNG.");
 const size=Number(value.size);if(!Number.isSafeInteger(size)||size<=0||size>DOCUMENT_LIMIT)throw new Error("Cada arquivo deve ter até 10 MB.");
 const extension=filename.split(".").at(-1)?.toLowerCase();
 if(!(mime==="application/pdf"?extension==="pdf":mime==="image/png"?extension==="png":["jpg","jpeg"].includes(extension??"")))throw new Error("A extensão não corresponde ao formato informado.");
 return {filename,mime,size,extension:DOCUMENT_TYPES[mime as keyof typeof DOCUMENT_TYPES]};
}
export function fileSignatureMatches(bytes:Uint8Array,mime:string){
 if(mime==="application/pdf")return bytes.length>=5&&new TextDecoder().decode(bytes.slice(0,5))==="%PDF-";
 if(mime==="image/png")return bytes.length>=8&&[137,80,78,71,13,10,26,10].every((byte,index)=>bytes[index]===byte);
 if(mime==="image/jpeg")return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 return false;
}
export function validDocumentDate(value:unknown){
 const date=String(value??"");if(!date)return "";
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error("Validade inválida.");
 return date;
}
export function documentStatus(doc:BiddingDocument,today=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})){
 if(!doc.uploaded)return "Pendente";
 if(doc.validUntil&&doc.validUntil<today)return "Vencido";
 if(doc.review==="rejected")return "Rejeitado";
 if(doc.review==="approved")return "Aprovado";
 return "Recebido • aguardando conferência";
}
export function reviewDocument(doc:BiddingDocument,input:{review:unknown;note:unknown;validUntil:unknown;noExpiry:unknown;identityChecked:unknown;contentChecked:unknown;tenderChecked:unknown},actor:string,now=new Date()){
 if(!doc.uploaded||!doc.sha256)throw new Error("O arquivo real ainda não foi confirmado no servidor.");
 const review=String(input.review);if(!["received","approved","rejected"].includes(review))throw new Error("Situação de conferência inválida.");
 const note=String(input.note??"").trim();if(note.length<5||note.length>2000)throw new Error("Registre uma justificativa de 5 a 2000 caracteres.");
 const validUntil=validDocumentDate(input.validUntil),noExpiry=input.noExpiry===true;
 if(validUntil&&noExpiry)throw new Error("Informe validade ou ausência de vencimento, sem marcar ambos.");
 const today=now.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
 if(review==="approved"){
  if(!input.identityChecked||!input.contentChecked||(doc.tenderId&&!input.tenderChecked))throw new Error("Confirme leitura, identidade da empresa e adequação ao edital antes de aprovar.");
  if(!validUntil&&!noExpiry)throw new Error("Informe a validade ou confirme que este documento não possui vencimento.");
  if(validUntil&&validUntil<today)throw new Error("Documento vencido não pode ser aprovado.");
 }
 if(doc.audit.length>=200)throw new Error("Limite de revisões atingido. Anexe uma nova versão sem apagar o histórico.");
 return {...doc,_revision:doc._revision+1,review:review as ReviewState,reviewNote:note,validUntil,noExpiry,reviewedAt:now.toISOString(),reviewedBy:actor,audit:[...doc.audit,{at:now.toISOString(),actor,action:review,note}]};
}
export function documentChecklist(documents:BiddingDocument[],tenderId:string,today?:string){
 const scoped=documents.filter(doc=>tenderId?doc.tenderId===tenderId:!doc.tenderId);
 return DOCUMENT_CATEGORIES.filter(category=>category!=="Outros").map(category=>({category,received:scoped.filter(doc=>doc.category===category&&doc.uploaded).length,approved:scoped.some(doc=>doc.category===category&&documentStatus(doc,today)==="Aprovado")}));
}
