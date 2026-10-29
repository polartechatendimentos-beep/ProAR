/** Prefer the explicit enrollment deadline over the opening/session date. */
export function municipalTenderDate(text:string){
 const patterns=[
  /Encerramento(?:\s+(?:do|de)\s+(?:recebimento|propostas))?\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})\s*(?:[aà]s\s*)?(\d{2})[:hH](\d{2})?/i,
  /Realiza[cç][aã]o(?:\s+em)?\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})\s*(?:[aà]s\s*)?(\d{2})[:hH](\d{2})?/i
 ];
 for(const pattern of patterns){
  const m=text.match(pattern);if(!m)continue;
  const minute=m[5]??"00",day=Number(m[1]),month=Number(m[2]),year=Number(m[3]);
  if(Number(m[4])>23||Number(minute)>59)return undefined;
  const calendar=new Date(Date.UTC(year,month-1,day));
  if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day)return undefined;
  return new Date(m[3]+"-"+m[2]+"-"+m[1]+"T"+m[4]+":"+minute+":00-03:00").toISOString();
 }
 return undefined;
}
