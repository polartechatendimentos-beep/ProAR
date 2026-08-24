"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, FileText, Landmark, Plus, Trash2 } from "lucide-react";
import {
  calculateCertameItemBalance,
  type CertameItem,
  type CertameMovement,
  type CertameStatus,
} from "@/lib/public-contracts";

type CustomerOption = { id: string; name: string; legalName?: string; tradeName?: string };

export type PublicContractItemRecord = CertameItem & {
  movements?: CertameMovement[];
};

export type PublicContractRecord = {
  id: string;
  name: string;
  client: string;
  description: string;
  createdAt: string;
  status?: string;
  date?: string;
  endDate?: string;
  value?: number;
  category?: string;
  certameCustomerId?: string;
  administrativeProcess?: string;
  modality?: string;
  biddingNumber?: string;
  auctionNumber?: string;
  minutesNumber?: string;
  contractNumber?: string;
  contractObject?: string;
  certameItems?: PublicContractItemRecord[];
};

type DraftItem = {
  code: string;
  description: string;
  unit: string;
  contractedQuantity: string;
  unitValue: string;
};

const emptyItem = (): DraftItem => ({
  code: "",
  description: "",
  unit: "UN",
  contractedQuantity: "",
  unitValue: "",
});

const money = (value: number) => value.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function downloadContractReport(record: PublicContractRecord, report: "extrato" | "saldo" | "movimentacoes") {
  const rows: (string | number)[][] = report === "movimentacoes"
    ? [["Certame", "Item", "Tipo", "Reservado", "Executado", "Cancelado", "OS", "Data", "Origem"], ...(record.certameItems ?? []).flatMap(item => (item.movements ?? []).map(movement => [record.name, item.description, movement.type, movement.reservedDelta, movement.executedDelta, movement.cancelledDelta, movement.serviceOrderId ?? "", movement.createdAt, movement.origin]))]
    : [["Certame", "Código", "Item", "Unidade", "Contratado", "Reservado", "Executado", "Saldo disponível", "Valor unitário", "Valor disponível"], ...(record.certameItems ?? []).map(item => { const balance=calculateCertameItemBalance(item,item.movements??[]);return [record.name,item.code??"",item.description,item.unit,balance.contractedQuantity,balance.reservedQuantity,balance.executedQuantity,balance.availableQuantity,item.unitValue,balance.availableValue]; })];
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type:"text/csv;charset=utf-8" }));
  link.download = `${report}-${record.id}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function PublicContractsPanel({
  records,
  customers,
  onSave,
}: {
  records: PublicContractRecord[];
  customers: CustomerOption[];
  onSave: (record: PublicContractRecord) => Promise<boolean>;
}) {
  const [creating, setCreating] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [process, setProcess] = useState("");
  const [modality, setModality] = useState("");
  const [biddingNumber, setBiddingNumber] = useState("");
  const [auctionNumber, setAuctionNumber] = useState("");
  const [minutesNumber, setMinutesNumber] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [object, setObject] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [status, setStatus] = useState<CertameStatus>("Em vigência");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => records.reduce((result, record) => {
    for (const item of record.certameItems ?? []) {
      const balance = calculateCertameItemBalance(item, item.movements ?? []);
      result.contracted += balance.contractedValue;
      result.executed += balance.executedValue;
      result.available += balance.availableValue;
    }
    return result;
  }, { contracted: 0, executed: 0, available: 0 }), [records]);

  const updateItem = (index: number, changes: Partial<DraftItem>) => {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  };

  const reset = () => {
    setCustomerId("");
    setProcess("");
    setModality("");
    setBiddingNumber("");
    setAuctionNumber("");
    setMinutesNumber("");
    setContractNumber("");
    setObject("");
    setStartsAt("");
    setEndsAt("");
    setStatus("Em vigência");
    setItems([emptyItem()]);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const customer = customers.find(item => item.id === customerId);
    if (!customer) {
      setMessage("Selecione o cliente público deste Certame.");
      return;
    }
    if (!object.trim()) {
      setMessage("Informe o objeto do Certame.");
      return;
    }
    const validItems = items.filter(item => item.description.trim());
    if (!validItems.length) {
      setMessage("Adicione pelo menos um item contratual.");
      return;
    }
    if (validItems.some(item => Number(item.contractedQuantity) <= 0 || Number(item.unitValue) < 0)) {
      setMessage("Confira a quantidade contratada e o valor unitário dos itens.");
      return;
    }

    const id = `CER-${Date.now().toString().slice(-8)}`;
    const certameItems: PublicContractItemRecord[] = validItems.map((item, index) => ({
      id: `${id}-ITEM-${String(index + 1).padStart(3, "0")}`,
      certameId: id,
      code: item.code.trim(),
      description: item.description.trim(),
      unit: item.unit.trim() || "UN",
      contractedQuantity: Number(item.contractedQuantity),
      unitValue: Number(item.unitValue),
      movements: [],
    }));
    const total = certameItems.reduce((sum, item) => sum + item.contractedQuantity * item.unitValue, 0);
    const identifier = auctionNumber || biddingNumber || contractNumber || process || id;
    setSaving(true);
    setMessage("Salvando...");
    const saved = await onSave({
      id,
      name: `${modality || "Certame"} ${identifier}`,
      client: customer.name,
      description: object.trim(),
      createdAt: new Date().toLocaleString("pt-BR"),
      status,
      date: startsAt,
      endDate: endsAt,
      value: total,
      category: "Certame público",
      certameCustomerId: customer.id,
      administrativeProcess: process.trim(),
      modality: modality.trim(),
      biddingNumber: biddingNumber.trim(),
      auctionNumber: auctionNumber.trim(),
      minutesNumber: minutesNumber.trim(),
      contractNumber: contractNumber.trim(),
      contractObject: object.trim(),
      certameItems,
    });
    setSaving(false);
    if (!saved) {
      setMessage("Não foi possível salvar o Certame. Os dados digitados foram mantidos.");
      return;
    }
    reset();
    setCreating(false);
    setMessage("✓ Alteração efetuada");
  };

  return <section className="public-contracts">
    <header className="public-contracts-head">
      <div>
        <span className="section-kicker"><Landmark size={13}/> GESTÃO CONTRATUAL PÚBLICA</span>
        <h2>Certames e Saldo do Certame</h2>
        <p>Preços, quantidades e movimentações contratuais separados do estoque físico da PolarTech.</p>
      </div>
      <button className="primary-btn" onClick={() => setCreating(value => !value)}><Plus size={16}/> Novo Certame</button>
    </header>

    <div className="public-contract-kpis">
      <article><small>CERTAMES CADASTRADOS</small><strong>{records.length}</strong></article>
      <article><small>VALOR CONTRATADO</small><strong>{money(totals.contracted)}</strong></article>
      <article><small>VALOR EXECUTADO</small><strong>{money(totals.executed)}</strong></article>
      <article><small>SALDO CONTRATUAL</small><strong>{money(totals.available)}</strong></article>
    </div>

    {message && <div className="public-contract-message"><CheckCircle2 size={15}/>{message}</div>}

    {creating && <form className="public-contract-form panel" onSubmit={save}>
      <div className="public-contract-fields">
        <label>Cliente público<select value={customerId} onChange={event => setCustomerId(event.target.value)} required><option value="">Selecionar cliente</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <label>Processo administrativo<input value={process} onChange={event => setProcess(event.target.value)} /></label>
        <label>Modalidade<input value={modality} onChange={event => setModality(event.target.value)} placeholder="Pregão eletrônico, concorrência..." /></label>
        <label>Número da licitação<input value={biddingNumber} onChange={event => setBiddingNumber(event.target.value)} /></label>
        <label>Número do pregão<input value={auctionNumber} onChange={event => setAuctionNumber(event.target.value)} /></label>
        <label>Número da ata<input value={minutesNumber} onChange={event => setMinutesNumber(event.target.value)} /></label>
        <label>Número do contrato<input value={contractNumber} onChange={event => setContractNumber(event.target.value)} /></label>
        <label>Situação<select value={status} onChange={event => setStatus(event.target.value as CertameStatus)}>{["Em vigência", "Próximo do vencimento", "Encerrado", "Suspenso", "Cancelado"].map(option => <option key={option}>{option}</option>)}</select></label>
        <label>Data inicial<input type="date" value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label>
        <label>Data final<input type="date" value={endsAt} onChange={event => setEndsAt(event.target.value)} /></label>
        <label className="wide">Objeto<textarea value={object} onChange={event => setObject(event.target.value)} required /></label>
      </div>
      <section className="public-contract-items">
        <header><div><FileText size={16}/><b>Itens do Certame</b></div><button type="button" onClick={() => setItems(current => [...current, emptyItem()])}><Plus size={14}/> Adicionar item</button></header>
        {items.map((item, index) => <div className="public-contract-item" key={index}>
          <label>Código<input value={item.code} onChange={event => updateItem(index, { code: event.target.value })}/></label>
          <label className="description">Descrição<input value={item.description} onChange={event => updateItem(index, { description: event.target.value })}/></label>
          <label>Unidade<input value={item.unit} onChange={event => updateItem(index, { unit: event.target.value })}/></label>
          <label>Qtd. contratada<input type="number" min="0.001" step="0.001" value={item.contractedQuantity} onChange={event => updateItem(index, { contractedQuantity: event.target.value })}/></label>
          <label>Valor unitário<input type="number" min="0" step="0.01" value={item.unitValue} onChange={event => updateItem(index, { unitValue: event.target.value })}/></label>
          <button type="button" aria-label="Remover item" disabled={items.length === 1} onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15}/></button>
        </div>)}
      </section>
      <footer><button type="button" className="outline-btn" disabled={saving} onClick={() => { reset(); setCreating(false); }}>Cancelar</button><button className="primary-btn" type="submit" disabled={saving}><CheckCircle2 size={16}/> {saving ? "Salvando..." : "Salvar alterações"}</button></footer>
    </form>}

    <div className="public-contract-list">
      {records.map(record => <article className="panel" key={record.id}>
        <header><div><small>{record.modality || "CERTAME"}</small><h3>{record.name}</h3><p>{record.client}</p></div><span>{record.status || "Em vigência"}</span></header>
        <p>{record.contractObject || record.description}</p>
        <div><span>Processo <b>{record.administrativeProcess || "Não informado"}</b></span><span>Contrato <b>{record.contractNumber || "Não informado"}</b></span><span>Itens <b>{record.certameItems?.length ?? 0}</b></span><span>Valor <b>{money(record.value ?? 0)}</b></span></div>
        <section>{(record.certameItems ?? []).map(item => { const balance = calculateCertameItemBalance(item, item.movements ?? []); return <div key={item.id}><span><b>{item.code || "Sem código"}</b>{item.description}</span><span>Contratado <b>{balance.contractedQuantity}</b></span><span>Reservado <b>{balance.reservedQuantity}</b></span><span>Executado <b>{balance.executedQuantity}</b></span><span>Saldo disponível <b>{balance.availableQuantity}</b></span></div>; })}</section>
        <footer className="public-contract-report-actions"><button type="button" onClick={()=>downloadContractReport(record,"extrato")}>Extrato do Certame</button><button type="button" onClick={()=>downloadContractReport(record,"saldo")}>Saldo por item</button><button type="button" onClick={()=>downloadContractReport(record,"movimentacoes")}>Movimentações</button></footer>
      </article>)}
      {!records.length && <div className="linked-empty panel"><Landmark size={24}/><h4>Nenhum Certame cadastrado</h4><p>O monitor de oportunidades continua disponível abaixo. Cadastros contratuais só serão criados após confirmação do utilizador.</p></div>}
    </div>
  </section>;
}
