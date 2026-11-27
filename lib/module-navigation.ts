export const MODULE_TABS:Record<string,string>={dashboard:'Painel inicial',atividades:'Atividades',pendencias:'Central de pendências',agenda:'Agenda',clientes:'Clientes',equipamentos:'Equipamentos',orcamento:'Orçamentos',pdv:'Vendas',contratos:'Licitações',os:'Ordens de serviço',pmoc:'PMOC e conformidade',obras:'Obras',servicos:'Serviços',produtos:'Produtos',estoque:'Estoque',compras:'Compras',fornecedores:'Fornecedores','base-tecnica':'Base Técnica',financeiro:'Financeiro',fiscal:'Fiscal',aprovacoes:'Aprovações',funcionarios:'Funcionários',relatorios:'Relatórios',diagnosticos:'Diagnósticos',integridade:'Integridade do Sistema',configuracoes:'Configurações'};
function explicitModuleFromSearch(search: string) {
 const tab = new URLSearchParams(search).get("tab");
 if (!tab) return null;
 if (Object.hasOwn(MODULE_TABS, tab)) return MODULE_TABS[tab];
 return Object.values(MODULE_TABS).find(name => name === tab) || null;
}
export function moduleFromSearch(search: string) {
 return explicitModuleFromSearch(search) || "Painel inicial";
}
export function moduleNavigationUrl(href:string,module:string){const tab=Object.entries(MODULE_TABS).find(([,name])=>name===module)?.[0];if(!tab)return null;const url=new URL(href);if(url.pathname==='/mobile'||url.pathname.startsWith('/mobile/'))return null;if(tab==='dashboard')url.searchParams.delete('tab');else url.searchParams.set('tab',tab);return url.pathname+url.search+url.hash;}
export function canNavigateModule(name:string,user:{role?:string;permissions?:string[]},entitledModules?:string[]){
 const permissions=user.permissions||[];const licensed=!Array.isArray(entitledModules)||entitledModules.includes(name);
 const permitted=user.role==='Administrador'||permissions.includes('*')||permissions.includes(name)||(name==='Atividades'&&permissions.some(p=>/auditoria|atividade|integridade|admin/i.test(p)))||(name==='Fiscal'&&permissions.some(p=>/^fiscal\./i.test(p)))||(name==='Integridade do Sistema'&&permissions.includes('integridade.visualizar'))||(name==='Aprovações'&&(permissions.includes('aprovacoes.visualizar')||permissions.includes('aprovacoes.aprovar')));
 return licensed&&permitted;
}

type NavigationActor = { role?: string; permissions?: string[] };
const priorities: Readonly<Record<string, readonly string[]>> = {
 administrador: ["Painel inicial", "Central de pendências", "Agenda"],
 gerencia: ["Painel inicial", "Central de pendências", "Agenda"],
 financeiro: ["Financeiro", "Fiscal", "Compras"],
 vendedor: ["Orçamentos", "Vendas", "Clientes"],
 tecnico: ["Agenda", "Ordens de serviço", "Equipamentos"],
 "tecnico de campo": ["Agenda", "Ordens de serviço", "Equipamentos"],
 "prestador de servico": ["Agenda", "Ordens de serviço"],
 estoquista: ["Estoque", "Compras", "Produtos"],
};

export function visibleNavigationModules(knownModules: readonly string[], actor: NavigationActor, entitledModules?: string[]) {
 return [...new Set(knownModules)].filter(module => canNavigateModule(module, actor, entitledModules));
}

/** Role determines preferred ordering only. Explicit grants and plan still govern every destination. */
export function roleNavigationModules(knownModules: readonly string[], actor: NavigationActor, entitledModules?: string[]) {
 const allowed = visibleNavigationModules(knownModules, actor, entitledModules);
 const role = (actor.role || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
 const preferred = Object.hasOwn(priorities, role) ? priorities[role] : ["Painel inicial"];
 return [...new Set([...preferred.filter(module => allowed.includes(module)), ...allowed])];
}

/** Returns no destination if the actor and plan allow nothing. Never renders an ungranted fallback dashboard. */
export function resolveNavigationDestination(search: string, knownModules: readonly string[], actor: NavigationActor, entitledModules?: string[]) {
 const visible = roleNavigationModules(knownModules, actor, entitledModules);
 const requested = explicitModuleFromSearch(search);
 return requested && visible.includes(requested) ? requested : visible[0] || null;
}
