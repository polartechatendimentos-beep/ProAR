/** Deterministic bid viability simulator. Figures are estimates, not a legal/accounting opinion. */
export type BidCostInput={units:number;unitMaterials:number;unitLabor:number;unitTravel:number;unitOther:number;fixedContractCost:number;taxPercent:number;feesPercent:number;riskReservePercent:number;targetMarginPercent:number;referencePrice?:number;proposedBid?:number};
const round=(v:number)=>{if(!Number.isFinite(v)||Math.abs(v)>1e12)throw Error("Valor fora do limite de cálculo");return Math.round((v+Number.EPSILON)*100)/100;};
const up=(v:number)=>{round(v);return Math.ceil(v*100-1e-8)/100;};
export function simulatePublicBid(i:BidCostInput){
 for(const key of ["units","unitMaterials","unitLabor","unitTravel","unitOther","fixedContractCost","taxPercent","feesPercent","riskReservePercent","targetMarginPercent"] as const)if(!Number.isFinite(i[key]))throw Error(`Campo obrigatório: ${key}`);
 const fields=Object.entries(i);
 for(const [name,value] of fields)if(value!==undefined&&(!Number.isFinite(value)||value<0))throw Error(`Valor inválido: ${name}`);
 if(!Number.isInteger(i.units)||i.units<1)throw Error("Quantidade inválida");
 for(const name of ["taxPercent","feesPercent","riskReservePercent","targetMarginPercent"] as const)if(i[name]>=100)throw Error(`Percentual inválido: ${name}`);
 const variable=round(i.unitMaterials+i.unitLabor+i.unitTravel+i.unitOther);
 const direct=round((i.unitMaterials+i.unitLabor+i.unitTravel+i.unitOther)*i.units+i.fixedContractCost);
 const reserve=round(direct*i.riskReservePercent/100);
 const totalCost=round(direct+reserve);
 const deduction=(i.taxPercent+i.feesPercent)/100;
 const minimumDenominator=1-deduction;
 const targetDenominator=minimumDenominator-i.targetMarginPercent/100;
 const minimumBid=minimumDenominator>1e-12?up(totalCost/minimumDenominator):null;
 const targetBid=targetDenominator>1e-12?up(totalCost/targetDenominator):null;
 const proposed=i.proposedBid??null;
 const estimatedProfit=proposed===null?null:round(proposed*minimumDenominator-totalCost);
 const estimatedMargin=proposed&&estimatedProfit!==null?round(estimatedProfit/proposed*100):null;
 const maximumDiscount=i.referencePrice!==undefined&&minimumBid!==null&&i.referencePrice>0?Math.max(0,round((1-minimumBid/i.referencePrice)*100)):null;
 const warnings:string[]=[];
 if(minimumBid===null||targetBid===null)warnings.push("Percentuais inviabilizam o preço mínimo ou a margem desejada.");
 if(proposed!==null&&minimumBid!==null&&proposed<minimumBid)warnings.push("Lance proposto abaixo do preço mínimo calculado.");
 if(i.referencePrice!==undefined&&minimumBid!==null&&i.referencePrice<minimumBid)warnings.push("Preço de referência abaixo do custo mínimo estimado.");
 if(!i.unitLabor)warnings.push("Mão de obra não informada.");
 if(!i.unitTravel)warnings.push("Deslocamento não informado.");
 if(!i.riskReservePercent)warnings.push("Reserva de riscos não informada.");
 return {variableUnitCost:variable,directCost:direct,riskReserve:reserve,totalCost,minimumBid,targetBid,estimatedProfit,estimatedMargin,maximumDiscount,warnings};
}
