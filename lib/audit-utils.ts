export type AuditChange = { field:string; before:string; after:string };

const ignored = new Set(["createdAt","updatedAt","password","employeePasswordHash","token","certificate","pfxBase64"]);

const labelMap: Record<string,string> = {
  name:"Nome", status:"Situação", client:"Cliente", phone:"Telefone", email:"E-mail", address:"Endereço",
  value:"Valor", cost:"Custo", category:"Categoria", description:"Descrição", stockCurrent:"Estoque atual",
  stockMin:"Estoque mínimo", stockMax:"Estoque máximo", stockLocation:"Localização", employeeRole:"Cargo",
  accessProfile:"Perfil de acesso", discount:"Desconto", discountPercent:"Desconto (%)", date:"Data",
  tech:"Técnico", service:"Serviço", unit:"Unidade", sector:"Setor", room:"Ambiente",
};

const printable=(value:unknown)=>{
  if(value===undefined||value===null||value==="") return "—";
  if(typeof value==="object") return Array.isArray(value)?`${value.length} item(ns)`:"Dados estruturados";
  return String(value);
};

export function diffAuditRecord(before:Record<string,unknown>|undefined,next:Record<string,unknown>|undefined):AuditChange[]{
  if(!before||!next) return [];
  const keys=new Set([...Object.keys(before),...Object.keys(next)]);
  return [...keys].filter(key=>!ignored.has(key)&&!/(password|token|secret|hash)/i.test(key)).flatMap(key=>{
    const a=printable(before[key]),b=printable(next[key]);
    if(a===b) return [];
    return [{field:labelMap[key]??key,before:a,after:b}];
  }).slice(0,24);
}

export function auditMatches(record:Record<string,unknown>,moduleName:string,recordId:string,recordName?:string){
  if(String(record.recordId??"")===recordId && (!record.auditModule || String(record.auditModule)===moduleName)) return true;
  const text=`${record.description??""} ${record.name??""}`.toLocaleLowerCase("pt-BR");
  return text.includes(recordId.toLocaleLowerCase("pt-BR")) || Boolean(recordName&&text.includes(recordName.toLocaleLowerCase("pt-BR")));
}

export type StructuredAuditEntry={
  action:string;
  moduleName:string;
  recordId:string;
  recordName?:string;
  actor:string;
  reason?:string;
  createdAt:string;
  changes:AuditChange[];
};

export function buildStructuredAuditEntry(input:{
  action:string;
  moduleName:string;
  recordId:string;
  recordName?:string;
  actor:string;
  reason?:string;
  before?:Record<string,unknown>;
  after?:Record<string,unknown>;
  createdAt?:string;
}):StructuredAuditEntry{
  return {
    action:input.action,
    moduleName:input.moduleName,
    recordId:input.recordId,
    recordName:input.recordName,
    actor:input.actor,
    reason:input.reason,
    createdAt:input.createdAt||new Date().toISOString(),
    changes:diffAuditRecord(input.before,input.after),
  };
}
