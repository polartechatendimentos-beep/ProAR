"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Download, FileText, HandCoins, Plus } from "lucide-react";
import { validateEmpenhoAllocations, type EmpenhoAllocation } from "@/lib/public-contracts";
import type { PublicContractRecord } from "@/components/PublicContractsPanel";

type ContractItem = {
  certameItemId: string;
  description: string;
  quantity: number;
  unitValue: number;
  executionMovementId?: string;
};

type ContractOrder = {
  id: string;
  client: string;
  unit: string;
  date: string;
  status: string;
  certameId?: string;
  contractItems?: ContractItem[];
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
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"','""')}"`;

function downloadCsv(name: string, rows: unknown[][]) {
  const content = rows.map(row => row.map(csvCell).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type:"text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

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

  const eligible = useMemo(() => {
    const allocations = commitments.flatMap(record => record.empenhoAllocations ?? []);
    return orders.flatMap(order => {
      if (!order.certameId || !/conclu[ií]da/i.test(order.status)) return [];
      const executedItems = (order.contractItems ?? []).filter(item => item.executionMovementId);
      const groupedItems = Array.from(executedItems.reduce((map, item) => {
        const current = map.get(item.certameItemId);
        if (current) {
          current.quantity += item.quantity;
          current.executedValue += item.quantity * item.unitValue;
        } else {
          map.set(item.certameItemId, { ...item, executedValue:item.quantity * item.unitValue });
        }
        return map;
      }, new Map<string,ContractItem & { executedValue:number }>()).values());
      let legacyAllocated = allocations.filter(allocation => allocation.serviceOrderId === order.id && !allocation.certameItemId).reduce((sum, allocation) => sum + allocation.amount, 0);
      return groupedItems.map(item => {
        const allocated = allocations.filter(allocation => allocation.serviceOrderId === order.id && allocation.certameItemId === item.certameItemId).reduce((sum, allocation) => sum + allocation.amount, 0);
        const legacyShare = Math.min(Math.max(0, item.executedValue - allocated), legacyAllocated);
        legacyAllocated = Math.max(0, legacyAllocated - legacyShare);
        const available = Math.max(0, item.executedValue - allocated - legacyShare);
        return { key:`${order.id}::${item.certameItemId}`, order, item, executedValue:item.executedValue, allocated:allocated + legacyShare, available };
      }).filter(entry => entry.available > 0);
    });
  }, [orders, commitments]);

  const selectedTotal = Object.values(selected).reduce((sum, raw) => sum + (Number(raw) || 0), 0);
  const reset = () => { setNumber("");setDate(new Date().toISOString().slice(0,10));setValue("");setFicha("");setPurchaseOrder("");setAuthorization("");setSelected({}); };

  const exportAwaiting = () => downloadCsv("servicos-aguardando-empenho", [
    ["OS", "Cliente", "Unidade", "Certame", "Item", "Quantidade executada", "Valor executado", "Valor já empenhado", "Saldo aguardando", "Data"],
    ...eligible.map(entry => [entry.order.id, entry.order.client, entry.order.unit, contracts.find(contract => contract.id === entry.order.certameId)?.name ?? entry.order.certameId, entry.item.description, entry.item.quantity, entry.executedValue, entry.allocated, entry.available, entry.order.date]),
  ]);

  const exportCommitments = (statuses?: string[]) => {
    const selectedCommitments = statuses?.length ? commitments.filter(record => statuses.includes(record.status ?? "")) : commitments;
    downloadCsv(statuses?.length ? `empenhos-${statuses.join("-").toLowerCase().replaceAll(" ","-")}` : "empenhos-recebidos", [
      ["Empenho", "Situação", "Cliente", "Unidade", "Certame", "OS", "Item do Certame", "Quantidade", "Valor vinculado", "Valor do Empenho", "Data", "Processo", "Pedido de compra", "Autorização"],
      ...selectedCommitments.flatMap(record => {
        const allocations = record.empenhoAllocations ?? [];
        if (!allocations.length) return [[record.empenhoNumber ?? record.name, record.status, record.client, "", contracts.find(contract => contract.id === record.certameId)?.name ?? record.certameId, "", "Vínculo legado sem item", "", 0, record.value, record.date, record.empenhoProcess, record.empenhoPurchaseOrder, record.empenhoAuthorization]];
        return allocations.map(allocation => {
          const order = orders.find(item => item.id === allocation.serviceOrderId);
          const contract = contracts.find(item => item.id === record.certameId);
          const item = contract?.certameItems?.find(contractItem => contractItem.id === allocation.certameItemId);
          return [record.empenhoNumber ?? record.name, record.status, record.client, order?.unit, contract?.name ?? record.certameId, allocation.serviceOrderId, item?.description ?? (allocation.certameItemId ? `Item ${allocation.certameItemId}` : "Vínculo legado sem item"), allocation.quantity ?? "", allocation.amount, record.value, record.date, record.empenhoProcess, record.empenhoPurchaseOrder, record.empenhoAuthorization];
        });
      }),
    ]);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const empenhoValue = Number(value);
    const selectedEntries = eligible.filter(entry => Number(selected[entry.key]) > 0);
    if (!number.trim() || !Number.isFinite(empenhoValue) || empenhoValue <= 0) { setMessage("Informe o número e o valor do Empenho.");return; }
    if (!selectedEntries.length) { setMessage("Selecione ao menos uma OS executada e informe o valor do vínculo.");return; }
    if (selectedEntries.some(entry => Number(selected[entry.key]) > entry.available)) { setMessage("Um dos valores ultrapassa o saldo executado ainda não empenhado do item.");return; }
    const certameIds = Array.from(new Set(selectedEntries.map(entry => entry.order.certameId)));
    if (certameIds.length !== 1) { setMessage("Um Empenho deve ser registrado dentro de um único Certame.");return; }
    const id = `EMP-${Date.now().toString().slice(-8)}`;
    const allocations: EmpenhoAllocation[] = selectedEntries.map((entry,index) => {
      const amount = Number(selected[entry.key]);
      return { id:`${id}-VINC-${index+1}`, empenhoId:id, serviceOrderId:entry.order.id, certameItemId:entry.item.certameItemId, quantity:entry.item.unitValue > 0 ? amount / entry.item.unitValue : undefined, unitValue:entry.item.unitValue, amount };
    });
    try { validateEmpenhoAllocations(empenhoValue, allocations); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Confira os valores vinculados.");return; }
    const contract = contracts.find(item => item.id === certameIds[0]);
    setSaving(true);setMessage("Salvando...");
    let saved = false;
    try {
      saved = await onSave({ id, name:`Empenho ${number.trim()}`, client:contract?.client || selectedEntries[0].order.client, description:`Vinculado a ${new Set(allocations.map(allocation => allocation.serviceOrderId)).size} OS e ${allocations.length} item(ns) do Certame`, createdAt:new Date().toLocaleString("pt-BR"), status:"Empenho recebido", date, value:empenhoValue, category:"Empenho público", certameId:certameIds[0], empenhoNumber:number.trim(), empenhoFicha:ficha.trim(), empenhoProcess:contract?.administrativeProcess, empenhoPurchaseOrder:purchaseOrder.trim(), empenhoAuthorization:authorization.trim(), empenhoAllocations:allocations });
    } catch {
      saved = false;
    }
    setSaving(false);
    if (!saved) { setMessage("Não foi possível salvar o Empenho. Os dados digitados foram mantidos.");return; }
    reset();setCreating(false);setMessage("✓ Alteração efetuada");
  };

  return <section className="public-commitments">
    <header><div><span className="section-kicker"><HandCoins size={13}/> EXECUÇÃO E EMPENHOS</span><h2>Serviços executados — aguardando Empenho</h2><p>O Empenho classifica financeiramente a execução e não movimenta novamente o Saldo do Certame.</p></div><button className="primary-btn" onClick={()=>setCreating(value=>!value)}><Plus size={15}/> Registrar Empenho recebido</button></header>
    {message && <div className="public-contract-message"><CheckCircle2 size={15}/>{message}</div>}
    <div className="commitment-kpis"><article><small>OS AGUARDANDO EMPENHO</small><strong>{new Set(eligible.map(entry=>entry.order.id)).size}</strong></article><article><small>VALOR AGUARDANDO</small><strong>{money(eligible.reduce((sum,item)=>sum+item.available,0))}</strong></article><article><small>EMPENHOS RECEBIDOS</small><strong>{commitments.length}</strong></article><article><small>VALOR EMPENHADO</small><strong>{money(commitments.reduce((sum,item)=>sum+(item.value??0),0))}</strong></article></div>
    <div className="public-contract-report-actions"><button type="button" onClick={exportAwaiting}><Download size={13}/> Serviços aguardando Empenho</button><button type="button" onClick={()=>exportCommitments()}><Download size={13}/> Empenhos recebidos</button><button type="button" onClick={()=>exportCommitments(["Pronto para faturar"])}><Download size={13}/> Pronto para faturar</button><button type="button" onClick={()=>exportCommitments(["Faturado","Recebido"])}><Download size={13}/> Faturados e recebidos</button></div>
    {creating && <form className="commitment-form panel" onSubmit={save}><div className="commitment-fields"><label>Número do Empenho<input value={number} onChange={event=>setNumber(event.target.value)} required/></label><label>Data<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><label>Valor do Empenho<input type="number" min="0.01" step="0.01" value={value} onChange={event=>setValue(event.target.value)} required/></label><label>Ficha<input value={ficha} onChange={event=>setFicha(event.target.value)}/></label><label>Pedido de Compra<input value={purchaseOrder} onChange={event=>setPurchaseOrder(event.target.value)}/></label><label>Autorização de Fornecimento<input value={authorization} onChange={event=>setAuthorization(event.target.value)}/></label></div><section className="commitment-orders"><header><b>Itens executados disponíveis</b><strong>Total selecionado: {money(selectedTotal)}</strong></header>{eligible.map(entry=><label key={entry.key}><input type="checkbox" checked={selected[entry.key] !== undefined} onChange={event=>setSelected(current=>{const next={...current};if(event.target.checked)next[entry.key]=String(entry.available);else delete next[entry.key];return next;})}/><span><b>{entry.order.id} • {entry.item.description}</b><small>{entry.order.client} • {entry.order.unit} • disponível {money(entry.available)}</small></span><input type="number" min="0.01" max={entry.available} step="0.01" disabled={selected[entry.key]===undefined} value={selected[entry.key]??""} onChange={event=>setSelected(current=>({...current,[entry.key]:event.target.value}))}/></label>)}</section><footer><button type="button" className="outline-btn" disabled={saving} onClick={()=>{reset();setCreating(false)}}>Cancelar</button><button className="primary-btn" disabled={saving} type="submit">{saving?"Salvando...":"Salvar alterações"}</button></footer></form>}
    <div className="commitment-list">{commitments.map(record=><article className="panel" key={record.id}><FileText size={18}/><span><b>{record.name}</b><small>{record.client} • {record.date || record.createdAt} • {new Set((record.empenhoAllocations??[]).map(allocation=>allocation.serviceOrderId)).size} OS / {(record.empenhoAllocations??[]).filter(allocation=>allocation.certameItemId).length} item(ns)</small></span><strong>{money(record.value??0)}</strong><em>{record.status}</em>{record.status==="Empenho recebido"&&<button className="outline-btn" disabled={Boolean(advancingId)} onClick={async()=>{setAdvancingId(record.id);setMessage("Salvando...");let saved=false;try{saved=await onReadyToInvoice(record)}catch{saved=false}setAdvancingId("");setMessage(saved?"✓ Alteração efetuada":"Não foi possível enviar para faturamento.")}}>{advancingId===record.id?"Salvando...":"Pronto para faturar"}</button>}</article>)}{!commitments.length&&<div className="linked-empty panel"><HandCoins size={23}/><h4>Nenhum Empenho registrado</h4><p>Empenhos antigos não serão vinculados automaticamente.</p></div>}</div>
  </section>;
}
