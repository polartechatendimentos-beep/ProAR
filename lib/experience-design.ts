export type TenderView="cards"|"table"|"kanban";
export function normalizeTenderView(value:unknown):TenderView{return value==="table"||value==="kanban"?value:"cards";}
export function deadlineIndicator(value?:string,now=Date.now()){
  const timestamp=Date.parse(value??"");if(!Number.isFinite(timestamp))return {tone:"unknown",label:"Prazo não informado"};
  const remaining=timestamp-now;if(remaining<=0)return {tone:"closed",label:"Prazo encerrado"};
  const hours=Math.ceil(remaining/3600000);
  return {tone:hours<=24?"urgent":hours<=48?"soon":"normal",label:hours<=48?`Encerra em até ${hours}h`:`Encerra em ${Math.ceil(hours/24)} dias`};
}
