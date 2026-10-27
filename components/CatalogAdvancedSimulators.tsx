"use client";
import {useMemo,useState} from "react";
import {breakEvenUnits,hourlyWorkforceCost,measuredMaterialLines,simulateBatch} from "@/lib/catalog-advanced-simulators";
import type {CostLine} from "@/lib/catalog-cost-engine";
const money=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function CatalogAdvancedSimulators({baseCost=0}:{baseCost?:number}){
 const [units,setUnits]=useState(1),[meters,setMeters]=useState(0),[costMeter,setCostMeter]=useState(0),[waste,setWaste]=useState(0);
 const [salary,setSalary]=useState(0),[burden,setBurden]=useState(0),[benefits,setBenefits]=useState(0),[hours,setHours]=useState(176),[people,setPeople]=useState(1),[serviceHours,setServiceHours]=useState(0);
 const [fixed,setFixed]=useState(0),[negotiated,setNegotiated]=useState(0),[tax,setTax]=useState(0),[margin,setMargin]=useState(0);
 const result=useMemo(()=>{try{
  const hourly=hourlyWorkforceCost({monthlySalary:salary,monthlyBurden:burden,benefits,productiveHours:hours,people});
  const lines:CostLine[]=[{id:"base",label:"Custo cadastrado",quantity:1,unitCost:baseCost,category:"other"},...measuredMaterialLines([{id:"meter",label:"Material por metro",meters,unitCost:costMeter,wastePercent:waste}]),{id:"work",label:"Equipe por hora",quantity:serviceHours,unitCost:hourly,category:"labor"}];
  const batch=simulateBatch({units,costLines:lines,pricing:{taxPercent:tax,marginPercent:margin},negotiatedRevenue:negotiated>0?negotiated:undefined});
  return {hourly,batch,breakEven:breakEvenUnits(fixed,batch.suggestedRevenue===null?0:batch.suggestedRevenue/units,batch.unitCost,tax)};
 }catch{return null;}},[units,meters,costMeter,waste,salary,burden,benefits,hours,people,serviceHours,fixed,negotiated,tax,margin,baseCost]);
 const field=(label:string,value:number,set:(n:number)=>void)=><label>{label}<input type="number" min="0" step=".01" value={value} onChange={e=>set(Number(e.target.value))}/></label>;
 return <details className="wide catalog-pricing-tool" style={{display:"grid",gap:10,border:"1px solid #cbd5e1",borderRadius:12,padding:12}}>
 <summary>Simuladores avançados • Custo e viabilidade</summary>
 <small>O custo cadastrado entra como base e os materiais/equipe abaixo são adicionais: revise para evitar contar o mesmo gasto duas vezes. Custos fixos/mês são usados no ponto de equilíbrio.</small>
 <div className="catalog-simulator-fields">
 {field("Quantidade",units,setUnits)}{field("Metros",meters,setMeters)}{field("R$/metro",costMeter,setCostMeter)}{field("Perda %",waste,setWaste)}
 {field("Salário mensal por profissional",salary,setSalary)}{field("Encargos mensais",burden,setBurden)}{field("Benefícios mensais",benefits,setBenefits)}
 {field("Horas produtivas/mês",hours,setHours)}{field("Nº profissionais",people,setPeople)}{field("Horas por unidade",serviceHours,setServiceHours)}
 {field("Custos fixos/mês",fixed,setFixed)}{field("Valor negociado total",negotiated,setNegotiated)}{field("Impostos %",tax,setTax)}{field("Margem alvo %",margin,setMargin)}
 </div>
 {result?<div aria-live="polite"><p>Custo/hora da equipe: <b>{money(result.hourly)}</b></p><p>Custo total do lote: <b>{money(result.batch.totalCost)}</b></p><p>Receita sugerida: <b>{result.batch.suggestedRevenue===null?"Inviável":money(result.batch.suggestedRevenue)}</b></p><p>Lucro estimado: <b>{result.batch.profit===null?"—":money(result.batch.profit)}</b></p><p>Margem estimada: <b>{result.batch.marginPercent===null?"—":result.batch.marginPercent+"%"}</b></p><p>Ponto de equilíbrio: <b>{result.breakEven===null?"Não atingível":result.breakEven+" unidades"}</b></p></div>:<p role="alert">Revise as quantidades, custos e percentuais.</p>}
 </details>;
}
