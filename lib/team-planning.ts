export type PlanningOrder = {
  id?: string;
  tech?: string;
  date?: string;
  time?: string;
  status?: string;
  service?: string;
  serviceType?: string;
  estimatedDurationMinutes?: number;
  priority?: string;
  [key:string]: unknown;
};

export type PlanningEmployee = {
  id?: string;
  name?: string;
  status?: string;
  role?: string;
  function?: string;
  skills?: string[] | string;
  [key:string]: unknown;
};

const active=(status:unknown)=>!/conclu|cancel/i.test(String(status||""));
const minute=(time:unknown)=>{
  const match=String(time||"").match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1])*60+Number(match[2]) : null;
};
const duration=(order:PlanningOrder)=>Math.max(15,Number(order.estimatedDurationMinutes||90));
const skillText=(employee:PlanningEmployee)=>Array.isArray(employee.skills)?employee.skills.join(" "):String(employee.skills||employee.role||employee.function||"");

export function analyzeTeamSchedule(orders:PlanningOrder[], employees:PlanningEmployee[]=[]){
  const open=orders.filter(order=>active(order.status));
  const conflicts:Array<{orderId:string;otherOrderId:string;tech:string;date:string;message:string}>=[];
  const load=new Map<string,number>();
  const orderFlags=new Map<string,string[]>();

  for(const order of open){
    if(!order.id) continue;
    const flags:string[]=[];
    if(!order.date) flags.push("Sem data");
    if(!order.time) flags.push("Sem horário");
    if(!String(order.tech||"").trim()) flags.push("Sem técnico");
    if(flags.length) orderFlags.set(String(order.id),flags);
    if(order.date&&order.tech){
      const key=`${order.date}|${order.tech}`;
      load.set(key,(load.get(key)||0)+duration(order));
    }
  }

  const scheduled=open.filter(order=>order.id&&order.date&&order.time&&String(order.tech||"").trim());
  for(let i=0;i<scheduled.length;i++){
    const a=scheduled[i],aStart=minute(a.time);
    if(aStart===null) continue;
    const aEnd=aStart+duration(a);
    for(let j=i+1;j<scheduled.length;j++){
      const b=scheduled[j];
      if(a.date!==b.date||a.tech!==b.tech) continue;
      const bStart=minute(b.time);
      if(bStart===null) continue;
      const bEnd=bStart+duration(b);
      if(aStart<bEnd&&bStart<aEnd){
        conflicts.push({orderId:String(a.id),otherOrderId:String(b.id),tech:String(a.tech),date:String(a.date),message:`${a.id} e ${b.id} se sobrepõem`});
        orderFlags.set(String(a.id),[...(orderFlags.get(String(a.id))||[]),"Conflito de horário"]);
        orderFlags.set(String(b.id),[...(orderFlags.get(String(b.id))||[]),"Conflito de horário"]);
      }
    }
  }

  const overloaded=[...load.entries()].filter(([,minutes])=>minutes>8*60).map(([key,minutes])=>{
    const [date,tech]=key.split("|");
    return {date,tech,minutes,hours:Math.round(minutes/6)/10};
  });

  const suggestTechnicians=(order:PlanningOrder)=>{
    const service=`${order.service||""} ${order.serviceType||""}`.toLowerCase();
    return employees.filter(employee=>!/inativ|afast|férias|ferias/i.test(String(employee.status||""))&&String(employee.name||"").trim()).map(employee=>{
      const tech=String(employee.name);
      const minutes=order.date?(load.get(`${order.date}|${tech}`)||0):0;
      const skills=skillText(employee).toLowerCase();
      const terms=service.split(/\s+/).filter(term=>term.length>=5);
      const skillMatches=terms.filter(term=>skills.includes(term)).length;
      const score=skillMatches*100-minutes;
      return {tech,minutes,skillMatches,score};
    }).sort((a,b)=>b.score-a.score).slice(0,3);
  };

  return {
    conflicts,
    overloaded,
    unassigned:open.filter(order=>!order.date||!order.time||!String(order.tech||"").trim()),
    orderFlags,
    load,
    suggestTechnicians,
  };
}
