import type { WorkRoute } from "./work-routes";
import { FieldSupportError } from "./field-support.ts";
import { assignedToSession, isOpenMobileOrder, type MobileFieldSession } from "./mobile-field.ts";
import { mobileChecklist, checklistProgress } from "./mobile-service-checklists.ts";
import { createHash } from "node:crypto";
export function fieldOrderFingerprint(order:Record<string,unknown>){return createHash("sha256").update(JSON.stringify(order)).digest("hex");}

export function technicianRole(role: string) { return /^(tecnico|prestador(?: de servico)?)$/.test(role.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()); }
export function approvedFieldException(order:Record<string,unknown>,kind:"signature"|"equipment") {
  return Array.isArray(order.fieldExceptions) && order.fieldExceptions.some(item=>item && item.kind===kind && item.status==="Aprovado" && item.decidedBy && item.decidedAt);
}
export function requireActiveJourney(routes: WorkRoute[], now: string) {
  const active=routes.find(route=>route.status === "active" && Date.parse(route.startedAt)<=Date.parse(now) && Date.parse(route.expiresAt)>Date.parse(now));
  if(!active)throw new FieldSupportError("Inicie a jornada ou registre o retorno da pausa antes de atuar na OS.",403);
  return active;
}
export type FieldOrderCommand = { requestId:string; action:"start"|"save"|"finish"; orderId:string; expectedVersion:number; expectedToken?:string; report?:string; diagnosis?:string; checklist?:Record<string,boolean>; beforePhoto?:string; afterPhoto?:string; signature?:string; signerName?:string; equipmentIds?:string[]; point?:{id:string;capturedAt:string;latitude:number;longitude:number;accuracy:number} };
function image(value:unknown) {
  if(value == null || value === "")return "";
  if(typeof value !== "string" || value.length > 350000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))throw new FieldSupportError("Imagem inválida ou maior que o limite de 250 KB.");
  return value;
}
export function eligibleFieldEquipment(order:Record<string,unknown>, equipment:Record<string,unknown>[]) {
  return equipment.filter(item => {
    if (!item.id || /cancelad|inativ/i.test(String(item.status || ""))) return false;
    const sameCustomer = item.customerId ? item.customerId === order.customerId : Boolean(item.client && item.client === order.client);
    const location = item.roomId || item.sectorId || item.unitId || item.structureId;
    return sameCustomer && (!location || [order.roomId,order.sectorId,order.unitId,order.structureId].includes(location));
  });
}
export function applyFieldOrder(order:Record<string,unknown>, command:FieldOrderCommand, session:MobileFieldSession, now:string, equipment:Record<string,unknown>[] = []) {
  if(!assignedToSession(order,session))throw new FieldSupportError("OS não atribuída a este colaborador.",403);
  if(!isOpenMobileOrder(order.status))throw new FieldSupportError("A OS já foi concluída ou cancelada.",409);
  if(Number(order.fieldVersion || 0) !== command.expectedVersion)throw new FieldSupportError("Esta OS foi alterada. Atualize antes de salvar.",409);
  if(command.expectedToken && command.expectedToken !== fieldOrderFingerprint(order))throw new FieldSupportError("Esta OS foi alterada no sistema. Atualize antes de salvar.",409);
  if(!["start","save","finish"].includes(command.action))throw new FieldSupportError("Ação de OS inválida.");
  const next={...order};
  if(command.equipmentIds !== undefined){
    if(!Array.isArray(command.equipmentIds) || command.equipmentIds.length>20 || command.equipmentIds.some(id=>typeof id!=="string" || !id || id.length>100) || new Set(command.equipmentIds).size!==command.equipmentIds.length)throw new FieldSupportError("Seleção de equipamentos inválida.");
    const existing=Array.isArray(order.equipmentIds)?order.equipmentIds:order.equipmentId?[order.equipmentId]:[];
    const allowed=new Set([...existing,...eligibleFieldEquipment(order,equipment).map(item=>item.id)]);
    if(command.equipmentIds.some(id=>!allowed.has(id)))throw new FieldSupportError("Equipamento não pertence ao cliente e local desta OS.",403);
    next.equipmentIds=command.equipmentIds;
  }
  if(command.report != null)next.executedService=String(command.report).trim().slice(0,8000);
  if(command.diagnosis != null)next.diagnosis=String(command.diagnosis).trim().slice(0,4000);
  if(command.checklist){if(typeof command.checklist !== "object" || Array.isArray(command.checklist))throw new FieldSupportError("Checklist inválido.");next.mobileChecklist=Object.fromEntries(Object.entries(command.checklist).filter(([key,value])=>/^[A-Za-z0-9_-]{1,60}$/.test(key)&&typeof value === "boolean").slice(0,40));}
  const photos={...((order.photos||{}) as Record<string,string[]>)};
  if(command.beforePhoto)photos.before=[image(command.beforePhoto)];
  if(command.afterPhoto)photos.after=[image(command.afterPhoto)];
  next.photos=photos;
  if(command.signature){if(!String(command.signerName||"").trim())throw new FieldSupportError("Identifique quem assinou o aceite.");next.customerSignature=image(command.signature);next.customerSignatureName=String(command.signerName).trim().slice(0,120);next.customerSignatureAt=now;}
  if(command.action === "start"){next.status="Em andamento";next.checkInAt=order.checkInAt||now;}
  if(command.point && command.action === "start")next.checkInGps={latitude:command.point.latitude,longitude:command.point.longitude,accuracy:command.point.accuracy,capturedAt:command.point.capturedAt};
  if(command.point && command.action === "finish")next.checkOutGps={latitude:command.point.latitude,longitude:command.point.longitude,accuracy:command.point.accuracy,capturedAt:command.point.capturedAt};
  if(command.action === "finish") {
    const ids=Array.isArray(next.equipmentIds)?next.equipmentIds:next.equipmentId?[next.equipmentId]:[];
    if(!order.checkInAt || (!ids.length&&!approvedFieldException(order,"equipment")) || !String(next.diagnosis||"").trim() || !String(next.executedService||"").trim() || !photos.before?.length || !photos.after?.length || (!next.customerSignature&&!approvedFieldException(order,"signature")))throw new FieldSupportError("Conclusão exige check-in, equipamento vinculado, diagnóstico, serviço executado, fotos antes/depois e assinatura do cliente. Exceções de equipamento ou assinatura precisam de aprovação do gestor.");
    const checks=next.mobileChecklist as Record<string,boolean>|undefined;
    if(!checks || !checklistProgress(mobileChecklist(String(order.service||"")),{...checks,equipment:ids.length>0||approvedFieldException(order,"equipment"),signature:Boolean(next.customerSignature)||approvedFieldException(order,"signature")}).ready)throw new FieldSupportError("Complete o checklist técnico antes de concluir.");
    next.status="Concluída";next.checkOutAt=now;
  }
  next.fieldVersion=Number(order.fieldVersion||0)+1;next.updatedAt=now;
  return next;
}
