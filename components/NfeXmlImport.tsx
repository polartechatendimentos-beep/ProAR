"use client";

import { useMemo, useState } from "react";
import type { ErpRecord } from "@/lib/operational-ledger";

type PurchaseLine = { id: string; description: string; quantity: number; pending: number; productId?: string };
type InvoiceLine = { code: string; description: string; quantity: number; unitPrice: number; total: number };
type Props = {
  purchaseItems: PurchaseLine[];
  products: ErpRecord[];
  onApply: (rows: Array<{ itemId: string; productId: string; quantity: number }>) => void;
};

function child(parent: Element | null, name: string): Element | null {
  if (!parent) return null;
  return Array.from(parent.children).find(node => node.localName === name) || null;
}
function value(parent: Element | null, name: string): string {
  return child(parent, name)?.textContent?.trim() || "";
}
function money(raw: string): number {
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
function parseInvoice(xml: string) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("O XML da NF-e está inválido ou incompleto.");
  const info = Array.from(document.getElementsByTagName("*")).find(node => node.localName === "infNFe") as Element | undefined;
  if (!info) throw new Error("Não encontrei os dados de uma NF-e no arquivo.");
  const ide = child(info, "ide");
  const emit = child(info, "emit");
  const total = child(child(info, "total"), "ICMSTot");
  const lines = Array.from(info.children).filter(node => node.localName === "det").map(node => {
    const product = child(node, "prod");
    return {
      code: value(product, "cProd"),
      description: value(product, "xProd"),
      quantity: money(value(product, "qCom")),
      unitPrice: money(value(product, "vUnCom")),
      total: money(value(product, "vProd")),
    };
  }).filter(line => line.description && line.quantity > 0);
  if (!lines.length || lines.length > 1000) throw new Error("A NF-e não contém itens válidos ou excede o limite de leitura.");
  return {
    number: value(ide, "nNF"),
    issuedAt: value(ide, "dhEmi") || value(ide, "dEmi"),
    supplier: value(emit, "xNome"),
    supplierTaxId: value(emit, "CNPJ") || value(emit, "CPF"),
    total: money(value(total, "vNF")),
    lines,
  };
}

export function NfeXmlImport({ purchaseItems, products, onApply }: Props) {
  const [invoice, setInvoice] = useState<ReturnType<typeof parseInvoice> | null>(null);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reading, setReading] = useState(false);
  const availableItems = useMemo(() => purchaseItems.filter(item => item.pending > 0), [purchaseItems]);

  const readFile = async (file?: File) => {
    setError(""); setNotice(""); setInvoice(null); setMapping({});
    if (!file) return;
    if (!/\.xml$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
      setError("Selecione um arquivo .xml de até 5 MB.");
      return;
    }
    setReading(true);
    try {
      const parsed = parseInvoice(await file.text());
      setInvoice(parsed);
      setNotice("XML lido no navegador. O arquivo não foi enviado nem armazenado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível ler o XML.");
    } finally {
      setReading(false);
    }
  };

  const apply = () => {
    if (!invoice) return;
    const mapped = Object.entries(mapping).flatMap(([index, itemId]) => {
      const row = invoice.lines[Number(index)];
      const item = purchaseItems.find(candidate => candidate.id === itemId);
      if (!row || !item) return [];
      return [{ itemId, productId: item.productId || "", quantity: Math.min(row.quantity, item.pending) }];
    }).filter(row => row.quantity > 0);
    if (!mapped.length) {
      setError("Vincule ao menos um item da NF-e a um item pendente do pedido.");
      return;
    }
    if (mapped.some(row => !row.productId)) {
      setError("Vincule os produtos do pedido antes de importar as quantidades. O XML não altera o cadastro nem o custo dos produtos.");
      return;
    }
    onApply(mapped);
    setNotice(`${mapped.length} item(ns) preenchido(s). Revise o recebimento e confirme no botão Registrar Recebimento.`);
    setError("");
  };

  return <section className="erp-card" aria-label="Importar NF-e por XML">
    <header><b>Importar NF-e por XML</b><small>Leia a nota, confira os dados e vincule os itens ao pedido selecionado.</small></header>
    <label>Arquivo XML da NF-e<input type="file" accept=".xml,application/xml,text/xml" disabled={reading} onChange={event => void readFile(event.target.files?.[0])}/></label>
    {reading && <p role="status">Lendo o XML…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {invoice && <>
      <div className="settlement-form">
        <div><b>NF-e {invoice.number || "sem número"}</b><small>{invoice.supplier || "Fornecedor não identificado"} • {invoice.supplierTaxId || "CNPJ/CPF ausente"} • {invoice.issuedAt || "Data não informada"}</small></div>
        <strong>Total informado: {invoice.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
      </div>
      <div className="w-full overflow-x-auto min-w-0 table-wrap"><table>
        <thead><tr><th>CÓDIGO / ITEM DA NF-E</th><th>QTD.</th><th>UNITÁRIO</th><th>VINCULAR AO PEDIDO</th></tr></thead>
        <tbody>{invoice.lines.map((line, index) => {
          const selected = purchaseItems.find(item => item.id === mapping[index]);
          const exceeds = Boolean(selected && line.quantity > selected.pending);
          return <tr key={`${line.code}-${index}`}>
            <td><b>{line.description}</b><small>{line.code} • Total {line.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</small></td>
            <td>{line.quantity}</td>
            <td>{line.unitPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
            <td><select value={mapping[index] || ""} onChange={event => setMapping(current => ({ ...current, [index]: event.target.value }))}>
              <option value="">Ignorar / selecionar item do pedido</option>
              {availableItems.filter(item => item.id === mapping[index] || !Object.values(mapping).includes(item.id)).map(item => <option key={item.id} value={item.id}>{item.description} • pendente {item.pending}</option>)}
            </select>{exceeds && <small role="alert">A quantidade importada será limitada ao saldo pendente do pedido ({selected?.pending}).</small>}</td>
          </tr>;
        })}</tbody>
      </table></div>
      <small>Esta etapa só preenche o recebimento. Ela não altera preços de custo nem cria parcelas financeiras; confira divergências e use o fluxo normal para confirmar a entrada.</small>
      <button type="button" className="primary-btn" onClick={apply} disabled={!availableItems.length}>Preencher recebimento para revisão</button>
    </>}
  </section>;
}
