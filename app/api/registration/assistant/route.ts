import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../../lib/permissions";
import { getOpenAiCredential } from "../../../../lib/openai-credential";

export const runtime = "nodejs";

const CUSTOMER_FIELDS = ["name","doc","legalName","tradeName","organizationType","contact","phone","email","zipCode","street","addressNumber","complement","neighborhood","city","state","description"] as const;
const CATALOG_FIELDS = ["name","description","category","unitOfMeasure","brand","model","sku","barcode"] as const;
function responseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "{}";
  const result = payload as { output_text?: unknown; output?: unknown[] };
  if (typeof result.output_text === "string") return result.output_text;
  for (const item of result.output || []) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown[] }).content || [];
    for (const part of content) if (part && typeof part === "object" && (part as { type?: unknown }).type === "output_text" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
  }
  return "{}";
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 12000) return NextResponse.json({ error: "Reduza o texto enviado ao assistente." }, { status: 413 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }
  const kind = body.kind === "cliente" ? "cliente" : body.kind === "produto" ? "produto" : body.kind === "servico" ? "servico" : null;
  if (!kind) return NextResponse.json({ error: "Tipo de cadastro inválido." }, { status: 400 });
  const permission = kind === "cliente" ? "clientes.editar" : kind === "produto" ? "estoque.editar" : "catalogo.editar";
  const access = requirePermission(request, permission);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const scope = sessionCompany(access.session);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const promptText = String(body.prompt || "").trim();
  if (promptText.length < 3 || promptText.length > 8000) return NextResponse.json({ error: "Descreva o cadastro em até 8.000 caracteres." }, { status: 400 });
  const credential = await getOpenAiCredential(scope.companyId);
  if (!credential) return NextResponse.json({ error: "Configure a IA em Configurações → Inteligência Artificial." }, { status: 503 });
  const allowed = kind === "cliente" ? CUSTOMER_FIELDS : CATALOG_FIELDS;
  const prompt = `Você auxilia o preenchimento de cadastros do ERP ProAR. Tipo: ${kind}.\nExtraia somente fatos explícitos do texto fornecido. Nunca invente, estime ou complete dados ausentes. Para campos não informados, use string vazia. Não gere nem deduza CPF/CNPJ, NCM, CEST, CFOP, CST/CSOSN, código fiscal, preço, custo, imposto, endereço, contato ou qualquer informação regulatória. A descrição pode ser organizada sem acrescentar fatos. Retorne JSON com uma propriedade "fields" contendo somente estas chaves: ${allowed.join(", ")}.\nTEXTO: ${promptText}\nDADOS JÁ INFORMADOS (contexto; não sobrescreva na resposta): ${JSON.stringify(body.current || {})}`;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${credential.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4.1-mini", input: prompt, text: { format: { type: "json_object" } }, max_output_tokens: 900 }),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: "O assistente não conseguiu analisar o texto." }, { status: 502 });
    const parsed = JSON.parse(responseText(payload));
    const source = parsed?.fields && typeof parsed.fields === "object" ? parsed.fields : parsed;
    const fields = Object.fromEntries(allowed.map(key => [key, typeof source?.[key] === "string" ? source[key].trim().slice(0, 500) : ""]));
    return NextResponse.json({ fields, source: credential.source }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível concluir a análise assistida." }, { status: 504 });
  }
}
