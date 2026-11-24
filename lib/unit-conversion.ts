export type UnitConversionProduct={unitOfMeasure?:string;purchaseUnitOfMeasure?:string;purchaseToStockFactor?:number};
const normalizeUnit=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
const roundQuantity=(value:number)=>Math.round(value*1000)/1000;
/** Converts a purchase quantity into the product stock/sale unit. The factor is stock units per purchase unit, for example meters per kg. */
export function purchaseQuantityToStock(quantity:number,inputUnit:unknown,product:UnitConversionProduct){
 if(!Number.isFinite(quantity)||quantity<=0)throw new Error("Informe uma quantidade de compra válida.");
 const stockUnit=normalizeUnit(product.unitOfMeasure)||"un";
 const purchaseUnit=normalizeUnit(inputUnit)||normalizeUnit(product.purchaseUnitOfMeasure)||stockUnit;
 if(purchaseUnit===stockUnit)return {quantity:roundQuantity(quantity),purchaseQuantity:quantity,purchaseUnit,stockUnit,factor:1};
 const configuredPurchaseUnit=normalizeUnit(product.purchaseUnitOfMeasure);
 const factor=Number(product.purchaseToStockFactor);
 if(purchaseUnit!==configuredPurchaseUnit)throw new Error(`A unidade ${purchaseUnit} não corresponde à unidade de compra configurada para este produto (${configuredPurchaseUnit||stockUnit}).`);
 if(!Number.isFinite(factor)||factor<=0)throw new Error(`Configure o fator de conversão de ${purchaseUnit} para ${stockUnit} no cadastro do produto.`);
 return {quantity:roundQuantity(quantity*factor),purchaseQuantity:quantity,purchaseUnit,stockUnit,factor};
}
