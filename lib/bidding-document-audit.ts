import type {DocumentCategory} from "./bidding-documents.ts";
export type ExtractionEvidence={source:"pdf_text"|"ocr"|"mixed"|"unreadable";pagesRead:number;totalPages:number;partial:boolean;confidence?:number;warnings:string[]};
export type DocumentAuditReport={version:1;at:string;sha256:string;textHash:string;suggestedCategory:DocumentCategory;categoryEvidence:string[];cnpjs:string[];expectedCnpj:string;companyCheck:"matched"|"divergent"|"not_identified";expiryCandidates:{date:string;evidence:string;expired:boolean}[];checks:{label:string;status:"identified"|"attention"|"pending";detail:string}[];extraction:ExtractionEvidence;requiresHumanReview:true};
const normalized=(text:string)=>text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ");
export function validNumericCnpj(value:string){
 const n=value.replace(/\D/g,"");if(n.length!==14||/^(\d)\1+$/.test(n))return false;
 const digit=(base:string)=>{let weight=base.length-7,sum=0;for(const char of base){sum+=Number(char)*weight--;if(weight===1)weight=9;}const mod=sum%11;return mod<2?"0":String(11-mod);};
 return digit(n.slice(0,12))===n[12]&&digit(n.slice(0,13))===n[13];
}
export function extractedCnpjs(text:string){
 const matches=text.match(/\b(?:\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})\b/g)||[];
 return [...new Set(matches.map(value=>value.replace(/\D/g,"")).filter(validNumericCnpj))].slice(0,30);
}
export function suggestedDocumentCategory(text:string):{category:DocumentCategory;evidence:string[]}{
 const t=normalized(text),matches:{category:DocumentCategory;reason:string}[]=[];
 const add=(category:DocumentCategory,test:boolean,reason:string)=>{if(test)matches.push({category,reason});};
 add("FGTS",/certificado de regularidade.{0,40}fgts|regularidade do fgts|\bcrf\b.{0,50}\bfgts\b/.test(t),"Referência a certificado de regularidade do FGTS");
 add("Trabalhista",/certidao negativa de debitos trabalhistas|\bcndt\b/.test(t),"Referência a CNDT ou débitos trabalhistas");
 add("CND Federal",/tributos federais|divida ativa da uniao|receita federal.{0,80}procuradoria geral/.test(t),"Referência a tributos federais ou dívida ativa da União");
 add("CND Estadual",/certidao.{0,100}(?:debitos|tributos).{0,70}estadua|fazenda.{0,25}estadual|divida ativa.{0,30}estado/.test(t),"Referência a certidão/fazenda estadual");
 add("CND Municipal",/certidao.{0,100}(?:debitos|tributos).{0,70}municipa|fazenda.{0,25}municipal|divida ativa.{0,30}municip/.test(t),"Referência a certidão/fazenda municipal");
 add("CREA / CFT",/conselho regional de engenharia|conselho federal dos tecnicos|certidao de registro.{0,50}\bcrea\b/.test(t),"Referência ao conselho profissional");
 add("ART",/anotacao de responsabilidade tecnica|\bart\b.{0,30}numero/.test(t),"Referência à Anotação de Responsabilidade Técnica");
 add("Atestado técnico",/atestado de capacidade tecnica|atestamos.{0,100}(?:servicos|executou|prestou)/.test(t),"Referência a atestado de capacidade ou execução");
 return {category:matches.length===1?matches[0].category:"Outros",evidence:matches.map(match=>match.reason)};
}
export function expiryDates(text:string,today:string){
 const result:{date:string;evidence:string;expired:boolean}[]=[];
 const t=normalized(text);
 const pattern=/(?:valid[ao] ate|validade(?:\s+(?:ate|em))?|vencimento|data de validade)\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/g;
 for(const match of t.matchAll(pattern)){
  const date=match[3]+"-"+match[2]+"-"+match[1],d=new Date(date);
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)continue;
  if(!result.some(item=>item.date===date))result.push({date,evidence:text.slice(Math.max(0,match.index-30),match.index+match[0].length+30).slice(0,200),expired:date<today});
 }
 return result.slice(0,10);
}
export function validateExtraction(value:unknown):ExtractionEvidence{
 if(!value||typeof value!=="object")throw new Error("Dados de extração inválidos.");
 const v=value as Record<string,unknown>,pagesRead=Number(v.pagesRead),totalPages=Number(v.totalPages),confidence=v.confidence===undefined?undefined:Number(v.confidence);
 if(!["pdf_text","ocr","mixed","unreadable"].includes(String(v.source))||!Number.isSafeInteger(pagesRead)||!Number.isSafeInteger(totalPages)||pagesRead<0||totalPages<1||pagesRead>totalPages||totalPages>100000||pagesRead>40)throw new Error("Contagem de páginas inválida.");
 if(confidence!==undefined&&(!Number.isFinite(confidence)||confidence<0||confidence>100))throw new Error("Confiança de OCR inválida.");
 const warnings=Array.isArray(v.warnings)?v.warnings.slice(0,20).map(text=>String(text).slice(0,300)):[];
 return {source:v.source as ExtractionEvidence["source"],pagesRead,totalPages,partial:v.partial===true||pagesRead<totalPages,confidence,warnings};
}
export function buildDocumentAudit({text,expectedCnpj,sha256,textHash,extraction,now=new Date()}:{text:string;expectedCnpj:string;sha256:string;textHash:string;extraction:ExtractionEvidence;now?:Date}):DocumentAuditReport{
 if(text.length>250000)throw new Error("Texto extraído excede o limite.");
 const normalizedText=normalized(text),cnpjs=extractedCnpjs(text),expected=expectedCnpj.replace(/\D/g,""),category=suggestedDocumentCategory(text);
 const companyCheck=expected.length===14&&cnpjs.length?cnpjs.includes(expected)?"matched":"divergent":"not_identified";
 const today=now.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"}),expiryCandidates=expiryDates(text,today);
 const checks:DocumentAuditReport["checks"]=[
  {label:"Leitura do arquivo",status:text.trim().length>=40&&!extraction.partial?"identified":"attention",detail:extraction.pagesRead+"/"+extraction.totalPages+" página(s) analisada(s). "+(text.trim().length<40?"Texto insuficiente para auditoria de conteúdo.":extraction.partial?"Leitura parcial: revisar as páginas restantes.":"Texto extraído para triagem.")},
  {label:"Tipo provável",status:category.category!=="Outros"?"identified":"attention",detail:category.category!=="Outros"?category.category:category.evidence.length>1?"Mais de um tipo identificado; pode haver documentos reunidos no mesmo PDF.":"Não foi possível classificar pelo conteúdo."},
  {label:"Empresa no conteúdo",status:companyCheck==="matched"?"identified":companyCheck==="divergent"?"attention":"pending",detail:companyCheck==="matched"?"CNPJ cadastrado encontrado no texto. Conferir o titular no original.":companyCheck==="divergent"?"CNPJ(s) encontrado(s) sem correspondência ao cadastro da empresa.":"Identidade não confirmada pelo texto ou cadastro disponível."},
  {label:"Validade extraída",status:expiryCandidates.some(date=>date.expired)||expiryCandidates.length>1?"attention":expiryCandidates.length===1?"identified":"pending",detail:expiryCandidates.length?expiryCandidates.map(date=>date.date+(date.expired?" • possível vencimento":"")).join("; "):"Não foi encontrada uma data de validade inequívoca. Não será presumida."},
  {label:"Autenticidade e assinatura",status:"pending",detail:"Conferir no emissor, QR/link de autenticidade e assinatura digital. A leitura automática não comprova autenticidade."},
  {label:"Exigências do edital",status:"pending",detail:"Conferir abrangência, titularidade, acervo e critérios do edital antes de aprovar."}
 ];
 if(/positiva|restricao|irregular|suspens/.test(normalizedText))checks.push({label:"Termos que exigem leitura",status:"attention",detail:"O texto contém termos como positiva, restrição, irregularidade ou suspensão. O contexto deve ser revisado; não constitui rejeição automática."});
 if(extraction.confidence!==undefined&&extraction.confidence<75)checks.push({label:"Qualidade de OCR",status:"attention",detail:"Confiança média abaixo de 75%; confira números e datas no original."});
 return {version:1,at:now.toISOString(),sha256,textHash,suggestedCategory:category.category,categoryEvidence:category.evidence,cnpjs,expectedCnpj:expected,companyCheck,expiryCandidates,checks,extraction,requiresHumanReview:true};
}
