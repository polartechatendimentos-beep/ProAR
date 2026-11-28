import { stateSaveOutcome } from "./state-save-confirmation.ts";

type RecordValue = { id: string; [key: string]: unknown };
type State = { customers: RecordValue[]; serviceOrders: RecordValue[]; moduleRecords: Record<string, RecordValue[]>; _revision?: number };
type Section = "customers" | "serviceOrders" | "moduleRecords";
type Change = { section: Section; module?: string; id: string; before: RecordValue | null; after: RecordValue };
export type DesktopOfflineOperation = { id: string; at: string; changes: Change[]; status?: "review" };
type LocalQueue = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;
const offlineModules = new Set(["Serviços", "Produtos", "Equipamentos", "Unidades e setores", "Fornecedores", "Auditoria"]);
const sensitiveKeys=/^(?:value|cost|unitvalue|stock.*|fiscal.*|nfe.*|nfse.*|nfce.*|tax.*|discount.*|customerid|employeeid|technicianid|credit.*|balance.*|financial.*|password.*|senha.*)$/i;
const compare = (a: unknown,b: unknown) => canonical(a) === canonical(b);
function canonical(value: unknown): string {
  if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
  if(value && typeof value === "object")return "{"+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+":"+canonical(v)).join(",")+"}";
  return JSON.stringify(value) ?? "null";
}
function allowedOffline(section:Section,module:string|undefined,before:RecordValue|null,after:RecordValue){
  if(section==="serviceOrders")return false; // Field OS has its own versioned queue.
  if(section==="customers")return Boolean(before) && !/inativ/i.test(String(after.status??"")) && ["creditLimit","balancePosted","financialStatus"].every(k=>compare(before?.[k],after[k]));
  if(!module || !offlineModules.has(module))return false;
  if(module==="Auditoria")return before===null;
  if(!before || /cancelad|recebid|inativ/i.test(String(after.status??"")))return false;
  if([...new Set([...Object.keys(before),...Object.keys(after)])].some(k=>sensitiveKeys.test(k)&&!compare(before[k],after[k])))return false;
  return true;
}

export function desktopOperationChanges(before:State,after:State):Change[] {
  const changes:Change[]=[];
  const add=(section:Section, old:RecordValue[], next:RecordValue[], module?:string)=>{
    const oldById=new Map(old.map(v=>[v.id,v]));
    const nextIds=new Set(next.map(v=>v.id));
    if(module!=="Auditoria" && old.some(v=>!nextIds.has(v.id)))throw new Error("Exclusões e alterações críticas precisam de conexão.");
    for(const row of next){
      if(!row.id)throw new Error("Identificador ausente.");
      const previous=oldById.get(row.id)??null;
      if(compare(previous,row))continue;
      if(!allowedOffline(section,module,previous,row))throw new Error("Esta operação precisa de confirmação online. Os campos continuam em edição.");
      changes.push({section,module,id:row.id,before:previous,after:row});
    }
  };
  add("customers",before.customers,after.customers);
  add("serviceOrders",before.serviceOrders,after.serviceOrders);
  for(const moduleName of new Set([...Object.keys(before.moduleRecords),...Object.keys(after.moduleRecords)]))add("moduleRecords",before.moduleRecords[moduleName]??[],after.moduleRecords[moduleName]??[],moduleName);
  return changes;
}
function validDesktopOperation(row:DesktopOfflineOperation){
  return row && typeof row.id==="string" && typeof row.at==="string" && Array.isArray(row.changes) && row.changes.length>0 &&
  row.changes.every(c=>c && typeof c.id==="string" && c.after?.id===c.id && (!c.before || c.before.id===c.id) && ["customers","serviceOrders","moduleRecords"].includes(c.section) && allowedOffline(c.section,c.module,c.before,c.after));
}
export function desktopQueuePrefix(company:string,username:string){
  if(!company || !username)throw new Error("Sessão sem identificação para a fila.");
  return "proar:desktop:offline:v2:"+encodeURIComponent(company)+":"+encodeURIComponent(username.trim().toLowerCase())+":";
}
export function readDesktopOperations(store:LocalQueue,prefix:string){
  const rows:DesktopOfflineOperation[]=[];
  for(let i=0;i<store.length;i++){
    const key=store.key(i);
    if(!key?.startsWith(prefix))continue;
    const raw=store.getItem(key);
    if(!raw)continue;
    const row=JSON.parse(raw) as DesktopOfflineOperation;
    if(!validDesktopOperation(row)||key!==prefix+row.id)throw new Error("Fila local precisa de revisão.");
    rows.push(row);
  }
  return rows.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
}
export function enqueueDesktopOperation(store:LocalQueue,prefix:string,op:DesktopOfflineOperation) {
  if(!validDesktopOperation(op)||!op.changes.some(c=>c.module!=="Auditoria"))throw new Error("Nenhuma alteração de cadastro foi identificada.");
  const rows=readDesktopOperations(store,prefix);
  const intent=(v:DesktopOfflineOperation)=>v.changes.filter(c=>c.module!=="Auditoria");
  if(rows.some(v=>compare(intent(v),intent(op))))return;
  const data=JSON.stringify(op);
  if(rows.length>=64 || data.length>180000)throw new Error("A fila local está cheia. Revise os itens existentes.");
  store.setItem(prefix+op.id,data);
}
export function legacyDesktopOperationsCount(store:LocalQueue,company:string){
  const raw=store.getItem("proar-offline-queue");
  if(!raw)return 0;
  const rows=JSON.parse(raw);
  return Array.isArray(rows)?rows.filter(r=>r?.companyId===company).length:0;
}
function records(state:State,c:Change){
  return c.section==="moduleRecords" ? state.moduleRecords[c.module??""]??[] : state[c.section];
}

