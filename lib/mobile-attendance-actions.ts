import {FieldSupportError} from "./field-support.ts";
import {canSeeAllMobileOrders,type MobileFieldSession} from "./mobile-field.ts";
type Item=Record<string,unknown>;
export const attendanceActions=["pause-attendance","resume-attendance","visit-no-service","request-material","request-scope","request-reschedule","decide-request","internal-message","report-delay","set-duration","set-warranty"];
export type AttendanceCommand={action:string;requestId:string;note?:string;date?:string;time?:string;minutes?:number;days?:number;targetId?:string;decision?:string};
type Entry={id:string;kind:string;note:string;status:string;requestedBy:string;requestedAt:string;date?:string;time?:string;decidedBy?:string;decidedAt?:string;decisionNote?:string};
export function applyAttendanceAction(order:Item,command:AttendanceCommand,session:MobileFieldSession,canApprove:boolean,now:string){
  const next={...order};const note=String(command.note||"").trim();
  const requiresNote=["pause-attendance","visit-no-service","request-material","request-scope","request-reschedule","decide-request","internal-message","report-delay","set-warranty"];
  if(requiresNote.includes(command.action)&&(note.length<5||note.length>2000))throw new FieldSupportError("Informe o motivo ou descrição (5 a 2000 caracteres).");
  const events=Array.isArray(order.fieldEvents)?[...order.fieldEvents]:[];
  const requests:Entry[]=Array.isArray(order.fieldRequests)?(order.fieldRequests as Entry[]).map(item=>({...item})):[];
  if(events.length>=200 || requests.length>=50)throw new FieldSupportError("Limite de registros desta OS atingido.");
  if(command.action==="pause-attendance"){
    if(!order.checkInAt || order.fieldAttendancePaused)throw new FieldSupportError("Inicie o atendimento antes de pausar, ou retome a pausa existente.",409);
    next.fieldAttendancePaused=true;next.status="Aguardando atendimento";
  }else if(command.action==="resume-attendance"){
    if(!order.checkInAt || !order.fieldAttendancePaused)throw new FieldSupportError("Não há atendimento pausado nesta OS.",409);
    next.fieldAttendancePaused=false;next.status="Em andamento";
  }else if(command.action==="visit-no-service"){
    next.status="Aguardando reagendamento";next.fieldAttendancePaused=Boolean(order.checkInAt);
  }else if(["request-material","request-scope","request-reschedule"].includes(command.action)){
    const entry:Entry={id:command.requestId,kind:command.action,note,status:"Pendente",requestedBy:session.username,requestedAt:now};
    if(command.action==="request-reschedule"){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(command.date||"") || Number.isNaN(Date.parse(command.date!)) || new Date(command.date!).toISOString().slice(0,10)!==command.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(command.time||""))throw new FieldSupportError("Informe data e horário válidos para reagendamento.");
      entry.date=command.date;entry.time=command.time;
    }
    requests.push(entry);
  }else if(command.action==="decide-request"){
    if(!canApprove || !canSeeAllMobileOrders(session))throw new FieldSupportError("Somente a gestão com permissão de aprovação pode decidir.",403);
    const entry=requests.find(item=>item.id===command.targetId);
    if(!entry||entry.status!=="Pendente")throw new FieldSupportError("Solicitação já decidida ou não encontrada.",409);
    if(!["Aprovado","Rejeitado"].includes(command.decision||""))throw new FieldSupportError("Decisão inválida.");
    Object.assign(entry,{status:command.decision,decidedBy:session.username,decidedAt:now,decisionNote:note});
    if(entry.kind==="request-reschedule"&&command.decision==="Aprovado"){next.date=entry.date;next.time=entry.time;next.status="Agendada";next.googleCalendarSyncedAt="";}
  }else if(["set-duration","report-delay"].includes(command.action)){
    if(!Number.isInteger(command.minutes)||command.minutes!<1||command.minutes!>1440)throw new FieldSupportError("Informe duração de 1 a 1440 minutos.");
    if(command.action==="set-duration")next.estimatedDurationMinutes=command.minutes;else next.fieldDelay={minutes:command.minutes,note,reportedBy:session.username,reportedAt:now};
  }else if(command.action==="set-warranty"){
    if(!canSeeAllMobileOrders(session))throw new FieldSupportError("A gestão deve registrar a garantia do serviço.",403);
    if(!Number.isInteger(command.days)||command.days!<0||command.days!>3650)throw new FieldSupportError("Informe garantia de 0 a 3650 dias.");
    next.fieldWarranty={days:command.days,terms:note,recordedBy:session.username,recordedAt:now};
  }else if(command.action!=="internal-message")throw new FieldSupportError("Operação de atendimento inválida.");
  events.push({id:command.requestId,kind:command.action,note,createdBy:session.username,createdAt:now});
  next.fieldEvents=events;next.fieldRequests=requests;next.fieldVersion=Number(order.fieldVersion||0)+1;next.updatedAt=now;
  return next;
}
