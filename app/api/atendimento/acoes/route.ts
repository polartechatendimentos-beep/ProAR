import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { GET as getState, PUT as putState } from "../../state/route";
import { chatAccess } from "../../../../lib/chatdesk-store";
import { hasPermission } from "../../../../lib/permissions";
import { requiredSecret } from "../../../../lib/security-env";
import { parseDeskAction, prepareDeskAction, appointmentSource, type ActionState } from "../../../../lib/chatdesk-actions";
import { assertActiveWhatsAppCompany } from "../../../../lib/evolution-tenant";
import { dispatchEvolutionJob } from "../../../../lib/evolution-jobs";
export const runtime = "nodejs";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sign = (value: string) => createHmac("sha256", requiredSecret("PROAR_SESSION_SECRET")).update(`desk-action:${value}`).digest("hex");
async function operationalState(request: NextRequest) {
  const response = await getState(request);
  const data = await response.json();
  if (!response.ok || !data.state) throw new Error(data.error || "Base operacional indisponível.");
  return data.state as ActionState;
}
function actionPermission(access: NonNullable<ReturnType<typeof chatAccess>>, kind: string) {
  const permissions = kind === "customer" ? ["clientes.visualizar", "clientes.editar"] as const : ["os.visualizar", "os.editar", "clientes.visualizar"] as const;
  if (!permissions.every(permission => hasPermission(access.session, permission))) throw new Error("Seu perfil não permite esta ação no sistema.");
  // Scoped technicians cannot check the complete team calendar for overlapping bookings.
  if (kind === "schedule" && /^(técnico|tecnico|prestador)/i.test(access.session.role)) throw new Error("Peça ao responsável pela agenda para distribuir este atendimento.");
}
export async function GET(request: NextRequest) {
  const access = chatAccess(request);
  if (!access) return reply({ error: "Entre com um usuário autorizado." }, 403);
  try {
    await assertActiveWhatsAppCompany(access.companyId);
    const state = await operationalState(request);
    const query = String(request.nextUrl.searchParams.get("q") || "").trim().toLocaleLowerCase("pt-BR").slice(0,100);
    const modules = Object.entries(state.moduleRecords || {}).map(([module, rows]) => ({ module, count: rows.length }));
    const matches = (row: Record<string,unknown>) => !query || [row.id,row.name,row.client,row.phone,row.service,row.date].some(value => String(value || "").toLocaleLowerCase("pt-BR").includes(query));
    const customers = state.customers.filter(matches).slice(0,30).map(row => ({ id: row.id, name: row.name, phone: row.phone, address: row.address }));
    const orders = state.serviceOrders.filter(matches).slice(0,50).map(row => ({ id: row.id, client: row.client, service: row.service, date: row.date, time: row.time, tech: row.tech, status: row.status, confirmation: row.appointmentConfirmation || "Pendente" }));
    const technicians = (state.moduleRecords["Funcionários"] || []).filter(row => !/inativ/i.test(String(row.status))).map(row => ({ id: row.id, name: row.name || row.employeeName || row.id }));
    const requestedModule = String(request.nextUrl.searchParams.get("module") || "");
    const moduleRows = requestedModule && Object.hasOwn(state.moduleRecords,requestedModule) ? state.moduleRecords[requestedModule] : [];
    const records = moduleRows.filter(row => !query || [row.id,row.name,row.client,row.description,row.status,row.date].some(value=>String(value||"").toLocaleLowerCase("pt-BR").includes(query))).slice(0,50).map(row=>({id:row.id,name:row.name||row.description||row.client||row.id,client:row.client,status:row.status,date:row.date}));
    return reply({ modules, customers, orders, technicians, records, limited: true, mode: "local-guided", capabilities: { customer: hasPermission(access.session,"clientes.editar") && hasPermission(access.session,"clientes.visualizar"), schedule: hasPermission(access.session,"os.editar") && technicians.length > 0 && !/^(técnico|tecnico|prestador)/i.test(access.session.role), confirmation: hasPermission(access.session,"os.editar") } });
  } catch { return reply({ error: "Não foi possível consultar os dados da empresa. Atualize a sessão e tente novamente." }, 503); }
}
export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") !== "same-origin" || request.headers.get("origin") !== request.nextUrl.origin) return reply({ error: "Origem inválida." }, 403);
  const access = chatAccess(request);
  if (!access) return reply({ error: "Não autorizado." }, 403);
  try {
    await assertActiveWhatsAppCompany(access.companyId);
    const raw = await request.text();
    if (raw.length > 12000) return reply({ error: "Solicitação muito grande." }, 413);
    const body = JSON.parse(raw);
    const command = String(body.command || "");
    const action = parseDeskAction(command);
    actionPermission(access, action.kind);
    const state = await operationalState(request);
    let requestId = randomUUID();
    if (body.review) {
      const [encoded, signature] = String(body.review).split(".");
      const expected = sign(encoded);
      if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) throw new Error("Revisão inválida. Prepare a ação novamente.");
      const review = JSON.parse(Buffer.from(encoded,"base64url").toString());
      if (review.company !== access.companyId || review.user !== access.session.username || review.command !== command || review.exp < Date.now()) throw new Error("Revisão expirada ou de outro usuário. Prepare novamente.");
      requestId = review.requestId;
      // Preserve idempotence on an HTTP retry even after the revision changed.
      const prior = (action.kind === "customer" ? state.customers : state.serviceOrders).find(row => row.id === `${action.kind === "customer" ? "CLI" : "OS"}-CHAT-${requestId}`);
      if (action.kind !== "confirmation" && prior) return reply({ saved: true, replay: true, recordId: prior.id, message: "Esta ação já foi registrada no sistema." });
      if (review.stateHash !== hash(state)) throw new Error("A base mudou desde a revisão. Prepare a ação novamente para conferir os dados atuais.");
    }
    const prepared = prepareDeskAction(state, action, requestId);
    if (!body.review) {
      const encoded = Buffer.from(JSON.stringify({ company: access.companyId, user: access.session.username, command, requestId, stateHash: hash(state), exp: Date.now()+5*60*1000 })).toString("base64url");
      return reply({ summary: prepared.summary, review: `${encoded}.${sign(encoded)}`, kind: action.kind });
    }
    if (action.kind === "confirmation") {
      const phone = prepared.phone!;
      // A schedule-specific durable outbox key prevents double sends from new previews.
      const source = appointmentSource(prepared.record);
      const result = await dispatchEvolutionJob(access.companyId,source,phone,`${prepared.summary}\n\n${access.actor.displayName} — ${access.actor.role}`);
      return reply({ status: result.status, message: result.status === "accepted" ? "Solicitação de confirmação aceita pelo WhatsApp. A presença continua pendente até a resposta do cliente." : "Envio sem confirmação ou bloqueado. Consulte o histórico antes de tentar novamente." });
    }
    const headers = new Headers(request.headers);
    headers.set("content-type","application/json");
    const saved = await putState(new NextRequest(new URL("/api/state",request.url), { method: "PUT", headers, body: JSON.stringify({ ...prepared.next, _baseRevision: state._revision || 0 }) }));
    const result = await saved.json();
    if (!saved.ok || !result.saved) return reply({ error: result.error || "Não foi possível salvar a ação." },saved.status);
    const rows = action.kind === "customer" ? result.state?.customers : result.state?.serviceOrders;
    if (!rows?.some((row: {id:string}) => row.id === prepared.record.id)) return reply({error:"Gravação sem confirmação do registro. Consulte o sistema antes de repetir."},409);
    return reply({ saved: true, recordId: prepared.record.id, message: action.kind === "customer" ? "Cliente cadastrado no ProAR." : "Agendamento criado na agenda do ProAR. A confirmação do cliente está pendente." });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : "Ação indisponível." },400); }
}
