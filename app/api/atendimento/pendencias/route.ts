import { NextRequest, NextResponse } from "next/server";
import { GET as getOperationalState } from "../../state/route";
import { chatAccess, chatDb, chatPrefix, chatSettings } from "../../../../lib/chatdesk-store";
import { databaseFetch } from "../../../../lib/supabase-rest";
import { tenantHeaders } from "../../../../lib/tenant-rest";
import { dailyActionableDigest, digestDayStart } from "../../../../lib/daily-actionable-digest";
import { operationalPendingCenter } from "../../../../lib/operational-pending-center";
import { publicOrderProjection,publicOrderIsCurrent } from "../../../../lib/service-order-public-view";
import { publicOrderStore } from "../../../../lib/service-order-public-store";
import type { ChatConversation } from "../../../../lib/chatdesk-local";
import type { AccessState } from "../../../../lib/state-access";

export const runtime = "nodejs";
export const maxDuration = 30;
const pageSize = 100;
const maximumPages = 10;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

async function readRecentChats(companyId: string, start: string) {
  const db = await chatDb(companyId);
  const prefix = chatPrefix(companyId);
  const chats: ChatConversation[] = [];
  let after = "";
  for (let page = 0; page < maximumPages; page++) {
    const params = new URLSearchParams({ select: "id,payload", "updated_at": `gte.${start}`, order: "id.asc", limit: String(pageSize + 1) });
    // Cursor pagination is not shifted by updates to unrelated conversation rows.
    params.set("id", `like.${prefix}*`);
    if (after) params.append("id", `gt.${after}`);
    const response = await databaseFetch(`${db.url}/rest/v1/proar_state?${params}`, { headers: tenantHeaders(db.key), cache: "no-store" });
    if (!response.ok) throw new Error("Fila de mensagens indisponível.");
    const rows: { id: string; payload: ChatConversation }[] = await response.json();
    for (const row of rows.slice(0, pageSize)) {
      const phone = row.id.startsWith(prefix) ? row.id.slice(prefix.length) : "";
      if (!/^[1-9]\d{9,14}$/.test(phone) || row.payload?.companyId !== companyId || row.payload?.phone !== phone) throw new Error("Registros da fila inconsistentes.");
      chats.push(row.payload);
      after = row.id;
    }
    if (rows.length <= pageSize) return { chats, complete: true };
  }
  return { chats, complete: false };
}

export async function GET(request: NextRequest) {
  const access = chatAccess(request);
  // All three areas combined are restricted to company administrators.
  // Requiring a company-bearing session also avoids the legacy state GET's recovery write branch.
  if (!access?.actor.admin || !access.session.companyId) return reply({ error: "O fechamento está disponível para administradores da empresa." }, 403);
  try {
    const now = new Date();
    const [stateResponse, recent, settings] = await Promise.all([
      getOperationalState(request),
      readRecentChats(access.companyId, digestDayStart(now)),
      chatSettings(access.companyId),
    ]);
    const result: { state?: AccessState } = await stateResponse.json();
    if (!stateResponse.ok || !result.state) return reply({ error: "Não foi possível conferir orçamento e agenda da empresa." }, 503);
    const state=result.state,orders=state.serviceOrders||[];
    const published=orders.flatMap(order=>{const view=publicOrderProjection(order,access.companyId);return view?[{order,view}]:[];})
      .sort((a,b)=>String(b.order.updatedAt||b.order.fieldUpdatedAt||b.order.date||"").localeCompare(String(a.order.updatedAt||a.order.fieldUpdatedAt||a.order.date||"")));
    const outdatedTracking: typeof orders=[];
    let trackingComplete=published.length<=18;
    try{
      if(published.length){
        const publicStore=await publicOrderStore();
        for(let i=0;i<Math.min(18,published.length);i+=6){
          const checks=await Promise.allSettled(published.slice(i,i+6).map(async ({order,view})=>({order,current:publicOrderIsCurrent(await publicStore.read(access.companyId,view.orderId),view)})));
          for(const check of checks)if(check.status==="rejected")trackingComplete=false;else if(!check.value.current)outdatedTracking.push(check.value.order);
        }
      }
    }catch{trackingComplete=false;}
    const daily=dailyActionableDigest({ ...recent, pilotPhone: settings.botTestPhone, orders, quotes: state.moduleRecords?.["Orçamentos"] || [], sales: state.moduleRecords?.["Vendas"] || [] }, now);
    return reply({...daily,operations:operationalPendingCenter({state,chats:recent.chats,pilotPhone:settings.botTestPhone,outdatedTracking,trackingComplete},now)});
  } catch {
    return reply({ error: "Não foi possível conferir todas as pendências da empresa agora." }, 503);
  }
}
