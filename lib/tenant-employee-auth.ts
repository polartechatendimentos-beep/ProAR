export type EmployeeAuthRecord=Record<string,unknown>;
export function employeeStateKeys(companyId:string,dedicated:boolean,primaryId:string){
 if(!companyId)return [];
 return dedicated?["main"]:companyId===primaryId?[companyId,"main","polartech"]:[companyId];
}
export function tenantEmployeeCandidate(payload:unknown,companyId:string,username:string):EmployeeAuthRecord|null{
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return null;
 const state=payload as Record<string,unknown>;
 if(state._companyId&&String(state._companyId)!==companyId)return null;
 const modules=state.moduleRecords;
 if(!modules||typeof modules!=="object"||Array.isArray(modules))return null;
 const employees=(modules as Record<string,unknown>)["Funcionários"];
 if(!Array.isArray(employees))return null;
 const normalized=username.trim().toLocaleLowerCase("pt-BR");
 const matches=employees.filter((item):item is EmployeeAuthRecord=>Boolean(item&&typeof item==="object"&&!Array.isArray(item)&&String(item.employeeUsername||"").trim().toLocaleLowerCase("pt-BR")===normalized));
 return matches.length===1?matches[0]:null;
}
