import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../../lib/permissions";
import { validateFiscalPayload } from "../../../../lib/fiscal-validation";
import { databaseFetch } from "../../../../lib/supabase-rest";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";

export const runtime = "nodejs";

const LEGACY_STORAGE_PATH = "proar/configuracao-fiscal.enc";
const storagePath = (companyId:string) => `proar/fiscal/${createHash("sha256").update(companyId).digest("hex").slice(0,24)}/configuracao-fiscal.enc`;
const recordId = (companyId:string) => `fiscal-config:${createHash("sha256").update(companyId).digest("hex").slice(0,24)}`;

type FiscalRecord = { company?:Record<string,string|boolean>; nfce?:Record<string,string|boolean>; certificate?:{pfxBase64:string;password:string;validTo:string} };
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

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.emitir");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const companyContext=sessionCompany(access.session);
  if(!companyContext.ok)return NextResponse.json({error:"Sessão de empresa inválida."},{status:companyContext.status});
  try {
    const body = await request.json();
    const fiscal=await loadFiscal(companyContext.companyId);
    const nfce=fiscal.nfce||{};
    const csc=String(nfce.csc||"");
    const cscId=String(nfce.cscId||"");
    const validation = validateFiscalPayload({
      ...body,
      kind:"NFCE",
      series:String(body.series||nfce.series||""),
      company:{...body.company,state:String(fiscal.company?.state||"").toUpperCase()},
      config:{csc,cscId,environment:String(fiscal.company?.environment||"Homologação")},
    });
    if (!validation.valid) return NextResponse.json({ error:"Pré-validação fiscal reprovada.", validation }, { status:422 });
    if (!body?.saleId || !Array.isArray(body.items) || !body.items.length || Number(body.total || 0) <= 0) {
      return NextResponse.json({ error: "Venda sem dados fiscais suficientes para NFC-e." }, { status: 400 });
    }
    if(!fiscal.certificate?.pfxBase64||!fiscal.certificate.password)return NextResponse.json({error:"Cadastre o certificado A1 desta empresa na Configuração Fiscal."},{status:428});
    if(new Date(fiscal.certificate.validTo).getTime()<=Date.now())return NextResponse.json({error:"O certificado A1 desta empresa está vencido."},{status:422});

    const providerUrl = process.env.SEFAZ_SP_NFCE_API_URL;
    const providerToken = process.env.SEFAZ_SP_NFCE_API_TOKEN;
    if (!providerUrl || !providerToken) {
      return NextResponse.json({ error: "Emissão NFC-e ainda não habilitada. Configure o adaptador emissor SEFAZ e valide o certificado A1 e o CSC desta empresa." }, { status: 428 });
    }
    const idempotencyKey = String(body.idempotencyKey || createHash("sha256").update(`${companyContext.companyId}:${body.saleId}:${body.total}:${body.series||nfce.series||"1"}`).digest("hex"));
    const response = await fetch(providerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerToken}`, "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        ...body,
        series:String(body.series||nfce.series||"1"),
        config:{csc,cscId,environment:String(fiscal.company?.environment||"Homologação")},
        certificate:{pfxBase64:fiscal.certificate.pfxBase64,password:fiscal.certificate.password},
        model:65,
        state:String(fiscal.company?.state||"").toUpperCase(),
        companyId:companyContext.companyId,
        requestedBy:access.session.username,
        idempotencyKey,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: result?.error || result?.message || "A SEFAZ/provedor não autorizou a NFC-e.", status:"Rejeitada", provider:result }, { status:502 });
    const provider = result?.result ?? result?.data ?? result;
    const cStat = Number(provider?.cStat ?? provider?.statusCode ?? provider?.code ?? 0);
    const statusText = String(provider?.status ?? provider?.situacao ?? provider?.state ?? "").toLocaleLowerCase("pt-BR");
    const accessKey = provider?.accessKey ?? provider?.chave ?? provider?.chNFe ?? provider?.key;
    const protocol = provider?.protocol ?? provider?.protocolo ?? provider?.nProt;
    const authorized = (cStat === 100 || provider?.authorized === true || provider?.autorizada === true || ["autorizada","autorizado","authorized"].includes(statusText)) && Boolean(accessKey) && Boolean(protocol);
    if (!authorized) {
      const processing = ["processando","processing","pendente","pending","recebida","received"].includes(statusText) || [103,105].includes(cStat);
      return NextResponse.json({ issued:false, status:processing ? "Processando" : "Rejeitada", idempotencyKey, provider:result, error:processing ? undefined : "A resposta não contém autorização válida da NFC-e." }, { status:processing ? 202 : 422 });
    }
    return NextResponse.json({ issued:true, status:"Autorizada", idempotencyKey, result });
  } catch(error) {
    const e=error as Error;
    if(e.message==="STORAGE_NOT_CONFIGURED")return NextResponse.json({error:"Cofre fiscal indisponível. Configure a chave de criptografia."},{status:503});
    if(e.message==="FISCAL_CONFIG_NOT_FOUND")return NextResponse.json({error:"Salve a configuração fiscal desta empresa antes de emitir NFC-e."},{status:422});
    console.error("NFC-e emission failed",error);
    return NextResponse.json({error:e.message||"Falha ao transmitir a NFC-e."},{status:502});
  }
}
