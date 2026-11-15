"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";

type RegistrationKind = "cliente" | "produto" | "servico";
type RegistrationFields = Record<string, string>;

const labels: Record<string, string> = {
  name: "Nome", doc: "CPF / CNPJ", legalName: "Razão social / nome completo", tradeName: "Nome fantasia",
  organizationType: "Tipo de organização", contact: "Responsável", phone: "Telefone", email: "E-mail",
  zipCode: "CEP", street: "Logradouro", addressNumber: "Número", complement: "Complemento",
  neighborhood: "Bairro", city: "Cidade", state: "UF", description: "Descrição", category: "Categoria",
  unitOfMeasure: "Unidade de medida", brand: "Marca", model: "Modelo", sku: "SKU", barcode: "Código de barras",
};

export function RegistrationAIAssistant({ kind, current, onApply }: {
  kind: RegistrationKind;
  current: RegistrationFields;
  onApply: (fields: RegistrationFields) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [fields, setFields] = useState<RegistrationFields | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const analyze = async () => {
    if (busy || prompt.trim().length < 3) return;
    setBusy(true); setMessage(""); setFields(null);
    try {
      const response = await fetch("/api/registration/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, prompt, current }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível analisar o cadastro.");
      setFields(result.fields || {});
      if (!Object.values(result.fields || {}).some(value => typeof value === "string" && value.trim())) setMessage("Não encontrei dados explícitos para sugerir. Preencha os campos manualmente.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao consultar o assistente."); }
    finally { setBusy(false); }
  };
  const available = Object.entries(fields || {}).filter(([key, value]) => value && !current[key]?.trim());
  return <details className="registration-ai-assistant">
    <summary><Sparkles size={15}/> Assistente de cadastro com IA <small>Sugestões revisáveis</small></summary>
    <p>Descreva ou cole as informações recebidas. O texto é enviado à IA configurada para esta empresa; inclua apenas os dados necessários. A IA só sugere campos encontrados no texto; revise antes de aplicar.</p>
    <textarea value={prompt} maxLength={8000} onChange={event => setPrompt(event.target.value)} placeholder={kind === "cliente" ? "Cole os dados de contato ou descreva as informações fornecidas pelo cliente..." : "Descreva o produto ou serviço usando somente os dados conhecidos..."}/>
    <div className="registration-ai-actions"><button type="button" className="outline-btn" disabled={busy || prompt.trim().length < 3} onClick={() => void analyze()}>{busy ? <><LoaderCircle size={14} className="spin"/> Analisando…</> : <><Sparkles size={14}/> Analisar texto</>}</button>{message && <span role="status">{message}</span>}</div>
    {available.length > 0 && <div className="registration-ai-result"><b>Confira as sugestões</b><div>{available.map(([key, value]) => <span key={key}><small>{labels[key] || key}</small>{value}</span>)}</div><button type="button" className="primary-btn" onClick={() => { onApply(Object.fromEntries(available)); setMessage("Sugestões aplicadas ao formulário. Confira os campos antes de salvar."); setFields(null); }}><CheckCircle2 size={14}/> Aplicar sugestões</button></div>}
  </details>;
}
