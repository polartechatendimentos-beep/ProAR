export type TenderStatusInput = { validationStatus?: string; dataEncerramentoProposta?: string; situacaoCompraNome?:string; situacaoNome?:string; status?:string };
export type TenderSituation = "aberta" | "prazo_encerrado" | "suspensa" | "cancelada" | "concluida" | "validacao";
const normalize=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
/** Distinguish proposal deadlines from official lifecycle. A passed deadline is not homologation. */
export function tenderSituation(t:TenderStatusInput,now:Date=new Date()):TenderSituation {
 const source=normalize(t.situacaoCompraNome||t.situacaoNome||t.status);
 if(/cancelad|anulad|revogad/.test(source))return "cancelada";
 if(/suspens/.test(source))return "suspensa";
 if(/homologad|adjudicad|concluid|finalizad/.test(source))return "concluida";
 const raw=t.dataEncerramentoProposta;
 if(typeof raw!=="string"||!raw.trim())return "validacao";
 const time=Date.parse(raw);
 if(!Number.isFinite(time))return "validacao";
 return time<now.getTime()?"prazo_encerrado":t.validationStatus==="history"?"validacao":"aberta";
}
/** Compare two snapshots; official re-opening requires the source to confirm the newer deadline. */
export function tenderDeadlineExtended(previous:TenderStatusInput,current:TenderStatusInput):boolean {
 const old=Date.parse(previous.dataEncerramentoProposta||"");
 const next=Date.parse(current.dataEncerramentoProposta||"");
 return Number.isFinite(old)&&Number.isFinite(next)&&next>old;
}
