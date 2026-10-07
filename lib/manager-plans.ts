export type ManagerPlan = {
  code:string;
  name:string;
  description:string;
  modules:string[];
  limits:{users:number|null;serviceOrdersPerMonth:number;storageGb:number;aiCallsPerMonth:number};
};

export const ALL_MANAGER_MODULES=[
  "Painel inicial","Agenda","Clientes","Equipamentos","Orçamentos","Vendas","Ordens de serviço","Serviços",
  "Produtos","Estoque","Compras","Fornecedores","Financeiro","Funcionários","Relatórios","Configurações",
  "PMOC e conformidade","Obras","Fiscal","Aprovações","Integridade do Sistema","Diagnósticos",
  "Licitações","Base Técnica","Atividades","Central de pendências",
];

export const BASIC_MODULES=[
  "Painel inicial","Agenda","Clientes","Equipamentos","Orçamentos",
  "Ordens de serviço","Serviços","Funcionários","Relatórios","Configurações",
];

export const INTERMEDIATE_MODULES=[
  ...BASIC_MODULES,
  "Vendas","Produtos","Estoque","Compras","Fornecedores","Financeiro",
  "PMOC e conformidade","Aprovações","Diagnósticos","Atividades","Central de pendências",
];

export const COMPLETE_MODULES=[...ALL_MANAGER_MODULES];

export const REQUIRED_MANAGER_MODULES=["Painel inicial","Clientes","Agenda","Funcionários","Configurações"];

export const COMMERCIAL_MANAGER_PLANS:ManagerPlan[]=[
  {
    code:"basico",
    name:"Básico",
    description:"Operação essencial para atendimento: clientes, equipamentos, orçamentos, OS, serviços e gestão da equipe.",
    modules:BASIC_MODULES,
    limits:{users:2,serviceOrdersPerMonth:500,storageGb:10,aiCallsPerMonth:500},
  },
  {
    code:"intermediario",
    name:"Intermediário",
    description:"Tudo do Básico mais vendas, estoque, compras, fornecedores, financeiro, PMOC, aprovações, diagnósticos e pendências.",
    modules:INTERMEDIATE_MODULES,
    limits:{users:4,serviceOrdersPerMonth:3000,storageGb:50,aiCallsPerMonth:3000},
  },
  {
    code:"completo",
    name:"Completo",
    description:"Todos os 26 módulos do ProAR, incluindo fiscal, obras, licitações, integridade e base técnica.",
    modules:COMPLETE_MODULES,
    limits:{users:null,serviceOrdersPerMonth:20000,storageGb:250,aiCallsPerMonth:20000},
  },
];

export const TRIAL_MANAGER_PLAN:ManagerPlan={
  code:"trial",
  name:"Trial",
  description:"Avaliação temporária com recursos equivalentes ao plano Básico.",
  modules:BASIC_MODULES,
  limits:{users:2,serviceOrdersPerMonth:100,storageGb:2,aiCallsPerMonth:100},
};

// Compatibilidade interna: trial continua existindo apenas para o período de avaliação.
// Códigos antigos são normalizados para os três planos comerciais atuais.
export const MANAGER_PLANS=[TRIAL_MANAGER_PLAN,...COMMERCIAL_MANAGER_PLANS];

const PLAN_ALIASES:Record<string,string>={
  essencial:"basico",
  profissional:"intermediario",
  enterprise:"completo",
  internal:"completo",
};

export function managerPlan(code:unknown){
  const raw=String(code||"").trim().toLowerCase();
  if(raw==="trial") return TRIAL_MANAGER_PLAN;
  const normalized=PLAN_ALIASES[raw]||raw;
  return COMMERCIAL_MANAGER_PLANS.find(plan=>plan.code===normalized)||COMMERCIAL_MANAGER_PLANS[0];
}

export function normalizeManagerModules(modules:unknown){
  const requested=Array.isArray(modules)?modules.map(value=>String(value)):[];
  return ALL_MANAGER_MODULES.filter(moduleName=>REQUIRED_MANAGER_MODULES.includes(moduleName)||requested.includes(moduleName));
}
