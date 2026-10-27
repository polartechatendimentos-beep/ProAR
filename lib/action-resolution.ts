export type ResolvePlan={actionId:string;module:string;recordId?:string;mode:"navigate"|"confirm"|"approval";message:string};
export function resolutionPlan(input:{id:string;module:string;recordId?:string;category:string;priority:number}):ResolvePlan{
 const sensitive=["Financeiro","Fiscal","Estoque","Aprovação"].includes(input.category);
 return {actionId:input.id,module:input.module,recordId:input.recordId,mode:input.category==="Aprovação"?"approval":sensitive?"confirm":"navigate",message:sensitive?"Revisar os dados e confirmar a operação. Nenhuma baixa crítica deve ocorrer apenas ao abrir a pendência.":"Abrir o registro já filtrado para concluir a ação."};
}
