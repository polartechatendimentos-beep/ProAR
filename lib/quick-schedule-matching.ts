export type QuickScheduleCustomer = {
 id:string; name:string; legalName?:string; tradeName?:string; phone?:string; whatsapp?:string; address?:string;
 street?:string; addressNumber?:string; neighborhood?:string; city?:string; state?:string;
};
export type QuickScheduleTarget = {
 name:string; phone?:string|null; street?:string|null; number?:string|null; neighborhood?:string|null; city?:string|null;
};
export type CustomerCandidate = {customer:QuickScheduleCustomer;score:number;nameScore:number;addressMatch:boolean;phoneMatch:boolean;kind:"strong"|"probable"|"homonym"};
const stopWords=new Set(["da","de","do","das","dos","e","rua","avenida","av","r","rodovia","estrada","travessa","alameda"]);
export function normalizeScheduleText(value:unknown){
 return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR")
  .replace(/\b(av\.?|aven\.?|avd\.?|avenida)\b/g,"avenida").replace(/\b(r\.?|rua)\b/g,"rua")
  .replace(/\b(tr\.?|trav\.?|travessa)\b/g,"travessa").replace(/\b(rod\.?|rodovia)\b/g,"rodovia")
  .replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
}
const nameTokens=(value:unknown)=>normalizeScheduleText(value).split(" ").filter(token=>token&&!stopWords.has(token));
const phoneDigits=(value:unknown)=>String(value||"").replace(/\D/g,"").replace(/^55(?=\d{10,11}$)/,"");
function similarity(a:string,b:string){
 if(!a||!b)return 0;
 if(a===b)return 1;
 const left=a.toLocaleLowerCase("pt-BR"),right=b.toLocaleLowerCase("pt-BR");
 const previous=Array.from({length:right.length+1},(_,index)=>index);
 for(let i=1;i<=left.length;i++){
  let diagonal=previous[0];previous[0]=i;
  for(let j=1;j<=right.length;j++){const old=previous[j];previous[j]=Math.min(previous[j]+1,previous[j-1]+1,diagonal+(left[i-1]===right[j-1]?0:1));diagonal=old;}
 }
 const edit=1-previous[right.length]/Math.max(left.length,right.length);
 const aa=nameTokens(left),bb=nameTokens(right),common=aa.filter(token=>bb.includes(token)).length;
 const token=common/Math.max(aa.length,bb.length,1);
 return Math.max(edit,token);
}
function customerAddress(customer:QuickScheduleCustomer){
 const street=customer.street||String(customer.address||"").replace(/,?\s*\b\d+[a-z]?\b.*$/i,"");
 const number=customer.addressNumber||String(customer.address||"").match(/(?:^|[,\s])([0-9]{1,6}[a-z]?)(?:[,\s]|$)/i)?.[1]||"";
 return {street:normalizeScheduleText(street),number:normalizeScheduleText(number)};
}
export function rankScheduleCustomers(target:QuickScheduleTarget,customers:QuickScheduleCustomer[],limit=10):CustomerCandidate[]{
 const targetPhone=phoneDigits(target.phone),targetStreet=normalizeScheduleText(target.street),targetNumber=normalizeScheduleText(target.number);
 return customers.map(customer=>{
  const phoneMatch=Boolean(targetPhone&&targetPhone.length>=10&&[customer.phone,customer.whatsapp].some(value=>phoneDigits(value)===targetPhone));
  const saved=customerAddress(customer);
  const addressMatch=Boolean(targetStreet&&targetNumber&&saved.street&&saved.number===targetNumber&&similarity(targetStreet,saved.street)>=0.78);
  const nameScore=Math.round(100*similarity(normalizeScheduleText(target.name),normalizeScheduleText(customer.name||customer.legalName||customer.tradeName||"")));
  let score=Math.round(nameScore*.48+(addressMatch?100:0)*.34+(phoneMatch?100:0)*.18);
  let kind:CustomerCandidate["kind"]="probable";
  if(phoneMatch||(addressMatch&&nameScore>=60)){score=Math.max(score,94);kind="strong";}
  else if(nameScore>=85){score=Math.max(score,Math.min(89,nameScore));kind="homonym";}
  else if(addressMatch){score=Math.max(score,74);kind="probable";}
  else if(score<35)return null;
  return {customer,score,nameScore,addressMatch,phoneMatch,kind};
 }).filter((item):item is CustomerCandidate=>Boolean(item)).sort((a,b)=>b.score-a.score||a.customer.name.localeCompare(b.customer.name,"pt-BR")).slice(0,Math.min(10,Math.max(1,limit)));
}
