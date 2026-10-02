"use client";

import { Plus, Trash2, Truck, MapPin, WalletCards, Building2, UsersRound, FileKey2 } from "lucide-react";
import type { FiscalAddress, FiscalConstruction, FiscalPayment, FiscalRetention, FiscalTransport } from "@/lib/fiscal-domain";

export type FiscalAdvancedData = {
  referencedDocuments: Array<{ type: "NFE" | "NFCE" | "CTE" | "ECF" | "OTHER"; accessKey?: string; number?: string; series?: string; issueDate?: string }>;
  payments: FiscalPayment[];
  change: number;
  transport: FiscalTransport;
  pickupAddress?: FiscalAddress;
  deliveryAddress?: FiscalAddress;
  retentions: FiscalRetention;
  construction: FiscalConstruction;
  intermediary?: { document?: string; name?: string; municipalRegistration?: string; email?: string };
  acquirer?: { document?: string; name?: string; municipalRegistration?: string; email?: string };
  recipient?: { document?: string; name?: string; municipalRegistration?: string; email?: string };
};

export const emptyFiscalAdvancedData = (): FiscalAdvancedData => ({
  referencedDocuments: [],
  payments: [],
  change: 0,
  transport: {},
  retentions: {},
  construction: {},
});

type Props = {
  documentType: "NF-e" | "NFC-e" | "NFS-e";
  purpose: string;
  freightMode: string;
  nfsePeopleIndicator: string;
  total: number;
  value: FiscalAdvancedData;
  onChange: (value: FiscalAdvancedData) => void;
};

