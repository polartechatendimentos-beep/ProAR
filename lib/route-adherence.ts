import type {WorkRoute} from "./work-routes.ts";
type PlannedStop={id:string;client?:string;latitude?:number;longitude?:number;sequence?:number};
export type RouteAdherence={score:number;classification:"aderente"|"atenção"|"divergente";planned:number;visited:number;outOfOrder:number;unplanned:number;notes:string[]};
export function comparePlannedRoute(route:WorkRoute,planned:PlannedStop[]):RouteAdherence{
 const expected=[...planned].sort((a,b)=>(a.sequence??999)-(b.sequence??999));const actual=route.stops.map(s=>s.osId);
 const visited=expected.filter(x=>actual.includes(x.id)).length;let outOfOrder=0,last=-1;
 for(const id of actual){const index=expected.findIndex(x=>x.id===id);if(index>=0){if(index<last)outOfOrder++;last=Math.max(last,index)}}
 const unplanned=actual.filter(id=>!expected.some(x=>x.id===id)).length;
 const coverage=expected.length?visited/expected.length:1;const penalty=Math.min(.5,outOfOrder*.1+unplanned*.1);const score=Math.max(0,Math.round((coverage-penalty)*100));
 const notes:string[]=[];if(visited<expected.length)notes.push(expected.length-visited+" parada(s) planejada(s) não registrada(s).");if(outOfOrder)notes.push(outOfOrder+" atendimento(s) fora da sequência planejada.");if(unplanned)notes.push(unplanned+" parada(s) não previstas na rota.");
 return{score,classification:score>=85?"aderente":score>=65?"atenção":"divergente",planned:expected.length,visited,outOfOrder,unplanned,notes};
}
export function attendanceSummary(route:WorkRoute){const events=route.events;const pauses=events.filter(e=>e.type==="pause").map((p,i)=>({start:p.at,end:events.slice(events.indexOf(p)+1).find(e=>e.type==="resume")?.at}));const pauseMinutes=pauses.reduce((sum,p)=>sum+(p.end?Math.max(0,(Date.parse(p.end)-Date.parse(p.start))/60000):0),0);return{entry:route.startedAt,exit:route.endedAt,status:route.status,pauseMinutes:Math.round(pauseMinutes),workedMinutes:Math.max(0,Math.round(((Date.parse(route.endedAt||new Date().toISOString())-Date.parse(route.startedAt))/60000)-pauseMinutes)),pauses};}
