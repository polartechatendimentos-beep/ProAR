import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ cep: string }> }) {
  const { cep: rawCep } = await context.params;
  const cep = rawCep.replace(/\D/g, "");
  if (cep.length !== 8) return NextResponse.json({ success: false, error: "CEP inválido." }, { status: 400 });
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Consulta de CEP indisponível.");
    const data = await response.json();
    if (data.erro) return NextResponse.json({ success: false, error: "CEP não localizado." }, { status: 404 });
    return NextResponse.json({ success: true, source: "ViaCEP", address: {
      cep: data.cep || cep, street: data.logradouro || "", complement: data.complemento || "",
      neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || "",
    } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Consulta de CEP indisponível." }, { status: 502 });
  }
}
