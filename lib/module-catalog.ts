export type ModuleCatalogEntry={
  id:string;
  name:string;
  group:"core"|"pro"|"enterprise";
  aliases?:string[];
};

export const MODULE_CATALOG:ModuleCatalogEntry[]=[
  {id:"dashboard",name:"Painel inicial",group:"core"},
  {id:"agenda",name:"Agenda",group:"core"},
  {id:"customers",name:"Clientes",group:"core"},
  {id:"equipment",name:"Equipamentos",group:"core"},
  {id:"quotes",name:"Orçamentos",group:"core"},
  {id:"sales",name:"Vendas",group:"core"},
  {id:"service_orders",name:"Ordens de serviço",group:"core",aliases:["OS","Ordens de Serviço"]},
  {id:"services",name:"Serviços",group:"core"},
  {id:"products",name:"Produtos",group:"core"},
  {id:"inventory",name:"Estoque",group:"core"},
  {id:"purchases",name:"Compras",group:"core"},
  {id:"suppliers",name:"Fornecedores",group:"core"},
  {id:"finance",name:"Financeiro",group:"core"},
  {id:"employees",name:"Funcionários",group:"core"},
  {id:"reports",name:"Relatórios",group:"core"},
  {id:"settings",name:"Configurações",group:"core"},
  {id:"pmoc",name:"PMOC e conformidade",group:"pro"},
  {id:"works",name:"Obras",group:"pro"},
  {id:"fiscal",name:"Fiscal",group:"pro"},
  {id:"approvals",name:"Aprovações",group:"pro"},
  {id:"integrity",name:"Integridade do Sistema",group:"pro"},
  {id:"diagnostics",name:"Diagnósticos",group:"pro"},
  {id:"procurement",name:"Licitações",group:"enterprise"},
  {id:"technical_base",name:"Base Técnica",group:"enterprise"},
  {id:"activity",name:"Atividades",group:"enterprise"},
  {id:"action_center",name:"Central de pendências",group:"enterprise"},
];

const byId=new Map(MODULE_CATALOG.map(item=>[item.id,item]));
const byName=new Map<string,ModuleCatalogEntry>();
for(const item of MODULE_CATALOG){
  byName.set(item.name.toLocaleLowerCase("pt-BR"),item);
  for(const alias of item.aliases||[])byName.set(alias.toLocaleLowerCase("pt-BR"),item);
}

export function moduleById(id:unknown){return byId.get(String(id||"").trim())||null;}
export function moduleByName(name:unknown){return byName.get(String(name||"").trim().toLocaleLowerCase("pt-BR"))||null;}
export function moduleId(value:unknown){
  const raw=String(value||"").trim();
  return moduleById(raw)?.id||moduleByName(raw)?.id||"";
}
export function moduleName(value:unknown){
  const raw=String(value||"").trim();
  return moduleById(raw)?.name||moduleByName(raw)?.name||raw;
}
export function normalizeContractedModules(values:unknown){
  if(!Array.isArray(values))return[];
  return [...new Set(values.map(value=>moduleId(value)).filter(Boolean))];
}
export function moduleNamesFromIds(values:unknown){
  return normalizeContractedModules(values).map(id=>moduleById(id)?.name).filter((value):value is string=>Boolean(value));
}
export function isModuleContracted(module:string,contractedIds:string[]|undefined){
  if(!Array.isArray(contractedIds))return false;
  const id=moduleId(module);
  return Boolean(id&&contractedIds.includes(id));
}
export function isUserAllowed(module:string,permissions:string[]|undefined,claims:string[]|undefined){
  const moduleEntry=moduleByName(module)||moduleById(module);
  const names=[moduleEntry?.name,moduleEntry?.id,...(moduleEntry?.aliases||[])].filter(Boolean) as string[];
  if(claims?.includes("platform_admin")||claims?.includes("company_owner"))return true;
  if(permissions?.includes("*"))return true;
  return names.some(name=>permissions?.includes(name))||
    (moduleEntry?.id==="integrity"&&Boolean(permissions?.includes("integridade.visualizar")))||
    (moduleEntry?.id==="approvals"&&Boolean(permissions?.includes("aprovacoes.visualizar")||permissions?.includes("aprovacoes.aprovar")))||
    (moduleEntry?.id==="fiscal"&&Boolean(permissions?.some(permission=>/^fiscal\./i.test(permission))))||
    (moduleEntry?.id==="activity"&&Boolean(permissions?.some(permission=>/auditoria|atividade|integridade|admin/i.test(permission))));
}
export function isModuleReady(input:{module:string;contractedIds?:string[];permissions?:string[];claims?:string[];configurationState:"loading"|"ready"|"blocked"|"error"}){
  return input.configurationState==="ready"&&isModuleContracted(input.module,input.contractedIds)&&isUserAllowed(input.module,input.permissions,input.claims);
}
