/**
 * ProAR Field — read-only mobile projection of the existing ERP state.
 * Never send the full state to a field technician: it includes finance, fiscal
 * data, customer documents, credentials and other unrelated company records.
 */
export type MobileFieldOrder = {
  id: string;
  client: string;
  unit: string;
  service: string;
  tech: string;
  date: string;
  time: string;
  address: string;
  status: string;
  equipmentIds: string[];
  checkInAt: string;
};

type RecordItem = Record<string, unknown>;
export type MobileFieldSession = {
  username: string;
  displayName?: string;
  role: string;
};

function normalized(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function canSeeAllMobileOrders(session: MobileFieldSession) {
  return ["administrador", "gerencia", "gerente", "gestor", "supervisor"].includes(normalized(session.role));
}

export function assignedToSession(order: RecordItem, session: MobileFieldSession) {
  if (canSeeAllMobileOrders(session)) return true;
  const assigned = normalized(order.tech);
  if (!assigned || ["nao definido", "a definir", "sem tecnico"].includes(assigned)) return false;
  const username = normalized(session.username);
  const displayName = normalized(session.displayName);
  return assigned === username || Boolean(displayName && assigned === displayName);
}

function short(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export function mobileFieldOrders(
  orders: unknown,
  session: MobileFieldSession,
  max = 300,
): MobileFieldOrder[] {
  if (!Array.isArray(orders)) return [];
  const results: MobileFieldOrder[] = [];
  const seen = new Set<string>();
  for (const entry of orders) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const order = entry as RecordItem;
    const id = short(order.id, 100);
    if (!id || seen.has(id) || !assignedToSession(order, session)) continue;
    seen.add(id);
    const equipmentIds = (Array.isArray(order.equipmentIds) ? order.equipmentIds : [order.equipmentId])
      .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
      .map(value => value.slice(0, 100)).slice(0, 20);
    results.push({
      id,
      client: short(order.client, 150),
      unit: short(order.unit, 120),
      service: short(order.service, 300),
      tech: short(order.tech, 120),
      date: short(order.date, 32),
      time: short(order.time, 32),
      address: short(order.address, 220),
      status: short(order.status, 70),
      equipmentIds,
      checkInAt: short(order.checkInAt, 40),
    });
    if (results.length >= Math.max(1, Math.min(500, max))) break;
  }
  return results.sort((a, b) => {
    const left = `${a.date || "9999-99-99"} ${a.time || "99:99"}`;
    const right = `${b.date || "9999-99-99"} ${b.time || "99:99"}`;
    return left.localeCompare(right);
  });
}

export function mobileFieldSummary(orders: MobileFieldOrder[], date: string) {
  const today = orders.filter(item => item.date === date);
  const closed = (status: string) => /conclu[ií]d|finalizad|encerrad/i.test(status);
  const active = (status: string) => /andamento|execu[cç][aã]o|iniciad/i.test(status);
  return {
    today: today.length,
    inProgress: orders.filter(item => active(item.status)).length,
    pending: orders.filter(item => !closed(item.status) && !active(item.status)).length,
    completedToday: today.filter(item => closed(item.status)).length,
  };
}
