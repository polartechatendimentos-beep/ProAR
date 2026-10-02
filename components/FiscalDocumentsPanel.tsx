"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronRight, FileCheck2, FileText, Filter,
  Landmark, Package, Plus, ReceiptText, RefreshCw, Search, Send, Settings,
  ShieldCheck, ShoppingBag, Wrench, X
} from "lucide-react";

type AnyRecord = Record<string, any>;

export type FiscalDocumentRecord = AnyRecord & {
  id: string;
  name: string;
  client: string;
  description: string;
  createdAt: string;
  date?: string;
  value?: number;
  status?: "Pendente" | "Validando" | "Transmitindo" | "Autorizada" | "Rejeitada" | "Cancelada" | "Contingência";
  category?: string;
  fiscalDocumentType?: "NF-e" | "NFC-e" | "NFS-e";
  fiscalSourceType?: "Venda" | "Ordem de Serviço" | "Financeiro" | "Manual";
  fiscalSourceId?: string;
  fiscalCustomerId?: string;
  fiscalItems?: FiscalItem[];
  fiscalPreflight?: FiscalPreflight;
  fiscalNumber?: string;
  fiscalSeries?: string;
  fiscalKey?: string;
  fiscalProtocol?: string;
  fiscalVerificationCode?: string;
  fiscalCancelProtocol?: string;
  fiscalCancelledAt?: string;
  fiscalRejectionCode?: string;
  fiscalRejectionMessage?: string;
  fiscalXmlUrl?: string;
  fiscalDanfeUrl?: string;
  fiscalDanfseLayoutVersion?: string;
  fiscalDanfseGeneratedAt?: string;
  fiscalEnvironment?: string;
  fiscalIssuedAt?: string;
  fiscalOperationNature?: string;
  fiscalPurpose?: string;
  fiscalPresenceIndicator?: string;
  fiscalFreightMode?: string;
  fiscalPaymentMethod?: string;
  fiscalServiceMunicipalityCode?: string;
  fiscalServiceTaxationLocation?: string;
};

type FiscalItem = {
  id: string;
  kind: "Produto" | "Serviço";
  description: string;
  quantity: number;
  unitValue: number;
  ncm?: string;
  cfop?: string;
  cest?: string;
  fiscalOrigin?: string;
  icmsCst?: string;
  csosn?: string;
  pisCst?: string;
  cofinsCst?: string;
  gtin?: string;
  unitOfMeasure?: string;
  fiscalBenefitCode?: string;
  ibsCbsCst?: string;
  ibsCbsClassCode?: string;
  serviceCode?: string;
  nbs?: string;
  issRate?: number;
  issWithheld?: boolean;
};

type FiscalPreflight = {
  checkedAt: string;
  ok: boolean;
  issues: string[];
};

