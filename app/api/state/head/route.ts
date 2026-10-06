import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../../lib/proar-auth";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";
import { databaseFetch } from "../../../../lib/supabase-rest";

const safe=(value:unknown)=>String(value||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
const PRIMARY_COMPANY_ID=safe(process.env.PROAR_PRIMARY_COMPANY_ID||"polartech-principal")||"polartech-principal";
const PRIMARY_COMPANY_SLUG=String(process.env.PROAR_PRIMARY_COMPANY_SLUG||"polartech").trim().toLowerCase();

function companyKey(session:ReturnType<typeof readSession>){
  if(String(session?.companySlug||"").trim().toLowerCase()===PRIMARY_COMPANY_SLUG)return PRIMARY_COMPANY_ID;
  if(session?.companyId===PRIMARY_COMPANY_ID)return PRIMARY_COMPANY_ID;
  return session?.companyId||PRIMARY_COMPANY_ID;
}

function failure(error:unknown){
  const message=error instanceof Error?error.message:String(error||"");
  return /quota|exceeded|http status 402|\b402\b/i.test(message)
    ? {code:"DATABASE_QUOTA_EXCEEDED",error:"Banco online temporariamente indisponível por limite do provedor."}
    : {code:"DATABASE_UNAVAILABLE",error:"Banco online indisponível."};
}

export async function GET(request:NextRequest){
  const session=readSession(request.cookies.get("proar_session")?.value);
  if(!session)return NextResponse.json({error:"Sessão inválida."},{status:401});
  try{
    const company=companyKey(session);
    const db=await resolveTenantDb(company);
    if(!db.url||!db.key)throw new Error("Banco indisponível");
    const ids=db.dedicated
      ? ["main"]
      : company===PRIMARY_COMPANY_ID
        ? [company,"main","polartech"]
        : [company];
    const values:{id:string;updated_at?:string}[]=[];
    for(const id of ids){
      const response=await databaseFetch(
        `${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=id,updated_at`,
        {headers:tenantHeaders(db.key),cache:"no-store"},
      );
      if(!response.ok)continue;
      const rows=await response.json() as {id:string;updated_at?:string}[];
      values.push(...rows);
    }
    const updatedAt=values.map(row=>String(row.updated_at||"")).filter(Boolean).sort((a,b)=>new Date(b).getTime()-new Date(a).getTime())[0]||"";
    return NextResponse.json({ok:true,companyId:company,updatedAt,dedicatedDatabase:db.dedicated},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    const result=failure(error);
    return NextResponse.json({...result,ok:false},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
