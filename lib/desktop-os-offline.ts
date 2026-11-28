import {agendaToday,validAgendaDate} from "./agenda-calendar.ts";
import {stateSaveOutcome} from "./state-save-confirmation.ts";

type Row={id:string;[key:string]:unknown};
type OSIntent={creationRequestId:string;client:string;status:string;[key:string]:unknown};
type State={customers:Row[];serviceOrders:Row[];moduleRecords:Record<string,Row[]>;_revision?:number};
type Store=Pick<Storage,"getItem"|"setItem"|"removeItem"|"length"|"key">;
export type DesktopOsDraft={intent:OSIntent;createdAt:string;review?:string};
const token=/^[a-zA-Z0-9-]{12,100}$/;
const osFields=new Set("creationRequestId client customerId unit unitId sector sectorId room roomId structureId service tech date time address status tone avatar catalogItems equipmentIds total servicesTotal productsTotal discount request priority serviceType checklist tag externalCode checkInRequirement estimatedDurationMinutes pmocRepeatEnabled npsEnabled whatsappPhone whatsappUpdatesEnabled whatsappAppointmentReminderEnabled whatsappStatusUpdatesEnabled appointmentReminderHours lastMaintenanceDate reviewPeriodMonths notifyDaysBefore".split(" "));
const isIntent=(row:OSIntent)=>row&&typeof row.creationRequestId==="string"&&token.test(row.creationRequestId)&&typeof row.client==="string"&&Boolean(row.client.trim())&&["Rascunho","Agendada"].includes(row.status)&&Object.keys(row).every(key=>osFields.has(key));
export const desktopOsQueuePrefix=(queueScope:string)=>queueScope?"os-draft:"+queueScope:"";
export function readDesktopOsDrafts(store:Store,prefix:string){
 if(!prefix)return [];
 const entries:DesktopOsDraft[]=[];
 for(let i=0;i<store.length;i++){
  const key=store.key(i);
  if(!key?.startsWith(prefix))continue;
  const raw=store.getItem(key);
  if(!raw)continue;
  const draft=JSON.parse(raw) as DesktopOsDraft;
  if(!isIntent(draft?.intent)||key!==prefix+draft.intent.creationRequestId||!Number.isFinite(Date.parse(draft.createdAt)))throw new Error("Há rascunhos de OS que precisam de revisão local.");
  entries.push(draft);
 }
 return entries.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}
export function saveDesktopOsDraft(store:Store,prefix:string,order:Row,at=new Date().toISOString()){
 if(!prefix)throw new Error("Não é possível guardar a OS sem uma sessão local nesta empresa.");
 const intent=Object.fromEntries(Object.entries(order).filter(([key])=>osFields.has(key))) as OSIntent;
 if(!isIntent(intent))throw new Error("Selecione um cliente para guardar esta OS neste aparelho.");
 const key=prefix+intent.creationRequestId;
 const entries=readDesktopOsDrafts(store,prefix),existing=entries.find(row=>row.intent.creationRequestId===intent.creationRequestId);
 const data=JSON.stringify({intent,createdAt:existing?.createdAt??at});
 if(data.length>80_000||(!existing&&entries.length>=24))throw new Error("Limite de rascunhos de OS atingido neste aparelho.");
 store.setItem(key,data);
}
export function nextDesktopOsId(orders:Row[]){
 const sequence=orders.reduce((max,row)=>/^#?OS-\d+$/.test(row.id)?Math.max(max,Number(row.id.replace(/\D/g,""))||0):max,15499)+1;
 return `#OS-${String(sequence).padStart(5,"0")}`;
}
export async function syncDesktopOsDraft({
 store,prefix,id,read,write,active=()=>true,now=()=>new Date(),
}:{store:Store;prefix:string;id:string;read:()=>Promise<State|null>;write:(state:State)=>Promise<{status:number;body:unknown}>;active?:()=>boolean;now?:()=>Date}){
 const key=prefix+id, draft=readDesktopOsDrafts(store,prefix).find(row=>row.intent.creationRequestId===id);
 if(!draft||!active())return null;
 const current=await read().catch(()=>null);
 if(!current||!Array.isArray(current.customers)||!Array.isArray(current.serviceOrders)||!current.moduleRecords||!Number.isSafeInteger(current._revision)||!active())return null;
 const existing=current.serviceOrders.find(row=>row.creationRequestId===id);
 if(existing){store.removeItem(key);return existing;}
 const review=(message:string)=>{store.setItem(key,JSON.stringify({...draft,review:message}));return null;};
 const customer=current.customers.find(row=>row.id===draft.intent.customerId&&row.name===draft.intent.client);
 if(!customer||/inativ/i.test(String(customer.status||""))||["Bloqueado","Restrito"].includes(String(customer.financialStatus||"")))return review("O cliente mudou, está bloqueado ou não está disponível. Revise os dados antes de enviar.");
 if(draft.intent.status==="Agendada"){
  const technicians=(current.moduleRecords.Funcionários||[]).filter(row=>row.name===draft.intent.tech&&!/inativ/i.test(String(row.status||"")));
  const date=String(draft.intent.date||""),time=String(draft.intent.time||""),stamp=now();
  const localTime=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(stamp);
  if(!validAgendaDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||date<agendaToday(stamp)||(date===agendaToday(stamp)&&time<=localTime))return review("O horário deste pedido passou ou não é válido. Ajuste antes de enviar.");
  if(technicians.length!==1)return review("O técnico não está disponível ou o nome ficou ambíguo. Revise antes de enviar.");
 }
 // Prefer the original explicit intent, but suppress external notifications during offline replay.
 const row={...draft.intent,id:nextDesktopOsId(current.serviceOrders),whatsappUpdatesEnabled:false,whatsappAppointmentReminderEnabled:false,whatsappStatusUpdatesEnabled:false};
 const result=await write({...current,serviceOrders:[row,...current.serviceOrders]}).catch(()=>null);
 if(!result||!active())return null;
 const receipt=stateSaveOutcome(result.status,result.body,current._revision!);
 if(receipt.confirmed){
  const saved=receipt.state.serviceOrders.find(record=>record.id===row.id&&record.creationRequestId===id);
  if(saved){store.removeItem(key);return saved;}
  return review("O banco não devolveu esta OS. Atualize antes de tentar novamente.");
 }
 if([400,403,409,422].includes(result.status))return review(receipt.error);
 return null;
}

/** Update only proposed schedule fields, retaining identity for unknown-receipt reconciliation. */
export function reviseDesktopOsDraft(store:Store,prefix:string,id:string,fields:{date:string;time:string;tech:string}){
 const draft=readDesktopOsDrafts(store,prefix).find(row=>row.intent.creationRequestId===id);
 if(!draft||draft.intent.status!=="Agendada")throw new Error("Pedido local não encontrado.");
 if(!validAgendaDate(fields.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.time)||!fields.tech.trim())throw new Error("Informe data, horário e técnico.");
 store.setItem(prefix+id,JSON.stringify({...draft,intent:{...draft.intent,...fields},review:undefined}));
}
