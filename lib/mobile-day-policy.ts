import type {MobileFieldOrder} from "./mobile-field";
export const OFFLINE_LEASE_KEY="proar-mobile-offline-lease-v1";
export type MobileDayData={connected:boolean;stateFound:boolean;mode:"operational";user:{displayName:string;role:string;canEdit:boolean;canApprove:boolean;scope:string;linkedEmployee:boolean;manager:boolean};orders:MobileFieldOrder[];summary:{today:number;inProgress:number;pending:number};lastReadAt:string;notice:string;offlineAccessUntil?:number};
export type CachedHistory={id:string;date:string;service:string;diagnosis:string;report:string;unit?:string};
export type MobileDayPackage={version:1;scope:string;day:string;preparedAt:number;validUntil:number;truncated:boolean;data:MobileDayData;histories:Record<string,CachedHistory[]>};
export const mobileCivilDay=(now=Date.now())=>new Date(now).toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
export function createDayPackage(data:MobileDayData,now=Date.now()):MobileDayPackage{
  const day=mobileCivilDay(now),scope=data.user?.scope;
  if(data.mode!=="operational"||!scope||scope.length>240||!Array.isArray(data.orders)||!Number.isFinite(data.offlineAccessUntil)||Number(data.offlineAccessUntil)<=now)throw new Error("Sessão online válida necessária para preparar o pacote.");
  const nextDay=new Date(`${day}T12:00:00-03:00`);nextDay.setUTCDate(nextDay.getUTCDate()+1);
  const midnight=Date.parse(`${mobileCivilDay(nextDay.getTime())}T00:00:00-03:00`);
  const eligible=data.orders.filter(o=>o.date===day||Boolean(o.checkInAt));
  const orders=eligible.slice(0,200);
  return {version:1,scope,day,preparedAt:now,validUntil:Math.min(Number(data.offlineAccessUntil),now+8*3600000,midnight),truncated:eligible.length>200,
    data:{...data,orders,summary:{today:orders.filter(o=>o.date===day).length,inProgress:orders.filter(o=>Boolean(o.checkInAt)).length,pending:orders.filter(o=>!o.checkInAt).length}},histories:{}};
}
export function validDayPackage(value:MobileDayPackage|null,scope:string,now=Date.now()):value is MobileDayPackage{
  return Boolean(value&&value.version===1&&value.scope===scope&&value.data?.user?.scope===scope&&value.day===mobileCivilDay(now)&&Number.isFinite(value.preparedAt)&&value.preparedAt<=now&&Number.isFinite(value.validUntil)&&value.validUntil>now&&value.validUntil<=Number(value.data.offlineAccessUntil)&&value.validUntil<=value.preparedAt+8*3600000&&Array.isArray(value.data.orders));
}
type StorageLike={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void;removeItem:(key:string)=>void};
export function rememberOfflineLease(storage:StorageLike,value:MobileDayPackage){storage.setItem(OFFLINE_LEASE_KEY,JSON.stringify({scope:value.scope,day:value.day,preparedAt:value.preparedAt,validUntil:value.validUntil}));}
export function readOfflineLease(storage:Pick<StorageLike,"getItem">,now=Date.now()){
  try{const v=JSON.parse(storage.getItem(OFFLINE_LEASE_KEY)||"null");return v&&typeof v.scope==="string"&&v.scope.length<=240&&v.day===mobileCivilDay(now)&&Number.isFinite(v.preparedAt)&&v.preparedAt<=now&&Number.isFinite(v.validUntil)&&v.validUntil>now&&v.validUntil<=v.preparedAt+8*3600000?v as {scope:string;day:string;preparedAt:number;validUntil:number}:null;}catch{return null;}
}
export function clearOfflineLease(storage:Pick<StorageLike,"removeItem">){try{storage.removeItem(OFFLINE_LEASE_KEY);}catch{}}
export function draftRecoveryState(draft:{pendingSubmission?:{blocked?:boolean;sentAt?:number}}){return draft.pendingSubmission?.blocked?"BLOCKED":draft.pendingSubmission?.sentAt?"AWAITING_CONFIRMATION":draft.pendingSubmission?"PENDING":"DRAFT";}
