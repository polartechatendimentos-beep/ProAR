"use client";

import { BarChart3, CircleDollarSign, PackageSearch, TrendingUp, WalletCards, Wrench } from "lucide-react";

type RecordLike = {
  id?: string;
  status?: string;
  value?: number;
  total?: number;
  cost?: number;
  costValue?: number;
  totalCost?: number;
  estimatedCost?: number;
  settledValue?: number;
  transactionType?: string;
  date?: string;
  createdAt?: string;
  stockCurrent?: number;
  stockMin?: number;
  [key:string]: unknown;
};

const money=(value:number)=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const amount=(record:RecordLike)=>Number(record.value??record.total??0);
const cost=(record:RecordLike)=>{
  for(const key of ["totalCost","costValue","estimatedCost","cost"] as const){
    const value=Number(record[key]);
    if(Number.isFinite(value)&&value>0) return value;
  }
  return 0;
};
const monthKey=(value:unknown)=>String(value||"").slice(0,7);

export function ManagementInsights({ modules, serviceOrders, onNavigate }: { modules:Record<string,RecordLike[]>; serviceOrders:RecordLike[]; onNavigate:(module:string)=>void }) {
  const currentMonth=new Date().toISOString().slice(0,7);
  const sales=(modules.Vendas||[]).filter(item=>monthKey(item.date||item.createdAt)===currentMonth&&!/cancel/i.test(String(item.status||"")));
  const revenue=sales.reduce((sum,item)=>sum+amount(item),0);
  const salesWithCost=sales.filter(item=>cost(item)>0);
  const knownCost=salesWithCost.reduce((sum,item)=>sum+cost(item),0);
  const knownRevenue=salesWithCost.reduce((sum,item)=>sum+amount(item),0);
  const margin=knownRevenue-knownCost;
  const marginPct=knownRevenue>0?margin/knownRevenue*100:0;

  const finance=modules.Financeiro||[];
  const receivable=finance.filter(item=>!/pagar|compra|fornecedor/i.test(`${item.transactionType||""}`)&&!/recebid|cancel/i.test(String(item.status||""))).reduce((sum,item)=>sum+Math.max(0,amount(item)-Number(item.settledValue||0)),0);
  const payable=finance.filter(item=>/pagar|compra|fornecedor/i.test(`${item.transactionType||""} ${item.status||""}`)&&!/paga|cancel/i.test(String(item.status||""))).reduce((sum,item)=>sum+Math.max(0,amount(item)-Number(item.settledValue||0)),0);
  const lowStock=(modules.Produtos||[]).filter(item=>Number(item.stockMin??-1)>=0&&Number(item.stockCurrent||0)<=Number(item.stockMin||0)).length;
  const openOrders=serviceOrders.filter(item=>!/conclu|cancel/i.test(String(item.status||""))).length;
  const budgets=modules.Orçamentos||[];
  const converted=budgets.filter(item=>/aprov|convert|vend/i.test(String(item.status||""))).length;
  const conversion=budgets.length?converted/budgets.length*100:0;

  const cards=[
    {label:"Vendas no mês",value:money(revenue),note:`${sales.length} venda(s)`,icon:TrendingUp,module:"Vendas"},
    {label:"Margem conhecida",value:salesWithCost.length?money(margin):"Sem custo",note:salesWithCost.length?`${marginPct.toFixed(1)}% • custo em ${salesWithCost.length}/${sales.length} vendas`:"Cadastre custos para medir rentabilidade",icon:BarChart3,module:"Relatórios"},
    {label:"A receber",value:money(receivable),note:`A pagar: ${money(payable)}`,icon:WalletCards,module:"Financeiro"},
    {label:"Estoque crítico",value:String(lowStock),note:lowStock?"Itens no mínimo ou abaixo":"Sem alerta de mínimo",icon:PackageSearch,module:"Estoque"},
    {label:"OS abertas",value:String(openOrders),note:`${serviceOrders.length} OS no histórico`,icon:Wrench,module:"Ordens de serviço"},
    {label:"Conversão comercial",value:`${conversion.toFixed(0)}%`,note:`${converted}/${budgets.length} orçamento(s)`,icon:CircleDollarSign,module:"Orçamentos"},
  ];

  return <section className="panel" style={{marginBottom:18}}>
    <div className="panel-head"><div><span className="section-kicker"><BarChart3 size={12}/> VISÃO GERENCIAL</span><h2>Indicadores para decidir rápido</h2><p>Valores calculados apenas com dados já registrados no ProAR.</p></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10,padding:"0 18px 18px"}}>
      {cards.map(({label,value,note,icon:Icon,module})=><button key={label} onClick={()=>onNavigate(module)} style={{textAlign:"left",border:"1px solid #e2e8f0",borderRadius:14,padding:14,background:"#fff",cursor:"pointer"}}>
        <span style={{display:"inline-flex",padding:8,borderRadius:10,background:"#f1f5f9"}}><Icon size={17}/></span>
        <small style={{display:"block",marginTop:10,color:"#64748b",fontWeight:700}}>{label.toUpperCase()}</small>
        <strong style={{display:"block",fontSize:20,marginTop:3}}>{value}</strong>
        <span style={{display:"block",fontSize:11,color:"#64748b",marginTop:3}}>{note}</span>
      </button>)}
    </div>
  </section>;
}
