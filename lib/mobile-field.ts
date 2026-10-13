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
  fieldVersion: number;
  diagnosis: string;
  executedService: string;
  mobileChecklist: Record<string, boolean>;
  evidence: { before: boolean; after: boolean; signature: boolean };
  editToken?: string;
  equipmentOptions?: { id: string; label: string }[];
};

type RecordItem = Record<string, unknown>;
export type MobileFieldSession = {
  username: string;
  displayName?: string;
  role: string;
  employeeId?: string;
};

function normalized(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isOpenMobileOrder(status: unknown) {
  return !/^(concluid[ao]s?|finalizad[ao]s?|encerrad[ao]s?|cancelad[ao]s?)(?:$|\s|[(:-])/.test(normalized(status));
}

export function canSeeAllMobileOrders(session: MobileFieldSession) {
  return ["administrador", "gerencia", "gerente", "gestor", "supervisor"].includes(normalized(session.role));
}

export function assignedToSession(order: RecordItem, session: MobileFieldSession) {
  if (canSeeAllMobileOrders(session)) return true;
  const assignedId = String(order.employeeId || order.techId || "").trim();
  if (assignedId) return Boolean(session.employeeId && assignedId === session.employeeId);
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
    if (!id || seen.has(id) || !assignedToSession(order, session) || !isOpenMobileOrder(order.status)) continue;
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
      fieldVersion: Number.isInteger(order.fieldVersion) ? Number(order.fieldVersion) : 0,
      diagnosis: short(order.diagnosis, 4000),
      executedService: short(order.executedService, 8000),
      mobileChecklist: Object.fromEntries(Object.entries(order.mobileChecklist && typeof order.mobileChecklist === "object" ? order.mobileChecklist : {}).filter(([,value])=>typeof value === "boolean")) as Record<string,boolean>,
      evidence: { before: Boolean((order.photos as Record<string,unknown[]>|undefined)?.before?.length), after: Boolean((order.photos as Record<string,unknown[]>|undefined)?.after?.length), signature: Boolean(order.customerSignature) },
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
  const openOrders = orders.filter(item => isOpenMobileOrder(item.status));
  const today = openOrders.filter(item => item.date === date);
  const active = (status: string) => /andamento|execu[cç][aã]o|iniciad/i.test(status);
  return {
    today: today.length,
    inProgress: openOrders.filter(item => active(item.status)).length,
    pending: openOrders.filter(item => !active(item.status)).length,
  };
}

