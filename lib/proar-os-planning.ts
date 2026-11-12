/** Pure domain calculations. No writes to OS, finance, inventory or tenant data. */
export type ServiceKind = "instalacao" | "higienizacao" | "corretiva" | "preventiva" | "pmoc";
export type ChecklistItem = { id: string; label: string; required: boolean };
const common: ChecklistItem[] = [
 {id:"identify",label:"Confirmar cliente, unidade e equipamento",required:true},
 {id:"safety",label:"Verificar segurança e condições de acesso",required:true},
 {id:"photos",label:"Registrar evidências fotográficas",required:true},
 {id:"signoff",label:"Registrar responsável e aceite",required:true}
];
const specific: Record<ServiceKind,ChecklistItem[]> = {
 instalacao:[{id:"leak",label:"Teste de estanqueidade",required:true},{id:"vacuum",label:"Vácuo e validação do circuito",required:true},{id:"drain",label:"Teste do dreno",required:true}],
 higienizacao:[{id:"clean",label:"Higienização e inspeção",required:true},{id:"drain",label:"Teste do dreno",required:true}],
 corretiva:[{id:"symptoms",label:"Registrar sintomas e medições",required:true},{id:"diagnosis",label:"Registrar diagnóstico confirmado",required:true}],
 preventiva:[{id:"measure",label:"Registrar medições e inspeções",required:true},{id:"filter",label:"Inspecionar filtros e drenagem",required:true}],
 pmoc:[{id:"measure",label:"Registrar medições e inspeções",required:true},{id:"pmoc",label:"Vincular plano e unidade do PMOC",required:true}]
};
export function checklistFor(kind: ServiceKind): ChecklistItem[] {
 if (!Object.prototype.hasOwnProperty.call(specific,kind)) throw new Error("Tipo de serviço inválido.");
 return [...common,...specific[kind]].map(x=>({...x}));
}
export function checklistCompletion(items: ChecklistItem[], checkedIds: string[]) {
 const required=items.filter(x=>x.required), completed=required.filter(x=>checkedIds.includes(x.id));
 return { completed:completed.length,total:required.length,ready:required.length>0 && completed.length===required.length,missing:required.filter(x=>!checkedIds.includes(x.id)).map(x=>x.id) };
}
export type ServiceCosts = { companyId:string; orderCompanyId:string; revenueCents:number; laborCents:number; materialCents:number; travelCents:number; foodCents:number; taxCents:number; otherCents:number };
export function orderProfit(input:ServiceCosts) {
 if (!input.companyId || input.companyId!==input.orderCompanyId) throw new Error("OS pertence a outra empresa.");
 const values=[input.revenueCents,input.laborCents,input.materialCents,input.travelCents,input.foodCents,input.taxCents,input.otherCents];
 if (values.some(v=>!Number.isSafeInteger(v)||v<0)) throw new Error("Valores monetários devem ser centavos inteiros não negativos.");
 const costCents=values.slice(1).reduce((a,b)=>a+b,0), profitCents=input.revenueCents-costCents;
 if (!Number.isSafeInteger(costCents)||!Number.isSafeInteger(profitCents)) throw new Error("Valor fora do limite.");
 return { revenueCents:input.revenueCents,costCents,profitCents,marginPercent:input.revenueCents?Math.round(profitCents/input.revenueCents*10000)/100:null };
}
