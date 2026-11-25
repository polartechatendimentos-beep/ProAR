/** Deliberately bounded local commands. Incoming WhatsApp text is never executed. */
export type ActionRow = Record<string, unknown>;
export type ActionState = { customers: ActionRow[]; serviceOrders: ActionRow[]; moduleRecords: Record<string, ActionRow[]>; _revision?: number };
export type DeskAction = { kind: "customer" | "schedule" | "reschedule" | "confirmation"; fields: string[] };
const digits = (value: unknown) => String(value || "").replace(/\D/g, "");
export function actionPhone(value: unknown) {
  let phone = digits(value);
  if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
  if (!/^55\d{10,11}$/.test(phone)) throw new Error("Informe um telefone brasileiro com DDD.");
  return phone;
}
export function parseDeskAction(command: string): DeskAction {
  if (command.length > 2500) throw new Error("Comando muito longo.");
  const [verb, ...fields] = command.split("|").map(value => value.trim());
  const verbs = { cadastrar: "customer", agendar: "schedule", reagendar: "reschedule", confirmar: "confirmation" } as const;
  const kind = Object.hasOwn(verbs,verb.toLowerCase()) ? verbs[verb.toLowerCase() as keyof typeof verbs] : undefined;
  if (!kind) throw new Error("Use cadastrar, agendar, reagendar ou confirmar, separando os campos por |.");
  const count = kind === "customer" ? 3 : kind === "schedule" ? 7 : kind === "reschedule" ? 5 : 1;
  if (fields.length !== count || fields.some(value => !value || value.length > 500)) throw new Error("Preencha todos os campos do modelo de comando.");
  return { kind, fields };
}
const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
const confirmableStatus = (row: ActionRow) => !row.startedAt && !row.checkInAt && ["agendada", "reagendada", "cliente confirmado"].includes(normalize(row.status));
function futureSlot(row: ActionRow, now: Date) {
  const date = String(row.date || ""), time = String(row.time || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
  const start = new Date(`${date}T${time}:00-03:00`);
  return start > now && new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) === date;
}
const closedOrder = (row: ActionRow) => /cancelad|concluid|finalizad|encerrad|faturad/.test(normalize(row.status));
export function savedDeskAction(state: ActionState, action: DeskAction, requestId: string) {
  if (action.kind === "customer") return state.customers.find(row => row.id === `CLI-CHAT-${requestId}`);
  if (action.kind === "schedule") return state.serviceOrders.find(row => row.id === `OS-CHAT-${requestId}`);
  if (action.kind === "reschedule") return state.serviceOrders.find(row => row.id === action.fields[0] && row.chatdeskScheduleRequestId === requestId);
}
export function prepareDeskAction(state: ActionState, action: DeskAction, requestId: string, now = new Date()): { next: ActionState; record: ActionRow; replay: boolean; summary: string; phone?: string } {
  if (!/^[a-f0-9-]{36}$/i.test(requestId)) throw new Error("Solicitação inválida.");
  const next = structuredClone(state);
  const id = `${action.kind === "customer" ? "CLI" : "OS"}-CHAT-${requestId}`;
  const replay = savedDeskAction(next, action, requestId);
  if (replay) return { next, record: replay, replay: true, summary: `Já registrado: ${replay.id}` };
  if (action.kind === "customer") {
    const [name, rawPhone, address] = action.fields;
    if (name.length < 3 || name.length > 150) throw new Error("Informe o nome completo do cliente (3 a 150 caracteres).");
    const phone = actionPhone(rawPhone);
    const existing = next.customers.find(row => [row.phone, row.whatsapp].some(value => value && actionPhoneSafe(value) === phone));
    if (existing) throw new Error(`Este telefone já pertence ao cliente ${existing.id}. Use o cadastro existente.`);
    const record = { id, name, legalName: name, phone, whatsapp: phone, address, doc: "", contact: name, units: 0, status: "Ativo", createdAt: now.toISOString(), source: "Central de atendimento", changeReason: "Cadastro solicitado pelo assistente operacional" };
    next.customers.push(record);
    return { next, record, replay: false, summary: `Cadastrar ${name} • ${phone} • ${address}. CPF/CNPJ não informado; cadastro inicial para atendimento.` };
  }
  if (action.kind === "confirmation") {
    const order = next.serviceOrders.find(row => row.id === action.fields[0]);
    if (!order || !confirmableStatus(order)) throw new Error("Selecione uma OS já agendada ou reagendada e ainda não iniciada.");
    if (normalize(order.status) === "cliente confirmado" || normalize(order.appointmentConfirmation) === "confirmado") throw new Error("O cliente já confirmou este horário. Não envie outro pedido.");
    if (normalize(order.appointmentConfirmation) === "reagendamento solicitado") throw new Error("O cliente pediu reagendamento. Atualize o horário da mesma OS antes de solicitar confirmação.");
    const customer = next.customers.find(row => row.id === order.customerId);
    if (!customer || /inativ/i.test(String(customer.status))) throw new Error("Agendamento sem cliente ativo vinculado. Corrija a OS antes do envio.");
    const phone = actionPhone(customer.whatsapp || customer.phone);
    if(uniqueAppointmentCustomer(next.customers,phone)?.id !== customer.id) throw new Error("Mais de um cliente usa este WhatsApp. Confira o cadastro antes de solicitar a confirmação.");
    if (!futureSlot(order, now)) throw new Error("A OS precisa ter data e horário futuros válidos.");
    const service = String(order.service || "").trim(), address = String(order.address || customer.address || "").trim();
    if (!service || !address) throw new Error("Preencha o serviço e o endereço na OS antes de solicitar confirmação.");
    const message = `Olá, ${customer.name}! Seu atendimento de ${service} está agendado para ${String(order.date).split("-").reverse().join("/")} às ${order.time}, em ${address}. Podemos confirmar sua presença? Responda CONFIRMAR ${order.id} ou REAGENDAR ${order.id}. Para não receber mensagens, responda SAIR.`;
    return { next, record: order, replay: false, summary: message, phone };
  }
  const moving = action.kind === "reschedule";
  const existing = moving ? next.serviceOrders.find(row => row.id === action.fields[0]) : undefined;
  if (moving && (!existing || existing.startedAt || existing.checkInAt || !["agendada","reagendada","cliente confirmado"].includes(normalize(existing.status)))) {
    throw new Error("Selecione uma OS agendada, reagendada ou confirmada. Não é possível reprogramar uma OS encerrada ou em execução por aqui.");
  }
  const [targetId, date, time, rawDuration, tech, service, address] = action.fields;
  const customerId = moving ? existing?.customerId : targetId;
  const customer = next.customers.find(row => row.id === customerId);
  if (!customer || /inativ/i.test(String(customer.status))) throw new Error("Cliente ativo não encontrado. Use o ID exibido na consulta ou corrija o vínculo da OS.");
  if (customer.financialStatus === "Bloqueado" || customer.billingBlocked === true) throw new Error("O cliente está bloqueado financeiramente. Solicite a liberação antes de criar ou alterar a OS.");
  const start = new Date(`${date}T${time}:00-03:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isFinite(start.getTime()) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date || start <= now) throw new Error("Informe uma data e um horário futuros válidos (horário de Brasília).");
  const durationMinutes = Number(rawDuration);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) throw new Error("Duração deve estar entre 15 e 480 minutos.");
  const employees = next.moduleRecords["Funcionários"] || [];
  const active = employees.filter(row => !/inativ/i.test(String(row.status)));
  const byId = active.filter(row => row.id === tech);
  const matches = byId.length ? byId : active.filter(row => [row.name, row.employeeName].some(value => normalize(value) === normalize(tech)));
  if (matches.length !== 1) throw new Error("Técnico ativo não encontrado de forma única. Selecione pelo ID na consulta.");
  const employee = matches[0];
  const techName = String(employee.name || employee.employeeName || employee.id);
  const minute = (value: unknown) => { const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || "")); return match ? Number(match[1])*60 + Number(match[2]) : NaN; };
  const from = minute(time), to = from + durationMinutes;
  if (to > 1440) throw new Error("O atendimento precisa terminar no mesmo dia.");
  const uniqueCustomerName = next.customers.filter(row => normalize(row.name) === normalize(customer.name)).length === 1;
  const sameCustomer = (row: ActionRow) => row.customerId ? row.customerId === customerId : uniqueCustomerName && normalize(row.client) === normalize(customer.name);
  if (!moving) {
    const duplicate = next.serviceOrders.find(row => !closedOrder(row) && sameCustomer(row) && row.date === date && row.time === time && normalize(row.service) === normalize(service));
    if (duplicate) throw new Error(`Já existe uma OS para este cliente, serviço e horário: ${duplicate.id}. Use Reagendar OS existente para alterar a programação.`);
  } else if (existing!.date === date && existing!.time === time && normalize(existing!.tech) === normalize(techName) && Number(existing!.estimatedDurationMinutes || existing!.durationMinutes) === durationMinutes) {
    throw new Error("A OS já está programada com esses dados. Nenhuma alteração é necessária.");
  }
  const conflict = next.serviceOrders.find(order => order.id !== existing?.id && order.date === date && !closedOrder(order) && (normalize(order.tech) === normalize(techName) || order.employeeId === employee.id || order.techId === employee.id || sameCustomer(order)) && from < minute(order.time) + (Number(order.estimatedDurationMinutes || order.durationMinutes) || 60) && to > minute(order.time));
  if (conflict) throw new Error(`Conflito de agenda com ${conflict.id}. Escolha outro horário.`);
  const timing = { tech: techName, employeeId: employee.id, techId: employee.id, date, time, durationMinutes, estimatedDurationMinutes: durationMinutes, tone: "blue", avatar: techName.slice(0,2).toUpperCase(), appointmentConfirmation: "Pendente" };
  if (existing) {
    const oldSlot = `${String(existing.date || "").split("-").reverse().join("/")} ${existing.time || ""}`.trim();
    const sameSlot = existing.date === date && existing.time === time;
    const record = { ...existing, ...timing, appointmentConfirmation: sameSlot ? (existing.appointmentConfirmation || "Pendente") : "Pendente", ...(!sameSlot ? { appointmentScheduleRevision: requestId, appointmentConfirmedAt: null, appointmentReplyMessageId: null } : {}), status: sameSlot && existing.status === "Cliente confirmado" ? existing.status : "Reagendada", chatdeskScheduleRequestId: requestId, changeReason: "Programação alterada pela Central de atendimento" };
    next.serviceOrders = next.serviceOrders.map(row => row.id === existing.id ? record : row);
    return { next, record, replay: false, summary: `Reagendar ${existing.id} • ${customer.name} • ${existing.service || "Serviço já cadastrado"} • de ${oldSlot || "horário a definir"} para ${date.split("-").reverse().join("/")} às ${time} (${durationMinutes} min) • ${techName}. A mesma OS será preservada. Nenhuma mensagem será enviada.` };
  }
  const record = { id, customerId, client: customer.name, unit: "", service, ...timing, address, status: "Agendada", createdAt: now.toISOString(), source: "Central de atendimento", changeReason: "Agendamento solicitado pelo assistente operacional" };
  next.serviceOrders.push(record);
  return { next, record, replay: false, summary: `Agendar ${customer.name} • ${service} • ${date.split("-").reverse().join("/")} às ${time} (${durationMinutes} min) • ${techName} • ${address}. Confirmação do cliente pendente.` };
}
function actionPhoneSafe(value: unknown) { try { return actionPhone(value); } catch { return ""; } }
function customersByPhone(customers: readonly ActionRow[], phone: string) {
  return phone ? customers.filter(row => [row.whatsapp,row.phone].some(value=>actionPhoneSafe(value)===phone)) : [];
}
export function uniqueAppointmentCustomer(customers: readonly ActionRow[], phone: string) {
  const matches = customersByPhone(customers,actionPhoneSafe(phone));
  return matches.length === 1 && matches[0].id ? matches[0] : undefined;
}
export function parseAppointmentReply(text: string) {
  const match = /^(CONFIRMAR|REAGENDAR)\s+(#?OS-[A-Z0-9-]{1,90})$/i.exec(text.trim());
  return match ? { orderId: match[2].toUpperCase(), status: match[1].toUpperCase() === "CONFIRMAR" ? "Confirmado" : "Reagendamento solicitado" } : null;
}
export function appointmentSource(order: ActionRow) { return `appointment:${order.id}:${order.date}:${order.time}${order.appointmentScheduleRevision ? `:${order.appointmentScheduleRevision}` : ""}`; }
export function appointmentReplyAllowed(order: ActionRow, customer: ActionRow | undefined, phone: string, eventAt: string, job: ActionRow | undefined, now = new Date()) {
  const event = Date.parse(eventAt), sent = Date.parse(String(job?.createdAt || ""));
  return Boolean(customer && customer.id === order.customerId && !/inativ/i.test(String(customer.status)) && actionPhoneSafe(customer.whatsapp || customer.phone) === phone && confirmableStatus(order) && job?.status === "accepted" && job.sourceId === appointmentSource(order) && Number.isFinite(event) && Number.isFinite(sent) && event >= sent && event <= now.getTime()+300000 && now.getTime()-event < 86400000 && futureSlot(order, now));
}

export function chatCustomerContext(state: ActionState, rawPhone: string) {
  const phone = actionPhone(rawPhone);
  const matches = customersByPhone(state.customers,phone);
  if (matches.length !== 1) return {customer:null,ambiguous:matches.length>1,orders:[],equipment:[],orderCount:0,equipmentCount:0};
  const customer = matches[0];
  const uniqueName = state.customers.filter(row=>row.name===customer.name).length===1;
  const belongs = (row:ActionRow) => row.customerId ? row.customerId===customer.id : uniqueName && row.client===customer.name;
  const orders = state.serviceOrders.filter(belongs).sort((a,b)=>`${b.date||""} ${b.time||""}`.localeCompare(`${a.date||""} ${a.time||""}`));
  const equipment = (state.moduleRecords.Equipamentos || []).filter(belongs);
  return {customer:{id:customer.id,name:customer.name,address:customer.address,phone:customer.phone},ambiguous:false,orderCount:orders.length,equipmentCount:equipment.length,orders:orders.slice(0,5).map(row=>({id:row.id,service:row.service,status:row.status,date:row.date,time:row.time})),equipment:equipment.slice(0,5).map(row=>({id:row.id,name:row.name,brand:row.brand,model:row.model,capacityBtus:row.capacityBtus,serialNumber:row.serialNumber}))};
}
