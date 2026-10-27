export type DreEntry={id:string;date:string;kind:"revenue"|"cost";category:string;amount:number;costCenterId?:string;sourceType?:string;sourceId?:string;status?:"confirmed"|"projected"};
export function buildDre(entries:DreEntry[]){
 const confirmed=entries.filter(x=>x.status!=="projected");
 const revenue=confirmed.filter(x=>x.kind==="revenue").reduce((s,x)=>s+x.amount,0);
 const costs=confirmed.filter(x=>x.kind==="cost").reduce((s,x)=>s+x.amount,0);
 const byCategory=Object.entries(confirmed.reduce((a,x)=>{a[x.category]=(a[x.category]||0)+(x.kind==="revenue"?x.amount:-x.amount);return a;},{} as Record<string,number>)).map(([category,result])=>({category,result}));
 return {revenue,costs,result:revenue-costs,margin:revenue?((revenue-costs)/revenue)*100:0,byCategory};
}
export function profitabilityBySource(entries:DreEntry[]){const groups=new Map<string,DreEntry[]>();for(const x of entries){const key=`${x.sourceType||"Sem origem"}:${x.sourceId||"geral"}`;groups.set(key,[...(groups.get(key)||[]),x]);}return [...groups.entries()].map(([source,rows])=>({source,...buildDre(rows)})).sort((a,b)=>b.result-a.result);}