const numberValue = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function TextField({ label, value, onChange, placeholder = "", type = "text" }: { label: string; value?: string | number; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <label className="text-xs font-semibold text-slate-600">{label}<input type={type} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm" value={value ?? ""} onChange={event=>onChange(event.target.value)} placeholder={placeholder}/></label>;
}

export function FiscalAdvancedFields({ documentType, purpose, freightMode, nfsePeopleIndicator, total, value, onChange }: Props) {
  const patch = (next: Partial<FiscalAdvancedData>) => onChange({ ...value, ...next });
  const refsRequired = documentType === "NF-e" && ["2","3","4","5","6"].includes(purpose);

  const addReference = () => patch({ referencedDocuments: [...value.referencedDocuments, { type: "NFE", accessKey: "" }] });
  const updateReference = (index: number, next: Partial<FiscalAdvancedData["referencedDocuments"][number]>) =>
    patch({ referencedDocuments: value.referencedDocuments.map((item,i)=>i===index ? { ...item, ...next } : item) });

  const addPayment = () => patch({ payments: [...value.payments, { id: crypto.randomUUID(), method: "17", amount: value.payments.length ? 0 : total }] });
  const updatePayment = (index: number, next: Partial<FiscalPayment>) =>
    patch({ payments: value.payments.map((item,i)=>i===index ? { ...item, ...next } : item) });

  const transport = (next: Partial<FiscalTransport>) => patch({ transport: { ...value.transport, ...next } });
  const retention = (next: Partial<FiscalRetention>) => patch({ retentions: { ...value.retentions, ...next } });
  const construction = (next: Partial<FiscalConstruction>) => patch({ construction: { ...value.construction, ...next } });

  const updateAddress = (key: "pickupAddress" | "deliveryAddress", next: Partial<FiscalAddress>) =>
    patch({ [key]: { ...(value[key] || {}), ...next } } as Partial<FiscalAdvancedData>);

  return <div className="md:col-span-2 space-y-4">
    {refsRequired && <section className="rounded-xl border bg-slate-50 p-4">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><FileKey2 size={16}/><b className="text-sm">Documentos referenciados</b></div><button type="button" onClick={addReference} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-bold"><Plus size={13}/> Adicionar</button></div>
      <p className="mt-1 text-xs text-slate-500">Permite várias NF-e/NFC-e/CT-e de origem para devolução, complemento, ajuste, crédito ou débito.</p>
      <div className="mt-3 space-y-2">{value.referencedDocuments.map((ref,index)=><div key={index} className="grid gap-2 md:grid-cols-[120px_1fr_auto]">
        <select className="rounded-lg border bg-white p-2 text-sm" value={ref.type} onChange={event=>updateReference(index,{type:event.target.value as any})}><option>NFE</option><option>NFCE</option><option>CTE</option><option>ECF</option><option>OTHER</option></select>
        <input className="rounded-lg border bg-white p-2 text-sm" value={ref.accessKey || ""} onChange={event=>updateReference(index,{accessKey:event.target.value.replace(/\D/g,"").slice(0,44)})} placeholder="Chave de acesso"/>
        <button type="button" onClick={()=>patch({referencedDocuments:value.referencedDocuments.filter((_,i)=>i!==index)})} className="rounded-lg border bg-white p-2 text-red-600"><Trash2 size={14}/></button>
      </div>)}</div>
    </section>}

    {documentType !== "NFS-e" && <section className="rounded-xl border bg-slate-50 p-4">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><WalletCards size={16}/><b className="text-sm">Pagamentos e cobrança</b></div><button type="button" onClick={addPayment} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-bold"><Plus size={13}/> Meio de pagamento</button></div>
      <div className="mt-3 space-y-2">{value.payments.map((payment,index)=><div key={payment.id || index} className="grid gap-2 md:grid-cols-[170px_140px_1fr_auto]">
        <select className="rounded-lg border bg-white p-2 text-sm" value={payment.method} onChange={event=>updatePayment(index,{method:event.target.value})}><option value="01">Dinheiro</option><option value="03">Cartão crédito</option><option value="04">Cartão débito</option><option value="15">Boleto</option><option value="17">PIX</option><option value="18">Transferência</option><option value="90">Sem pagamento</option><option value="99">Outros</option></select>
        <input type="number" step="0.01" className="rounded-lg border bg-white p-2 text-sm" value={payment.amount} onChange={event=>updatePayment(index,{amount:numberValue(event.target.value)})} placeholder="Valor"/>
        <input className="rounded-lg border bg-white p-2 text-sm" value={payment.authorizationCode || ""} onChange={event=>updatePayment(index,{authorizationCode:event.target.value})} placeholder="Autorização/NSU"/>
        <button type="button" onClick={()=>patch({payments:value.payments.filter((_,i)=>i!==index)})} className="rounded-lg border bg-white p-2 text-red-600"><Trash2 size={14}/></button>
      </div>)}</div>
      <div className="mt-3 max-w-[180px]"><TextField label="Troco" type="number" value={value.change} onChange={v=>patch({change:numberValue(v)})}/></div>
    </section>}

    {documentType === "NF-e" && <section className="rounded-xl border bg-slate-50 p-4">
      <div className="flex items-center gap-2"><Truck size={16}/><b className="text-sm">Transporte</b></div>
      {freightMode !== "9" && <div className="mt-3 grid gap-3 md:grid-cols-3">
        <TextField label="CNPJ/CPF transportadora" value={value.transport.carrierDocument} onChange={v=>transport({carrierDocument:v})}/>
        <TextField label="Transportadora" value={value.transport.carrierName} onChange={v=>transport({carrierName:v})}/>
        <TextField label="IE transportadora" value={value.transport.carrierStateRegistration} onChange={v=>transport({carrierStateRegistration:v})}/>
        <TextField label="RNTRC" value={value.transport.rntrc} onChange={v=>transport({rntrc:v})}/>
        <TextField label="Placa" value={value.transport.vehiclePlate} onChange={v=>transport({vehiclePlate:v.toUpperCase()})}/>
        <TextField label="UF veículo" value={value.transport.vehicleState} onChange={v=>transport({vehicleState:v.toUpperCase().slice(0,2)})}/>
        <TextField label="Volumes" type="number" value={value.transport.volumeQuantity} onChange={v=>transport({volumeQuantity:numberValue(v)})}/>
        <TextField label="Peso líquido" type="number" value={value.transport.netWeight} onChange={v=>transport({netWeight:numberValue(v)})}/>
        <TextField label="Peso bruto" type="number" value={value.transport.grossWeight} onChange={v=>transport({grossWeight:numberValue(v)})}/>
      </div>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(["pickupAddress","deliveryAddress"] as const).map(key=><div key={key} className="rounded-lg border bg-white p-3"><div className="mb-2 flex items-center gap-2 text-xs font-bold"><MapPin size={13}/>{key==="pickupAddress"?"Local de retirada diferente":"Local de entrega diferente"}</div><div className="grid gap-2 md:grid-cols-2">
          <TextField label="CEP" value={value[key]?.zipCode} onChange={v=>updateAddress(key,{zipCode:v})}/>
          <TextField label="Logradouro" value={value[key]?.street} onChange={v=>updateAddress(key,{street:v})}/>
          <TextField label="Número" value={value[key]?.number} onChange={v=>updateAddress(key,{number:v})}/>
          <TextField label="Bairro" value={value[key]?.neighborhood} onChange={v=>updateAddress(key,{neighborhood:v})}/>
          <TextField label="Cidade" value={value[key]?.city} onChange={v=>updateAddress(key,{city:v})}/>
          <TextField label="UF" value={value[key]?.state} onChange={v=>updateAddress(key,{state:v.toUpperCase().slice(0,2)})}/>
        </div></div>)}
      </div>
    </section>}

    {documentType === "NFS-e" && <section className="rounded-xl border bg-slate-50 p-4">
      <div className="flex items-center gap-2"><Building2 size={16}/><b className="text-sm">Retenções e construção civil</b></div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        {(["iss","inss","ir","csll","pis","cofins"] as const).map(key=><TextField key={key} label={key.toUpperCase()} type="number" value={value.retentions[key]} onChange={v=>retention({[key]:numberValue(v)})}/>)}
        <label className="text-xs font-semibold text-slate-600">Responsável ISS<select className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm" value={value.retentions.issResponsible || ""} onChange={event=>retention({issResponsible:(event.target.value || undefined) as any})}><option value="">Não definido</option><option value="prestador">Prestador</option><option value="tomador">Tomador</option><option value="intermediario">Intermediário</option></select></label>
        <TextField label="CNO" value={value.construction.cno} onChange={v=>construction({cno:v.replace(/\D/g,"").slice(0,12)})}/>
        <TextField label="Código da obra" value={value.construction.workCode} onChange={v=>construction({workCode:v})}/>
        <TextField label="ART/RRT" value={value.construction.artRrt} onChange={v=>construction({artRrt:v})}/>
      </div>
    </section>}

    {documentType === "NFS-e" && nfsePeopleIndicator !== "0" && <section className="rounded-xl border bg-slate-50 p-4">
      <div className="flex items-center gap-2"><UsersRound size={16}/><b className="text-sm">Pessoas distintas na NFS-e</b></div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <TextField label="CPF/CNPJ adquirente" value={value.acquirer?.document} onChange={v=>patch({acquirer:{...(value.acquirer||{}),document:v}})}/>
        <TextField label="Nome adquirente" value={value.acquirer?.name} onChange={v=>patch({acquirer:{...(value.acquirer||{}),name:v}})}/>
        <TextField label="CPF/CNPJ destinatário" value={value.recipient?.document} onChange={v=>patch({recipient:{...(value.recipient||{}),document:v}})}/>
        <TextField label="Nome destinatário" value={value.recipient?.name} onChange={v=>patch({recipient:{...(value.recipient||{}),name:v}})}/>
        <TextField label="CPF/CNPJ intermediário" value={value.intermediary?.document} onChange={v=>patch({intermediary:{...(value.intermediary||{}),document:v}})}/>
        <TextField label="Nome intermediário" value={value.intermediary?.name} onChange={v=>patch({intermediary:{...(value.intermediary||{}),name:v}})}/>
      </div>
    </section>}
  </div>;
}
