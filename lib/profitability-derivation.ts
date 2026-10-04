import {calculateRealProfitability,type ProfitabilityInput} from "./real-profitability.ts";
type R=Record<string,unknown>;const n=(v:unknown)=>Number(v)||0;
export function profitabilityFromRecord(record:R){
 const input:ProfitabilityInput={revenue:n(record.revenue??record.total??record.value),materials:n(record.materialCost??record.materials),laborHours:n(record.laborHours),laborHourlyCost:n(record.laborHourlyCost),travel:n(record.travelCost??record.travel),commissions:n(record.commission??record.commissions),taxes:n(record.taxCost??record.taxes),paymentFees:n(record.paymentFees),rework:n(record.reworkCost??record.rework),otherCosts:n(record.otherCosts)};
 return calculateRealProfitability(input);
}
export function profitabilityPortfolio(records:R[]){const rows=records.map(r=>({id:String(r.id??r.code??""),name:String(r.name??r.client??r.id??"Registro"),...profitabilityFromRecord(r)}));const revenue=rows.reduce((s,r)=>s+r.revenue,0),cost=rows.reduce((s,r)=>s+r.totalCost,0);return{rows,revenue,totalCost:cost,profit:revenue-cost,margin:revenue>0?(revenue-cost)/revenue*100:0};}
