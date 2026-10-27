export type ProfitabilityInput={revenue:number;materials?:number;laborHours?:number;laborHourlyCost?:number;travel?:number;commissions?:number;taxes?:number;paymentFees?:number;rework?:number;otherCosts?:number};
export function calculateRealProfitability(i:ProfitabilityInput){
 const costs={materials:i.materials||0,labor:(i.laborHours||0)*(i.laborHourlyCost||0),travel:i.travel||0,commissions:i.commissions||0,taxes:i.taxes||0,paymentFees:i.paymentFees||0,rework:i.rework||0,otherCosts:i.otherCosts||0};
 const totalCost=Object.values(costs).reduce((a,b)=>a+b,0); const profit=i.revenue-totalCost; const margin=i.revenue>0?(profit/i.revenue)*100:0;
 return {revenue:i.revenue,costs,totalCost,profit,margin};
}
