export type ManagerPlan = {
  code:string;
  name:string;
  description:string;
  modules:string[];
  limits:{users:number;serviceOrdersPerMonth:number;storageGb:number;aiCallsPerMonth:number};
};

export type ManagerModuleGroup = {
  code:string;
  name:string;
  description:string;
  modules:string[];
};

export const CORE_MODULES=["Painel inicial","Agenda","Clientes","Equipamentos","Orçamentos","Vendas","Ordens de serviço","Serviços","Produtos","Estoque","Compras","Fornecedores","Financeiro","Funcionários","Relatórios","Configurações"];
export const PRO_MODULES=["PMOC e conformidade","Obras","Fiscal","Aprovações","Integridade do Sistema","Diagnósticos"];
export const ENTERPRISE_MODULES=["Licitações","Base Técnica","Atividades","Central de pendências"];
export const ALL_MANAGER_MODULES=[...CORE_MODULES,...PRO_MODULES,...ENTERPRISE_MODULES];

export const REQUIRED_MANAGER_MODULES=["Painel inicial","Clientes","Agenda","Funcionários","Configurações"];

export const MANAGER_MODULE_GROUPS:ManagerModuleGroup[]=[
  {code:"base",name:"Base Operacional",description:"Estrutura obrigatória para o ProAR funcionar com contexto de cliente, usuários e operação diária.",modules:REQUIRED_MANAGER_MODULES},
  {code:"comercial",name:"Comercial",description:"Propostas, vendas e aprovações ligadas ao cadastro de clientes.",modules:["Orçamentos","Vendas","Aprovações"]},
  {code:"operacao",name:"Operação Técnica",description:"Equipamentos, atendimentos, execução técnica, PMOC e diagnóstico.",modules:["Equipamentos","Ordens de serviço","Serviços","PMOC e conformidade","Diagnósticos","Base Técnica"]},
  {code:"suprimentos",name:"Estoque e Suprimentos",description:"Produtos, materiais, movimentações, compras e fornecedores.",modules:["Produtos","Estoque","Compras","Fornecedores"]},
  {code:"financeiro",name:"Financeiro e Fiscal",description:"Contas, movimentações financeiras e documentos fiscais.",modules:["Financeiro","Fiscal"]},
  {code:"gestao",name:"Gestão e Produtividade",description:"Indicadores, atividades, pendências e integridade operacional.",modules:["Relatórios","Atividades","Central de pendências","Integridade do Sistema"]},
  {code:"projetos-publico",name:"Obras e Licitações",description:"Execução de obras e processos de contratação pública.",modules:["Obras","Licitações"]},
];

export function normalizeManagerModules(modules:unknown){
  const requested=Array.isArray(modules)?modules.map(value=>String(value)):[];
  return ALL_MANAGER_MODULES.filter(moduleName=>REQUIRED_MANAGER_MODULES.includes(moduleName)||requested.includes(moduleName));
}

export const MANAGER_PLANS:ManagerPlan[]=[
  {code:"trial",name:"Trial",description:"Ambiente de avaliação controlado.",modules:CORE_MODULES,limits:{users:3,serviceOrdersPerMonth:100,storageGb:2,aiCallsPerMonth:100}},
  {code:"essencial",name:"Essencial",description:"Operação comercial e técnica essencial.",modules:CORE_MODULES,limits:{users:5,serviceOrdersPerMonth:500,storageGb:10,aiCallsPerMonth:500}},
  {code:"profissional",name:"Profissional",description:"Operação completa com fiscal, obras e conformidade.",modules:[...CORE_MODULES,...PRO_MODULES],limits:{users:20,serviceOrdersPerMonth:3000,storageGb:50,aiCallsPerMonth:3000}},
  {code:"enterprise",name:"Enterprise",description:"Todos os módulos, contratos públicos e maior capacidade.",modules:ALL_MANAGER_MODULES,limits:{users:100,serviceOrdersPerMonth:20000,storageGb:250,aiCallsPerMonth:20000}},
];

export function managerPlan(code:unknown){return MANAGER_PLANS.find(plan=>plan.code===String(code||""))||MANAGER_PLANS[0];}
