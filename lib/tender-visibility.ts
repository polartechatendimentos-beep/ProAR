export type TenderDeadline = {dataEncerramentoProposta?:string;validationStatus?:string};
/** Hide expired proposal windows from opportunity queues, without deleting history. */
export function isTenderClosed(tender:TenderDeadline,now:Date=new Date()):boolean {
 if(tender.validationStatus === "history") return true;
 const raw=tender.dataEncerramentoProposta;
 if(typeof raw !== "string" || !raw.trim()) return false;
 const parsed=Date.parse(raw);
 return Number.isFinite(parsed) && parsed < now.getTime();
}
