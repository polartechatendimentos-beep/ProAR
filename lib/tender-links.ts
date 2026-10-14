export type TenderIdentity = {linkSistemaOrigem?:string; numeroControlePNCP?:string; anoCompra?:number; sequencialCompra?:number; orgaoEntidade?:{cnpj?:string;razaoSocial?:string}; objetoCompra?:string};
const hosts = new Set(['bllcompras.com','pncp.gov.br','compras.gov.br','gov.br','bec.sp.gov.br','portaldecompraspublicas.com.br','licitacoes-e.com.br']);
export function safeTenderOrigin(value?:string) {
 try { const u=new URL(value||''); const host=u.hostname.replace(/^www\./,''); if(u.protocol!=='https:' || u.username || u.password || u.port || !hosts.has(host))return '';return u.href; }catch{return '';}
}
export function tenderPncpLink(t:TenderIdentity) {
 let cnpj=t.orgaoEntidade?.cnpj?.replace(/\D/g,'')||'',year=t.anoCompra,sequence=t.sequencialCompra;
 const m=t.numeroControlePNCP?.match(/^(\d{14})-1-(\d+)\/(\d{4})$/);
 if(m){cnpj=m[1];sequence=Number(m[2]);year=Number(m[3]);}
 return /^\d{14}$/.test(cnpj) && Number.isInteger(year) && Number(year)>=2000 && Number(year)<=2100 && Number.isSafeInteger(sequence) && Number(sequence)>0 ? `https://pncp.gov.br/app/editais/${cnpj}/${year}/${sequence}` : '';
}
export function tenderPncpSearch(t:TenderIdentity) {return `https://pncp.gov.br/app/editais?q=${encodeURIComponent(t.numeroControlePNCP||t.orgaoEntidade?.razaoSocial||t.objetoCompra||'')}`;}
export function importedTenderId(url:string) {let hash=2166136261;for(const ch of url)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;return `LIC-LINK-${hash.toString(16)}`;}
