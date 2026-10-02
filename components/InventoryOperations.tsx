"use client";
import { useMemo, useState } from "react";
import type { ErpRecord, OperationalCommand } from "@/lib/operational-ledger";
type Props = { mode: "Compras" | "Estoque"; modules: Record<string, ErpRecord[]>; onOperation: (command: OperationalCommand) => Promise<void> };
export function InventoryOperations({ mode, modules, onOperation }: Props) {
  const [selected, setSelected] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [productIds, setProductIds] = useState<Record<string, string>>({});
  const [type, setType] = useState("Entrada");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [reservationQty,setReservationQty]=useState(0);
  const [reservationSourceType,setReservationSourceType]=useState("OS");
  const [reservationSourceId,setReservationSourceId]=useState("");
  const products = modules.Produtos || [];
  const reservations = modules["Reservas de estoque"] || [];
  const activeReservations = useMemo(()=>reservations.filter(item=>item.status==="Ativa"),[reservations]);
  const purchase = (modules.Compras || []).find(item => item.id === selected);
  const pending = (item: ErpRecord) => Number(item.quantity) - (purchase?.receiptHistory || []).reduce((sum: number, receipt: ErpRecord) => sum + (receipt.items || []).filter((line: ErpRecord) => line.itemId === item.id).reduce((total: number, line: ErpRecord) => total + Number(line.quantity),0),0);
  const submit = async () => {
    if (saving) return;
    setSaving(true);setNotice("");
    try {
      const command: OperationalCommand = mode === "Compras" ? { idempotencyKey: crypto.randomUUID(), action: "receive", recordId:selected, expectedRecord:purchase, data:{items:(purchase?.purchaseItems || []).filter((item:ErpRecord) => Number(quantities[item.id]) > 0).map((item:ErpRecord) => ({itemId:item.id,productId:item.productId || productIds[item.id],quantity:quantities[item.id]}))} } : { idempotencyKey:crypto.randomUUID(),action:"stock",data:{productId:selected,movementType:type,quantity:quantities.stock || 0,reason} };
      await onOperation(command);setNotice("Operação confirmada e registrada no livro de estoque.");setQuantities({});
    } catch(error) { setNotice(error instanceof Error ? error.message : "Falha ao registrar operação."); }
    finally { setSaving(false); }
  };
  const reserve = async () => {
    if (saving || !selected || reservationQty <= 0) return;
    setSaving(true); setNotice("");
    try {
      await onOperation({ idempotencyKey:crypto.randomUUID(), action:"reserve-stock", data:{ productId:selected, quantity:reservationQty, sourceType:reservationSourceType, sourceId:reservationSourceId, reason:reason || "Reserva operacional" } });
      setReservationQty(0); setReservationSourceId(""); setNotice("Material reservado. O saldo disponível foi atualizado.");
    } catch(error) { setNotice(error instanceof Error ? error.message : "Falha ao reservar material."); }
    finally { setSaving(false); }
  };
  const release = async (reservation:ErpRecord) => {
    if (saving) return;
    setSaving(true); setNotice("");
    try {
      await onOperation({ idempotencyKey:crypto.randomUUID(), action:"release-stock", recordId:reservation.id, expectedRecord:reservation, data:{ reason:"Reserva liberada manualmente" } });
      setNotice("Reserva liberada e saldo disponível recomposto.");
    } catch(error) { setNotice(error instanceof Error ? error.message : "Falha ao liberar reserva."); }
    finally { setSaving(false); }
  };
  return <section className="panel erp-card"><h3>{mode === "Compras" ? "Recebimento por item — parcial ou total" : "Estoque físico, reservado e disponível"}</h3><div className="settlement-form"><label>{mode === "Compras" ? "Compra" : "Produto"}<select value={selected} onChange={event => {setSelected(event.target.value);setQuantities({});setProductIds({});}}><option value="">Selecionar</option>{(mode === "Compras" ? (modules.Compras || []).filter(item => !/Cancelada|Recebida$/i.test(item.status || "")) : products).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{mode === "Compras" ? (purchase?.purchaseItems || []).filter((item:ErpRecord) => !["Serviço","Custo adicional"].includes(item.kind)).map((item:ErpRecord) => <div key={item.id} className="erp-receipt-line"><b>{item.description}</b><small>Pendente: {pending(item)}</small><label>Produto<select disabled={Boolean(item.productId)} value={item.productId || productIds[item.id] || ""} onChange={event => setProductIds(current => ({...current,[item.id]:event.target.value}))}><option value="">Vincular produto</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Quantidade recebida<input type="number" min="0" max={pending(item)} step="0.001" value={quantities[item.id] || 0} onChange={event => setQuantities(current => ({...current,[item.id]:Number(event.target.value)}))}/></label></div>) : <><label>Tipo<select value={type} onChange={event => setType(event.target.value)}><option>Entrada</option><option>Saída</option><option>Ajuste</option></select></label><label>Quantidade<input type="number" min="0.001" step="0.001" value={quantities.stock || 0} onChange={event => setQuantities({stock:Number(event.target.value)})}/></label><label>Motivo<textarea value={reason} onChange={event => setReason(event.target.value)}/></label><small>Para reduzir o estoque, registre uma saída com motivo. Ajustes nesta tela acrescentam a quantidade informada.</small></>}</div><button className="primary-btn" disabled={saving || !selected} onClick={() => void submit()}>{saving ? "Confirmando..." : "Confirmar no banco"}</button>{notice && <p role="status">{notice}</p>}{mode === "Estoque" && <>
    <div className="erp-card" style={{marginTop:16}}>
      <h3>Reserva de material</h3>
      <div className="settlement-form">
        <label>Quantidade a reservar<input type="number" min="0.001" step="0.001" value={reservationQty} onChange={event=>setReservationQty(Number(event.target.value)||0)}/></label>
        <label>Destino<select value={reservationSourceType} onChange={event=>setReservationSourceType(event.target.value)}><option>OS</option><option>Obra</option><option>Manual</option></select></label>
        <label>OS / Obra / referência<input value={reservationSourceId} onChange={event=>setReservationSourceId(event.target.value)} placeholder="Ex.: OS-1048 ou OBRA-12"/></label>
      </div>
      <button className="primary-btn" disabled={saving || !selected || reservationQty<=0} onClick={()=>void reserve()}>Reservar material</button>
    </div>
    <div className="w-full overflow-x-auto min-w-0 table-wrap"><table><thead><tr><th>PRODUTO</th><th>FÍSICO</th><th>RESERVADO</th><th>DISPONÍVEL</th><th>MÍNIMO</th></tr></thead><tbody>{products.map(product=><tr key={`balance-${product.id}`}><td><b>{product.name}</b></td><td>{Number(product.stockCurrent||0)}</td><td>{Number(product.stockReserved||0)}</td><td><b>{Number(product.stockAvailable ?? product.stockCurrent || 0)}</b></td><td>{Number(product.stockMin||0)}</td></tr>)}</tbody></table></div>
    {!!activeReservations.length && <div className="w-full overflow-x-auto min-w-0 table-wrap"><table><thead><tr><th>RESERVA</th><th>PRODUTO</th><th>QTD.</th><th>DESTINO</th><th>CRIADA</th><th>AÇÃO</th></tr></thead><tbody>{activeReservations.map(item=><tr key={item.id}><td>{item.id}</td><td>{products.find(product=>product.id===item.productId)?.name||item.productId}</td><td>{item.quantity}</td><td>{item.sourceType} {item.sourceId||""}</td><td>{item.createdAt?.slice(0,10)}</td><td><button className="outline-btn" disabled={saving} onClick={()=>void release(item)}>Liberar</button></td></tr>)}</tbody></table></div>}
    <div className="w-full overflow-x-auto min-w-0 table-wrap"><table><thead><tr><th>DATA</th><th>PRODUTO</th><th>TIPO</th><th>QUANTIDADE</th><th>ORIGEM</th><th>USUÁRIO / MOTIVO</th></tr></thead><tbody>{[...(modules["Livro de estoque"] || [])].reverse().map(item => <tr key={item.id}><td>{item.createdAt?.slice(0,10)}</td><td>{products.find(product => product.id === item.productId)?.name || item.productId}</td><td>{item.kind}</td><td>{item.quantity}</td><td>{item.purchaseId || item.receiptId || "Manual / abertura"}</td><td>{item.user} • {item.reason}</td></tr>)}</tbody></table></div>
  </>}</section>;
}
