import {agendaInsights} from "./agenda-insights.ts";
import {closedAgendaOrder,validAgendaDate,type AgendaOrder} from "./agenda-calendar.ts";
type Row=Record<string,unknown>;
/** Use only after the request is authorized and the complete tenant state is selected. */
export function assertOrderScheduleChanges(previous:Row[],incoming:Row[]){
 const fields=["date","time","tech","employeeId","techId","estimatedDurationMinutes","durationMinutes"] as const;
 const rows:AgendaOrder[]=incoming.map(row=>({...row,id:String(row.id),client:String(row.client||""),unit:String(row.unit||""),service:String(row.service||""),tech:String(row.tech||""),date:String(row.date||""),time:String(row.time||""),address:String(row.address||""),status:String(row.status||""),tone:String(row.tone||""),companyId:"authorized-tenant-state"}));
 for(const candidate of rows){const old=previous.find(row=>row.id===candidate.id);if(closedAgendaOrder(candidate)||old&&fields.every(key=>JSON.stringify(old[key])===JSON.stringify(candidate[key]))&&!closedAgendaOrder({...candidate,status:String(old.status||"")}))continue;
  if(!candidate.date||!candidate.time||!candidate.tech||/^(não definido|a definir)$/i.test(candidate.tech))continue;
  if(!validAgendaDate(candidate.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(candidate.time))throw new Error("Informe uma data e um horário válidos para programar a OS.");
  const duration=Number(candidate.estimatedDurationMinutes||candidate.durationMinutes);
  if(!Number.isInteger(duration)||duration<=0)continue;
  const [hour,minute]=candidate.time.split(":").map(Number);if(duration>1440||hour*60+minute+duration>1440)throw new Error("A duração do atendimento precisa terminar no mesmo dia.");
  const analysis=agendaInsights("authorized-tenant-state",rows,candidate.date,candidate.date);
  if(analysis.conflicts.some(pair=>pair.first.id===candidate.id||pair.second.id===candidate.id))throw new Error("Conflito de horário para o técnico selecionado. Escolha outro horário ou responsável.");
 }
}
