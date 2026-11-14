import { createDecipheriv, createHash } from "node:crypto";
import { get } from "@vercel/blob";
import https from "node:https";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../../../lib/permissions";
import { databaseFetch } from "../../../../../lib/supabase-rest";
import { resolveTenantDb, tenantHeaders } from "../../../../../lib/tenant-rest";

export const runtime = "nodejs";
const LEGACY_STORAGE_PATH = "proar/configuracao-fiscal.enc";
const storagePath = (companyId: string) => `proar/fiscal/${createHash("sha256").update(companyId).digest("hex").slice(0, 24)}/configuracao-fiscal.enc`;
const recordId = (companyId: string) => `fiscal-config:${createHash("sha256").update(companyId).digest("hex").slice(0,24)}`;

function decrypt(value: string) {
  const secret = process.env.PROAR_FISCAL_ENCRYPTION_KEY ?? process.env.PROAR_TENANT_MASTER_KEY ?? "";
  if (secret.length < 32) throw new Error("STORAGE_NOT_CONFIGURED");
  const key = createHash("sha256").update(secret).digest();
  const payload = JSON.parse(value) as {iv:string;tag:string;data:string};
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv,"base64"));
  decipher.setAuthTag(Buffer.from(payload.tag,"base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.data,"base64")),decipher.final()]).toString("utf8")) as {
    company?:Record<string,string|boolean>;nfse?:Record<string,string|boolean>;
    certificate?:{pfxBase64:string;password:string;validTo:string};
  };
}

async function loadFiscal(companyId:string) {
  if(process.env.BLOB_READ_WRITE_TOKEN){
    try{
      let blob=await get(storagePath(companyId),{access:"private",token:process.env.BLOB_READ_WRITE_TOKEN});
      if(!blob&&process.env.PROAR_LEGACY_FISCAL_COMPANY_ID===companyId) blob=await get(LEGACY_STORAGE_PATH,{access:"private",token:process.env.BLOB_READ_WRITE_TOKEN});
      if(blob?.statusCode===200&&blob.stream)return decrypt(await new Response(blob.stream).text());
    }catch(error){console.warn("National NFS-e configuration Blob read failed; checking tenant database.",error);}
  }
  const db=await resolveTenantDb(companyId); if(!db.url||!db.key)throw new Error("STORAGE_NOT_CONFIGURED");
  const response=await databaseFetch(`${db.url}/rest/v1/proar_state?select=payload&id=eq.${encodeURIComponent(recordId(companyId))}&limit=1`,{headers:tenantHeaders(db.key),cache:"no-store"});
  if(!response.ok)throw new Error("STORAGE_READ_FAILED");
  const rows=await response.json() as {payload?:{encrypted?:string}}[];
  if(!rows[0]?.payload?.encrypted)throw new Error("FISCAL_CONFIG_NOT_FOUND");
  return decrypt(rows[0].payload.encrypted);
}

function nationalGet(hostname:string,path:string,pfx:Buffer,passphrase:string):Promise<unknown>{
  return new Promise((resolve,reject)=>{
    const req=https.request({hostname,path,method:"GET",pfx,passphrase,headers:{Accept:"application/json"},timeout:20000},res=>{
      const chunks:Buffer[]=[];let size=0;
      res.on("data",(chunk:Buffer)=>{size+=chunk.length;if(size>1_000_000){req.destroy(new Error("Resposta fiscal excedeu 1 MB."));return;}chunks.push(chunk);});
      res.on("end",()=>{const raw=Buffer.concat(chunks).toString("utf8");let data:unknown;try{data=raw?JSON.parse(raw):{};}catch{data={message:raw.slice(0,1000)};}
        if((res.statusCode??500)>=400)reject(Object.assign(new Error("SEFIN_REJECTED"),{status:res.statusCode,data}));else resolve(data);});
    });
    req.on("timeout",()=>req.destroy(new Error("Tempo limite ao consultar a SEFIN Nacional.")));
    req.on("error",reject);req.end();
  });
}

export async function GET(request:NextRequest){
  const access=requirePermission(request,"fiscal.consultar");
  if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
  const context=sessionCompany(access.session);
  if(!context.ok)return NextResponse.json({error:"Sessão de empresa inválida."},{status:context.status});
  try{
    const fiscal=await loadFiscal(context.companyId);
    const municipality=String(fiscal.company?.municipalityCode||"").replace(/\D/g,"");
    const serviceCode=String(fiscal.nfse?.serviceCode||"").trim();
    if(!/^\d{7}$/.test(municipality))return NextResponse.json({error:"Informe o código IBGE de 7 dígitos do município na configuração fiscal."},{status:422});
    if(!fiscal.certificate?.pfxBase64||!fiscal.certificate.password)return NextResponse.json({error:"Cadastre o certificado A1 da empresa na configuração fiscal."},{status:422});
    const production=String(fiscal.company?.environment||"Homologação")==="Produção";
    const hostname=production?"sefin.nfse.gov.br":"sefin.producaorestrita.nfse.gov.br";
    const base="/SefinNacional";
    const pfx=Buffer.from(fiscal.certificate.pfxBase64,"base64");
    const convenio=await nationalGet(hostname,`${base}/parametros_municipais/${municipality}/convenio`,pfx,fiscal.certificate.password);
    const service=serviceCode?await nationalGet(hostname,`${base}/parametros_municipais/${municipality}/${encodeURIComponent(serviceCode)}`,pfx,fiscal.certificate.password):null;
    return NextResponse.json({ok:true,environment:production?"Produção":"Homologação",municipalityCode:municipality,convenio,service,checkedAt:new Date().toISOString()});
  }catch(error){
    const e=error as Error&{status?:number;data?:unknown};
    if(e.message==="STORAGE_NOT_CONFIGURED")return NextResponse.json({error:"Cofre fiscal indisponível. Configure a chave de criptografia."},{status:503});
    if(e.message==="FISCAL_CONFIG_NOT_FOUND")return NextResponse.json({error:"Salve primeiro a configuração fiscal desta empresa."},{status:422});
    if(e.message==="SEFIN_REJECTED")return NextResponse.json({error:"A SEFIN Nacional rejeitou a consulta de parâmetros.",details:e.data},{status:e.status||502});
    console.error("National NFS-e parameter lookup failed",error);
    return NextResponse.json({error:e.message||"Não foi possível consultar os parâmetros municipais da SEFIN Nacional."},{status:502});
  }
}
