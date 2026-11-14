import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { get } from "@vercel/blob";
import { gunzipSync } from "node:zlib";
import * as https from "node:https";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { validateFiscalPayload } from "../../../../lib/fiscal-validation";
import { databaseFetch } from "../../../../lib/supabase-rest";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";

export const runtime = "nodejs";
const LEGACY_STORAGE_PATH = "proar/configuracao-fiscal.enc";
const storagePath = (companyId:string) => `proar/fiscal/${createHash("sha256").update(companyId).digest("hex").slice(0,24)}/configuracao-fiscal.enc`;
const recordId = (companyId:string) => `fiscal-config:${createHash("sha256").update(companyId).digest("hex").slice(0,24)}`;

type FiscalRecord = {company?:Record<string,string|boolean>;nfse?:Record<string,string|boolean>;certificate?:{pfxBase64:string;password:string;validTo:string;document:string}};
function decryptRecord(value:string):FiscalRecord{
 const secret=process.env.PROAR_FISCAL_ENCRYPTION_KEY??process.env.PROAR_TENANT_MASTER_KEY??"";
 if(secret.length<32)throw new Error("STORAGE_NOT_CONFIGURED");
 const payload=JSON.parse(value) as {iv:string;tag:string;data:string};
 const decipher=createDecipheriv("aes-256-gcm",createHash("sha256").update(secret).digest(),Buffer.from(payload.iv,"base64"));
 decipher.setAuthTag(Buffer.from(payload.tag,"base64"));
 return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.data,"base64")),decipher.final()]).toString("utf8")) as FiscalRecord;
}
async function loadFiscal(companyId:string):Promise<FiscalRecord>{
 if(process.env.BLOB_READ_WRITE_TOKEN){try{
  let blob=await get(storagePath(companyId),{access:"private",token:process.env.BLOB_READ_WRITE_TOKEN});
  if(!blob&&process.env.PROAR_LEGACY_FISCAL_COMPANY_ID===companyId)blob=await get(LEGACY_STORAGE_PATH,{access:"private",token:process.env.BLOB_READ_WRITE_TOKEN});
  if(blob?.statusCode===200&&blob.stream)return decryptRecord(await new Response(blob.stream).text());
 }catch(error){console.warn("Fiscal configuration Blob read failed; checking tenant database.",error);}}
 const db=await resolveTenantDb(companyId);if(!db.url||!db.key)throw new Error("STORAGE_NOT_CONFIGURED");
 const response=await databaseFetch(`${db.url}/rest/v1/proar_state?select=payload&id=eq.${encodeURIComponent(recordId(companyId))}&limit=1`,{headers:tenantHeaders(db.key),cache:"no-store"});
 if(!response.ok)throw new Error("STORAGE_READ_FAILED");
 const rows=await response.json() as {payload?:{encrypted?:string}}[];
 const encrypted=rows[0]?.payload?.encrypted;if(!encrypted)throw new Error("FISCAL_CONFIG_NOT_FOUND");
 return decryptRecord(encrypted);
}
function nationalPost(hostname:string,pfx:Buffer,passphrase:string,body:string):Promise<{status:number;data:unknown}>{
 return new Promise((resolve,reject)=>{const req=https.request({hostname,path:"/SefinNacional/nfse",method:"POST",pfx,passphrase,headers:{"Content-Type":"application/json","Accept":"application/json","Content-Length":Buffer.byteLength(body)},timeout:30000},res=>{
  const chunks:Buffer[]=[];let size=0;res.on("data",(chunk:Buffer)=>{size+=chunk.length;if(size>8_000_000){req.destroy(new Error("Resposta da SEFIN Nacional excedeu o limite permitido."));return;}chunks.push(chunk);});
  res.on("end",()=>{const raw=Buffer.concat(chunks).toString("utf8");let data:unknown;try{data=raw?JSON.parse(raw):{};}catch{data={message:raw.slice(0,2000)};}resolve({status:res.statusCode??500,data});});
 });req.on("timeout",()=>req.destroy(new Error("Tempo limite ao transmitir a DPS para a SEFIN Nacional.")));req.on("error",reject);req.end(body);});
}
function decodeXml(value:unknown):string{if(typeof value!=="string"||value.length>8_000_000)return "";try{return gunzipSync(Buffer.from(value,"base64")).toString("utf8");}catch{return "";}}
export async function POST(request:NextRequest){
 const access=requirePermission(request,"fiscal.emitir");if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
 try{
  const body=await request.json();const validation=validateFiscalPayload({...body,kind:"NFSE"});
  if(!validation.valid)return NextResponse.json({error:"Pré-validação fiscal reprovada.",validation},{status:422});
  if(!body?.serviceOrderId||!body?.customer?.document||!body?.service?.description||Number(body?.service?.value||0)<=0)return NextResponse.json({error:"Informe OS, CPF/CNPJ do tomador, descrição e valor do serviço."},{status:400});
  const dpsXmlGZipB64=String(body?.dpsXmlGZipB64||"");
  if(!dpsXmlGZipB64||dpsXmlGZipB64.length>5_000_000)return NextResponse.json({error:"A emissão municipal foi desativada. A SEFIN Nacional exige DPS completa, validada no XSD vigente e assinada digitalmente. Nenhuma nota foi enviada."},{status:422});
  const fiscal=await loadFiscal(access.session.companyId);const certificate=fiscal.certificate;
  if(!certificate?.pfxBase64||!certificate.password)return NextResponse.json({error:"Cadastre o certificado A1 desta empresa na Configuração Fiscal."},{status:428});
  if(new Date(certificate.validTo).getTime()<=Date.now())return NextResponse.json({error:"O certificado A1 desta empresa está vencido."},{status:422});
  const nfse=fiscal.nfse||{};
  if(!/^\d{7}$/.test(String(fiscal.company?.municipalityCode||""))||!String(nfse.nationalServiceCode||"").trim()||!String(nfse.rpsSeries||"").trim())return NextResponse.json({error:"Complete município IBGE, código nacional do serviço e série DPS na Configuração Fiscal."},{status:422});
  const signedXml=decodeXml(dpsXmlGZipB64);
  if(!signedXml.includes("<DPS")||!signedXml.includes("<Signature")||!signedXml.includes("<infDPS"))return NextResponse.json({error:"O documento compactado não contém uma DPS XML assinada."},{status:422});
  const production=String(fiscal.company?.environment||"Homologação")==="Produção";
  const response=await nationalPost(production?"sefin.nfse.gov.br":"sefin.producaorestrita.nfse.gov.br",Buffer.from(certificate.pfxBase64,"base64"),certificate.password,JSON.stringify({dpsXmlGZipB64}));
  const result=response.data as Record<string,unknown>;
  if(response.status<200||response.status>=300)return NextResponse.json({issued:false,status:"Rejeitada",error:"A SEFIN Nacional rejeitou a DPS.",details:result},{status:422});
  const nfseXml=decodeXml(result?.nfseXmlGZipB64);const key=String(result?.chaveAcesso||result?.chNFSe||result?.key||"");
  if(!nfseXml||!key)return NextResponse.json({issued:false,status:"Rejeitada",error:"A SEFIN respondeu sem XML da NFS-e e chave de acesso. Nota não marcada como autorizada.",details:result},{status:502});
  return NextResponse.json({issued:true,status:"Autorizada",provider:"SEFIN Nacional",environment:production?"Produção":"Homologação",key,nfseXmlGZipB64:result.nfseXmlGZipB64});
 }catch(error){const e=error as Error;if(e.message==="STORAGE_NOT_CONFIGURED")return NextResponse.json({error:"Cofre fiscal indisponível. Configure a chave de criptografia."},{status:503});if(e.message==="FISCAL_CONFIG_NOT_FOUND")return NextResponse.json({error:"Salve primeiro a configuração fiscal desta empresa."},{status:422});console.error("SEFIN Nacional NFS-e emission failed",error);return NextResponse.json({error:e.message||"Falha ao transmitir DPS para a SEFIN Nacional."},{status:502});}
}
