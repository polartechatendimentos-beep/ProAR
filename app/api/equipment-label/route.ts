import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";
import { getOpenAiCredential, safeCompanyId } from "../../../lib/openai-credential";

const FIELDS = ["brand", "model", "equipmentType", "capacityBtus", "serialNumber", "voltage", "frequency", "current", "power", "refrigerant", "refrigerantCharge", "manufactureDate", "manufacturerCode"] as const;

export async function POST(request: NextRequest) {
  const session=readSession(request.cookies.get("proar_session")?.value);
  if(!session)return NextResponse.json({error:"Sessão inválida."},{status:401});
  const { image } = await request.json().catch(() => ({}));
  if (typeof image !== "string" || !image.startsWith("data:image/")) return NextResponse.json({ error: "Envie uma imagem válida da etiqueta." }, { status: 400 });
  if (image.length > 11_000_000) return NextResponse.json({ error: "A imagem enviada é muito grande." }, { status: 413 });
  const credential=await getOpenAiCredential(safeCompanyId(session.companyId));
  if (!credential) return NextResponse.json({ error: "Configure a IA em Configurações → Inteligência Artificial." }, { status: 503 });
  const prompt = `Leia somente dados claramente legíveis na etiqueta técnica HVAC desta imagem. Retorne JSON puro com estas chaves: ${FIELDS.join(", ")}. Para campo ilegível ou ausente, retorne string vazia. Não infira, complete, estime ou invente números de série, capacidade, tensão, refrigerante, carga ou qualquer dado técnico. capacityBtus deve conter apenas dígitos quando estiver explícito na etiqueta.`;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${credential.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4.1-mini", input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: image, detail: "high" }] }], text: { format: { type: "json_object" } } }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || "Falha na leitura da etiqueta.");
    const text = payload.output_text || payload.output?.flatMap((item: { content?: { text?: string }[] }) => item.content || []).map((item: { text?: string }) => item.text || "").join("") || "{}";
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const fields = Object.fromEntries(FIELDS.map(field => [field, typeof parsed[field] === "string" ? parsed[field].trim() : ""]));
    return NextResponse.json({ fields });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível analisar a etiqueta." }, { status: 502 });
  }
}
