import {assignedToSession} from "./mobile-field.ts";
type Row=Record<string,unknown>;
export type AccessState=Row&{customers?:Row[];serviceOrders?:Row[];moduleRecords?:Record<string,Row[]>};
export type StateActor={username:string;displayName?:string;role:string;permissions:string[]};
type Can=(permission:string)=>boolean;
const rows=(value:unknown):Row[]=>Array.isArray(value)?value.filter((row):row is Row=>Boolean(row&&typeof row==="object"&&!Array.isArray(row))):[];
const admin=(actor:StateActor)=>actor.role==="Administrador"||actor.permissions.includes("*");
const technician=(actor:StateActor)=>/^(tecnico(?: de campo)?|prestador(?: de servico)?)$/.test(actor.role.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase());
const rules:Record<string,string[]>={
 "Clientes":["clientes.visualizar"],"Unidades e setores":["clientes.visualizar","os.visualizar"],
 "Equipamentos":["equipamentos.visualizar"],"Funcionários":["configuracoes.usuarios"],
 "Financeiro":["financeiro.visualizar"],"Contas financeiras":["financeiro.visualizar"],"Razão financeiro":["financeiro.visualizar"],"Conciliações":["financeiro.visualizar"],
 "Estoque":["estoque.visualizar"],"Livro de estoque":["estoque.visualizar"],"Reservas de estoque":["estoque.visualizar"],
 "Produtos":["estoque.visualizar"],"Compras":["compras.visualizar"],"Fornecedores":["compras.visualizar"],
 "Orçamentos":["comercial.editar"],"Vendas":["comercial.editar"],"Serviços":["catalogo.editar"],
 "Obras":["obras.visualizar"],"Licitações":["licitacoes.visualizar"],"Certames":["licitacoes.visualizar"],"Empenhos":["licitacoes.visualizar"],
 "Acompanhamento de licitações":["licitacoes.visualizar"],"Documentação / Habilitação":["licitacoes.visualizar"],"Composições de licitação":["licitacoes.visualizar"],
 "Lembretes":["os.visualizar"],"PMOC":["PMOC e conformidade"],"Refrigerantes":["PMOC e conformidade","Base Técnica"],"Base Técnica":["Base Técnica"],
 "Códigos HVAC":["Base Técnica"],"Códigos de erro":["Base Técnica"],"ErrorCode":["Base Técnica"],"Manuais Técnicos":["Base Técnica"],"Manuais HVAC":["Base Técnica"],"DiagnosticManual":["Base Técnica"],
 "Aprovações":["aprovacoes.visualizar","aprovacoes.aprovar"],"Auditoria":["auditoria.visualizar"],"Auditoria operacional":["auditoria.visualizar"],
};
function moduleVisible(module:string,actor:StateActor,can:Can){
 if(admin(actor))return true;
 const allowed=can(module)||(rules[module]||[]).some(can);
 if(technician(actor)&&["Financeiro","Contas financeiras","Razão financeiro","Conciliações","Funcionários","Auditoria","Auditoria operacional"].includes(module))return false;
 return allowed;
}
const secret=(key:string)=>{
 const name=key.replace(/[_-]/g,"").toLowerCase();
 return /password|senha/.test(name)||["secret","encryptedsecret","clientsecret","apikey","servicekey","servicerolekey"].includes(name)||/privatekey$|accesstoken$|refreshtoken$/.test(name);
};
const financial=(key:string)=>["total","cost","unitValue","servicesTotal","productsTotal","discount","nfseValue","costLines","costMarginPercent","costTaxPercent"].includes(key);
function protectedField(key:string,actor:StateActor,write=false){
 return (secret(key)&&(!write||!admin(actor)))||(technician(actor)&&financial(key));
}
function redact(value:unknown,actor:StateActor):unknown{
 if(Array.isArray(value))return value.map(item=>redact(item,actor));
 if(!value||typeof value!=="object")return value;
 return Object.fromEntries(Object.entries(value).filter(([key])=>!protectedField(key,actor)).map(([key,item])=>[key,redact(item,actor)]));
}
function restore(value:unknown,before:unknown,actor:StateActor):unknown{
 if(Array.isArray(value))return value.map((item,index)=>{const previous=Array.isArray(before)?before:[];const id=item&&typeof item==="object"?(item as Row).id:undefined;return restore(item,id?previous.find(row=>row&&typeof row==="object"&&(row as Row).id===id):previous[index],actor);});
 if(!value||typeof value!=="object")return value;
 const previous=before&&typeof before==="object"&&!Array.isArray(before)?before as Row:{};
 const next=Object.fromEntries(Object.entries(value).filter(([key])=>!protectedField(key,actor,true)).map(([key,item])=>[key,restore(item,previous[key],actor)]));
 for(const [key,item] of Object.entries(previous)){
   if(protectedField(key,actor,true)||(secret(key)&&!Object.hasOwn(value,key)))next[key]=structuredClone(item);
 }
 return next;
}
function visibleOrders(state:AccessState,actor:StateActor,can:Can){
 if(!admin(actor)&&!can("os.visualizar"))return [];
 const all=rows(state.serviceOrders);
 if(!technician(actor))return all;
 const employee=rows(state.moduleRecords?.["Funcionários"]).find(row=>String(row.employeeUsername||"").trim().toLowerCase()===actor.username.trim().toLowerCase());
 return all.filter(order=>assignedToSession(order,{...actor,employeeId:employee?String(employee.id):undefined}));
}
export function projectOperationalState(state:AccessState|null|undefined,actor:StateActor,can:Can):AccessState|null{
 if(!state)return null;
 const orders=visibleOrders(state,actor,can);
 const customers=admin(actor)||can("clientes.visualizar")?rows(state.customers):rows(state.customers).filter(customer=>orders.some(order=>order.customerId?order.customerId===customer.id:order.client===customer.name));
 const modules=Object.fromEntries(Object.entries(state.moduleRecords||{}).filter(([name])=>moduleVisible(name,actor,can)).map(([name,records])=>[name,redact(rows(records),actor)]));
 return {_revision:state._revision,_updatedAt:state._updatedAt,_companyId:state._companyId,_legacyMerged:state._legacyMerged,customers:redact(customers,actor) as Row[],serviceOrders:redact(orders,actor) as Row[],moduleRecords:modules as Record<string,Row[]>};
}
export function mergeOperationalView(current:AccessState|null|undefined,incoming:AccessState,actor:StateActor,can:Can):AccessState{
 const before=current||{customers:[],serviceOrders:[],moduleRecords:{}};
 const visible=projectOperationalState(before,actor,can)!;
 const next:AccessState={...structuredClone(before),moduleRecords:structuredClone(before.moduleRecords||{})};
 for(const [name,records] of Object.entries(incoming.moduleRecords||{})){
  if(moduleVisible(name,actor,can)&&Array.isArray(records))next.moduleRecords![name]=restore(rows(records),before.moduleRecords?.[name],actor) as Row[];
 }
 if(Array.isArray(incoming.customers)&&(admin(actor)||can("clientes.visualizar")||visible.customers?.length)){
  const ids=new Set(rows(visible.customers).map(row=>String(row.id)));
  const hidden=rows(before.customers).filter(row=>!ids.has(String(row.id)));
  next.customers=[...hidden,...restore(rows(incoming.customers).filter(row=>!hidden.some(old=>old.id===row.id)),before.customers,actor) as Row[]];
 }
 if(Array.isArray(incoming.serviceOrders)&&(admin(actor)||can("os.visualizar"))){
  const ids=new Set(rows(visible.serviceOrders).map(row=>String(row.id)));
  const hidden=rows(before.serviceOrders).filter(row=>!ids.has(String(row.id)));
  const submitted=rows(incoming.serviceOrders).filter(row=>!hidden.some(old=>old.id===row.id));
  // Technician scope cannot be widened by submitting another technician's assignment.
  const own=technician(actor)?submitted.filter(row=>ids.has(String(row.id))||assignedToSession(row,actor)):submitted;
  next.serviceOrders=[...hidden,...restore(own,before.serviceOrders,actor) as Row[]];
 }
 return next;
}
