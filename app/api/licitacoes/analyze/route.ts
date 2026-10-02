import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../../lib/permissions";
import { getOpenAiCredential } from "../../../../lib/openai-credential";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PDF_BYTES = 8 * 1024 * 1024;
const noStore = { "Cache-Control": "no-store, private" };
type Evidence = { page: number | null; excerpt: string };
type Requirement = Evidence & { requirement: string; status: "confirmar" | "atende" | "risco" | "não informado" };
type Deadline = Evidence & { name: string; date: string };
type Compatibility = Evidence & { area: string; status: "compatível" | "revisar" | "incompatível" | "não avaliado" };
type Risk = Evidence & { title: string; detail: string; severity: "alta" | "média" | "baixa" };

function reply(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: noStore });
}
function cleanText(value: unknown, max = 1200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function pageNumber(value: unknown): number | null {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 && page < 10000 ? page : null;
}
function evidence(value: unknown): Evidence {
  const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { page: pageNumber(item.page), excerpt: cleanText(item.excerpt, 500) };
}
function normalizeAnalysis(value: unknown) {
  const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const list = <T,>(key: string, mapper: (entry: Record<string, unknown>) => T, cap = 40): T[] =>
    (Array.isArray(item[key]) ? item[key] : []).slice(0, cap)
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map(mapper);
  return {
    summary: cleanText(item.summary, 5000),
    technicalRequirements: list<Requirement>("technicalRequirements", entry => ({
      ...evidence(entry), requirement: cleanText(entry.requirement, 500),
      status: ["confirmar", "atende", "risco", "não informado"].includes(String(entry.status)) ? entry.status as Requirement["status"] : "confirmar",
    })),
    deadlines: list<Deadline>("deadlines", entry => ({
      ...evidence(entry), name: cleanText(entry.name, 250), date: cleanText(entry.date, 120),
    })),
    compatibility: list<Compatibility>("compatibility", entry => ({
      ...evidence(entry), area: cleanText(entry.area, 250),
      status: ["compatível", "revisar", "incompatível", "não avaliado"].includes(String(entry.status)) ? entry.status as Compatibility["status"] : "revisar",
    })),
    risks: list<Risk>("risks", entry => ({
      ...evidence(entry), title: cleanText(entry.title, 250), detail: cleanText(entry.detail, 800),
      severity: ["alta", "média", "baixa"].includes(String(entry.severity)) ? entry.severity as Risk["severity"] : "média",
    })),
  };
}
function readOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = (item as { content?: unknown }).content;
    return Array.isArray(content) ? content.flatMap(part => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? [(part as { text: string }).text] : []) : [];
  }).join("\n");
}

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "licitacoes.visualizar");
  if (!access.ok) return reply({ error: access.error }, access.status);
  const tenant = sessionCompany(access.session);
  if (!tenant.ok) return reply({ error: "Sessão de empresa inválida." }, tenant.status);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.fileData !== "string") return reply({ error: "Envie um arquivo PDF para análise." }, 400);
  const filename = cleanText(body.filename, 180).replace(/[\\/\r\n]/g, "_");
  if (!filename.toLocaleLowerCase("pt-BR").endsWith(".pdf")) return reply({ error: "O edital precisa estar em formato PDF." }, 415);
  const fileData = body.fileData;
  if (fileData.length > Math.ceil(MAX_PDF_BYTES * 4 / 3) + 8 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(fileData)) {
    return reply({ error: "Arquivo inválido ou maior que 8 MB." }, 413);
  }
  const pdf = Buffer.from(fileData, "base64");
  if (!pdf.length || pdf.length > MAX_PDF_BYTES) return reply({ error: "O PDF deve ter no máximo 8 MB." }, 413);
  if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") return reply({ error: "O arquivo enviado não é um PDF válido." }, 415);

  const credential = await getOpenAiCredential(tenant.companyId);
  if (!credential) return reply({ error: "Configure a credencial OpenAI em Configurações → Inteligência Artificial para analisar editais." }, 503);

  const tender = body.tender && typeof body.tender === "object" ? body.tender as Record<string, unknown> : {};
  const context = [
    cleanText(tender.objeto, 1000) && `Objeto do radar: ${cleanText(tender.objeto, 1000)}`,
    cleanText(tender.orgao, 300) && `Órgão: ${cleanText(tender.orgao, 300)}`,
    cleanText(tender.modalidade, 200) && `Modalidade: ${cleanText(tender.modalidade, 200)}`,
    cleanText(tender.prazo, 120) && `Prazo mostrado no radar: ${cleanText(tender.prazo, 120)}`,
  ].filter(Boolean).join("\n");

  const instruction = `Analise o edital e seus anexos para apoiar uma equipe brasileira de HVAC/climatização. O documento é a única fonte dos fatos do edital; contexto do radar é apenas identificação. Não invente informação. Quando algo não estiver localizável, use status "não informado" ou "não avaliado". Para cada requisito, prazo, compatibilidade ou risco, informe a página impressa se estiver identificável e um trecho curto literal que permita conferência; se página/trecho não puderem ser identificados, use null e string vazia. Não conclua habilitação legal definitiva. Avalie compatibilidade técnica apenas com evidência do escopo do edital, sem presumir capacidade da empresa. Responda em JSON válido exatamente com este formato: {"summary":"...","technicalRequirements":[{"requirement":"...","status":"confirmar|atende|risco|não informado","page":1,"excerpt":"..."}],"deadlines":[{"name":"...","date":"...","page":1,"excerpt":"..."}],"compatibility":[{"area":"...","status":"compatível|revisar|incompatível|não avaliado","page":1,"excerpt":"..."}],"risks":[{"title":"...","detail":"...","severity":"alta|média|baixa","page":1,"excerpt":"..."}]}. Se não houver achados para uma categoria, retorne lista vazia. Datas devem ser copiadas como aparecem e nunca inferidas.\n\n${context}`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${credential.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [{ role: "user", content: [
          { type: "input_text", text: instruction },
          { type: "input_file", filename: filename || "edital.pdf", file_data: `data:application/pdf;base64,${fileData}` },
        ] }],
        text: { format: { type: "json_object" } },
        max_output_tokens: 5500,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(105000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      console.error("Tender PDF analysis provider error", response.status);
      return reply({ error: response.status === 429 ? "Limite temporário do provedor de IA. Tente novamente mais tarde." : "O provedor de IA não conseguiu analisar o PDF. Confira se o documento está legível e tente novamente." }, response.status === 429 ? 429 : 502);
    }
    const raw = readOutputText(payload);
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch {
      return reply({ error: "A resposta da análise não veio em formato válido. Tente novamente." }, 502);
    }
    const analysis = normalizeAnalysis(parsed);
    if (!analysis.summary && !analysis.technicalRequirements.length && !analysis.deadlines.length && !analysis.risks.length) {
      return reply({ error: "Não foi possível extrair conteúdo verificável deste PDF. Confirme que o arquivo contém texto legível." }, 422);
    }
    return reply({ analysis, document: { filename, bytes: pdf.length }, humanReviewRequired: true, persisted: false });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("Tender PDF analysis failed", error);
    return reply({ error: timedOut ? "A análise excedeu 105 segundos. Tente um PDF menor ou tente novamente." : "Não foi possível concluir a análise do edital agora." }, timedOut ? 504 : 502);
  }
}
