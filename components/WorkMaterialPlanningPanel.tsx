"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, CheckCircle2, CircleDollarSign, Package, Plus, Save, Trash2 } from "lucide-react";
import "./work-material-planning.css";

export type WorkMaterialEnvironment = { id:string; name:string; copperMeters:number };
export type WorkMaterialPlanning = {
  remainingFridgeHouses:number;
  remainingExhaustPipeHouses:number;
  remainingExhaustFinishHouses:number;
  lossPercent:number;
  copperKgPrice:number;
  copperQuarterKgPerMeter:number;
  copperThreeEighthKgPerMeter:number;
  insulationQuarterPriceMeter:number;
  insulationThreeEighthPriceMeter:number;
  ppPriceMeter:number;
  exhaustUnitPrice:number;
  exhaustFinishUnitPrice:number;
  exhaustPipePriceMeter:number;
  exhaustPipeMetersPerHouse:number;
  environments:WorkMaterialEnvironment[];
};

export const RESERVA_MATERIAL_PLANNING:WorkMaterialPlanning={
  remainingFridgeHouses:42,
  remainingExhaustPipeHouses:42,
  remainingExhaustFinishHouses:42,
  lossPercent:0,
  copperKgPrice:129,
  copperQuarterKgPerMeter:0.150,
  copperThreeEighthKgPerMeter:0.203,
  insulationQuarterPriceMeter:1.70,
  insulationThreeEighthPriceMeter:1.80,
  ppPriceMeter:7.50,
  exhaustUnitPrice:89,
  exhaustFinishUnitPrice:25,
  exhaustPipePriceMeter:7,
  exhaustPipeMetersPerHouse:8,
  environments:[
    {id:"sala",name:"Sala",copperMeters:2.5},
    {id:"quarto-frente",name:"Quarto frente",copperMeters:10},
    {id:"quarto-meio",name:"Quarto meio",copperMeters:2},
    {id:"quarto-fundo",name:"Quarto fundo",copperMeters:2},
    {id:"home",name:"Home",copperMeters:6},
  ],
};

const money=(value:number)=>value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const qty=(value:number,digits=2)=>value.toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:digits});

