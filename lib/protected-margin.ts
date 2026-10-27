import {calculateRealProfitability,type ProfitabilityInput} from "./real-profitability";
export function evaluateProtectedMargin(input:ProfitabilityInput,minimumMargin:number){
 const result=calculateRealProfitability(input); const requiresApproval=result.margin<minimumMargin;
 return {...result,minimumMargin,requiresApproval,reason:requiresApproval?"Margem abaixo do mínimo configurado. Exigir aprovação antes do fechamento.":"Margem dentro da política configurada."};
}
