/** Deliberately bounded local commands. Incoming WhatsApp text is never executed. */
export type ActionRow = Record<string, unknown>;
export type ActionState = { customers: ActionRow[]; serviceOrders: ActionRow[]; moduleRecords: Record<string, ActionRow[]>; _revision?: number };
export type DeskAction = { kind: "customer" | "schedule" | "confirmation"; fields: string[] };
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
  const verbs = { cadastrar: "customer", agendar: "schedule", confirmar: "confirmation" } as const;
  const kind = Object.hasOwn(verbs,verb.toLowerCase()) ? verbs[verb.toLowerCase() as keyof typeof verbs] : undefined;
  if (!kind) throw new Error("Use cadastrar, agendar ou confirmar, separando os campos por |.");
  const count = kind === "customer" ? 3 : kind === "schedule" ? 7 : 1;
  if (fields.length !== count || fields.some(value => !value || value.length > 500)) throw new Error("Preencha todos os campos do modelo de comando.");
  return { kind, fields };
}
export function prepareDeskAction(state: ActionState, action: DeskAction, requestId: string, now = new Date()): { next: ActionState; record: ActionRow; replay: boolean; summary: string; phone?: string } {
  if (!/^[a-f0-9-]{36}$/i.test(requestId)) throw new Error("Solicitação inválida.");
  const next = structuredClone(state);
  const id = `${action.kind === "customer" ? "CLI" : "OS"}-CHAT-${requestId}`;
  const replay = action.kind === "customer" ? next.customers.find(row => row.id === id) : action.kind === "schedule" ? next.serviceOrders.find(row => row.id === id) : null;
  if (replay) return { next, record: replay, replay: true, summary: `Já registrado: ${id}` };
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
    if (!order || /cancelad|conclu[ií]d|finalizad/i.test(String(order.status))) throw new Error("Agendamento ativo não encontrado.");
    const customer = next.customers.find(row => row.id === order.customerId);
    if (!customer) throw new Error("Agendamento sem cliente vinculado. Corrija a OS antes do envio.");
    const phone = actionPhone(customer.whatsapp || customer.phone);
    if (!order.date || !order.time || !(new Date(`${order.date}T${order.time}:00-03:00`) > now)) throw new Error("A OS precisa ter data e horário futuros definidos.");
    const message = `Olá, ${customer.name}! Seu atendimento de ${order.service} está agendado para ${String(order.date).split("-").reverse().join("/")} às ${order.time}, em ${order.address || customer.address}. Podemos confirmar sua presença? Responda CONFIRMAR ${order.id} ou REAGENDAR ${order.id}. Para não receber mensagens, responda SAIR.`;
    return { next, record: order, replay: false, summary: message, phone };
  }
  const [customerId, date, time, rawDuration, tech, service, address] = action.fields;
  const customer = next.customers.find(row => row.id === customerId);
  if (!customer || /inativ/i.test(String(customer.status))) throw new Error("Cliente ativo não encontrado. Use o ID exibido na consulta.");
  if (customer.financialStatus === "Bloqueado" || customer.billingBlocked === true) throw new Error("O cliente está bloqueado financeiramente. Solicite a liberação antes de criar a OS.");
  const start = new Date(`${date}T${time}:00-03:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isFinite(start.getTime()) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date || start <= now) throw new Error("Informe uma data e um horário futuros válidos (horário de Brasília).");
  const durationMinutes = Number(rawDuration);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) throw new Error("Duração deve estar entre 15 e 480 minutos.");
  const employees = next.moduleRecords["Funcionários"] || [];
  const employee = employees.find(row => !/inativ/i.test(String(row.status)) && [row.id, row.name, row.employeeName].includes(tech));
  if (!employee) throw new Error("Técnico ativo não encontrado. Use um dos técnicos exibidos na consulta.");
  const techName = String(employee.name || employee.employeeName || employee.id);
  const minute = (value: unknown) => { const [hours, minutes] = String(value || "00:00").split(":").map(Number); return hours * 60 + minutes; };
  const from = minute(time), to = from + durationMinutes;
  if (to > 1440) throw new Error("O atendimento precisa terminar no mesmo dia.");
  const conflict = next.serviceOrders.find(order => order.date === date && !/cancelad|conclu[ií]d|finalizad/i.test(String(order.status)) && (order.tech === techName || order.employeeId === employee.id || order.techId === employee.id || order.customerId === customerId) && from < minute(order.time) + (Number(order.estimatedDurationMinutes || order.durationMinutes) || 60) && to > minute(order.time));
  if (conflict) throw new Error(`Conflito de agenda com ${conflict.id}. Escolha outro horário.`);
  const record = { id, customerId, client: customer.name, unit: "", service, tech: techName, employeeId: employee.id, techId: employee.id, date, time, durationMinutes, estimatedDurationMinutes: durationMinutes, address, status: "Agendada", tone: "blue", avatar: techName.slice(0,2).toUpperCase(), createdAt: now.toISOString(), source: "Central de atendimento", appointmentConfirmation: "Pendente", changeReason: "Agendamento solicitado pelo assistente operacional" };
  next.serviceOrders.push(record);
  return { next, record, replay: false, summary: `Agendar ${customer.name} • ${service} • ${date.split("-").reverse().join("/")} às ${time} (${durationMinutes} min) • ${techName} • ${address}. Confirmação do cliente pendente.` };
}
function actionPhoneSafe(value: unknown) { try { return actionPhone(value); } catch { return ""; } }
export function parseAppointmentReply(text: string) {
  const match = /^(CONFIRMAR|REAGENDAR)\s+(OS-[A-Z0-9-]{1,90})$/i.exec(text.trim());
  return match ? { orderId: match[2].toUpperCase(), status: match[1].toUpperCase() === "CONFIRMAR" ? "Confirmado" : "Reagendamento solicitado" } : null;
}
export function appointmentSource(order: ActionRow) { return `appointment:${order.id}:${order.date}:${order.time}`; }
export function appointmentReplyAllowed(order: ActionRow, customer: ActionRow | undefined, phone: string, eventAt: string, job: ActionRow | undefined, now = new Date()) {
  const event = Date.parse(eventAt), sent = Date.parse(String(job?.createdAt || ""));
  return Boolean(customer && customer.id === order.customerId && actionPhoneSafe(customer.whatsapp || customer.phone) === phone && !/cancelad|conclu[ií]d|finalizad/i.test(String(order.status)) && job?.status === "accepted" && job.sourceId === appointmentSource(order) && Number.isFinite(event) && Number.isFinite(sent) && event >= sent && event <= now.getTime()+300000 && now.getTime()-event < 86400000 && new Date(`${order.date}T${order.time}:00-03:00`) > now);
}

export function chatCustomerContext(state: ActionState, rawPhone: string) {
  const phone = actionPhone(rawPhone);
  const matches = state.customers.filter(customer=>[customer.whatsapp,customer.phone].some(value=>actionPhoneSafe(value)===phone));
  if (matches.length !== 1) return {customer:null,ambiguous:matches.length>1,orders:[],equipment:[],orderCount:0,equipmentCount:0};
  const customer = matches[0];
  const uniqueName = state.customers.filter(row=>row.name===customer.name).length===1;
  const belongs = (row:ActionRow) => row.customerId ? row.customerId===customer.id : uniqueName && row.client===customer.name;
  const orders = state.serviceOrders.filter(belongs).sort((a,b)=>`${b.date||""} ${b.time||""}`.localeCompare(`${a.date||""} ${a.time||""}`));
  const equipment = (state.moduleRecords.Equipamentos || []).filter(belongs);
  return {customer:{id:customer.id,name:customer.name,address:customer.address,phone:customer.phone},ambiguous:false,orderCount:orders.length,equipmentCount:equipment.length,orders:orders.slice(0,5).map(row=>({id:row.id,service:row.service,status:row.status,date:row.date,time:row.time})),equipment:equipment.slice(0,5).map(row=>({id:row.id,name:row.name,brand:row.brand,model:row.model,capacityBtus:row.capacityBtus,serialNumber:row.serialNumber}))};
}
