import { parseAppointmentReply, appointmentSource, appointmentReplyAllowed, type ActionState } from "./chatdesk-actions";
import { resolveTenantDb, tenantHeaders } from "./tenant-rest";
import { databaseFetch, commitNeonOperationalState, PRIMARY_DATABASE_URL } from "./supabase-rest";
import { evolutionJobId } from "./evolution-jobs";
import { prepareOperationalState, independentOperationalRows } from "./operational-ledger";
/** Only a verified webhook may call this. It records confirmation, timeline and the matching agenda status; never changes a slot, cancels or creates records. */
export async function recordAppointmentReply(companyId: string, event: {id:string;phone:string;text:string;at:string}) {
  const reply = parseAppointmentReply(event.text);
  if (!reply) return false;
  const db = await resolveTenantDb(companyId);
  if (!db.url || !db.key) throw new Error("Base indisponível.");
  const headers = tenantHeaders(db.key), id = db.dedicated ? "main" : companyId;
  for (let attempt=0;attempt<3;attempt++) {
    const response = await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload&limit=1`,{headers,cache:"no-store"});
    if (!response.ok) throw new Error("Agenda indisponível.");
    const state = (await response.json())[0]?.payload as ActionState & {_companyId?:string};
    if (!state || state._companyId !== companyId) return false;
    const order = state.serviceOrders.find(row => String(row.id).toUpperCase() === reply.orderId);
    if (!order || order.appointmentReplyMessageId === event.id) return false;
    const jobResponse = await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(evolutionJobId(companyId,appointmentSource(order)))}&select=payload&limit=1`,{headers,cache:"no-store"});
    if (!jobResponse.ok) throw new Error("Histórico indisponível.");
    const job = (await jobResponse.json())[0]?.payload;
    if (job?.companyId !== companyId || !appointmentReplyAllowed(order,state.customers.find(customer=>customer.id===order.customerId),event.phone,event.at,job)) return false;
    // A delayed webhook must never overwrite a newer reply.
    if (Date.parse(String(order.appointmentConfirmedAt || "")) >= Date.parse(event.at)) return false;
    const next = structuredClone(state);
    const updated = next.serviceOrders.find(row=>row.id===order.id)!;
    Object.assign(updated,{appointmentConfirmation:reply.status,appointmentConfirmedAt:event.at,appointmentReplyMessageId:event.id,changeReason:"Resposta do cliente recebida no WhatsApp"});
    const previousStatus = String(updated.status);
    if (reply.status === "Confirmado" && ["Agendada", "Reagendada"].includes(previousStatus)) { updated.status = "Cliente confirmado"; updated.tone = "green"; }
    const timeline = Array.isArray(updated.timeline) ? updated.timeline : [];
    updated.timeline = [...timeline,{id:`wa-confirmation:${event.id}`,createdAt:event.at,previousStatus,status:String(updated.status),technician:String(updated.tech||""),internalNote:`WhatsApp: ${reply.status}. Resposta vinculada ao telefone do cliente.`,customerVisible:false,whatsappQueued:false}];
    const validated = prepareOperationalState(state,next,{username:`whatsapp:••••${event.phone.slice(-4)}`,displayName:"Cliente via WhatsApp",can:permission=>permission==="os.editar"});
    const revision = Number(state._revision || 0);
    const payload = {...validated,_revision:revision+1,_updatedAt:new Date().toISOString(),_companyId:companyId};
    if (db.url === PRIMARY_DATABASE_URL) {
      if (await commitNeonOperationalState(id,revision,payload,independentOperationalRows(companyId,payload,state))) return true;
    } else {
      const filter = state._revision === undefined ? "payload->>_revision=is.null" : `payload->>_revision=eq.${revision}`;
      const committed = await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&${filter}`,{method:"PATCH",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify({payload,updated_at:payload._updatedAt})});
      if(!committed.ok)throw new Error("Não foi possível atualizar a confirmação.");
      if((await committed.json()).length)return true;
    }
  }
  throw new Error("Agenda alterada durante a confirmação. Reprocessamento necessário.");
}
