import { createHash } from "node:crypto";
import { workDate } from "./work-routes.ts";

export type FieldRecord = Record<string, unknown>;
export type FieldSupportState = { companyId: string; _revision: number; records: FieldRecord[]; requests: Record<string, { fingerprint: string; recordId: string }> };
export type FieldSupportActor = { employeeId: string; name: string; username: string; manager: boolean };
export type FieldSupportCommand = { requestId: string; action: string; data: FieldRecord };
export class FieldSupportError extends Error { status:number; constructor(message: string, status = 422) { super(message); this.status=status; } }
export const VEHICLE_CHECKS = ["pneus", "farois", "oleo", "agua", "lataria"] as const;
const text = (value: unknown, max = 300) => String(value ?? "").trim().slice(0, max);
const validId = (value: unknown) => /^[A-Za-z0-9_-]{1,120}$/.test(String(value || ""));
function positive(value: unknown, label: string, max: number, zero = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value > max || (zero ? value < 0 : value <= 0)) throw new FieldSupportError(`${label} inválido.`);
  return value;
}
function requireManager(actor: FieldSupportActor) { if (!actor.manager) throw new FieldSupportError("Ação restrita à gestão autorizada.", 403); }
export function fieldSupportKey(companyId: string) { return `field-support-v1:${Buffer.from(companyId).toString("hex")}`; }
export function applyFieldSupport(current: FieldSupportState, command: FieldSupportCommand, actor: FieldSupportActor, now: string) {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(command.requestId || "")) throw new FieldSupportError("Identificador de operação inválido.");
  if (!command.data || typeof command.data !== "object" || Array.isArray(command.data)) throw new FieldSupportError("Dados inválidos.");
  const fingerprint = createHash("sha256").update(JSON.stringify({action: command.action, data: command.data, actor: actor.username})).digest("hex");
  const replay = current.requests[command.requestId];
  if (replay) { if (replay.fingerprint !== fingerprint) throw new FieldSupportError("Identificador já utilizado com outro conteúdo.", 409); return { state: current, recordId: replay.recordId, replay: true }; }
  if (current.records.length >= 10000) throw new FieldSupportError("Arquivo operacional atingiu o limite. Solicite arquivamento antes de novos registros.", 409);
  const next = structuredClone(current), data = command.data;
  const record: FieldRecord = { id: `FIELD-${command.requestId}`, kind: command.action, employeeId: actor.employeeId, employeeName: actor.name, username: actor.username, createdAt: now, workDate: workDate(now) };
  const vehicles = next.records.filter(item => item.kind === "vehicle");
  const vehicle = vehicles.find(item => item.id === data.vehicleId);
  switch (command.action) {
    case "vehicle": {
      requireManager(actor);
      const plate = text(data.plate, 8).toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate) || !text(data.name, 100)) throw new FieldSupportError("Informe placa e identificação válidas.");
      if (vehicles.some(item => item.plate === plate)) throw new FieldSupportError("Placa já cadastrada.", 409);
      record.plate = plate; record.name = text(data.name,100); record.odometer = positive(data.odometer, "Odômetro", 10000000, true);
      record.assignedEmployeeId = validId(data.assignedEmployeeId) ? text(data.assignedEmployeeId,120) : "";
      record.maintenanceAtKm = data.maintenanceAtKm == null ? null : positive(data.maintenanceAtKm,"Próxima revisão",10000000,true);
      break;
    }
    case "checklist":
    case "fuel": {
      if (!actor.employeeId) throw new FieldSupportError("Vincule o usuário ao funcionário antes de registrar a frota.", 403);
      if (!vehicle || vehicle.assignedEmployeeId !== actor.employeeId) throw new FieldSupportError("Veículo não atribuído a este funcionário.", 403);
      const previous = next.records.filter(item => item.vehicleId === vehicle.id && typeof item.odometer === "number");
      const lastKm = Math.max(Number(vehicle.odometer || 0), ...previous.map(item => Number(item.odometer)));
      record.vehicleId = vehicle.id; record.odometer = positive(data.odometer, "Odômetro",10000000,true);
      if (Number(record.odometer) < lastKm) throw new FieldSupportError("Odômetro inferior ao último registro. Solicite correção à gestão.");
      if (command.action === "checklist") {
        const checks = data.checks as FieldRecord | undefined;
        if (!checks || !VEHICLE_CHECKS.every(key => ["ok","attention","unsafe"].includes(String(checks[key])))) throw new FieldSupportError("Preencha todos os itens do checklist.");
        record.checks = Object.fromEntries(VEHICLE_CHECKS.map(key=>[key,checks[key]]));
        record.notes = text(data.notes,1000);
        record.released = !VEHICLE_CHECKS.some(key=>checks[key] === "unsafe");
        if (VEHICLE_CHECKS.some(key=>checks[key] !== "ok") && !record.notes) throw new FieldSupportError("Descreva a avaria encontrada.");
      } else {
        record.liters = positive(data.liters,"Litros",2000); record.amount = positive(data.amount,"Valor",100000);
        record.fullTank = data.fullTank === true; record.station = text(data.station,120);
        const lastFill = next.records.filter(item=>item.kind === "fuel" && item.vehicleId === vehicle.id).at(-1);
        const km = lastFill ? Number(record.odometer)-Number(lastFill.odometer) : null;
        record.distanceKm = km;
        record.kmPerLiter = lastFill?.fullTank === true && record.fullTank === true && km != null && km > 0 ? Math.round(km / Number(record.liters) * 100)/100 : null;
        record.anomaly = typeof record.kmPerLiter === "number" && (record.kmPerLiter < 2 || record.kmPerLiter > 30);
      }
      break;
    }
    case "sos": {
      if (!actor.employeeId) throw new FieldSupportError("Vincule este usuário a um funcionário para identificar o SOS.",403);
      record.status = "open"; record.message = text(data.message,500) || "Pedido de ajuda pelo colaborador";
      const point = data.point as FieldRecord | undefined;
      if (point && [point.latitude,point.longitude,point.accuracy].every(value=>typeof value === "number" && Number.isFinite(value)) && Math.abs(Number(point.latitude)) <=90 && Math.abs(Number(point.longitude)) <=180 && Number(point.accuracy)>=0 && Number(point.accuracy)<=50000) {
        const captured = Date.parse(String(point.capturedAt));
        if (!Number.isFinite(captured) || Math.abs(Date.parse(now)-captured)>120000) throw new FieldSupportError("Localização de emergência desatualizada.");
        record.point = {latitude:point.latitude,longitude:point.longitude,accuracy:point.accuracy,capturedAt:point.capturedAt};
      } else if (point) throw new FieldSupportError("Localização de emergência inválida.");
      break;
    }
    case "sos-ack": {
      requireManager(actor);
      const sos = next.records.find(item=>item.kind === "sos" && item.id === data.sosId);
      if (!sos) throw new FieldSupportError("SOS não encontrado.",404);
      if (!text(data.reason,500)) throw new FieldSupportError("Registre a providência tomada.");
      record.sosId = sos.id; record.reason = text(data.reason,500); record.decision = data.decision === "resolved" ? "resolved" : "acknowledged";
      break;
    }
    case "point-adjustment": {
      const date=text(data.date,10),stamp=Date.parse(date+"T12:00:00Z");
      if (!actor.employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0,10)!==date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(text(data.requestedTime,40)) || !text(data.reason,1000)) throw new FieldSupportError("Informe data, horário solicitado e motivo do ajuste.");
      record.date=text(data.date,10); record.requestedTime=text(data.requestedTime,40); record.reason=text(data.reason,1000); record.status="pending";
      break;
    }
    case "adjustment-decision": {
      requireManager(actor);
      const adjustment=next.records.find(item=>item.kind === "point-adjustment" && item.id === data.adjustmentId);
      if (!adjustment) throw new FieldSupportError("Solicitação não encontrada.",404);
      if (next.records.some(item=>item.kind === "adjustment-decision" && item.adjustmentId === adjustment.id)) throw new FieldSupportError("Solicitação já analisada.",409);
      if (!["approved","rejected"].includes(String(data.decision)) || !text(data.reason,1000)) throw new FieldSupportError("Informe decisão e justificativa.");
      record.adjustmentId=adjustment.id; record.decision=data.decision; record.reason=text(data.reason,1000);
      break;
    }
    case "gps-alert":
      if (!actor.employeeId) throw new FieldSupportError("Funcionário não identificado.",403);
      record.reason=text(data.reason,300); break;
    default: throw new FieldSupportError("Operação desconhecida.");
  }
  next.records.push(record); next._revision++;
  next.requests[command.requestId]={fingerprint,recordId:String(record.id)};
  return {state:next,recordId:String(record.id),replay:false};
}
export function visibleFieldSupport(state: FieldSupportState, actor: FieldSupportActor) {
  const owned=new Set(state.records.filter(item=>item.employeeId===actor.employeeId).map(item=>item.id));
  const records = state.records.filter(item=>actor.manager || item.employeeId === actor.employeeId || item.kind === "vehicle" && item.assignedEmployeeId === actor.employeeId || item.kind==="adjustment-decision"&&owned.has(item.adjustmentId) || item.kind==="sos-ack"&&owned.has(item.sosId));
  return records.map(item=>{const copy={...item};if (!actor.manager) delete copy.point; return copy;});
}
export function vehicleReleased(state: FieldSupportState, employeeId: string, date: string) {
  const vehicles=state.records.filter(item=>item.kind === "vehicle" && item.assignedEmployeeId === employeeId);
  return vehicles.every(vehicle=>state.records.filter(item=>item.kind === "checklist" && item.vehicleId === vehicle.id && item.workDate === date).at(-1)?.released === true);
}