type Props = {
  company: AnyRecord;
  customers: AnyRecord[];
  products: AnyRecord[];
  services: AnyRecord[];
  sales: AnyRecord[];
  serviceOrders: AnyRecord[];
  financeRecords: AnyRecord[];
  documents: FiscalDocumentRecord[];
  canEdit: boolean;
  onSaveDocument: (record: FiscalDocumentRecord) => void | Promise<void>;
  onOpenSettings: () => void;
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const today = () => new Date().toISOString().slice(0, 10);

function StatusPill({ status = "Pendente" }: { status?: string }) {
  const tone = /autoriz/i.test(status) ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : /rejeit|cancel/i.test(status) ? "bg-red-50 text-red-700 border-red-200"
    : /transmit|validando/i.test(status) ? "bg-blue-50 text-blue-700 border-blue-200"
    : /conting/i.test(status) ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-slate-50 text-slate-700 border-slate-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${tone}`}>{status}</span>;
}

export function FiscalDocumentsPanel({
  company, customers, products, services, sales, serviceOrders, financeRecords, documents,
  canEdit, onSaveDocument, onOpenSettings,
}: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [type, setType] = useState("Todos");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<FiscalDocumentRecord | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [configError, setConfigError] = useState("");
  const [configLoading, setConfigLoading] = useState(false);
  const [fiscalActionLoading, setFiscalActionLoading] = useState(false);
  const [fiscalActionMessage, setFiscalActionMessage] = useState("");

  const loadConfig = async () => {
    setConfigLoading(true);
    setConfigError("");
    try {
      const response = await fetch("/api/fiscal-config", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar a configuração fiscal.");
      setConfig(data);
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : "Falha ao consultar configuração fiscal.");
    } finally {
      setConfigLoading(false);
    }
  };
  useEffect(() => { void loadConfig(); }, [company?.id]);

  const filtered = useMemo(() => documents.filter(document => {
    const text = `${document.id} ${document.client} ${document.fiscalDocumentType ?? ""} ${document.fiscalNumber ?? ""} ${document.fiscalKey ?? ""}`.toLowerCase();
    return (!query.trim() || text.includes(query.trim().toLowerCase()))
      && (status === "Todos" || document.status === status)
      && (type === "Todos" || document.fiscalDocumentType === type);
  }).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))), [documents, query, status, type]);

  const counters = {
    pending: documents.filter(item => item.status === "Pendente").length,
    transmitting: documents.filter(item => /Validando|Transmitindo/.test(item.status ?? "")).length,
    authorized: documents.filter(item => item.status === "Autorizada").length,
    rejected: documents.filter(item => item.status === "Rejeitada").length,
  };

  const buildFiscalPayload = (draft: Partial<FiscalDocumentRecord>) => {
    const customer = customers.find(item => item.id === draft.fiscalCustomerId || item.name === draft.client);
    const documentType = draft.fiscalDocumentType ?? "NF-e";
    const firstService = draft.fiscalItems?.find(item => item.kind === "Serviço");
    return {
      kind: documentType === "NF-e" ? "NFE" : documentType === "NFC-e" ? "NFCE" : "NFSE",
      issueDate: draft.date || today(),
      operationNature: draft.fiscalOperationNature || (documentType === "NFS-e" ? "Prestação de serviços" : "Venda de mercadoria"),
      purpose: draft.fiscalPurpose || "1",
      presenceIndicator: draft.fiscalPresenceIndicator || (documentType === "NFC-e" ? "1" : "9"),
      freightMode: draft.fiscalFreightMode || (documentType === "NF-e" ? "9" : undefined),
      paymentMethod: draft.fiscalPaymentMethod || (documentType === "NFC-e" ? "01" : undefined),
      company: {
        document: company?.cnpj,
        name: company?.legalName || company?.tradeName,
        city: company?.city,
        state: company?.state,
        stateRegistration: config?.company?.stateRegistration || company?.stateRegistration,
        municipalRegistration: config?.company?.municipalRegistration || company?.municipalRegistration,
        taxRegime: config?.company?.taxRegime || company?.taxRegime,
      },
      customer: customer ? {
        document: customer.doc,
        name: customer.legalName || customer.name,
        address: customer.address,
        zipCode: customer.zipCode,
        street: customer.street,
        number: customer.addressNumber,
        neighborhood: customer.neighborhood,
        city: customer.city,
        state: customer.state,
        stateRegistration: customer.stateRegistration,
        stateRegistrationIndicator: customer.stateRegistration ? "1" : "9",
        municipalRegistration: customer.municipalRegistration,
      } : undefined,
      items: draft.fiscalItems?.filter(item => item.kind === "Produto").map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitValue: item.unitValue,
        unitOfMeasure: item.unitOfMeasure,
        ncm: item.ncm,
        cfop: item.cfop,
        cest: item.cest,
        gtin: item.gtin,
        fiscalOrigin: item.fiscalOrigin,
        icmsCst: item.icmsCst,
        csosn: item.csosn,
        pisCst: item.pisCst,
        cofinsCst: item.cofinsCst,
        fiscalBenefitCode: item.fiscalBenefitCode,
        ibsCbsCst: item.ibsCbsCst,
        ibsCbsClassCode: item.ibsCbsClassCode,
      })),
      service: firstService ? {
        description: firstService.description,
        value: firstService.quantity * firstService.unitValue,
        serviceCode: firstService.serviceCode,
        nbs: firstService.nbs,
        issRate: firstService.issRate,
        municipalityCode: draft.fiscalServiceMunicipalityCode,
        taxationLocation: draft.fiscalServiceTaxationLocation,
      } : undefined,
      config: {
        environment: config?.company?.environment,
        certificateConfigured: Boolean(config?.certificate),
        certificateValidTo: config?.certificate?.validTo,
        nfeSeries: config?.nfe?.series,
        nfceSeries: config?.nfce?.series,
        cscConfigured: Boolean(config?.nfce?.cscConfigured),
        cscId: config?.nfce?.cscId,
        nfseSeries: config?.nfse?.rpsSeries,
        nfseServiceCode: config?.nfse?.serviceCode,
        nfseIssRate: config?.nfse?.issRate,
      },
    };
  };

  const preflight = async (draft: Partial<FiscalDocumentRecord>): Promise<FiscalPreflight> => {
    try {
      const response = await fetch("/api/fiscal/preflight", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildFiscalPayload(draft)) });
      const data = await response.json();
      if (!response.ok && !data.issues) throw new Error(data.error || "Falha na pré-validação fiscal.");
      return {
        checkedAt: data.checkedAt || new Date().toISOString(),
        ok: Boolean(data.valid),
        issues: Array.isArray(data.issues) ? data.issues.map((issue: any) => issue.message || String(issue)) : [],
      };
    } catch (error) {
      return { checkedAt: new Date().toISOString(), ok: false, issues: [error instanceof Error ? error.message : "Falha na pré-validação fiscal."] };
    }
  };

  const validateRecord = async (record: FiscalDocumentRecord) => {
    const result = await preflight(record);
    const next: FiscalDocumentRecord = { ...record, status: "Pendente", fiscalPreflight: result };
    await onSaveDocument(next);
    setSelected(next);
    setFiscalActionMessage(result.ok ? "Pré-validação concluída sem erros bloqueantes." : "Existem pendências que precisam ser corrigidas antes da transmissão.");
  };

  const transmitRecord = async (record: FiscalDocumentRecord) => {
    setFiscalActionLoading(true);
    setFiscalActionMessage("Transmitindo documento ao autorizador fiscal...");
    try {
      const preflightResult = await preflight(record);
      if (!preflightResult.ok) {
        const blocked = { ...record, status: "Pendente" as const, fiscalPreflight: preflightResult };
        await onSaveDocument(blocked);
        setSelected(blocked);
        setFiscalActionMessage("Transmissão bloqueada: corrija as pendências da pré-validação.");
        return;
      }
      const transmitting = { ...record, status: "Transmitindo" as const, fiscalPreflight: preflightResult };
      await onSaveDocument(transmitting);
      setSelected(transmitting);
      const response = await fetch("/api/fiscal/transmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: record.id, payload: buildFiscalPayload(record) }),
      });
      const data = await response.json();
      if (response.status === 202 || data.status === "processing") {
        const processing = { ...transmitting, status: "Transmitindo" as const };
        await onSaveDocument(processing);
        setSelected(processing);
        setFiscalActionMessage("Documento recebido pelo autorizador e permanece em processamento.");
        return;
      }
      if (!response.ok || data.status !== "authorized") {
        if (data.status === "integration_required") {
          const pending = { ...record, status: "Pendente" as const, fiscalPreflight: preflightResult };
          await onSaveDocument(pending);
          setSelected(pending);
          setFiscalActionMessage(data.error || "Ponte fiscal não configurada.");
          return;
        }
        const rejected = {
          ...record,
          status: "Rejeitada" as const,
          fiscalPreflight: preflightResult,
          fiscalRejectionCode: data.code || data.provider?.code || "REJEITADA",
          fiscalRejectionMessage: data.error || data.provider?.message || "Documento rejeitado pelo autorizador.",
        };
        await onSaveDocument(rejected);
        setSelected(rejected);
        setFiscalActionMessage(rejected.fiscalRejectionMessage);
        return;
      }
      const authorized: FiscalDocumentRecord = {
        ...record,
        status: "Autorizada",
        fiscalPreflight: preflightResult,
        fiscalNumber: data.documentNumber,
        fiscalSeries: data.series,
        fiscalKey: data.accessKey,
        fiscalVerificationCode: data.verificationCode,
        fiscalProtocol: data.protocol,
        fiscalIssuedAt: data.authorizedAt,
        fiscalXmlUrl: data.xmlUrl,
        fiscalDanfeUrl: data.danfeUrl,
        fiscalRejectionCode: undefined,
        fiscalRejectionMessage: undefined,
      };
      await onSaveDocument(authorized);
      setSelected(authorized);
      setFiscalActionMessage("Documento autorizado pelo órgão fiscal.");
    } catch (error) {
      setFiscalActionMessage(error instanceof Error ? error.message : "Falha na transmissão fiscal.");
    } finally {
      setFiscalActionLoading(false);
    }
  };

  const cancelRecord = async (record: FiscalDocumentRecord) => {
    const reason = window.prompt("Informe a justificativa do cancelamento fiscal (mínimo 15 caracteres):", "");
    if (!reason) return;
    setFiscalActionLoading(true);
    setFiscalActionMessage("Solicitando cancelamento ao autorizador fiscal...");
    try {
      const response = await fetch("/api/fiscal/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: record.id,
          documentType: record.fiscalDocumentType,
          accessKey: record.fiscalKey,
          verificationCode: record.fiscalVerificationCode,
          protocol: record.fiscalProtocol,
          reason,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status !== "cancelled") throw new Error(data.error || "Cancelamento não autorizado.");
      const cancelled: FiscalDocumentRecord = {
        ...record,
        status: "Cancelada",
        fiscalCancelledAt: data.cancelledAt,
        fiscalCancelProtocol: data.protocol,
      };
      await onSaveDocument(cancelled);
      setSelected(cancelled);
      setFiscalActionMessage("Documento cancelado com retorno do autorizador fiscal.");
    } catch (error) {
      setFiscalActionMessage(error instanceof Error ? error.message : "Falha ao cancelar o documento.");
    } finally {
      setFiscalActionLoading(false);
    }
  };

  const generateDanfse = async (record: FiscalDocumentRecord) => {
    if (record.fiscalDocumentType !== "NFS-e") return;
    setFiscalActionLoading(true);
    setFiscalActionMessage("Gerando DANFSe no leiaute nacional NT 008/2026 v1.02...");
    try {
      const response = await fetch("/api/fiscal/danfse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: record.id,
          accessKey: record.fiscalKey,
          verificationCode: record.fiscalVerificationCode,
          xmlUrl: record.fiscalXmlUrl,
          environment: record.fiscalEnvironment || config?.company?.environment,
        }),
      });
      const data = await response.json();
      if (response.status === 202 || data.status === "processing") {
        setFiscalActionMessage("DANFSe em processamento no gerador fiscal.");
        return;
      }
      if (!response.ok || data.status !== "generated" || !data.pdfUrl) {
        throw new Error(data.error || "Não foi possível gerar o DANFSe.");
      }
      const updated: FiscalDocumentRecord = {
        ...record,
        fiscalDanfeUrl: data.pdfUrl,
        fiscalDanfseLayoutVersion: data.layoutVersion || "NT 008/2026 v1.02",
        fiscalDanfseGeneratedAt: data.generatedAt || new Date().toISOString(),
      };
      await onSaveDocument(updated);
      setSelected(updated);
      setFiscalActionMessage("DANFSe gerado conforme NT 008/2026 v1.02.");
      window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setFiscalActionMessage(error instanceof Error ? error.message : "Falha ao gerar o DANFSe.");
    } finally {
      setFiscalActionLoading(false);
    }
  };

  return <section className="space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-950 to-slate-800 p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-blue-200"><ReceiptText size={15}/> CENTRAL FISCAL</div>
          <h2 className="mt-2 text-2xl font-bold">Nota Fiscal Eletrônica</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">NF-e, NFC-e e NFS-e em um único fluxo: preparação, pré-validação, transmissão, autorização, XML e documento auxiliar.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void loadConfig()} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/10"><RefreshCw size={14} className={configLoading ? "animate-spin" : ""}/> Atualizar configuração</button>
          <button onClick={() => setCreateOpen(true)} disabled={!canEdit} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold hover:bg-blue-500 disabled:opacity-50"><Plus size={14}/> Nova nota</button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[
          ["Pendentes", counters.pending, "Aguardando validação/emissão"],
          ["Em processamento", counters.transmitting, "Validando ou transmitindo"],
          ["Autorizadas", counters.authorized, "Com autorização registrada"],
          ["Rejeitadas", counters.rejected, "Exigem correção"],
        ].map(([label,count,note]) => <div key={String(label)} className="rounded-xl border border-white/10 bg-white/5 p-3"><small className="text-slate-300">{label}</small><div className="mt-1 text-2xl font-bold">{count}</div><span className="text-[11px] text-slate-400">{note}</span></div>)}
      </div>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <label className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><Search size={15} className="text-slate-400"/><input className="w-full outline-none text-sm" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar por cliente, número, chave ou ID..."/></label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Filter size={14}/><select className="rounded-lg border border-slate-200 px-3 py-2" value={type} onChange={event=>setType(event.target.value)}><option>Todos</option><option>NF-e</option><option>NFC-e</option><option>NFS-e</option></select></label>
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold" value={status} onChange={event=>setStatus(event.target.value)}><option>Todos</option><option>Pendente</option><option>Validando</option><option>Transmitindo</option><option>Autorizada</option><option>Rejeitada</option><option>Cancelada</option><option>Contingência</option></select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Emissão</th><th className="px-4 py-3"/></tr></thead>
            <tbody>
              {filtered.map(document => <tr key={document.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3"><b>{document.fiscalDocumentType ?? "NF-e"}</b><small className="block text-slate-500">{document.fiscalNumber ? `Nº ${document.fiscalNumber}` : document.id}</small></td>
                <td className="px-4 py-3"><b>{document.client || "Sem cliente"}</b><small className="block text-slate-500">{document.fiscalKey ? `Chave: ${document.fiscalKey.slice(0,16)}...` : "Sem chave fiscal"}</small></td>
                <td className="px-4 py-3">{document.fiscalSourceType ?? "Manual"}<small className="block text-slate-500">{document.fiscalSourceId || "—"}</small></td>
                <td className="px-4 py-3 font-bold">{money(Number(document.value || 0))}</td>
                <td className="px-4 py-3"><StatusPill status={document.status}/>{document.fiscalPreflight && !document.fiscalPreflight.ok && <small className="mt-1 block text-red-600">{document.fiscalPreflight.issues.length} pendência(s)</small>}</td>
                <td className="px-4 py-3">{document.fiscalIssuedAt ? new Date(document.fiscalIssuedAt).toLocaleDateString("pt-BR") : document.date || "—"}</td>
                <td className="px-4 py-3"><button onClick={()=>setSelected(document)} className="rounded-lg border border-slate-200 p-2 hover:bg-white"><ChevronRight size={15}/></button></td>
              </tr>)}
              {!filtered.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Nenhuma nota fiscal encontrada para os filtros selecionados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2"><ShieldCheck size={18} className={configError ? "text-red-600" : "text-emerald-600"}/><div><b className="text-sm">Configuração fiscal</b><small className="block text-slate-500">{config?.company?.environment || "Não carregada"}</small></div></div>
          {configError ? <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{configError}</p> : <div className="mt-3 space-y-2 text-xs text-slate-600">
            <div className="flex justify-between"><span>Regime</span><b>{config?.company?.taxRegime || company?.taxRegime || "Pendente"}</b></div>
            <div className="flex justify-between"><span>Certificado A1</span><b>{config?.certificate?.status || "Não configurado"}</b></div>
            <div className="flex justify-between"><span>CSC NFC-e</span><b>{config?.nfce?.cscConfigured ? "Configurado" : "Pendente"}</b></div>
            <div className="flex justify-between"><span>Cód. serviço NFS-e</span><b>{config?.nfse?.serviceCode || "Pendente"}</b></div>
          </div>}
          <button onClick={onOpenSettings} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50"><Settings size={14}/> Abrir configurações fiscais</button>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
          <b>Regra de segurança fiscal</b>
          <p className="mt-1 leading-5">O ProAR só deve marcar uma nota como <b>Autorizada</b> após retorno real do provedor/SEFAZ/prefeitura com número, protocolo e chave/código de verificação.</p>
        </div>
      </aside>
    </div>

    {createOpen && <FiscalCreateDialog
      customers={customers}
      products={products}
      services={services}
      sales={sales}
      serviceOrders={serviceOrders}
      financeRecords={financeRecords}
      config={config}
      preflight={preflight}
      onClose={()=>setCreateOpen(false)}
      onSave={async record => { await onSaveDocument(record); setCreateOpen(false); setSelected(record); }}
    />}

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-slate-950/55" onClick={()=>setSelected(null)} aria-label="Fechar detalhe"/>
      <section className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b p-5"><div><small className="font-bold text-blue-600">{selected.fiscalDocumentType} • {selected.id}</small><h3 className="mt-1 text-xl font-bold">{selected.client}</h3><p className="text-sm text-slate-500">{selected.fiscalSourceType} {selected.fiscalSourceId ? `• ${selected.fiscalSourceId}` : ""}</p></div><button onClick={()=>setSelected(null)}><X size={18}/></button></header>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="rounded-xl border p-4"><small className="text-slate-500">Status</small><div className="mt-2"><StatusPill status={selected.status}/></div><div className="mt-4 text-sm"><p><b>Valor:</b> {money(Number(selected.value||0))}</p><p><b>Número:</b> {selected.fiscalNumber || "—"}</p><p><b>Série:</b> {selected.fiscalSeries || "—"}</p><p><b>Protocolo:</b> {selected.fiscalProtocol || "—"}</p><p><b>Chave/código:</b> {selected.fiscalKey || selected.fiscalVerificationCode || "—"}</p>{selected.fiscalDocumentType === "NFS-e" && selected.fiscalDanfseLayoutVersion && <p><b>DANFSe:</b> {selected.fiscalDanfseLayoutVersion}</p>}{selected.fiscalRejectionMessage && <p className="mt-2 text-red-700"><b>Rejeição:</b> {selected.fiscalRejectionCode ? `${selected.fiscalRejectionCode} • ` : ""}{selected.fiscalRejectionMessage}</p>}</div></div>
          <div className="rounded-xl border p-4"><small className="text-slate-500">Pré-validação</small>{selected.fiscalPreflight ? selected.fiscalPreflight.ok ? <div className="mt-2 flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 size={17}/> Sem pendências conhecidas</div> : <div className="mt-2 space-y-2">{selected.fiscalPreflight.issues.map(issue=><p key={issue} className="flex gap-2 text-xs text-red-700"><AlertTriangle size={14} className="shrink-0"/>{issue}</p>)}</div> : <p className="mt-2 text-sm text-slate-500">Ainda não executada.</p>}</div>
          <div className="md:col-span-2 rounded-xl border p-4"><b className="text-sm">Itens</b><div className="mt-3 divide-y">{selected.fiscalItems?.map(item=><div key={item.id} className="flex items-center justify-between py-2 text-sm"><div><b>{item.description}</b><small className="block text-slate-500">{item.kind}{item.ncm ? ` • NCM ${item.ncm}` : ""}{item.cfop ? ` • CFOP ${item.cfop}` : ""}</small></div><span>{item.quantity} × {money(item.unitValue)}</span></div>)}</div></div>
        </div>
        {fiscalActionMessage && <div className="mx-5 mb-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">{fiscalActionMessage}</div>}
        <footer className="flex flex-wrap justify-end gap-2 border-t p-4">
          <button disabled={fiscalActionLoading} onClick={()=>void validateRecord(selected)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold disabled:opacity-50"><FileCheck2 size={14}/> Validar pré-emissão</button>
          {selected.status === "Autorizada" && selected.fiscalDocumentType === "NFS-e" && <button disabled={fiscalActionLoading || !selected.fiscalXmlUrl || digits(selected.fiscalKey).length !== 50} onClick={()=>void generateDanfse(selected)} title={!selected.fiscalXmlUrl ? "O XML autorizado é obrigatório para gerar o DANFSe." : digits(selected.fiscalKey).length !== 50 ? "A chave de acesso da NFS-e deve possuir 50 dígitos." : "Gerar DANFSe conforme NT 008/2026 v1.02"} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-xs font-bold text-blue-700 disabled:opacity-40"><FileText size={14}/> {selected.fiscalDanfeUrl ? "Regenerar DANFSe" : "Gerar DANFSe"}</button>}
          {selected.status === "Autorizada" && selected.fiscalDocumentType === "NFS-e" && selected.fiscalDanfeUrl && <button disabled={fiscalActionLoading} onClick={()=>window.open(selected.fiscalDanfeUrl,"_blank","noopener,noreferrer")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold"><FileText size={14}/> Abrir DANFSe</button>}
          {selected.status === "Autorizada" && <button disabled={fiscalActionLoading} onClick={()=>void cancelRecord(selected)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-700 disabled:opacity-50"><X size={14}/> Cancelar nota</button>}
          <button onClick={()=>void transmitRecord(selected) disabled={fiscalActionLoading || !selected.fiscalPreflight?.ok || selected.status === "Autorizada" || selected.status === "Cancelada"} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Send size={14}/>{fiscalActionLoading ? " Processando..." : " Transmitir"}</button>
        </footer>
      </section>
    </div>}
  </section>;
}

function FiscalCreateDialog({ customers, products, services, sales, serviceOrders, financeRecords, config, preflight, onClose, onSave }: {
  customers: AnyRecord[]; products: AnyRecord[]; services: AnyRecord[]; sales: AnyRecord[]; serviceOrders: AnyRecord[]; financeRecords: AnyRecord[]; config: any;
  preflight: (draft: Partial<FiscalDocumentRecord>) => Promise<FiscalPreflight>;
  onClose: () => void; onSave: (record: FiscalDocumentRecord) => void | Promise<void>;
}) {
  const [documentType, setDocumentType] = useState<"NF-e"|"NFC-e"|"NFS-e">("NF-e");
  const [sourceType, setSourceType] = useState<"Venda"|"Ordem de Serviço"|"Financeiro"|"Manual">("Manual");
  const [sourceId, setSourceId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<FiscalItem[]>([]);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [operationNature, setOperationNature] = useState("Venda de mercadoria");
  const [purpose, setPurpose] = useState("1");
  const [presenceIndicator, setPresenceIndicator] = useState("1");
  const [freightMode, setFreightMode] = useState("9");
  const [paymentMethod, setPaymentMethod] = useState("01");
  const [serviceMunicipalityCode, setServiceMunicipalityCode] = useState("");
  const [serviceTaxationLocation, setServiceTaxationLocation] = useState("Município da prestação");
  const [preview, setPreview] = useState<FiscalPreflight | null>(null);
  const [validating, setValidating] = useState(false);

  const sourceRecords = sourceType === "Venda" ? sales : sourceType === "Ordem de Serviço" ? serviceOrders : sourceType === "Financeiro" ? financeRecords : [];
  const catalog = documentType === "NFS-e" ? services : products;
  const customer = customers.find(item => item.id === customerId);
  const total = items.reduce((sum,item)=>sum + item.quantity * item.unitValue,0);

  useEffect(() => {
    if (!sourceId) return;
    const source = sourceRecords.find(item => item.id === sourceId);
    if (!source) return;
    const sourceCustomer = customers.find(item => item.id === source.customerId || item.name === source.client || item.name === source.customer);
    if (sourceCustomer) setCustomerId(sourceCustomer.id);
  }, [sourceId, sourceType]);

  const addItem = () => {
    const record = catalog.find(item => item.id === itemId);
    if (!record) return;
    setItems(current => [...current, {
      id: `${record.id}-${Date.now()}`,
      kind: documentType === "NFS-e" ? "Serviço" : "Produto",
      description: record.name,
      quantity: Math.max(0.001, quantity || 1),
      unitValue: Number(record.value || 0),
      ncm: record.ncm || "",
      cfop: record.cfop || "",
      cest: record.cest || "",
      fiscalOrigin: record.fiscalOrigin || "0",
      icmsCst: record.icmsCst || "",
      csosn: record.csosn || "",
      pisCst: record.pisCst || "",
      cofinsCst: record.cofinsCst || "",
      gtin: record.taxGtin || record.barcode || "SEM GTIN",
      unitOfMeasure: record.unitOfMeasure || (documentType === "NFS-e" ? "serviço" : "un"),
      fiscalBenefitCode: record.fiscalBenefitCode || "",
      ibsCbsCst: record.ibsCbsCst || "",
      ibsCbsClassCode: record.ibsCbsClassCode || "",
      serviceCode: record.serviceCode || config?.nfse?.serviceCode || "",
      nbs: record.nbs || "",
      issRate: Number(record.issRate || config?.nfse?.issRate || 0),
      issWithheld: Boolean(record.issWithheld),
    }]);
    setItemId("");
    setQuantity(1);
  };

  const draft = (): FiscalDocumentRecord => ({
    id: `NFE-${Date.now().toString().slice(-8)}`,
    name: `${documentType} • ${customer?.name || "Destinatário"}`,
    client: customer?.name || "",
    description: `${documentType} preparada no ProAR`,
    createdAt: new Date().toISOString(),
    date: today(),
    value: total,
    status: "Pendente",
    category: "Documento fiscal eletrônico",
    fiscalDocumentType: documentType,
    fiscalSourceType: sourceType,
    fiscalSourceId: sourceId || undefined,
    fiscalCustomerId: customerId || undefined,
    fiscalItems: items,
    fiscalEnvironment: config?.company?.environment || "Homologação",
    fiscalOperationNature: operationNature,
    fiscalPurpose: purpose,
    fiscalPresenceIndicator: presenceIndicator,
    fiscalFreightMode: freightMode,
    fiscalPaymentMethod: paymentMethod,
    fiscalServiceMunicipalityCode: serviceMunicipalityCode,
    fiscalServiceTaxationLocation: serviceTaxationLocation,
  });

  const validate = async () => {
    setValidating(true);
    try { setPreview(await preflight(draft())); }
    finally { setValidating(false); }
  };
  const save = async () => {
    const record = draft();
    record.fiscalPreflight = await preflight(record);
    await onSave(record);
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button className="absolute inset-0 bg-slate-950/55" onClick={onClose} aria-label="Fechar"/>
    <section className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b p-5"><div><small className="font-bold text-blue-600">NOVA NOTA FISCAL</small><h3 className="mt-1 text-xl font-bold">Preparar documento eletrônico</h3><p className="text-sm text-slate-500">A pré-validação não substitui a autorização fiscal do órgão competente.</p></div><button onClick={onClose}><X size={18}/></button></header>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">Tipo de documento<select className="mt-1 w-full rounded-xl border p-3 text-sm" value={documentType} onChange={event=>{setDocumentType(event.target.value as any);setItems([]);setPreview(null)}}><option>NF-e</option><option>NFC-e</option><option>NFS-e</option></select></label>
        <label className="text-xs font-semibold text-slate-600">Origem<select className="mt-1 w-full rounded-xl border p-3 text-sm" value={sourceType} onChange={event=>{setSourceType(event.target.value as any);setSourceId("")}}><option>Manual</option><option>Venda</option><option>Ordem de Serviço</option><option>Financeiro</option></select></label>
        {sourceType !== "Manual" && <label className="text-xs font-semibold text-slate-600 md:col-span-2">Registro de origem<select className="mt-1 w-full rounded-xl border p-3 text-sm" value={sourceId} onChange={event=>setSourceId(event.target.value)}><option value="">Selecione...</option>{sourceRecords.map(item=><option key={item.id} value={item.id}>{item.id} • {item.name || item.client || item.description}</option>)}</select></label>}
        <label className="text-xs font-semibold text-slate-600 md:col-span-2">Cliente / destinatário<select className="mt-1 w-full rounded-xl border p-3 text-sm" value={customerId} onChange={event=>setCustomerId(event.target.value)}><option value="">Selecione...</option>{customers.map(item=><option key={item.id} value={item.id}>{item.name} • {item.doc || "sem documento"}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Natureza da operação<input className="mt-1 w-full rounded-xl border p-3 text-sm" value={operationNature} onChange={event=>setOperationNature(event.target.value)} placeholder={documentType === "NFS-e" ? "Prestação de serviços" : "Venda de mercadoria"}/></label>
        {documentType === "NF-e" && <label className="text-xs font-semibold text-slate-600">Finalidade<select className="mt-1 w-full rounded-xl border p-3 text-sm" value={purpose} onChange={event=>setPurpose(event.target.value)}><option value="1">Normal</option><option value="2">Complementar</option><option value="3">Ajuste</option><option value="4">Devolução/retorno</option></select></label>}
        {documentType !== "NFS-e" && <label className="text-xs font-semibold text-slate-600">Indicador de presença<select className="mt-1 w-full rounded-xl border p-3 text-sm" value={presenceIndicator} onChange={event=>setPresenceIndicator(event.target.value)}><option value="1">Operação presencial</option><option value="2">Internet</option><option value="3">Teleatendimento</option><option value="5">Fora do estabelecimento</option><option value="9">Outros</option></select></label>}
        {documentType === "NF-e" && <label className="text-xs font-semibold text-slate-600">Modalidade do frete<select className="mt-1 w-full rounded-xl border p-3 text-sm" value={freightMode} onChange={event=>setFreightMode(event.target.value)}><option value="9">Sem frete</option><option value="0">Por conta do remetente</option><option value="1">Por conta do destinatário</option><option value="2">Por conta de terceiros</option></select></label>}
        {documentType === "NFC-e" && <label className="text-xs font-semibold text-slate-600">Forma de pagamento<select className="mt-1 w-full rounded-xl border p-3 text-sm" value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value)}><option value="01">Dinheiro</option><option value="03">Cartão de crédito</option><option value="04">Cartão de débito</option><option value="17">PIX</option><option value="90">Sem pagamento</option><option value="99">Outros</option></select></label>}
        {documentType === "NFS-e" && <><label className="text-xs font-semibold text-slate-600">Código IBGE do município da prestação<input className="mt-1 w-full rounded-xl border p-3 text-sm" value={serviceMunicipalityCode} onChange={event=>setServiceMunicipalityCode(event.target.value.replace(/\D/g,"").slice(0,7))} placeholder="Ex.: 3530300"/></label><label className="text-xs font-semibold text-slate-600">Local de incidência<input className="mt-1 w-full rounded-xl border p-3 text-sm" value={serviceTaxationLocation} onChange={event=>setServiceTaxationLocation(event.target.value)} placeholder="Município da prestação"/></label></>}

        <div className="md:col-span-2 rounded-xl border bg-slate-50 p-4">
          <div className="flex items-center gap-2"><Package size={16}/><b className="text-sm">{documentType === "NFS-e" ? "Serviços da nota" : "Produtos da nota"}</b></div>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_120px_auto]">
            <select className="rounded-lg border bg-white p-2 text-sm" value={itemId} onChange={event=>setItemId(event.target.value)}><option value="">Selecionar item...</option>{catalog.map(item=><option key={item.id} value={item.id}>{item.name} • {money(Number(item.value||0))}</option>)}</select>
            <input className="rounded-lg border bg-white p-2 text-sm" type="number" min="0.001" step="0.001" value={quantity} onChange={event=>setQuantity(Number(event.target.value)||1)}/>
            <button type="button" onClick={addItem} disabled={!itemId} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Adicionar</button>
          </div>
          <div className="mt-3 divide-y rounded-lg border bg-white">{items.map(item=><div key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm"><div><b>{item.description}</b><small className="block text-slate-500">{item.kind}{item.ncm ? ` • NCM ${item.ncm}` : ""}{item.cfop ? ` • CFOP ${item.cfop}` : ""}</small></div><div className="flex items-center gap-3"><span>{item.quantity} × {money(item.unitValue)}</span><button onClick={()=>setItems(current=>current.filter(x=>x.id!==item.id))} className="text-red-600"><X size={14}/></button></div></div>)}</div>
          <div className="mt-3 text-right text-sm">Total da nota: <b>{money(total)}</b></div>
        </div>

        {preview && <div className={`md:col-span-2 rounded-xl border p-4 ${preview.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex items-center gap-2 font-bold">{preview.ok ? <CheckCircle2 size={17} className="text-emerald-700"/> : <AlertTriangle size={17} className="text-red-700"/>}{preview.ok ? "Pré-validação concluída sem pendências conhecidas" : `${preview.issues.length} pendência(s) encontrada(s)`}</div>
          {!preview.ok && <div className="mt-2 space-y-1">{preview.issues.map(issue=><p key={issue} className="text-xs text-red-700">• {issue}</p>)}</div>}
        </div>}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t p-4"><button onClick={()=>void validate()} disabled={validating} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold disabled:opacity-50"><FileCheck2 size={14}/>{validating ? " Validando..." : " Pré-validar"}</button><button onClick={()=>void save()} disabled={!canCreate(customerId, items)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"><ReceiptText size={14}/> Salvar nota pendente</button></footer>
    </section>
  </div>;
}

const canCreate = (customerId: string, items: FiscalItem[]) => Boolean(customerId && items.length);
