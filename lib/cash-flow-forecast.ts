export type CashFlowItem={id:string;date:string;amount:number;direction:"in"|"out";status:"confirmed"|"projected";source:string};
export function cashFlowForecast(items:CashFlowItem[],from:string,horizons=[7,30,60,90]){
 return horizons.map(days=>{const start=new Date(from+"T12:00:00");const end=new Date(start);end.setDate(end.getDate()+days);const relevant=items.filter(x=>{const d=new Date(x.date+"T12:00:00");return d>=start&&d<=end;});const confirmed=relevant.filter(x=>x.status==="confirmed").reduce((s,x)=>s+(x.direction==="in"?x.amount:-x.amount),0);const projected=relevant.filter(x=>x.status==="projected").reduce((s,x)=>s+(x.direction==="in"?x.amount:-x.amount),0);return{days,confirmed,projected,total:confirmed+projected};});
}
