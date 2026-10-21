/** Reviewed public sources. A vendor name never implies municipality coverage. */
export const REGIONAL_PRIORITIES=[
 {name:'PNCP',layer:'Publicação nacional',priority:1},
 {name:'Fiorilli',layer:'Sistema publicador / transparência',priority:2},
 {name:'BLL Compras',layer:'Plataforma de disputa',priority:3},
 {name:'Betha',layer:'Sistema publicador / transparência',priority:4},
 {name:'Compras.gov.br',layer:'Plataforma de disputa',priority:5},
 {name:'Licitações-e',layer:'Plataforma de disputa',priority:6},
 {name:'BEC-SP',layer:'Plataforma de disputa',priority:7},
 {name:'IPM / Atende.net',layer:'Sistema publicador / transparência',priority:8},
 {name:'Equiplano / Aspec / SMARAPD',layer:'Sistema publicador / transparência',priority:9},
] as const;
export const FIORILLI_SOURCES=[{
 id:'ibira-prefeitura',city:'Ibirá',uf:'SP',ibge:'3519402',entity:'1',
 base:'https://transparencia.ibira.sp.gov.br/transparencia/',
 evidence:'https://transparencia.ibira.sp.gov.br/transparencia/versaoJson/DadosAbertos/',
 verifiedAt:'2026-10-21',
}] as const;
export type FiorilliSource=typeof FIORILLI_SOURCES[number];
export function publicationSystem(name:unknown):string|undefined{
 const text=String(name??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/\bfiorilli\b/.test(text))return 'Fiorilli';
 if(/\bbetha\b/.test(text))return 'Betha';
 if(/\bipm\b|atende\.net/.test(text))return 'IPM / Atende.net';
 if(/\bequiplano\b/.test(text))return 'Equiplano';
 if(/\baspec\b/.test(text))return 'Aspec';
 if(/\bsmarapd\b/.test(text))return 'SMARAPD';
 return undefined;
}

export function disputePlatformFromUrl(value:unknown):string|undefined{
 let host='';try{host=new URL(String(value??'')).hostname.toLowerCase().replace(/^www\./,'');}catch{return undefined;}
 for(const [domain,name] of [['bllcompras.com','BLL Compras'],['compras.gov.br','Compras.gov.br'],['comprasnet.gov.br','Compras.gov.br'],['licitacoes-e.com.br','Licitações-e'],['bec.sp.gov.br','BEC-SP']])if(host===domain||host.endsWith(`.${domain}`))return name;
 return undefined;
}
