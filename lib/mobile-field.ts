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
  attendancePaused?:boolean;
  estimatedDurationMinutes?:number;
  requests?:{id:string;kind:string;note:string;status:string;date?:string;time?:string;decidedBy?:string;decisionNote?:string}[];
  events?:{id:string;kind:string;note:string;createdBy:string;createdAt:string}[];
  delay?:{minutes:number;note:string};
  warranty?:{days:number;terms:string};
  observations?:string;
  measurements?:Record<string,string>;
  photoCounts?:{before:number;after:number};
  appliedMaterials?:{name:string;quantity:number}[];
  technicianSignaturePreview?:string;
  editToken?: string;
  equipmentOptions?: { id: string; label: string }[];
  fieldExceptions?: { id:string;kind:"signature"|"equipment";reason:string;status:string;requestedBy:string;requestedAt:string;decidedBy?:string;decidedAt?:string;decisionReason?:string }[];
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
  return ["admin", "administrador", "gerencia", "gerente", "gestor", "supervisor", "proprietario", "dono"].includes(normalized(session.role));
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedInteger(value: unknown, max: number) {
  if (typeof value !== "number" && typeof value !== "string") return 0;
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : 0;
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
  const limit = canSeeAllMobileOrders(session) ? Number.MAX_SAFE_INTEGER : (typeof max === "number" && Number.isFinite(max) ? Math.max(1, Math.min(500, Math.floor(max))) : 300);
  const results: MobileFieldOrder[] = [];
  const seen = new Set<string>();
  for (const entry of orders) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const order = entry as RecordItem;
    const id = short(order.id, 100);
    if (!id || seen.has(id) || !assignedToSession(order, session) || (!canSeeAllMobileOrders(session) && !isOpenMobileOrder(order.status))) continue;
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
      fieldVersion: typeof order.fieldVersion === "number" && Number.isSafeInteger(order.fieldVersion) && order.fieldVersion >= 0 ? order.fieldVersion : 0,
      fieldExceptions: Array.isArray(order.fieldExceptions) ? order.fieldExceptions.filter((item): item is Record<string,unknown> & {kind:"signature"|"equipment"} => isRecord(item) && (item.kind === "signature" || item.kind === "equipment")).slice(-20).map(item=>({id:short(item.id,100),kind:item.kind,reason:short(item.reason,1000),status:short(item.status,30),requestedBy:short(item.requestedBy,120),requestedAt:short(item.requestedAt,40),decidedBy:short(item.decidedBy,120),decidedAt:short(item.decidedAt,40),decisionReason:short(item.decisionReason,1000)})) : [],
      attendancePaused:Boolean(order.fieldAttendancePaused),
      estimatedDurationMinutes:boundedInteger(order.estimatedDurationMinutes,1440),
      requests:Array.isArray(order.fieldRequests)?order.fieldRequests.filter(isRecord).slice(-50).map(item=>({id:short(item.id,100),kind:short(item.kind,50),note:short(item.note,2000),status:short(item.status,30),date:short(item.date,10),time:short(item.time,5),decidedBy:short(item.decidedBy,120),decisionNote:short(item.decisionNote,2000)})):[],
      events:Array.isArray(order.fieldEvents)?order.fieldEvents.filter(isRecord).slice(-100).map(item=>({id:short(item.id,100),kind:short(item.kind,50),note:short(item.note,2000),createdBy:short(item.createdBy,120),createdAt:short(item.createdAt,40)})):[],
      delay:isRecord(order.fieldDelay)?{minutes:boundedInteger((order.fieldDelay as Record<string,unknown>).minutes,1440),note:short((order.fieldDelay as Record<string,unknown>).note,2000)}:undefined,
      warranty:isRecord(order.fieldWarranty)?{days:boundedInteger((order.fieldWarranty as Record<string,unknown>).days,3650),terms:short((order.fieldWarranty as Record<string,unknown>).terms,2000)}:undefined,
      observations: short(order.fieldObservations,4000),
      measurements: Object.fromEntries(["pressure","temperature","voltage","current"].filter(key=>typeof (order.fieldMeasurements as Record<string,unknown>|undefined)?.[key]==="string").map(key=>[key,short((order.fieldMeasurements as Record<string,unknown>)[key],30)])),
      photoCounts:{before:Array.isArray((order.photos as Record<string,unknown>|undefined)?.before)?(order.photos as Record<string,string[]>).before.length:0,after:Array.isArray((order.photos as Record<string,unknown>|undefined)?.after)?(order.photos as Record<string,string[]>).after.length:0},
      appliedMaterials:Array.isArray(order.catalogItems)?order.catalogItems.filter(isRecord).filter(item=>item.kind==="Produto").slice(0,100).map(item=>({name:short(item.name,150),quantity:typeof item.quantity==="number"&&Number.isFinite(item.quantity)&&item.quantity>0?item.quantity:1})):[],
      diagnosis: short(order.diagnosis, 4000),
      executedService: short(order.executedService, 8000),
      mobileChecklist: Object.fromEntries(Object.entries(isRecord(order.mobileChecklist) ? order.mobileChecklist : {}).filter(([,value])=>typeof value === "boolean")) as Record<string,boolean>,
      evidence: { before: Boolean((order.photos as Record<string,unknown[]>|undefined)?.before?.length), after: Boolean((order.photos as Record<string,unknown[]>|undefined)?.after?.length), signature: Boolean(order.customerSignature) },
    });
    if (results.length >= limit) break;
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


