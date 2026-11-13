import type {AgendaMode} from './agenda-calendar.ts';
export function preferredAgendaMode(narrow:boolean,selected:AgendaMode|null):AgendaMode{return selected??(narrow?'Dia':'Semana');}
export function sortOrdersByTime<T extends {id:string;time?:string}>(orders:T[]):T[]{
 const minutes=(time?:string)=>{if(!time||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return Infinity;const [h,m]=time.split(':').map(Number);return h*60+m;};
 return [...orders].sort((a,b)=>{const left=minutes(a.time),right=minutes(b.time);return left===right?a.id.localeCompare(b.id,'pt-BR',{numeric:true}):left<right?-1:1;});
}
