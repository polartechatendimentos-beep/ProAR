import { databaseFetch, masterDatabaseConfig } from "../../../lib/supabase-rest";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../lib/permissions";
import {GET as getOperationalState} from "../state/route";
import {publicOrderProjection,safePublicOrderId} from "../../../lib/service-order-public-view";
import {publicOrderStore} from "../../../lib/service-order-public-store";
import type {AccessState} from "../../../lib/state-access";

const config = masterDatabaseConfig;
const headers = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" });
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token || token.length < 20) return NextResponse.json({ error: "Link de acompanhamento inválido." }, { status: 400 });
  const { url, key } = config();
  if (!url || !key) return NextResponse.json({ error: "Base de dados indisponível." }, { status: 503 });
  const response = await databaseFetch(`${url}/rest/v1/proar_state?id=like.osmap-*&select=payload`, { headers: headers(key), cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "Não foi possível carregar o acompanhamento." }, { status: 502 });
  const rows = await response.json() as { payload?: Record<string, unknown> }[];
  const order = rows.find(row => row.payload?.token === token)?.payload;
  return order ? NextResponse.json({ order }) : NextResponse.json({ error: "Link não localizado ou desativado." }, { status: 404 });
}

export async function PUT(request: NextRequest) {
  const respond=(payload:unknown,status=200)=>NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store"}});
  const auth = requirePermission(request, "os.editar");
  if (!auth.ok) return respond({ error: auth.error },auth.status);
  if(request.headers.get("sec-fetch-site")==="cross-site"||(request.headers.get("origin")&&request.headers.get("origin")!==request.nextUrl.origin))return respond({error:"Origem inválida."},403);
  try {
    const raw=await request.text();
    if(raw.length>16_384)return respond({error:"Informe somente o identificador da OS."},413);
    let body;try{body=JSON.parse(raw);}catch{return respond({error:"Solicitação inválida."},400);}
    const orderId=safePublicOrderId(body?.orderId);
    if(!orderId)return respond({error:"Informe uma ordem de serviço válida."},400);
    const scope=sessionCompany(auth.session,body?.companyId);
    if(!scope.ok)return respond({error:scope.error},scope.status);
    const original=await getOperationalState(request);
    const result=await original.json() as {state?:AccessState};
    if(!original.ok||!result.state)return respond({error:"Não foi possível ler a ordem salva."},503);
    const order=result.state.serviceOrders?.find(row=>row.id===orderId);
    if(!order)return respond({error:"A ordem não está disponível para esta sessão."},404);
    const projection=publicOrderProjection(order,scope.companyId);
    if(!projection)return respond({error:"A OS salva não tem link de acompanhamento válido."},409);
    const synced=await (await publicOrderStore()).publish(projection,Number(result.state._revision)||0);
    if(synced.status==="conflict")return respond({error:"Acompanhamento em atualização. Tente conferir novamente."},409);
    return respond({saved:true,status:synced.status});
  }catch{
    return respond({error:"O acompanhamento não foi confirmado. Nenhuma nova gravação da OS foi solicitada."},503);
  }
}
