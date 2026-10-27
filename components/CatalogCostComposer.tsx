"use client";
import {useMemo,useState} from "react";
import {calculateCatalogPrice,explainCatalogPrice,type CostLine} from "@/lib/catalog-cost-engine";
export function CatalogCostComposer({onApply,initialLines,initialTax=0,initialMargin=0,initialFee=0,onCompositionChange}:{onApply:(cost:number,price:number)=>void;initialLines?:CostLine[];initialTax?:number;initialMargin?:number;initialFee?:number;onCompositionChange?:(lines:CostLine[],tax:number,margin:number,fee:number)=>void}){
 const [lines,setLines]=useState<CostLine[]>(initialLines?.length?initialLines:[{id:"material",label:"Materiais",quantity:1,unitCost:0,category:"material"},{id:"labor",label:"Mão de obra",quantity:1,unitCost:0,category:"labor"},{id:"travel",label:"Deslocamento",quantity:1,unitCost:0,category:"travel"},{id:"overhead",label:"Despesas indiretas",quantity:1,unitCost:0,category:"overhead"}]);
 const [tax,setTax]=useState(initialTax),[margin,setMargin]=useState(initialMargin),[fee,setFee]=useState(initialFee);
 const changeLines=(next:CostLine[])=>{setLines(next);onCompositionChange?.(next,tax,margin,fee);};
 const changeScenario=(t:number,m:number,f:number)=>{setTax(t);setMargin(m);setFee(f);onCompositionChange?.(lines,t,m,f);};
 const result=useMemo(()=>{try{return calculateCatalogPrice(lines,{taxPercent:tax,marginPercent:margin,cardFeePercent:fee});}catch{return null;}},[lines,tax,margin,fee]);
 const format=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 return <details className="wide catalog-pricing-tool" style={{border:"1px solid #cbd5e1",borderRadius:12,padding:12,display:"grid",gap:10}}>
  <summary>Composição de custos • Assistente de preços</summary>
  <small>Preencha os custos reais. Impostos e margem devem ser revisados para este cadastro. A análise usa regras de cálculo.</small>
  {lines.map((line,index)=><div key={line.id} className="catalog-simulator-cost-row">
   <label>{line.label}<input type="text" value={line.label} onChange={e=>changeLines(lines.map((v,i)=>i===index?{...v,label:e.target.value}:v))}/></label>
   <label>Qtd.<input type="number" min="0" step=".01" value={line.quantity} onChange={e=>changeLines(lines.map((v,i)=>i===index?{...v,quantity:Number(e.target.value)}:v))}/></label>
   <label>R$/un.<input type="number" min="0" step=".01" value={line.unitCost} onChange={e=>changeLines(lines.map((v,i)=>i===index?{...v,unitCost:Number(e.target.value)}:v))}/></label>
  </div>)}
  <button type="button" className="outline-btn" onClick={()=>changeLines([...lines,{id:`extra-${crypto.randomUUID()}`,label:"Insumo adicional",quantity:1,unitCost:0,category:"other"}])}>+ Adicionar insumo</button>
  <div className="catalog-simulator-fields">
   <label>Impostos %<input type="number" min="0" max="99" value={tax} onChange={e=>changeScenario(Number(e.target.value),margin,fee)}/></label>
   <label>Margem %<input type="number" min="0" max="99" value={margin} onChange={e=>changeScenario(tax,Number(e.target.value),fee)}/></label>
   <label>Taxa cartão %<input type="number" min="0" max="99" value={fee} onChange={e=>changeScenario(tax,margin,Number(e.target.value))}/></label>
  </div>
  {result?<><strong>Custo: {format(result.cost)} • Preço sugerido: {result.suggestedPrice===null?"Inviável":format(result.suggestedPrice)}</strong><p aria-live="polite">{explainCatalogPrice(result)}</p><button type="button" className="outline-btn" disabled={result.suggestedPrice===null||result.cost<=0} onClick={()=>{if(result.suggestedPrice!==null)onApply(result.cost,result.suggestedPrice);}}>Aplicar custo e preço sugeridos no cadastro</button></>:<p role="alert">Revise os custos e percentuais informados.</p>}
 </details>;
}
