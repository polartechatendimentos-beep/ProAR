export type FinancialRecord = {
  id?: string;
  name?: string;
  category?: string;
  centerCost?: string;
  transactionType?: string;
  value?: number;
  settledValue?: number;
  dueDate?: string;
  date?: string;
  status?: string;
  [key:string]: unknown;
};

export type LedgerEntry = {
  id?: string;
  titleId?: string;
  signedValue?: number;
  kind?: string;
  createdAt?: string;
  paymentDate?: string;
  [key:string]: unknown;
};

const amount=(value:unknown)=>Number(value||0);
const payable=(record:FinancialRecord)=>record.transactionType==="Pagar"||/pagar|compra|fornecedor/i.test(`${record.name||""} ${record.category||""}`);
const day=(value:unknown)=>String(value||"").slice(0,10);

export function financialAnalytics(records:FinancialRecord[], ledger:LedgerEntry[], today=new Date().toISOString().slice(0,10)){
  const open=records.filter(record=>!/cancelad/i.test(String(record.status||"")));
  const outstanding=(record:FinancialRecord)=>Math.max(0,amount(record.value)-amount(record.settledValue));
  const receivable=open.filter(record=>!payable(record)).reduce((sum,record)=>sum+outstanding(record),0);
  const payableOpen=open.filter(record=>payable(record)).reduce((sum,record)=>sum+outstanding(record),0);

  const realized=ledger.filter(item=>item.kind==="Baixa"||item.kind==="Saldo legado");
  const revenue=realized.filter(item=>amount(item.signedValue)>0).reduce((sum,item)=>sum+amount(item.signedValue),0);
  const expense=realized.filter(item=>amount(item.signedValue)<0).reduce((sum,item)=>sum-Math.min(0,amount(item.signedValue)),0);

  const aging={current:0,d1_30:0,d31_60:0,d61_plus:0};
  for(const record of open.filter(record=>!payable(record))){
    const balance=outstanding(record);
    if(balance<=0) continue;
    const due=Date.parse(day(record.dueDate||record.date));
    const now=Date.parse(today);
    const days=Number.isFinite(due)?Math.floor((now-due)/86400000):-1;
    if(days<=0) aging.current+=balance;
    else if(days<=30) aging.d1_30+=balance;
    else if(days<=60) aging.d31_60+=balance;
    else aging.d61_plus+=balance;
  }

  const byCenter=new Map<string,{revenue:number;expense:number;result:number}>();
  for(const movement of realized){
    const title=records.find(record=>record.id===movement.titleId);
    const center=String(title?.centerCost||title?.category||"Sem centro de custo");
    const current=byCenter.get(center)||{revenue:0,expense:0,result:0};
    const value=amount(movement.signedValue);
    if(value>=0) current.revenue+=value; else current.expense+=-value;
    current.result=current.revenue-current.expense;
    byCenter.set(center,current);
  }

  return {
    receivable,
    payable:payableOpen,
    projectedResult:receivable-payableOpen,
    realizedRevenue:revenue,
    realizedExpense:expense,
    realizedResult:revenue-expense,
    aging,
    byCenter:[...byCenter.entries()].map(([center,data])=>({center,...data})).sort((a,b)=>Math.abs(b.result)-Math.abs(a.result)),
  };
}
