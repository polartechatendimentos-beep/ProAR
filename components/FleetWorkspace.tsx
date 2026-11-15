"use client";

import { useMemo, useState } from "react";
import { CarFront, Plus, Save, Wrench } from "lucide-react";
import type { ErpRecord } from "@/lib/operational-ledger";

type Tool = { id: string; name: string; serialNumber?: string; condition: string; status: string; assignedAt: string };
type Vehicle = ErpRecord & { id: string; name: string; plate?: string; model?: string; year?: string; driver?: string; odometer?: number; tools?: Tool[] };
type Props = { records: ErpRecord[]; canEdit: boolean; onUpdate: (module: string, record: ErpRecord) => void };
const key = (value: unknown) => String(value ?? "").trim().toLocaleUpperCase("pt-BR");

export function FleetWorkspace({ records, canEdit, onUpdate }: Props) {
  const vehicles = useMemo(() => records as Vehicle[], [records]);
  const [selectedId, setSelectedId] = useState(vehicles[0]?.id ?? "");
  const selected = vehicles.find(row => row.id === selectedId) ?? null;
  const [name,setName]=useState(""); const [plate,setPlate]=useState(""); const [model,setModel]=useState("");
  const [year,setYear]=useState(""); const [driver,setDriver]=useState(""); const [odometer,setOdometer]=useState("");
  const [toolName,setToolName]=useState(""); const [toolSerial,setToolSerial]=useState(""); const [notice,setNotice]=useState("");
  const choose=(row:Vehicle)=>{setSelectedId(row.id);setName(row.name);setPlate(row.plate||"");setModel(row.model||"");setYear(row.year||"");setDriver(row.driver||"");setOdometer(String(row.odometer||""));setNotice("");};
  const reset=()=>{setSelectedId("");setName("");setPlate("");setModel("");setYear("");setDriver("");setOdometer("");setNotice("");};
  const save=()=>{
    if(!name.trim()||!plate.trim()){setNotice("Preencha a identificação e a placa.");return;}
    if(vehicles.some(row=>key(row.plate)===key(plate)&&row.id!==selectedId)){setNotice("Esta placa já está cadastrada.");return;}
    const row:Vehicle=selected?{...selected,name:name.trim(),plate:key(plate),model:model.trim(),year:year.trim(),driver:driver.trim(),odometer:Number(odometer)||0}:{id:`VEI-${crypto.randomUUID().slice(0,8)}`,name:name.trim(),plate:key(plate),model:model.trim(),year:year.trim(),driver:driver.trim(),odometer:Number(odometer)||0,status:"Ativo",tools:[],createdAt:new Date().toISOString()};
    onUpdate("Veículos",row); choose(row);setNotice("Veículo salvo.");
  };
  const addTool=()=>{
    if(!selected||!toolName.trim()){setNotice("Selecione um veículo e informe a ferramenta.");return;}
    const tool:Tool={id:`FER-${crypto.randomUUID().slice(0,8)}`,name:toolName.trim(),serialNumber:toolSerial.trim(),condition:"Bom",status:"No veículo",assignedAt:new Date().toISOString()};
    onUpdate("Veículos",{...selected,tools:[...(selected.tools||[]),tool]});setToolName("");setToolSerial("");setNotice("Ferramenta vinculada ao veículo.");
  };
  const returnTool=(id:string)=>{
    if(!selected)return;
    onUpdate("Veículos",{...selected,tools:(selected.tools||[]).map(item=>item.id===id?{...item,status:"Devolvida",returnedAt:new Date().toISOString()}:item)});
    setNotice("Devolução registrada.");
  };
  return <section className="panel erp-card" style={{display:"grid",gap:16}}>
    <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><span className="section-kicker"><CarFront size={14}/> FROTA E FERRAMENTAS</span><h2>Veículos da empresa</h2><p>Controle responsáveis e ferramentas. Materiais por veículo são movimentados em Estoque.</p></div>{canEdit&&<button type="button" className="primary-btn" onClick={reset}><Plus size={15}/> Novo veículo</button>}</header>
    <div style={{display:"grid",gridTemplateColumns:"minmax(210px,.7fr) minmax(0,1.5fr)",gap:16}}>
      <div style={{display:"grid",alignContent:"start",gap:8}}>{vehicles.map(row=><button key={row.id} type="button" className={selected?.id===row.id?"primary-btn":"outline-btn"} onClick={()=>choose(row)} style={{textAlign:"left"}}><CarFront size={14}/>{row.name} • {row.plate||"—"}<small style={{display:"block"}}>{row.driver||"Responsável pendente"}</small></button>)}{!vehicles.length&&<p>Nenhum veículo cadastrado.</p>}</div>
      <div style={{display:"grid",gap:16}}>
        {(!vehicles.length||selected||!selectedId)&&<section className="panel" style={{padding:16}}><h3>{selected?"Dados do veículo":"Cadastrar veículo"}</h3><div className="form-grid">
          <label>Identificação<input disabled={!canEdit} value={name} onChange={e=>setName(e.target.value)} placeholder="Van equipe 1"/></label><label>Placa<input disabled={!canEdit} value={plate} onChange={e=>setPlate(e.target.value.toUpperCase())} placeholder="ABC1D23"/></label>
          <label>Marca / modelo<input disabled={!canEdit} value={model} onChange={e=>setModel(e.target.value)}/></label><label>Ano<input disabled={!canEdit} value={year} onChange={e=>setYear(e.target.value)}/></label>
          <label>Responsável<input disabled={!canEdit} value={driver} onChange={e=>setDriver(e.target.value)}/></label><label>Odômetro<input disabled={!canEdit} type="number" min="0" value={odometer} onChange={e=>setOdometer(e.target.value)}/></label>
        </div>{canEdit&&<button type="button" className="primary-btn" onClick={save} style={{marginTop:12}}><Save size={14}/> Salvar</button>}</section>}
        {selected&&<section className="panel" style={{padding:16}}><h3><Wrench size={15}/> Ferramentas no veículo</h3><p>Registre patrimônio, estado e devoluções para manter a custódia visível.</p>{canEdit&&<div className="form-grid"><label>Ferramenta<input value={toolName} onChange={e=>setToolName(e.target.value)} placeholder="Bomba de vácuo"/></label><label>Nº série / patrimônio<input value={toolSerial} onChange={e=>setToolSerial(e.target.value)}/></label><div><button type="button" className="outline-btn" onClick={addTool}><Plus size={14}/> Vincular</button></div></div>}
          <div style={{display:"grid",gap:8,marginTop:12}}>{(selected.tools||[]).slice().reverse().map(tool=><article key={tool.id} className="panel" style={{padding:12,display:"flex",justifyContent:"space-between",gap:12}}><span><b>{tool.name}</b><small style={{display:"block"}}>{tool.serialNumber||"Sem patrimônio"} • {tool.condition} • {tool.status}</small></span>{canEdit&&tool.status==="No veículo"&&<button type="button" className="outline-btn" onClick={()=>returnTool(tool.id)}>Registrar devolução</button>}</article>)}{!(selected.tools||[]).length&&<p>Nenhuma ferramenta vinculada.</p>}</div>
        </section>}
      </div>
    </div>{notice&&<p role="status">{notice}</p>}
  </section>;
}
