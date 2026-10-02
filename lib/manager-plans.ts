export type ManagerPlan = {
  code:string;
  name:string;
  description:string;
  modules:string[];
  limits:{users:number;serviceOrdersPerMonth:number;storageGb:number;aiCallsPerMonth:number};
};

const BASE=["Painel inicial","Agenda","Clientes","Equipamentos","Orçamentos","Vendas","Ordens de serviço","Serviços","Produtos","Estoque","Compras","Fornecedores","Financeiro","Funcionários","Relatórios","Configurações"];
const PRO=["PMOC e conformidade","Obras","Fiscal","Aprovações","Integridade do Sistema","Diagnósticos"];
const ENTERPRISE=["Licitações","Base Técnica","Atividades","Central de pendências"];

export const MANAGER_PLANS:ManagerPlan[]=[
  {code:"trial",name:"Trial",description:"Ambiente de avaliação controlado.",modules:BASE,limits:{users:3,serviceOrdersPerMonth:100,storageGb:2,aiCallsPerMonth:100}},
  {code:"essencial",name:"Essencial",description:"Operação comercial e técnica essencial.",modules:BASE,limits:{users:5,serviceOrdersPerMonth:500,storageGb:10,aiCallsPerMonth:500}},
  {code:"profissional",name:"Profissional",description:"Operação completa com fiscal, obras e conformidade.",modules:[...BASE,...PRO],limits:{users:20,serviceOrdersPerMonth:3000,storageGb:50,aiCallsPerMonth:3000}},
  {code:"enterprise",name:"Enterprise",description:"Todos os módulos, contratos públicos e maior capacidade.",modules:[...BASE,...PRO,...ENTERPRISE],limits:{users:100,serviceOrdersPerMonth:20000,storageGb:250,aiCallsPerMonth:20000}},
];

export function managerPlan(code:unknown){return MANAGER_PLANS.find(plan=>plan.code===String(code||""))||MANAGER_PLANS[0];}
