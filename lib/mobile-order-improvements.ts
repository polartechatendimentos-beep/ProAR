import { createHash } from "node:crypto";
import { FieldSupportError } from "./field-support.ts";
import { assignedToSession, canSeeAllMobileOrders, isOpenMobileOrder, type MobileFieldSession } from "./mobile-field.ts";
import { applyFieldOrder, eligibleFieldEquipment, fieldOrderFingerprint, type FieldOrderCommand } from "./mobile-workday.ts";

type Item=Record<string,unknown>;
export type FieldException={id:string;kind:"signature"|"equipment";reason:string;status:"Pendente"|"Aprovado"|"Rejeitado";requestedBy:string;requestedAt:string;decidedBy?:string;decidedAt?:string;decisionReason?:string};
export type ImprovementCommand={requestId:string;orderId:string;expectedVersion:number;expectedToken:string;action:"register-equipment"|"request-exception"|"decide-exception";equipment?:{name:string;brand?:string;model?:string;serialNumber?:string;photo?:string};kind?:FieldException["kind"];reason?:string;exceptionId?:string;decision?:"Aprovado"|"Rejeitado"};
export function improveFieldOrder(order:Item,equipment:Item[],command:ImprovementCommand,session:MobileFieldSession,canApprove:boolean,now:string){
  if(!assignedToSession(order,session))throw new FieldSupportError("OS não atribuída a este colaborador.",403);
  if(!isOpenMobileOrder(order.status))throw new FieldSupportError("A OS já foi concluída ou cancelada.",409);
  if(Number(order.fieldVersion||0)!==command.expectedVersion || fieldOrderFingerprint(order)!==command.expectedToken)throw new FieldSupportError("Esta OS foi alterada. Atualize antes de continuar.",409);
  const next={...order},all=[...equipment];
  const exceptions=Array.isArray(order.fieldExceptions)?(order.fieldExceptions as FieldException[]).map(item=>({...item})):[];
  if(command.action==="register-equipment"){
    const input=command.equipment;
    if(!input || !String(input.name||"").trim() || String(input.name).length>150)throw new FieldSupportError("Informe a identificação do equipamento (até 150 caracteres).");
    if(!order.customerId && !order.client)throw new FieldSupportError("A OS precisa identificar o cliente antes do cadastro.");
    if(!input.photo || input.photo.length>350000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(input.photo))throw new FieldSupportError("Fotografe o equipamento para cadastrá-lo.");
    const serial=String(input.serialNumber||"").trim().slice(0,120);
    if(serial && all.some(item=>String(item.serialNumber||"").trim().toLowerCase()===serial.toLowerCase()))throw new FieldSupportError("Número de série já cadastrado. Selecione o equipamento existente.",409);
    const record:Item={id:`EQ-MOB-${createHash("sha256").update(command.requestId).digest("hex").slice(0,20)}`,name:String(input.name).trim(),brand:String(input.brand||"").trim().slice(0,100),model:String(input.model||"").trim().slice(0,100),serialNumber:serial,photo:input.photo,customerId:order.customerId,client:order.client,unitId:order.unitId,sectorId:order.sectorId,roomId:order.roomId,structureId:order.structureId,unit:order.unit,status:"Ativo",createdAt:now,createdBy:session.username};
    all.push(record);
    const existing=Array.isArray(order.equipmentIds)?order.equipmentIds.map(String):order.equipmentId?[String(order.equipmentId)]:[];
    if(existing.length>=20)throw new FieldSupportError("A OS já tem o limite de 20 equipamentos.");
    return {order:applyFieldOrder(order,{...command,action:"save",equipmentIds:[...existing,String(record.id)]} as FieldOrderCommand,session,now,all),equipment:all};
  }
  if(command.action==="request-exception"){
    if(!["signature","equipment"].includes(command.kind||""))throw new FieldSupportError("Tipo de exceção inválido.");
    const reason=String(command.reason||"").trim();
    if(reason.length<10 || reason.length>1000)throw new FieldSupportError("Descreva o motivo da exceção (10 a 1000 caracteres).");
    if(exceptions.some(item=>item.kind===command.kind && item.status!=="Rejeitado"))throw new FieldSupportError("Esta exceção já foi solicitada ou aprovada.",409);
    if(exceptions.length>=20)throw new FieldSupportError("Limite de solicitações desta OS atingido.");
    exceptions.push({id:command.requestId,kind:command.kind!,reason,status:"Pendente",requestedBy:session.username,requestedAt:now});
  }else if(command.action==="decide-exception"){
    if(!canApprove || !canSeeAllMobileOrders(session))throw new FieldSupportError("Somente o gestor com permissão de aprovação pode decidir a exceção.",403);
    const item=exceptions.find(item=>item.id===command.exceptionId);
    if(!item || item.status!=="Pendente")throw new FieldSupportError("Solicitação não encontrada ou já decidida.",409);
    if(!["Aprovado","Rejeitado"].includes(command.decision||"") || String(command.reason||"").trim().length<10 || String(command.reason).length>1000)throw new FieldSupportError("Informe decisão e justificativa (10 a 1000 caracteres).");
    Object.assign(item,{status:command.decision,decidedBy:session.username,decidedAt:now,decisionReason:String(command.reason).trim()});
  }else throw new FieldSupportError("Operação mobile inválida.");
  next.fieldExceptions=exceptions;next.fieldVersion=Number(order.fieldVersion||0)+1;next.updatedAt=now;
  return {order:next,equipment:all};
}

export function fieldEquipmentHistory(order:Item,equipmentId:string,equipment:Item[],orders:Item[]){
  const chosen=eligibleFieldEquipment(order,equipment).find(item=>String(item.id)===equipmentId);
  if(!chosen)throw new FieldSupportError("Equipamento não disponível para este atendimento.",403);
  const safeImage=(value:unknown)=>typeof value==="string" && value.length<=350000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)?value:"";
  return orders.filter(item=>item.id!==order.id && !isOpenMobileOrder(item.status) && !/cancelad/i.test(String(item.status)) && (item.customerId?item.customerId===order.customerId:item.client===order.client) && (Array.isArray(item.equipmentIds)?item.equipmentIds.includes(equipmentId):item.equipmentId===equipmentId)).sort((a,b)=>String(b.checkOutAt||b.date||"").localeCompare(String(a.checkOutAt||a.date||""))).slice(0,10).map(item=>({id:String(item.id),date:String(item.checkOutAt||item.date||""),service:String(item.service||"").slice(0,300),diagnosis:String(item.diagnosis||"").slice(0,4000),report:String(item.executedService||"").slice(0,8000),before:safeImage((item.photos as {before?:unknown[]}|undefined)?.before?.[0]),after:safeImage((item.photos as {after?:unknown[]}|undefined)?.after?.[0])}));
}
