/** Domain validation for OS service lines. All values in BRL cents. No persistence or automatic charges. */
export type OsServiceLine={id:string;quantity:number;catalogUnitCents:number;overrideUnitCents?:number};
export type OsPricingInput={role:string;lines:OsServiceLine[];discountCents:number;surchargeCents:number;paymentMethod:string;cardFeePercent:number};
const safe=(v:number)=>Number.isSafeInteger(v)&&v>=0;
export function calculateOsPricing(input:OsPricingInput){
 if(!safe(input.discountCents)||!safe(input.surchargeCents))throw new Error("Acréscimo ou desconto inválido.");
 if(!Number.isFinite(input.cardFeePercent)||input.cardFeePercent<0||input.cardFeePercent>100)throw new Error("Taxa de cartão inválida.");
 if(input.paymentMethod!=="Cartão de crédito"&&input.paymentMethod!=="Cartão de débito"&&input.cardFeePercent!==0)throw new Error("Taxa de cartão só é permitida para pagamento com cartão.");
 const admin=input.role==="Administrador";
 const ids=new Set<string>();
 let subtotalCents=0;
 for(const line of input.lines){
  if(!line.id||ids.has(line.id)||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>10000||!safe(line.catalogUnitCents))throw new Error("Item ou quantidade inválida.");
  ids.add(line.id);
  if(line.overrideUnitCents!==undefined&&(!admin||!safe(line.overrideUnitCents)))throw new Error("Alteração de valor permitida somente ao administrador.");
  subtotalCents+=line.quantity*(line.overrideUnitCents??line.catalogUnitCents);
  if(!Number.isSafeInteger(subtotalCents))throw new Error("Total excede limite.");
 }
 const baseCents=subtotalCents+input.surchargeCents-input.discountCents;
 if(!Number.isSafeInteger(baseCents)||baseCents<0)throw new Error("Desconto excede o valor da OS.");
 const cardFeeCents=Math.round(baseCents*input.cardFeePercent/100);
 const totalCents=baseCents+cardFeeCents;
 if(!Number.isSafeInteger(totalCents))throw new Error("Total excede limite.");
 return {subtotalCents,discountCents:input.discountCents,surchargeCents:input.surchargeCents,cardFeeCents,totalCents};
}
