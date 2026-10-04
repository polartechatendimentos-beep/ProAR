export type RouteJob={id:string;region?:string;date:string;time?:string;requiredSkills?:string[];estimatedMinutes?:number};
export type Technician={id:string;regions?:string[];skills?:string[];availableMinutes:number};
export type RouteAssignment={jobId:string;technicianId?:string;reason:string};
export function suggestAssignments(jobs:RouteJob[],techs:Technician[]):RouteAssignment[]{
 const remaining=new Map(techs.map(t=>[t.id,t.availableMinutes]));
 return jobs.map(job=>{const candidates=techs.filter(t=>(!job.region||!t.regions?.length||t.regions.includes(job.region))&&(job.requiredSkills||[]).every(s=>t.skills?.includes(s))&&(remaining.get(t.id)||0)>=(job.estimatedMinutes||0)).sort((a,b)=>(remaining.get(b.id)||0)-(remaining.get(a.id)||0)); const pick=candidates[0]; if(!pick)return{jobId:job.id,reason:"Nenhum técnico compatível/disponível."};remaining.set(pick.id,(remaining.get(pick.id)||0)-(job.estimatedMinutes||0));return{jobId:job.id,technicianId:pick.id,reason:"Compatível com região, habilidade e capacidade disponível."};});
}