export function calculateWorkMaterialCost(draft:WorkMaterialPlanning){const baseMeters=draft.environments.reduce((sum,item)=>sum+Math.max(0,Number(item.copperMeters)||0),0);const ppMeters=draft.environments.reduce((sum,item)=>sum+Math.max(0,Number(item.copperMeters)||0)+1,0);const loss=1+Math.max(0,draft.lossPercent||0)/100;const fridge=Math.max(0,draft.remainingFridgeHouses||0);const copperMeters=baseMeters*fridge*loss;const ppTotal=ppMeters*fridge*loss;const qKg=copperMeters*draft.copperQuarterKgPerMeter;const eKg=copperMeters*draft.copperThreeEighthKgPerMeter;const qCopper=qKg*draft.copperKgPrice;const eCopper=eKg*draft.copperKgPrice;const qIns=copperMeters*draft.insulationQuarterPriceMeter;const eIns=copperMeters*draft.insulationThreeEighthPriceMeter;const pp=ppTotal*draft.ppPriceMeter;const exhaustUnits=Math.max(0,draft.remainingExhaustFinishHouses||0);const exhaustPipeHouses=Math.max(0,draft.remainingExhaustPipeHouses||0);const exhaust=draft.exhaustUnitPrice*exhaustUnits;const finish=draft.exhaustFinishUnitPrice*exhaustUnits;const pipeMeters=draft.exhaustPipeMetersPerHouse*exhaustPipeHouses*loss;const pipe=pipeMeters*draft.exhaustPipePriceMeter;return{baseMeters,ppMeters,copperMeters,ppTotal,qKg,eKg,qCopper,eCopper,qIns,eIns,pp,exhaustUnits,exhaustPipeHouses,exhaust,finish,pipeMeters,pipe,total:qCopper+eCopper+qIns+eIns+pp+exhaust+finish+pipe};}\n\nexport function WorkMaterialPlanningPanel({planning,totalHouses,onSave}:{planning?:WorkMaterialPlanning;totalHouses:number;onSave:(next:WorkMaterialPlanning)=>Promise<boolean>|boolean}){
  const [draft,setDraft]=useState<WorkMaterialPlanning>(planning??{...RESERVA_MATERIAL_PLANNING,environments:RESERVA_MATERIAL_PLANNING.environments.map(item=>({...item}))});
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  useEffect(()=>setDraft(planning??{...RESERVA_MATERIAL_PLANNING,environments:RESERVA_MATERIAL_PLANNING.environments.map(item=>({...item}))}),[planning]);
  const calc=useMemo(()=>calculateWorkMaterialCost(draft),[draft]);
  const setNumber=(key:keyof WorkMaterialPlanning,value:string)=>setDraft(current=>({...current,[key]:Math.max(0,Number(value)||0)}));
  const save=async()=>{setSaving(true);setNotice("");try{const ok=await onSave(draft);setNotice(ok?"Planejamento salvo na obra.":"Não foi possível salvar.");}finally{setSaving(false);}};
  return <section className="material-planning">
    <header className="material-planning-head"><div><span><Calculator size={17}/> PLANEJAMENTO DE MATERIAIS</span><h3>Consumo e custo para concluir a obra</h3><p>Composição configurável por obra. Metros, pesos, preços e quantidades podem ser diferentes em cada empreendimento.</p></div><button onClick={()=>void save()} disabled={saving}><Save size={15}/>{saving?"Salvando...":"Salvar planejamento"}</button></header>
    <div className="material-planning-kpis"><article><small>TOTAL DA OBRA</small><strong>{totalHouses}</strong><em>casas cadastradas</em></article><article><small>FRIGORÍGENA PENDENTE</small><strong>{draft.remainingFridgeHouses}</strong><em>casas para cálculo</em></article><article><small>EXAUSTÃO PENDENTE</small><strong>{draft.remainingExhaustPipeHouses}</strong><em>casas com tubulação</em></article><article><small>CUSTO PROJETADO</small><strong>{money(calc.total)}</strong><em>materiais desta composição</em></article></div>
    <div className="material-planning-grid">
      <section><h4>Casas pendentes por etapa</h4><div className="material-fields three"><label>Frigorígena<input type="number" min="0" value={draft.remainingFridgeHouses} onChange={e=>setNumber("remainingFridgeHouses",e.target.value)}/></label><label>Tubulação exaustão<input type="number" min="0" value={draft.remainingExhaustPipeHouses} onChange={e=>setNumber("remainingExhaustPipeHouses",e.target.value)}/></label><label>Exaustor/acabamento<input type="number" min="0" value={draft.remainingExhaustFinishHouses} onChange={e=>setNumber("remainingExhaustFinishHouses",e.target.value)}/></label></div></section>
      <section><h4>Preços e conversões</h4><div className="material-fields"><label>Cobre (R$/kg)<input type="number" step=".01" value={draft.copperKgPrice} onChange={e=>setNumber("copperKgPrice",e.target.value)}/></label><label>1/4 kg/m<input type="number" step=".001" value={draft.copperQuarterKgPerMeter} onChange={e=>setNumber("copperQuarterKgPerMeter",e.target.value)}/></label><label>3/8 kg/m<input type="number" step=".001" value={draft.copperThreeEighthKgPerMeter} onChange={e=>setNumber("copperThreeEighthKgPerMeter",e.target.value)}/></label><label>Isol. 1/4 R$/m<input type="number" step=".01" value={draft.insulationQuarterPriceMeter} onChange={e=>setNumber("insulationQuarterPriceMeter",e.target.value)}/></label><label>Isol. 3/8 R$/m<input type="number" step=".01" value={draft.insulationThreeEighthPriceMeter} onChange={e=>setNumber("insulationThreeEighthPriceMeter",e.target.value)}/></label><label>PP R$/m<input type="number" step=".01" value={draft.ppPriceMeter} onChange={e=>setNumber("ppPriceMeter",e.target.value)}/></label><label>Margem de perda %<input type="number" step=".1" value={draft.lossPercent} onChange={e=>setNumber("lossPercent",e.target.value)}/></label></div></section>
    </div>
    <section className="material-environments"><header><div><h4>Composição frigorígena por casa</h4><small>O cabo PP recebe automaticamente +1 metro em cada ambiente.</small></div><button onClick={()=>setDraft(current=>({...current,environments:[...current.environments,{id:crypto.randomUUID(),name:"Novo ambiente",copperMeters:1}]}))}><Plus size={13}/> Ambiente</button></header><div className="material-table"><table><thead><tr><th>Ambiente</th><th>Cobre 1/4</th><th>Cobre 3/8</th><th>Isol. 1/4</th><th>Isol. 3/8</th><th>Cabo PP</th><th/></tr></thead><tbody>{draft.environments.map((item,index)=><tr key={item.id}><td><input value={item.name} onChange={e=>setDraft(current=>({...current,environments:current.environments.map((row,i)=>i===index?{...row,name:e.target.value}:row)}))}/></td><td colSpan={4}><div className="shared-meter"><input type="number" min="0" step=".1" value={item.copperMeters} onChange={e=>setDraft(current=>({...current,environments:current.environments.map((row,i)=>i===index?{...row,copperMeters:Math.max(0,Number(e.target.value)||0)}:row)}))}/><span>m em cada linha</span></div></td><td><b>{qty(item.copperMeters+1)} m</b></td><td><button className="icon-danger" disabled={draft.environments.length===1} onClick={()=>setDraft(current=>({...current,environments:current.environments.filter((_,i)=>i!==index)}))}><Trash2 size={14}/></button></td></tr>)}</tbody><tfoot><tr><th>Total/casa</th><th>{qty(calc.baseMeters)} m</th><th>{qty(calc.baseMeters)} m</th><th>{qty(calc.baseMeters)} m</th><th>{qty(calc.baseMeters)} m</th><th>{qty(calc.ppMeters)} m</th><th/></tr></tfoot></table></div></section>
    <section className="material-exhaust"><h4>Composição da exaustão</h4><div className="material-fields"><label>Exaustor / tubulação forçada R$/un.<input type="number" step=".01" value={draft.exhaustUnitPrice} onChange={e=>setNumber("exhaustUnitPrice",e.target.value)}/></label><label>Acabamento externo R$/un.<input type="number" step=".01" value={draft.exhaustFinishUnitPrice} onChange={e=>setNumber("exhaustFinishUnitPrice",e.target.value)}/></label><label>Tubulação exaustão R$/m<input type="number" step=".01" value={draft.exhaustPipePriceMeter} onChange={e=>setNumber("exhaustPipePriceMeter",e.target.value)}/></label><label>Metros por casa<input type="number" step=".1" value={draft.exhaustPipeMetersPerHouse} onChange={e=>setNumber("exhaustPipeMetersPerHouse",e.target.value)}/></label></div></section>
    <section className="material-summary"><header><div><CircleDollarSign size={18}/><span><b>Necessidade projetada</b><small>Conversão automática de kg ↔ metros para o cobre.</small></span></div></header><div className="material-summary-list">
      <article><span><Package size={15}/><b>Cobre 1/4</b></span><em>{qty(calc.copperMeters)} m • {qty(calc.qKg)} kg</em><strong>{money(calc.qCopper)}</strong></article>
      <article><span><Package size={15}/><b>Cobre 3/8</b></span><em>{qty(calc.copperMeters)} m • {qty(calc.eKg)} kg</em><strong>{money(calc.eCopper)}</strong></article>
      <article><span><Package size={15}/><b>Isolamento 1/4</b></span><em>{qty(calc.copperMeters)} m</em><strong>{money(calc.qIns)}</strong></article>
      <article><span><Package size={15}/><b>Isolamento 3/8</b></span><em>{qty(calc.copperMeters)} m</em><strong>{money(calc.eIns)}</strong></article>
      <article><span><Package size={15}/><b>Cabo PP</b></span><em>{qty(calc.ppTotal)} m</em><strong>{money(calc.pp)}</strong></article>
      <article><span><Package size={15}/><b>Exaustor / tubulação forçada</b></span><em>{calc.exhaustUnits} un.</em><strong>{money(calc.exhaust)}</strong></article>
      <article><span><Package size={15}/><b>Acabamento externo</b></span><em>{calc.exhaustUnits} un.</em><strong>{money(calc.finish)}</strong></article>
      <article><span><Package size={15}/><b>Tubulação de exaustão</b></span><em>{qty(calc.pipeMeters)} m</em><strong>{money(calc.pipe)}</strong></article>
    </div><footer><span><CheckCircle2 size={16}/> Total previsto dos materiais configurados</span><strong>{money(calc.total)}</strong></footer></section>
    {notice&&<div className="material-notice">{notice}</div>}
  </section>;
}