export function applyDesktopOperation(current: State, op: DesktopOfflineOperation) {
  if(!validDesktopOperation(op))return {kind:"conflict"} as const;
  const next:State={...current,moduleRecords:{...current.moduleRecords}};
  const changeBusiness=op.changes.filter(c=>c.module!=="Auditoria");
  if(changeBusiness.length && changeBusiness.every(c=>compare(records(current,c).find(r=>r.id===c.id)??null,c.after)))return {kind:"already-saved"} as const;
  for(const c of op.changes){
    const rows=records(next,c);
    const existing=rows.find(v=>v.id===c.id)??null;
    if(compare(existing,c.after))continue;
    if(!compare(existing,c.before))return {kind:"conflict"} as const;
    const updated=existing ? rows.map(v=>v.id===c.id?c.after:v) : [c.after,...rows];
    if(c.section==="moduleRecords")next.moduleRecords[c.module!]=updated;
    else next[c.section]=updated;
  }
  return {kind:"write",state:next} as const;
}

function confirmsIntent(state:State,op:DesktopOfflineOperation) {
  const business=op.changes.filter(c=>c.module!=="Auditoria");
  if(!business.length)return false;
  return business.every(c=>{
    const record=records(state,c).find(r=>r.id===c.id);
    if(!record)return false;
    const before:Record<string,unknown>=c.before??{};
    return [...new Set([...Object.keys(before),...Object.keys(c.after)])].every(k=>compare(before[k],c.after[k])||compare(record[k],c.after[k]));
  });
}

export async function syncDesktopOperations(args:{
  store:LocalQueue;prefix:string;
  read:()=>Promise<State|null>;
  write:(state:State)=>Promise<{status:number;body:unknown}>;
  active?:()=>boolean;
}) {
  let confirmed=0;
  const {store,prefix,read,write,active=()=>true}=args;
  for(const op of readDesktopOperations(store,prefix)){
    if(!active())break;
    const current=await read().catch(()=>null);
    if(!current || !Array.isArray(current.customers) || !Array.isArray(current.serviceOrders) || !current.moduleRecords || !Number.isSafeInteger(current._revision) || !active())break;
    const attempt=applyDesktopOperation(current,op);
    if(attempt.kind==="already-saved"){store.removeItem(prefix+op.id);confirmed++;continue;}
    if(attempt.kind==="conflict"){
      store.setItem(prefix+op.id,JSON.stringify({...op,status:"review"}));
      break;
    }
    const result=await write(attempt.state).catch(()=>null);
    if(!result || !active())break;
    const receipt=stateSaveOutcome(result.status,result.body,current._revision!);
    if(receipt.confirmed && confirmsIntent(receipt.state as State,op)){store.removeItem(prefix+op.id);confirmed++;continue;}
    if(receipt.confirmed){store.setItem(prefix+op.id,JSON.stringify({...op,status:"review"}));break;}
    if(result.status===409 || result.status===422 || result.status===400)store.setItem(prefix+op.id,JSON.stringify({...op,status:"review"}));
    break;
  }
  const remaining=readDesktopOperations(store,prefix);
  return {confirmed,remaining};
}
