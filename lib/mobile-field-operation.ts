export type MobileFieldStep="arrival"|"checkin"|"diagnosis"|"service"|"material"|"photos"|"signature"|"finish";
export const MOBILE_FIELD_STEPS:MobileFieldStep[]=["arrival","checkin","diagnosis","service","material","photos","signature","finish"];
export type TechnicianSkill="Split"|"Cassete"|"Piso Teto"|"VRF"|"Elétrica"|"NR10"|"NR35";
export type FieldTechnician={id:string;name:string;skills:string[];active:boolean;available:boolean;distanceKm?:number;openOrders:number;documentsValid?:boolean};
export type FieldOrder={id:string;client:string;status:string;skills?:string[];scheduledAt?:string;technicianId?:string};
export function mobileRole(role?:string,permissions:string[]=[]){return role==="Administrador"||role==="Gerência"||permissions.includes("*")||permissions.includes("rotas.visualizar")?"manager":"technician" as const}
export function technicianScore(t:FieldTechnician,o:FieldOrder){const required=o.skills||[];const skills=required.filter(s=>t.skills.includes(s)).length;return (t.active?20:-100)+(t.available?25:0)+(t.documentsValid===false?-80:10)+skills*20-Math.min(30,t.openOrders*5)-Math.min(25,t.distanceKm||0)}
export function suggestTechnicians(techs:FieldTechnician[],order:FieldOrder){return [...techs].filter(t=>t.active&&t.documentsValid!==false).sort((a,b)=>technicianScore(b,order)-technicianScore(a,order))}
export function nextFieldStep(done:MobileFieldStep[]){return MOBILE_FIELD_STEPS.find(s=>!done.includes(s))||"finish"}
export function canConfirmOffline(kind:string){return !["fiscal","finance","stock-adjustment","payment","refund"].includes(kind)}
