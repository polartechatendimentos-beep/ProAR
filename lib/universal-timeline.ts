export type TimelineEntry={id:string;at:string;module:string;entityType:string;entityId:string;action:string;actor?:string;summary:string;correlationId?:string;metadata?:Record<string,unknown>};
export function buildUniversalTimeline(entries:TimelineEntry[], filter:{entityId?:string;correlationId?:string}){
 return entries.filter(e=>(!filter.entityId||e.entityId===filter.entityId)&&(!filter.correlationId||e.correlationId===filter.correlationId)).sort((a,b)=>b.at.localeCompare(a.at));
}
export function appendTimeline(entries:TimelineEntry[], entry:TimelineEntry){
 if(entries.some(e=>e.id===entry.id)) return entries;
 return [...entries,entry];
}
