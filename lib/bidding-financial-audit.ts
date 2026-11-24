export type FinancialInputs={currentAssets:number;currentLiabilities:number;realizableLongTerm:number;longTermLiabilities:number;totalAssets:number;minimumCurrent:string;minimumGeneral:string;minimumSolvency:string;sourceNote:string;documentIds:string[]};
export type FinancialRatio={name:string;value:number|null;minimum:number|null;status:"ok"|"below"|"missing"|"undefined"};
export function calculateBiddingFinancialRatios(input:FinancialInputs):FinancialRatio[]{
 const denominator=input.currentLiabilities+input.longTermLiabilities;
 const ratio=(name:string,numerator:number,denom:number,minimumText:string):FinancialRatio=>{
  const minimum=minimumText.trim()===""?null:Number(minimumText);
  if(denom===0)return {name,value:null,minimum,status:"undefined"};
  const value=numerator/denom;
  return {name,value,minimum,status:minimum===null?"missing":value>=minimum?"ok":"below"};
 };
 return [
  ratio("Liquidez Corrente",input.currentAssets,input.currentLiabilities,input.minimumCurrent),
  ratio("Liquidez Geral",input.currentAssets+input.realizableLongTerm,denominator,input.minimumGeneral),
  ratio("Solvência Geral",input.totalAssets,denominator,input.minimumSolvency)
 ];
}
