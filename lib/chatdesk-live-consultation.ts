/** Read-only projections for assisted chat responses. Never invent prices, slots or reservations. */
type Row = Record<string, unknown>;
const normal = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
const text = (v:unknown) => String(v??"").trim();
export function catalogForChat(modules:Record<string,Row[]>,query="") {
  const terms=normal(query).slice(0,100);
  const names=["Serviços","Servicos","Catálogo de Serviços","Catalogo de Servicos"];
  const rows=names.flatMap(name=>Array.isArray(modules[name])?modules[name]:[]);
  const unique=new Map<string,{id:string;name:string;price:number|null;description:string}>();
  for(const item of rows){
    const id=text(item.id),name=text(item.name||item.description);
    if(!id||!name||/inativ|cancelad|excluid|arquivad/.test(normal(item.status)))continue;
    if(terms&&!normal([id,name,item.description].join(" ")).includes(terms))continue;
    // Only explicitly named selling-price fields are eligible, not costs or estimates.
    const raw=item.salePrice??item.sellingPrice??item.unitPrice??item.price;
    const amount=typeof raw==="number"?raw:typeof raw==="string"&&/^\d+(?:[.,]\d{1,2})?$/.test(raw.trim())?Number(raw.trim().replace(",",".")):NaN;
    const price=Number.isFinite(amount)&&amount>0?amount:null;
    if(!unique.has(id))unique.set(id,{id,name:name.slice(0,160),price,description:text(item.description).slice(0,320)});
  }
  return {items:[...unique.values()].slice(0,40),total:unique.size};
}
export function scheduledSlotsForChat(orders:Row[],date:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return [];
  return orders.filter(row=>row.date===date&&!/cancelad|conclu[ií]d|finalizad/.test(normal(row.status))&&/^([01]\d|2[0-3]):[0-5]\d$/.test(text(row.time)))
  .slice(0,80).map(row=>({time:text(row.time),technician:text(row.tech),durationMinutes:Number(row.estimatedDurationMinutes||row.durationMinutes)||60}));
}
