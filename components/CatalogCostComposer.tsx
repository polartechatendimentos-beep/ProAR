"use client";
import {useMemo,useState} from "react";
import {calculateCatalogPrice,explainCatalogPrice,type CostLine} from "@/lib/catalog-cost-engine";
export function CatalogCostComposer({onApply}:{onApply:(cost:number,price:number)=>void}){
 const [lines,setLines]=useState<CostLine[]>([{id:"material",label:"Materiais",quantity:1,unitCost:0,category:"material"},{id:"labor",label:"Mão de obra",quantity:1,unitCost:0,category:"labor"},{id:"travel",label:"Deslocamento",quantity:1,unitCost:0,category:"travel"},{id:"overhead",label:"Despesas indiretas",quantity:1,unitCost:0,category:"overhead"}]);
 const [tax,setTax]=useState(10),[margin,setMargin]=useState(30),[fee,setFee]=useState(0);
 const result=useMemo(()=>{try{return calculateCatalogPrice(lines,{taxPercent:tax,marginPercent:margin,cardFeePercent:fee});}catch{return null;}},[lines,tax,margin,fee]);
 const format=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 return <section className="wide" style={{border:"1px solid #cbd5e1",borderRadius:12,padding:12,display:"grid",gap:10}}>
  <strong>Composição de custos • Assistente de preços</strong>
  <small>Preencha os custos reais. A análise é calculada por regras auditáveis; nenhuma IA inventa valores.</small>
  {lines.map((line,index)=><div key={line.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8}}>
   <label>{line.label}<input type="text" value={line.label} onChange={e=>setLines(old=>old.map((v,i)=>i===index?{...v,label:e.target.value}:v))}/></label>
   <label>Qtd.<input type="number" min="0" step=".01" value={line.quantity} onChange={e=>setLines(old=>old.map((v,i)=>i===index?{...v,quantity:Number(e.target.value)}:v))}/></label>
   <label>R$/un.<input type="number" min="0" step=".01" value={line.unitCost} onChange={e=>setLines(old=>old.map((v,i)=>i===index?{...v,unitCost:Number(e.target.value)}:v))}/></label>
  </div>)}
  <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>
   <label>Impostos %<input type="number" min="0" max="99" value={tax} onChange={e=>setTax(Number(e.target.value))}/></label>
   <label>Margem %<input type="number" min="0" max="99" value={margin} onChange={e=>setMargin(Number(e.target.value))}/></label>
   <label>Taxa cartão %<input type="number" min="0" max="99" value={fee} onChange={e=>setFee(Number(e.target.value))}/></label>
  </div>
  {result?<><strong>Custo: {format(result.cost)} • Preço sugerido: {result.suggestedPrice===null?"Inviável":format(result.suggestedPrice)}</strong><p aria-live="polite">{explainCatalogPrice(result)}</p><button type="button" className="outline-btn" disabled={result.suggestedPrice===null||result.cost<=0} onClick={()=>{if(result.suggestedPrice!==null)onApply(result.cost,result.suggestedPrice);}}>Aplicar custo e preço sugeridos no cadastro</button></>:<p role="alert">Revise os custos e percentuais informados.</p>}
 </section>;
}
