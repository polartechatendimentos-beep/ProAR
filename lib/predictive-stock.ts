export type StockDemand={productId:string;name:string;available:number;reserved:number;minimum:number;scheduledDemand:number;horizonDays:number};
export type StockForecast={productId:string;name:string;projected:number;shortage:number;status:"ok"|"attention"|"critical";suggestedPurchase:number};
export function forecastStock(d:StockDemand):StockForecast{
 const projected=d.available-d.reserved-d.scheduledDemand;
 const shortage=Math.max(0,d.minimum-projected);
 return {productId:d.productId,name:d.name,projected,shortage,status:projected<0?"critical":projected<=d.minimum?"attention":"ok",suggestedPurchase:shortage};
}
export function consolidatePurchaseSuggestions(rows:StockDemand[]){return rows.map(forecastStock).filter(x=>x.suggestedPurchase>0).sort((a,b)=>b.suggestedPurchase-a.suggestedPurchase);}
