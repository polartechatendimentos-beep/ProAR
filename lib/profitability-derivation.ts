import {calculateRealProfitability,type ProfitabilityInput} from "./real-profitability.ts";
type R=Record<string,unknown>;const n=(v:unknown)=>Number(v)||0;
const has=(r:R,...keys:string[])=>keys.some(key=>r[key]!==undefined&&r[key]!==null&&r[key]!=="");
export function profitabilityFromRecord(record:R){
 const outsourced=n(record.outsourcedCost);
 const input:ProfitabilityInput={
  revenue:n(record.total??record.revenue??record.value),
  materials:n(record.materialCost??record.materials),
  laborHours:n(record.laborHours),
  laborHourlyCost:n(record.laborCost!==undefined?0:record.laborHourlyCost),
  travel:n(record.travelCost??record.travel),
  commissions:n(record.commissionCost??record.commission??record.commissions),
  taxes:n(record.taxCost??record.taxes),
  paymentFees:n(record.paymentFees),
  rework:n(record.reworkCost??record.rework),
  otherCosts:n(record.otherCosts)+outsourced,
 };
 const result=calculateRealProfitability(input);
 if(record.laborCost!==undefined){
  result.costs.labor=n(record.laborCost);
  result.totalCost=Object.values(result.costs).reduce((sum,value)=>sum+value,0);
  result.profit=result.revenue-result.totalCost;
  result.margin=result.revenue>0?result.profit/result.revenue*100:0;
 }
 return {...result,costDataPresent:has(record,"materialCost","materials","laborCost","laborHours","travelCost","travel","outsourcedCost","taxCost","taxes","commissionCost","commission","commissions","paymentFees","reworkCost","rework","otherCosts"),costFields:{materials:has(record,"materialCost","materials"),labor:has(record,"laborCost","laborHours"),travel:has(record,"travelCost","travel"),taxes:has(record,"taxCost","taxes"),commissions:has(record,"commissionCost","commission","commissions"),other:has(record,"outsourcedCost","paymentFees","reworkCost","rework","otherCosts")}};
}
export function profitabilityPortfolio(records:R[]){const rows=records.map(r=>({id:String(r.id??r.code??""),name:String(r.name??r.client??r.id??"Registro"),source:String(r._profitabilitySource??"Registro"),...profitabilityFromRecord(r)}));const revenue=rows.reduce((s,r)=>s+r.revenue,0),cost=rows.reduce((s,r)=>s+r.totalCost,0);return{rows,revenue,totalCost:cost,profit:revenue-cost,margin:revenue>0?(revenue-cost)/revenue*100:0};}
