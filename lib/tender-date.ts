/** Only a stated time is accepted; never invent end-of-day for a session. */
export function municipalTenderDate(text:string) {
 const m=text.match(/(?:Realiza[cç][aã]o|Encerramento)\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})(?:\s*[aà]s\s*(\d{2})[:hH](\d{2}))?/i);
 if(!m || m[4]===undefined || Number(m[4])>23 || Number(m[5])>59)return undefined;
 const date=new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00-03:00`);
 return Number.isFinite(date.getTime())?date.toISOString():undefined;
}
