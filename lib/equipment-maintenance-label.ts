import { createHmac, timingSafeEqual } from "node:crypto";

type RecordItem = Record<string, unknown>;
export type MaintenanceVisit = { date: string; service: string; status: "Concluída" };

function validId(value: string) {
  return /^[A-Za-z0-9_-]{1,120}$/.test(value);
}

function digest(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest();
}

/** The label belongs to the equipment, not to an individual service order. */
export function createEquipmentLabel(companyId: string, equipmentId: string, secret: string) {
  if (!validId(companyId) || !validId(equipmentId) || !secret) throw new Error("Identificação de equipamento inválida.");
  const payload = Buffer.from(JSON.stringify({ v: 1, c: companyId, e: equipmentId })).toString("base64url");
  const signature = digest(secret, payload).toString("hex");
  return {
    token: `${payload}.${signature}`,
    code: `PT-${digest(secret, `label:${companyId}:${equipmentId}`).toString("hex").slice(0, 12).toUpperCase()}`,
  };
}

/** Public-facing PolarTech label codes are stable and intentionally non-sequential. */
export function isEquipmentLabelCode(value: string) {
  return /^PT-[A-F0-9]{12}$/.test(value);
}

/** Resolve a short printed code only inside the designated PolarTech tenant. */
export function findEquipmentByLabelCode(equipment: RecordItem[], companyId: string, code: string, secret: string) {
  if (!isEquipmentLabelCode(code)) return null;
  const matches = equipment.filter(item => {
    const id = String(item.id ?? "");
    if (!validId(id)) return false;
    return createEquipmentLabel(companyId, id, secret).code === code;
  });
  // Fail closed on a truncated-code collision; never show the wrong equipment.
  return matches.length === 1 ? matches[0] : null;
}

/** Reject tampered labels before resolving any tenant or querying the database. */
export function verifyEquipmentLabel(token: string, secret: string) {
  if (!secret || token.length > 500) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]{10,430}$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[1])) return null;
  const expected = digest(secret, parts[0]);
  const received = Buffer.from(parts[1], "hex");
  if (received.length !== expected.length || !timingSafeEqual(expected, received)) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as { v?: unknown; c?: unknown; e?: unknown };
    if (data.v !== 1 || typeof data.c !== "string" || typeof data.e !== "string" || !validId(data.c) || !validId(data.e)) return null;
    return { companyId: data.c, equipmentId: data.e };
  } catch {
    return null;
  }
}

function dateValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const stamp = Date.parse(raw.slice(0, 10) + "T12:00:00Z");
    return Number.isFinite(stamp) ? stamp : 0;
  }
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (match) {
    const stamp = Date.parse(`${match[3]}-${match[2]}-${match[1]}T12:00:00Z`);
    return Number.isFinite(stamp) ? stamp : 0;
  }
  return 0;
}

function publicServiceCategory(value: unknown) {
  const normalized = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/higien|limpeza/.test(normalized)) return "Higienização";
  if (/preventiv|pmoc/.test(normalized)) return "Manutenção preventiva";
  if (/corretiv|reparo|conserto/.test(normalized)) return "Manutenção corretiva";
  if (/desinstal|remocao/.test(normalized)) return "Desinstalação";
  if (/instal/.test(normalized)) return "Instalação";
  if (/inspec|vistoria|diagnost/.test(normalized)) return "Inspeção técnica";
  return "Atendimento técnico";
}

/** Validate explicit links to old OS records before any state write. */
export function canLinkHistoricalServiceOrder(equipment: RecordItem, order: RecordItem, allEquipment: RecordItem[]) {
  const equipmentId = String(equipment.id ?? "");
  const orderId = String(order.id ?? "");
  const customerId = String(equipment.customerId ?? "");
  if (!validId(equipmentId) || !validId(orderId) || !customerId || String(order.customerId ?? "") !== customerId) return false;
  if (!/conclu[ií]d|finalizad|encerrad/i.test(String(order.status ?? ""))) return false;
  const assignedToOtherLabel = allEquipment.some(other => {
    if (String(other.id) === equipmentId) return false;
    const historical = Array.isArray(other.historicalServiceOrderIds) ? other.historicalServiceOrderIds.map(String) : [];
    if (historical.includes(orderId)) return true;
    const orderEquipmentIds = Array.isArray(order.equipmentIds) ? order.equipmentIds.map(String) : [];
    if (order.equipmentId != null) orderEquipmentIds.push(String(order.equipmentId));
    return other.publicMaintenanceHistoryEnabled === true && orderEquipmentIds.includes(String(other.id));
  });
  return !assignedToOtherLabel;
}

/** A public QR must never expose customer, technician, location, price, notes or photos. */
export function publicMaintenanceHistory(equipment: RecordItem, orders: RecordItem[], limit = 15): MaintenanceVisit[] {
  const id = String(equipment.id ?? "");
  const customerId = String(equipment.customerId ?? "");
  if (!id) return [];
  const historicalOrderIds = new Set(
    Array.isArray(equipment.historicalServiceOrderIds)
      ? equipment.historicalServiceOrderIds.filter(value => typeof value === "string").slice(0, 100)
      : [],
  );
  return orders.filter(order => {
    const ids = Array.isArray(order.equipmentIds) ? order.equipmentIds.map(String) : [];
    if (order.equipmentId != null) ids.push(String(order.equipmentId));
    if (!ids.includes(id) && !historicalOrderIds.has(String(order.id ?? ""))) return false;
    // Explicit historical associations must never cross customer boundaries.
    if (customerId && String(order.customerId ?? "") !== customerId) return false;
    return /conclu[ií]d|finalizad|encerrad/i.test(String(order.status ?? ""));
  }).sort((a, b) => dateValue(b.date ?? b.updatedAt) - dateValue(a.date ?? a.updatedAt))
    .slice(0, Math.max(0, Math.min(limit, 30)))
    .map(order => ({
      date: dateValue(order.date ?? order.updatedAt) ? String(order.date ?? order.updatedAt).slice(0, 10) : "",
      service: publicServiceCategory(order.service),
      status: "Concluída" as const,
    }));
}
