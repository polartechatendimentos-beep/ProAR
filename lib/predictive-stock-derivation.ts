import {consolidatePurchaseSuggestions,type StockDemand} from "./predictive-stock.ts";type R=Record<string,unknown>;const n=(v:unknown)=>Number(v)||0;
export function deriveStockDemand(products:R[],serviceOrders:R[]=[],works:R[]=[]):StockDemand[]{
 return products.map(p=>{const productId=String(p.id??p.code??"");const scheduledDemand=[...serviceOrders,...works].reduce((sum,r)=>{const items=Array.isArray(r.catalogItems)?r.catalogItems:Array.isArray(r.items)?r.items:[];return sum+(items as R[]).filter(i=>String(i.id??i.productId)===productId).reduce((s,i)=>s+n(i.quantity),0)},0);return{productId,name:String(p.name??p.description??productId),available:n(p.stockCurrent??p.stock),reserved:n(p.reservedStock??p.reserved),minimum:n(p.minimumStock??p.minimum),scheduledDemand,horizonDays:30}}).filter(x=>x.productId);
}
export function predictivePurchaseList(products:R[],serviceOrders:R[]=[],works:R[]=[]){return consolidatePurchaseSuggestions(deriveStockDemand(products,serviceOrders,works));}
