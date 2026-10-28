export type EmployeeAccessAction = "Visualizar" | "Criar" | "Editar" | "Excluir";
export type EmployeeAccessMatrix = Record<string, EmployeeAccessAction[]>;
export const EMPLOYEE_ACCESS_MODULES = ["Painel inicial","Atividades","Central de pendências","Agenda","Clientes","Equipamentos","Orçamentos","Vendas","Licitações","Ordens de serviço","PMOC e conformidade","Obras","Serviços","Produtos","Estoque","Compras","Fornecedores","Base Técnica","Financeiro","Fiscal","Aprovações","Funcionários","Relatórios","Diagnósticos","Integridade do Sistema","Configurações","Rotas"];
export const EMPLOYEE_ACCESS_PROFILES = ["Técnico","Atendimento","Vendedor","Financeiro","Gestão","Estoquista","Consulta","Administrador"];
const view:EmployeeAccessAction[]=["Visualizar"];
const edit:EmployeeAccessAction[]=["Visualizar","Editar"];
const create:EmployeeAccessAction[]=["Visualizar","Criar","Editar"];
const presets:Record<string,EmployeeAccessMatrix>={
 "Técnico":{"Painel inicial":view,"Central de pendências":view,Agenda:edit,Clientes:view,Equipamentos:edit,"Ordens de serviço":edit,"PMOC e conformidade":edit,Serviços:view,"Base Técnica":view,Estoque:view},
 "Atendimento":{"Painel inicial":view,Agenda:create,Clientes:create,Equipamentos:view,"Ordens de serviço":create,Serviços:view},
 "Vendedor":{"Painel inicial":view,Clientes:create,Equipamentos:view,Orçamentos:create,Vendas:create,Serviços:view,Produtos:view,"Ordens de serviço":view,Relatórios:view},
 "Financeiro":{"Painel inicial":view,Clientes:view,Financeiro:create,Fiscal:create,Compras:view,Aprovações:view,Relatórios:view,Licitações:view},
 "Gestão":Object.fromEntries(["Painel inicial","Atividades","Central de pendências","Agenda","Clientes","Equipamentos","Orçamentos","Vendas","Licitações","Ordens de serviço","PMOC e conformidade","Obras","Serviços","Produtos","Estoque","Compras","Fornecedores","Base Técnica","Financeiro","Aprovações","Relatórios","Diagnósticos","Rotas"].map(name=>[name,create])),
 "Estoquista":{"Painel inicial":view,Produtos:edit,Estoque:create,Compras:create,Fornecedores:edit,"Ordens de serviço":view},
 "Consulta":Object.fromEntries(["Painel inicial","Agenda","Clientes","Equipamentos","Ordens de serviço","PMOC e conformidade","Base Técnica"].map(name=>[name,view])),
 "Administrador":Object.fromEntries(EMPLOYEE_ACCESS_MODULES.map(name=>[name,["Visualizar","Criar","Editar","Excluir"] as EmployeeAccessAction[]])),
};
export function employeeAccessProfile(role:string){
 return role==="Técnico de Campo"?"Técnico":role==="Gerência"||role==="Supervisor"?"Gestão":role;
}
export function employeeAccessRole(profile:string){
 return profile==="Técnico"?"Técnico de Campo":profile==="Gestão"?"Gerência":profile;
}
export function employeeAccessPreset(profile:string):EmployeeAccessMatrix{
 const source=presets[employeeAccessProfile(profile)]||{};
 return Object.fromEntries(EMPLOYEE_ACCESS_MODULES.map(name=>[name,[...(source[name]||[])]]));
}
