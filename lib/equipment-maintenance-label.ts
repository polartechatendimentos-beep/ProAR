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

/** A public QR must never expose customer, technician, location, price, notes or photos. */
export function publicMaintenanceHistory(equipment: RecordItem, orders: RecordItem[], limit = 15): MaintenanceVisit[] {
  const id = String(equipment.id ?? "");
  const customerId = String(equipment.customerId ?? "");
  if (!id) return [];
  return orders.filter(order => {
    const ids = Array.isArray(order.equipmentIds) ? order.equipmentIds.map(String) : [];
    if (order.equipmentId != null) ids.push(String(order.equipmentId));
    if (!ids.includes(id)) return false;
    if (customerId && order.customerId && String(order.customerId) !== customerId) return false;
    return /conclu[ií]d|finalizad|encerrad/i.test(String(order.status ?? ""));
  }).sort((a, b) => dateValue(b.date ?? b.updatedAt) - dateValue(a.date ?? a.updatedAt))
    .slice(0, Math.max(0, Math.min(limit, 30)))
    .map(order => ({
      date: dateValue(order.date ?? order.updatedAt) ? String(order.date ?? order.updatedAt).slice(0, 10) : "",
      service: publicServiceCategory(order.service),
      status: "Concluída" as const,
    }));
}
