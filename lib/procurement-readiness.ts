export const CERTIFICATE_KINDS = ['Federal', 'Estadual', 'Municipal', 'FGTS', 'CNDT', 'Falência'] as const;
export type CertificateKind = typeof CERTIFICATE_KINDS[number];
export type ProcurementData = {
  type: 'certificate' | 'attestation'; kind?: CertificateKind; conclusion?: 'regular' | 'restrictive' | 'pending';
  issuer?: string; number?: string; verifiedAt?: string; expiresAt?: string; sourceUrl?: string;
  customer?: string; equipmentType?: string; capacityBtu?: number; equipmentCount?: number; responsibilityDocument?: string;
};
export type ProcurementRecord = {id:string;name:string;status?:string;procurement?:ProcurementData};
const day = (value:string) => {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return NaN;
  const n=Date.parse(`${value}T00:00:00Z`);return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value?n:NaN;
};
export function brazilDay(now=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function certificateHealth(data:ProcurementData,today=brazilDay()) {
  const expiry=day(data.expiresAt||''),current=day(today),verified=day(data.verifiedAt||'');
  const days=Number.isFinite(expiry)&&Number.isFinite(current)?Math.round((expiry-current)/864e5):null;
  if(data.conclusion==='restrictive')return {level:'critical',label:'Restritiva',days,eligible:false} as const;
  if(days!==null&&days<0)return {level:'critical',label:'Vencida',days,eligible:false} as const;
  if(data.conclusion!=='regular'||!Number.isFinite(verified)||verified>current||verified>expiry||days===null)return {level:'pending',label:'Conferência pendente',days,eligible:false} as const;
  if(days<=5)return {level:'critical',label:days===0?'Vence hoje':'Vence em até 5 dias',days,eligible:true} as const;
  if(days<=15)return {level:'warning',label:'Vence em até 15 dias',days,eligible:true} as const;
  return {level:'ok',label:'Regular',days,eligible:true} as const;
}
export function qualificationReadiness(records:ProcurementRecord[],today=brazilDay()) {
 const active=records.filter(r=>!['Inativo','Cancelado'].includes(r.status||'')&&r.procurement?.type==='certificate');
 const items=CERTIFICATE_KINDS.map(kind=>{
  const options=active.filter(r=>r.procurement?.kind===kind).map(record=>({record,...certificateHealth(record.procurement!,today)}));
  // A restrictive record requires explicit resolution/inactivation; a newer regular certificate does not hide it.
  const restrictive=options.find(r=>r.record.procurement?.conclusion==='restrictive');
  const chosen=restrictive||options.filter(r=>r.eligible).sort((a,b)=>(b.days||0)-(a.days||0))[0]||options[0];
  return {kind,...(chosen||{level:'pending',label:'Não cadastrada',days:null,eligible:false})};
 });
 return {eligible:items.every(i=>i.eligible),items};
}
export type PricingInput={labor:number;parts:number;supplies:number;travel:number;tools:number;administration:number;risk:number;insurance:number;financial:number;profit:number;taxes:number};
export const EMPTY_PRICING:PricingInput={labor:0,parts:0,supplies:0,travel:0,tools:0,administration:0,risk:0,insurance:0,financial:0,profit:0,taxes:0};
export function priceComposition(input:PricingInput) {
 const values=Object.keys(EMPTY_PRICING).map(key=>input[key as keyof PricingInput]);if(values.some(n=>!Number.isFinite(n)||n<0))throw new Error('Informe valores não negativos e finitos.');
 for(const key of ['administration','risk','insurance','financial','profit','taxes'] as const)if(input[key]>=100)throw new Error('Percentuais devem ser menores que 100%.');
 const direct=input.labor+input.parts+input.supplies+input.travel+input.tools;
 const factor=(1+(input.administration+input.risk+input.insurance)/100)*(1+input.financial/100)*(1+input.profit/100)/(1-input.taxes/100);
 if(!Number.isFinite(direct*factor)||direct*factor>1e12)throw new Error('Composição excede o limite de cálculo.');
 return {direct,bdi:(factor-1)*100,price:Math.ceil(direct*factor*100)/100};
}
export function matchAttestations(records:ProcurementRecord[],requiredBtu:number,equipmentType:string,allowSum:boolean) {
 const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const type=norm(equipmentType);
 const valid=records.filter(r=>r.procurement?.type==='attestation'&&!['Inativo','Cancelado'].includes(r.status||''));
 const compatible=valid.filter(r=>r.procurement?.responsibilityDocument?.trim()&&norm(r.procurement.equipmentType||'')===type&&Number.isFinite(r.procurement.capacityBtu)&&Number(r.procurement.capacityBtu)>0);
 const unique=compatible.filter((r,i)=>compatible.findIndex(o=>o.id===r.id)===i).sort((a,b)=>Number(b.procurement!.capacityBtu)-Number(a.procurement!.capacityBtu));
 const selected:ProcurementRecord[]=[];let capacityBtu=0;
 if(Number.isFinite(requiredBtu)&&requiredBtu>0&&type)for(const r of unique){selected.push(r);capacityBtu+=Number(r.procurement!.capacityBtu);if(!allowSum||capacityBtu>=requiredBtu)break;}
 return {selected,capacityBtu,meets:requiredBtu>0&&capacityBtu>=requiredBtu,requiresReview:true};
}
export function validateProcurementData(value:ProcurementData) {
 if(!['certificate','attestation'].includes(value.type))throw new Error('Tipo de documento inválido.');
 if(value.sourceUrl){const url=new URL(value.sourceUrl);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Informe um link HTTPS sem credenciais.');}
 if(value.type==='certificate'){
  if(!CERTIFICATE_KINDS.includes(value.kind!)||!['regular','restrictive','pending'].includes(value.conclusion||''))throw new Error('Classifique a certidão e o resultado da conferência.');
  if(!Number.isFinite(day(value.expiresAt||'')))throw new Error('Informe uma validade válida.');
  if(value.conclusion!=='pending'&&(!Number.isFinite(day(value.verifiedAt||''))||String(value.verifiedAt)>brazilDay()))throw new Error('Informe a data válida da conferência, sem data futura.');
 }else if(!value.customer?.trim()||!value.equipmentType?.trim()||!Number.isFinite(value.capacityBtu)||Number(value.capacityBtu)<=0||!Number.isInteger(value.equipmentCount)||Number(value.equipmentCount)<=0||!value.responsibilityDocument?.trim())throw new Error('Preencha contratante, tipo, capacidade, quantidade e ART/TRT do atestado.');
}
