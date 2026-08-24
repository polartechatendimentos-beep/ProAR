"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, FileText, HandCoins, Plus } from "lucide-react";
import { validateEmpenhoAllocations, type EmpenhoAllocation } from "@/lib/public-contracts";
import type { PublicContractRecord } from "@/components/PublicContractsPanel";

type ContractOrder = {
  id: string;
  client: string;
  unit: string;
  date: string;
  status: string;
  certameId?: string;
  contractItems?: { certameItemId: string; description: string; quantity: number; unitValue: number; executionMovementId?: string }[];
};

export type PublicCommitmentRecord = {
  id: string;
  name: string;
  client: string;
  description: string;
  createdAt: string;
  status?: string;
  date?: string;
  value?: number;
  category?: string;
  certameId?: string;
  empenhoNumber?: string;
  empenhoFicha?: string;
  empenhoProcess?: string;
  empenhoPurchaseOrder?: string;
  empenhoAuthorization?: string;
  empenhoAllocations?: EmpenhoAllocation[];
};

const money = (value: number) => value.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

export function PublicCommitmentsPanel({ orders, contracts, commitments, onSave, onReadyToInvoice }: {
  orders: ContractOrder[];
  contracts: PublicContractRecord[];
  commitments: PublicCommitmentRecord[];
  onSave: (record: PublicCommitmentRecord) => Promise<boolean>;
  onReadyToInvoice: (record: PublicCommitmentRecord) => Promise<boolean>;
}) {
  const [creating, setCreating] = useState(false);
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [value, setValue] = useState("");
  const [ficha, setFicha] = useState("");
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [selected, setSelected] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);
  const [advancingId, setAdvancingId] = useState("");
  const [message, setMessage] = useState("");

  const allocationsByOrder = useMemo(() => commitments.flatMap(record => record.empenhoAllocations ?? []).reduce<Record<string,number>>((map, allocation) => {
    map[allocation.serviceOrderId] = (map[allocation.serviceOrderId] ?? 0) + allocation.amount;
    return map;
  }, {}), [commitments]);

  const eligible = useMemo(() => orders.map(order => {
    const executedValue = (order.contractItems ?? []).filter(item => item.executionMovementId).reduce((sum,item) => sum + item.quantity * item.unitValue, 0);
    const allocated = allocationsByOrder[order.id] ?? 0;
    return { order, executedValue, allocated, available:Math.max(0,executedValue-allocated) };
  }).filter(entry => entry.order.certameId && /conclu[ií]da/i.test(entry.order.status) && entry.available > 0), [orders, allocationsByOrder]);

  const selectedTotal = Object.values(selected).reduce((sum, raw) => sum + (Number(raw) || 0), 0);
  const reset = () => { setNumber("");setDate(new Date().toISOString().slice(0,10));setValue("");setFicha("");setPurchaseOrder("");setAuthorization("");setSelected({}); };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const empenhoValue = Number(value);
    const selectedEntries = eligible.filter(entry => Number(selected[entry.order.id]) > 0);
    if (!number.trim() || !Number.isFinite(empenhoValue) || empenhoValue <= 0) { setMessage("Informe o número e o valor do Empenho.");return; }
    if (!selectedEntries.length) { setMessage("Selecione ao menos uma OS executada e informe o valor do vínculo.");return; }
    if (selectedEntries.some(entry => Number(selected[entry.order.id]) > entry.available)) { setMessage("Um dos valores ultrapassa o saldo executado ainda não empenhado da OS.");return; }
    const certameIds = Array.from(new Set(selectedEntries.map(entry => entry.order.certameId)));
    if (certameIds.length !== 1) { setMessage("Um Empenho deve ser registrado dentro de um único Certame.");return; }
    const id = `EMP-${Date.now().toString().slice(-8)}`;
    const allocations: EmpenhoAllocation[] = selectedEntries.map((entry,index) => ({ id:`${id}-VINC-${index+1}`, empenhoId:id, serviceOrderId:entry.order.id, amount:Number(selected[entry.order.id]) }));
    try { validateEmpenhoAllocations(empenhoValue, allocations); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Confira os valores vinculados.");return; }
    const contract = contracts.find(item => item.id === certameIds[0]);
    setSaving(true);setMessage("Salvando...");
    const saved = await onSave({ id, name:`Empenho ${number.trim()}`, client:contract?.client || selectedEntries[0].order.client, description:`Vinculado a ${allocations.length} Ordem(ns) de Serviço`, createdAt:new Date().toLocaleString("pt-BR"), status:"Empenho recebido", date, value:empenhoValue, category:"Empenho público", certameId:certameIds[0], empenhoNumber:number.trim(), empenhoFicha:ficha.trim(), empenhoProcess:contract?.administrativeProcess, empenhoPurchaseOrder:purchaseOrder.trim(), empenhoAuthorization:authorization.trim(), empenhoAllocations:allocations });
    setSaving(false);
    if (!saved) { setMessage("Não foi possível salvar o Empenho. Os dados digitados foram mantidos.");return; }
    reset();setCreating(false);setMessage("✓ Alteração efetuada");
  };

  return <section className="public-commitments">
    <header><div><span className="section-kicker"><HandCoins size={13}/> EXECUÇÃO E EMPENHOS</span><h2>Serviços executados — aguardando Empenho</h2><p>O Empenho classifica financeiramente a execução e não movimenta novamente o Saldo do Certame.</p></div><button className="primary-btn" onClick={()=>setCreating(value=>!value)}><Plus size={15}/> Registrar Empenho recebido</button></header>
    {message && <div className="public-contract-message"><CheckCircle2 size={15}/>{message}</div>}
    <div className="commitment-kpis"><article><small>OS AGUARDANDO EMPENHO</small><strong>{eligible.length}</strong></article><article><small>VALOR AGUARDANDO</small><strong>{money(eligible.reduce((sum,item)=>sum+item.available,0))}</strong></article><article><small>EMPENHOS RECEBIDOS</small><strong>{commitments.length}</strong></article><article><small>VALOR EMPENHADO</small><strong>{money(commitments.reduce((sum,item)=>sum+(item.value??0),0))}</strong></article></div>
    {creating && <form className="commitment-form panel" onSubmit={save}><div className="commitment-fields"><label>Número do Empenho<input value={number} onChange={event=>setNumber(event.target.value)} required/></label><label>Data<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><label>Valor do Empenho<input type="number" min="0.01" step="0.01" value={value} onChange={event=>setValue(event.target.value)} required/></label><label>Ficha<input value={ficha} onChange={event=>setFicha(event.target.value)}/></label><label>Pedido de Compra<input value={purchaseOrder} onChange={event=>setPurchaseOrder(event.target.value)}/></label><label>Autorização de Fornecimento<input value={authorization} onChange={event=>setAuthorization(event.target.value)}/></label></div><section className="commitment-orders"><header><b>OS executadas disponíveis</b><strong>Total selecionado: {money(selectedTotal)}</strong></header>{eligible.map(entry=><label key={entry.order.id}><input type="checkbox" checked={selected[entry.order.id] !== undefined} onChange={event=>setSelected(current=>{const next={...current};if(event.target.checked)next[entry.order.id]=String(entry.available);else delete next[entry.order.id];return next;})}/><span><b>{entry.order.id} • {entry.order.client}</b><small>{entry.order.unit} • {entry.order.date} • disponível {money(entry.available)}</small></span><input type="number" min="0.01" max={entry.available} step="0.01" disabled={selected[entry.order.id]===undefined} value={selected[entry.order.id]??""} onChange={event=>setSelected(current=>({...current,[entry.order.id]:event.target.value}))}/></label>)}</section><footer><button type="button" className="outline-btn" disabled={saving} onClick={()=>{reset();setCreating(false)}}>Cancelar</button><button className="primary-btn" disabled={saving} type="submit">{saving?"Salvando...":"Salvar alterações"}</button></footer></form>}
    <div className="commitment-list">{commitments.map(record=><article className="panel" key={record.id}><FileText size={18}/><span><b>{record.name}</b><small>{record.client} • {record.date || record.createdAt} • {(record.empenhoAllocations??[]).length} OS vinculada(s)</small></span><strong>{money(record.value??0)}</strong><em>{record.status}</em>{record.status==="Empenho recebido"&&<button className="outline-btn" disabled={Boolean(advancingId)} onClick={async()=>{setAdvancingId(record.id);setMessage("Salvando...");const saved=await onReadyToInvoice(record);setAdvancingId("");setMessage(saved?"✓ Alteração efetuada":"Não foi possível enviar para faturamento.")}}>{advancingId===record.id?"Salvando...":"Pronto para faturar"}</button>}</article>)}{!commitments.length&&<div className="linked-empty panel"><HandCoins size={23}/><h4>Nenhum Empenho registrado</h4><p>Empenhos antigos não serão vinculados automaticamente.</p></div>}</div>
  </section>;
}
