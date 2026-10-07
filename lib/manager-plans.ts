import { MODULE_CATALOG } from "./module-catalog";

export type ManagerPlan = {
  code:string;
  name:string;
  description:string;
  modules:string[];
  moduleIds:string[];
  limits:{users:number;serviceOrdersPerMonth:number;storageGb:number;aiCallsPerMonth:number};
};

export const CORE_MODULE_IDS=MODULE_CATALOG.filter(item=>item.group==="core").map(item=>item.id);
export const PRO_MODULE_IDS=MODULE_CATALOG.filter(item=>item.group==="pro").map(item=>item.id);
export const ENTERPRISE_MODULE_IDS=MODULE_CATALOG.filter(item=>item.group==="enterprise").map(item=>item.id);
export const ALL_MANAGER_MODULE_IDS=MODULE_CATALOG.map(item=>item.id);

export const CORE_MODULES=MODULE_CATALOG.filter(item=>item.group==="core").map(item=>item.name);
export const PRO_MODULES=MODULE_CATALOG.filter(item=>item.group==="pro").map(item=>item.name);
export const ENTERPRISE_MODULES=MODULE_CATALOG.filter(item=>item.group==="enterprise").map(item=>item.name);
export const ALL_MANAGER_MODULES=MODULE_CATALOG.map(item=>item.name);

export const MANAGER_PLANS:ManagerPlan[]=[
  {code:"trial",name:"Trial",description:"Ambiente de avaliação controlado.",modules:CORE_MODULES,moduleIds:CORE_MODULE_IDS,limits:{users:3,serviceOrdersPerMonth:100,storageGb:2,aiCallsPerMonth:100}},
  {code:"essencial",name:"Essencial",description:"Operação comercial e técnica essencial.",modules:CORE_MODULES,moduleIds:CORE_MODULE_IDS,limits:{users:5,serviceOrdersPerMonth:500,storageGb:10,aiCallsPerMonth:500}},
  {code:"profissional",name:"Profissional",description:"Operação completa com fiscal, obras e conformidade.",modules:[...CORE_MODULES,...PRO_MODULES],moduleIds:[...CORE_MODULE_IDS,...PRO_MODULE_IDS],limits:{users:20,serviceOrdersPerMonth:3000,storageGb:50,aiCallsPerMonth:3000}},
  {code:"enterprise",name:"Enterprise",description:"Todos os módulos, contratos públicos e maior capacidade.",modules:ALL_MANAGER_MODULES,moduleIds:ALL_MANAGER_MODULE_IDS,limits:{users:100,serviceOrdersPerMonth:20000,storageGb:250,aiCallsPerMonth:20000}},
];

export function managerPlan(code:unknown){return MANAGER_PLANS.find(plan=>plan.code===String(code||""))||MANAGER_PLANS[0];}
