"use client";
import {useMemo,useState} from "react";
import {simulatePublicBid,type BidCostInput} from "@/lib/catalog-bid-simulator";
const format=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function CatalogBidSimulator({baseCost=0}:{baseCost?:number}){
 const [input,setInput]=useState<BidCostInput>({units:1,unitMaterials:baseCost,unitLabor:0,unitTravel:0,unitOther:0,fixedContractCost:0,taxPercent:10,feesPercent:0,riskReservePercent:5,targetMarginPercent:20});
 const update=(key:keyof BidCostInput,value:number)=>setInput(old=>({...old,[key]:value}));
 const result=useMemo(()=>{try{return simulatePublicBid(input);}catch{return null;}},[input]);
 const fields:[keyof BidCostInput,string][]=[["units","Quantidade"],["unitMaterials","Material/unidade (R$)"],["unitLabor","Mão de obra/unidade (R$)"],["unitTravel","Deslocamento/unidade (R$)"],["unitOther","Outros custos/unidade (R$)"],["fixedContractCost","Custos fixos do contrato (R$)"],["taxPercent","Impostos (%)"],["feesPercent","Taxas (%)"],["riskReservePercent","Reserva de risco (%)"],["targetMarginPercent","Margem desejada (%)"],["referencePrice","Valor estimado do edital (R$)"],["proposedBid","Lance proposto (R$)"]];
 return <section className="wide" style={{display:"grid",gap:10,border:"1px solid #cbd5e1",borderRadius:12,padding:12}}>
  <strong>Simulador de licitações • Viabilidade de lance</strong>
  <small>Valores em reais. Informe custos e condições do edital. A simulação não envia lances nem altera cadastros.</small>
  <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>
  {fields.map(([key,label])=><label key={key}>{label}<input type="number" min="0" step={key==="units"?"1":"0.01"} value={input[key]??""} onChange={e=>setInput(old=>{const next={...old};if(e.target.value===""){delete next[key];}else{(next as Record<string,number>)[key]=Number(e.target.value);}return next;})}/></label>)}
  </div>
  {result?<div aria-live="polite" style={{display:"grid",gap:4}}>
   <p>Custo total estimado: <b>{format(result.totalCost)}</b></p>
   <p>Reserva para riscos: <b>{format(result.riskReserve)}</b></p>
   <p>Lance mínimo estimado: <b>{result.minimumBid===null?"Inviável":format(result.minimumBid)}</b></p>
   <p>Lance com margem desejada: <b>{result.targetBid===null?"Inviável":format(result.targetBid)}</b></p>
   <p>Lucro no lance proposto: <b>{result.estimatedProfit===null?"Informe o lance":format(result.estimatedProfit)}</b></p>
   <p>Margem no lance proposto: <b>{result.estimatedMargin===null?"—":result.estimatedMargin+"%"}</b></p>
   <p>Desconto máximo sobre referência: <b>{result.maximumDiscount===null?"—":result.maximumDiscount+"%"}</b></p>
   {result.warnings.map(w=><p key={w} role="status" style={{color:"#b45309"}}>Atenção: {w}</p>)}
  </div>:<p role="alert">Revise os valores. Quantidade e custos são obrigatórios; percentuais devem ser inferiores a 100%.</p>}
  <small>Não considera automaticamente regras de exequibilidade, encargos específicos, retenções, BDI ou exigências do edital. Valide os parâmetros antes de ofertar.</small>
 </section>;
}
