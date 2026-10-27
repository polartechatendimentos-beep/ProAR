export type WorkStatusCount={status:string;count:number;progress:number};
export type WorkTodaySummary={total:number;completed:number;inProgress:number;notStarted:number;incidents:number;stale:number;nextActions:WorkStatusCount[]};
const finalStatus="SERVIÇO CONCLUÍDO";
export function buildWorkTodaySummary<T extends {status:string;updatedAt?:string;incidents?:unknown[]}>(houses:T[],progress:(status:string)=>number,now=Date.now()):WorkTodaySummary{
 const counts=new Map<string,number>();let completed=0,inProgress=0,notStarted=0,incidents=0,stale=0;
 for(const house of houses){const p=progress(house.status);if(house.status===finalStatus||p>=100)completed++;else if(p<=0)notStarted++;else inProgress++;incidents+=house.incidents?.length??0;if(house.updatedAt&&now-new Date(house.updatedAt).getTime()>7*86400000&&p<100)stale++;if(p<100)counts.set(house.status,(counts.get(house.status)||0)+1);}
 const nextActions=[...counts.entries()].map(([status,count])=>({status,count,progress:progress(status)})).sort((a,b)=>b.progress-a.progress||b.count-a.count);
 return{total:houses.length,completed,inProgress,notStarted,incidents,stale,nextActions};
}
export function workDailyLog<T extends {updatedAt?:string;history?:Array<{createdAt:string;responsible?:string;status:string;note?:string}>}>(houses:T[],date=new Date()){
 const key=date.toISOString().slice(0,10);return houses.flatMap((house,index)=>(house.history??[]).filter(h=>h.createdAt.slice(0,10)===key).map(h=>({unit:index+1,...h}))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
