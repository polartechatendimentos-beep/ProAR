/** Deterministic financial simulations; never replaces a tax/accounting assessment. */
import {calculateCatalogPrice,type CostLine,type PriceScenario} from "./catalog-cost-engine.ts";
export type Workforce={monthlySalary:number;monthlyBurden:number;benefits:number;productiveHours:number;people:number};
export function hourlyWorkforceCost(w:Workforce){
 const values=[w.monthlySalary,w.monthlyBurden,w.benefits,w.productiveHours,w.people];if(values.some(v=>!Number.isFinite(v)||v<0)||w.productiveHours<=0||!Number.isInteger(w.people)||w.people<=0)throw Error("Dados da equipe inválidos");
 const value=(w.monthlySalary+w.monthlyBurden+w.benefits)*w.people/w.productiveHours;if(!Number.isFinite(value)||value>1e12)throw Error("Custo por hora fora do limite");return Math.round(value*100)/100;
}
export type MeasuredMaterial={id:string;label:string;meters:number;unitCost:number;wastePercent?:number};
export function measuredMaterialLines(items:MeasuredMaterial[]):CostLine[]{
 return items.map(item=>{if([item.meters,item.unitCost,item.wastePercent??0].some(v=>!Number.isFinite(v)||v<0)|| (item.wastePercent??0)>100)throw Error("Metragem ou perda inválida");
 return {id:item.id,label:item.label,quantity:Math.ceil(item.meters*(1+(item.wastePercent??0)/100)*1000-1e-9)/1000,unitCost:item.unitCost,category:"material" as const};});
}
export type BatchScenario={units:number;costLines:CostLine[];pricing:PriceScenario;fixedProjectCost?:number;negotiatedRevenue?:number};
export function simulateBatch(input:BatchScenario){
 if(!Number.isInteger(input.units)||input.units<=0||!Number.isFinite(input.fixedProjectCost??0)||(input.fixedProjectCost??0)<0)throw Error("Quantidade ou custo fixo inválido");
 const unit=calculateCatalogPrice(input.costLines,input.pricing);
 const totalCost=Math.round((unit.cost*input.units+(input.fixedProjectCost??0))*100)/100;
 const global=calculateCatalogPrice([{id:"contract",label:"Custo total",quantity:1,unitCost:totalCost,category:"other"}],input.pricing);
 const suggestedRevenue=global.suggestedPrice;
 const revenue=input.negotiatedRevenue??(suggestedRevenue===null?null:suggestedRevenue*(1-(input.pricing.discountPercent??0)/100));
 if(revenue!==null&&(!Number.isFinite(revenue)||revenue<0||revenue>1e12))throw Error("Receita inválida");
 const taxAndFee=(input.pricing.taxPercent+(input.pricing.cardFeePercent??0))/100;
 const profit=revenue===null?null:Math.round((revenue*(1-taxAndFee)-totalCost)*100)/100;
 return {unitCost:unit.cost,totalCost,suggestedRevenue,negotiatedRevenue:input.negotiatedRevenue??null,profit,marginPercent:revenue&&profit!==null?Math.round(profit/revenue*10000)/100:null,warnings:unit.warnings};
}
export function breakEvenUnits(fixedMonthlyCosts:number,unitPrice:number,unitVariableCost:number,taxAndFeesPercent:number){
 if([fixedMonthlyCosts,unitPrice,unitVariableCost,taxAndFeesPercent].some(v=>!Number.isFinite(v)||v<0)||taxAndFeesPercent>=100)throw Error("Parâmetros inválidos");
 const contribution=unitPrice*(1-taxAndFeesPercent/100)-unitVariableCost;
 return contribution>0?Math.ceil(fixedMonthlyCosts/contribution):null;
}
