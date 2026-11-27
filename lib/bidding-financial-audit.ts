export type FinancialOperator = "gte" | "gt" | "not_required";
export type FinancialInputs = {
 currentAssets:number;currentLiabilities:number;realizableLongTerm:number;longTermLiabilities:number;totalAssets:number;
 minimumCurrent:string;minimumGeneral:string;minimumSolvency:string;
 operatorCurrent?:FinancialOperator;operatorGeneral?:FinancialOperator;operatorSolvency?:FinancialOperator;
 sourceNote:string;documentIds:string[];
};
export type FinancialRatio = {name:string;value:number|null;minimum:number|null;operator:FinancialOperator|null;status:"ok"|"below"|"missing"|"undefined"|"not_required"};
export const FINANCIAL_RATIO_FIELDS = [
 {name:"Liquidez Corrente",minimum:"minimumCurrent",operator:"operatorCurrent", pattern:/liquidez corrente|\blc\b/i},
 {name:"Liquidez Geral",minimum:"minimumGeneral",operator:"operatorGeneral", pattern:/liquidez geral|\blg\b/i},
 {name:"Solvência Geral",minimum:"minimumSolvency",operator:"operatorSolvency",pattern:/solvencia geral|\bsg\b/i},
] as const;

function isOperator(value:unknown):value is FinancialOperator {
 return value==="gte"||value==="gt"||value==="not_required";
}
type Decimal={coefficient:bigint;scale:number};
const power=(n:number)=>BigInt(10)**BigInt(n);
function decimal(value:number):Decimal {
 const [mantissa, exponentText]=value.toString().split("e");
 const [whole,fraction=""]=mantissa.split(".");
 const scale=fraction.length-Number(exponentText??0);
 const coefficient=BigInt(whole+fraction);
 return scale<0?{coefficient:coefficient*power(-scale),scale:0}:{coefficient,scale};
}
function sum(values:number[]):Decimal {
 const parts=values.map(decimal),scale=Math.max(...parts.map(p=>p.scale));
 return {scale,coefficient:parts.reduce((a,p)=>a+p.coefficient*power(scale-p.scale),BigInt(0))};
}

export function calculateBiddingFinancialRatios(input:FinancialInputs):FinancialRatio[] {
 const values=[
  [[input.currentAssets],[input.currentLiabilities]],
  [[input.currentAssets,input.realizableLongTerm],[input.currentLiabilities,input.longTermLiabilities]],
  [[input.totalAssets],[input.currentLiabilities,input.longTermLiabilities]],
 ];
 return FINANCIAL_RATIO_FIELDS.map((field,index)=>{
  const [numerator,denominator]=values[index];
  const rawOperator=input[field.operator],operator=isOperator(rawOperator)?rawOperator:null;
  const text=typeof input[field.minimum]==="string"?input[field.minimum].trim().replace(",", "."):"";
  const threshold=/^\d+(?:\.\d+)?$/.test(text)?Number(text):NaN;
  const minimum=Number.isFinite(threshold)?threshold:null;
  const base={name:field.name,operator,minimum};
  if(operator==="not_required")return {...base,value:null,minimum:null,status:input.sourceNote?.trim().length>=5?"not_required":"missing"};
  if([...numerator,...denominator].some(n=>!Number.isFinite(n)||n<0)||denominator.every(n=>n===0))return {...base,value:null,status:"undefined"};
  const value=numerator.reduce((a,b)=>a+b,0)/denominator.reduce((a,b)=>a+b,0);
  if(!Number.isFinite(value))return {...base,value:null,status:"undefined"};
  if(!operator||minimum===null)return {...base,value,status:"missing"};
  // Test the unrounded ratio by cross multiplication of decimal values, including decimal sums.
  const a=sum(numerator),b=sum(denominator),m=decimal(minimum);
  const lhs=a.coefficient*power(b.scale+m.scale),rhs=b.coefficient*m.coefficient*power(a.scale);
  return {...base,value,status:(operator==="gt"?lhs>rhs:lhs>=rhs)?"ok":"below"};
 });
}

export function biddingFinancialApprovalIssue(input:FinancialInputs|undefined,requirements:{category:string;description?:string;sourceQuote?:string}[]):string|null {
 const requiresAudit=requirements.some(req=>["Balanço Patrimonial","DRE","Índices econômico-financeiros"].includes(req.category));
 if(!input)return requiresAudit?"Complete a auditoria econômico-financeira exigida nesta matriz.":null;
 const ratios=calculateBiddingFinancialRatios(input);
 if(ratios.some(ratio=>ratio.status==="missing"))return "Revise os índices: informe o operador e o limite de cada índice exigido. Se o edital não exigir um índice, indique isso e registre a referência.";
 if(ratios.some(ratio=>ratio.status==="below"||ratio.status==="undefined"))return "Há índice que não atende à regra do edital ou não pode ser calculado. Revise o balanço, o operador e o limite.";
 const mandatory=requirements.filter(req=>req.category==="Índices econômico-financeiros");
 if(mandatory.length){
  const wording=mandatory.map(req=>[req.description,req.sourceQuote].join(" ")).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if(!ratios.some(ratio=>ratio.status==="ok")||FINANCIAL_RATIO_FIELDS.some((field,index)=>field.pattern.test(wording)&&ratios[index].status!=="ok")){
   return "Um índice exigido na matriz está marcado como não exigido. Compare a matriz com a cláusula do edital.";
  }
  // Check literal numeric clauses when one unambiguous condition follows the named indices.
  for(const req of mandatory){
   const quote=(req.sourceQuote||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
   const conditions=[...quote.matchAll(/(maior(?:es)? ou igua(?:l|is) (?:a|que)|igua(?:l|is) ou superior(?:es)? a|superior(?:es)? ou igua(?:l|is) a|maior(?:es)? que|superior(?:es)? a|>=|≥|>)\s*(\d+(?:[.,]\d+)?)(?![\d.,%])/g)];
   if(conditions.length!==1)continue;
   const match=conditions[0],names=quote.slice(0,match.index),minimum=Number(match[2].replace(",","."));
   const operator:FinancialOperator=/igua|>=|≥/.test(match[1])?"gte":"gt";
   if(FINANCIAL_RATIO_FIELDS.some((field,index)=>field.pattern.test(names)&&(ratios[index].operator!==operator||ratios[index].minimum!==minimum))){
    return "O operador ou limite da auditoria difere da referência registrada na matriz. Confira a cláusula do edital.";
   }
  }
 }
 return null;
}
