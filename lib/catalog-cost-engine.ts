/** Pure, auditable pricing calculation for catalog products and services. AI may explain results but never supply missing costs silently. */
export type CostLine = { id:string; label:string; quantity:number; unitCost:number; category:"material"|"labor"|"travel"|"overhead"|"other" };
export type PriceScenario = { taxPercent:number; marginPercent:number; cardFeePercent?:number; discountPercent?:number };
export type PriceResult = { cost:number; suggestedPrice:number|null; netRevenue:number|null; estimatedProfit:number|null; effectiveMarginPercent:number|null; warnings:string[]; breakdown:Record<string,number> };
const money=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
export function calculateCatalogPrice(lines:CostLine[], scenario:PriceScenario):PriceResult {
  const warnings:string[]=[];
  const breakdown:Record<string,number>={material:0,labor:0,travel:0,overhead:0,other:0};
  for(const line of lines){
    if(!Number.isFinite(line.quantity)||!Number.isFinite(line.unitCost)||line.quantity<0||line.unitCost<0)throw new Error("Custo ou quantidade inválidos");
    if(!(line.category in breakdown))throw new Error("Categoria de custo inválida");
    breakdown[line.category]+=line.quantity*line.unitCost;
  }
  for(const [key,value] of Object.entries(scenario))if(value!==undefined&&(!Number.isFinite(value)||value<0||value>=100))throw new Error(`Percentual inválido: ${key}`);
  const cost=money(Object.values(breakdown).reduce((a,b)=>a+b,0));
  if(!lines.length)warnings.push("Cadastre os custos antes de calcular o preço.");
  if(!breakdown.labor)warnings.push("Mão de obra não informada.");
  if(!breakdown.overhead)warnings.push("Despesas indiretas não informadas.");
  const taxes=scenario.taxPercent/100,margin=scenario.marginPercent/100,fee=(scenario.cardFeePercent||0)/100,discount=(scenario.discountPercent||0)/100;
  const denominator=(1-discount)*(1-taxes-fee-margin);
  if(denominator<=0){warnings.push("A soma de impostos, taxas e margem inviabiliza o preço.");return{cost,suggestedPrice:null,netRevenue:null,estimatedProfit:null,effectiveMarginPercent:null,warnings,breakdown};}
  const suggestedPrice=money(cost/denominator);
  const collected=money(suggestedPrice*(1-discount));
  const netRevenue=money(collected*(1-taxes-fee));
  const estimatedProfit=money(netRevenue-cost);
  return{cost,suggestedPrice,netRevenue,estimatedProfit,effectiveMarginPercent:collected>0?money(100*estimatedProfit/collected):null,warnings,breakdown:Object.fromEntries(Object.entries(breakdown).map(([k,v])=>[k,money(v)]))};
}
export function explainCatalogPrice(result:PriceResult):string {
  if(result.suggestedPrice===null)return "Não foi possível formar preço: "+result.warnings.join(" ");
  return `Custo total R$ ${result.cost.toFixed(2)}; preço sugerido R$ ${result.suggestedPrice.toFixed(2)}; lucro estimado R$ ${result.estimatedProfit?.toFixed(2)}. ${result.warnings.join(" ")}`;
}
