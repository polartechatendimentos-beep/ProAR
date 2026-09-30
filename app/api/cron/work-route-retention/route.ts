import {NextRequest,NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {supabaseRest} from "../../../../lib/supabase-rest";
import {resolveTenantDb} from "../../../../lib/tenant-rest";
import {routeRest} from "../../../../lib/work-route-store";
import {routeCompanyPrefix,workDate,type RouteDay} from "../../../../lib/work-routes";
export const runtime="nodejs";
export async function GET(request:NextRequest){
 const expected=Buffer.from(`Bearer ${process.env.CRON_SECRET||""}`), actual=Buffer.from(request.headers.get("authorization")||"");
 if(!process.env.CRON_SECRET||expected.length!==actual.length||!timingSafeEqual(expected,actual))return NextResponse.json({error:"Não autorizado."},{status:401});
 try{
 const companiesResponse=await supabaseRest("proar_companies?select=id&limit=1000");if(!companiesResponse.ok)throw new Error("Empresas indisponíveis");
 const companies=new Set<string>((await companiesResponse.json()).map((company:{id:string})=>company.id));companies.add(process.env.PROAR_PRIMARY_COMPANY_ID||"polartech-principal");
 const cutoff=workDate(new Date(Date.now()-90*86400000).toISOString());let removed=0;
 for(const company of companies){const db=await resolveTenantDb(company);if(!db.url||!db.key)continue;const prefix=routeCompanyPrefix(company);const response=await routeRest(db,`proar_state?id=like.${encodeURIComponent(prefix+"*")}&id=lt.${encodeURIComponent(prefix+cutoff+":")}&select=id,payload&limit=1000`);if(!response.ok)throw new Error("Falha na consulta de retenção");
 for(const row of await response.json() as {id:string;payload:RouteDay}[]){if(!row.id.startsWith(prefix)||row.payload.companyId!==company||row.payload.date>=cutoff)continue;
 const deleted=await routeRest(db,`proar_state?id=eq.${encodeURIComponent(row.id)}&payload->>_revision=eq.${row.payload._revision}`,{method:"DELETE"});if(!deleted.ok)throw new Error("Falha na retenção");removed++;}}
 return NextResponse.json({removed,retentionDays:90},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Retenção não concluída."},{status:503});}
}
