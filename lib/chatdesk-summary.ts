import {chatQueuePriority,type ChatConversation} from './chatdesk-local.ts';
/** Counts only the already authorized, loaded queue. Never implies the entire tenant history. */
export function chatdeskSummary(items:ChatConversation[],nowMs:number){
 const day=(value:number)=>new Date(value).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 const today=day(nowMs);
 return {waiting:items.filter(item=>chatQueuePriority(item,nowMs).waiting).length,unassigned:items.filter(item=>item.stage!=='Concluído'&&!item.assignee).length,today:items.filter(item=>Number.isFinite(Date.parse(item.updatedAt))&&day(Date.parse(item.updatedAt))===today).length};
}
