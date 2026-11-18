import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
export async function GET(request: NextRequest) {
  const state = String(request.nextUrl.searchParams.get("state") || "").trim().toUpperCase();
  const city = String(request.nextUrl.searchParams.get("city") || "").trim().slice(0, 80);
  const street = String(request.nextUrl.searchParams.get("street") || "").trim().slice(0, 100);
  if (!/^[A-Z]{2}$/.test(state) || city.length < 3 || street.length < 3) return reply({ error: "Informe UF, cidade e ao menos 3 letras do logradouro." }, 400);
  try {
    const url = "https://viacep.com.br/ws/" + encodeURIComponent(state) + "/" + encodeURIComponent(city) + "/" + encodeURIComponent(street) + "/json/";
    const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": "ProAR/1.0" }, signal: AbortSignal.timeout(7000) });
    if (!response.ok) return reply({ error: response.status === 400 ? "A busca precisa de cidade e logradouro mais específicos." : "A consulta de CEP está indisponível." }, 502);
    const data = await response.json();
    if (!Array.isArray(data)) return reply({ error: "Nenhum CEP encontrado para esse endereço." }, 404);
    const matches = data.slice(0, 10).map((row: Record<string, unknown>) => ({
      zipCode: String(row.cep || ""), street: String(row.logradouro || ""), complement: String(row.complemento || ""),
      neighborhood: String(row.bairro || ""), city: String(row.localidade || ""), state: String(row.uf || ""),
    })).filter((row: { zipCode: string; street: string }) => /^\d{5}-?\d{3}$/.test(row.zipCode.replace(/\D/g, "")) && row.street);
    return matches.length ? reply({ matches, limited: data.length > matches.length, source: "ViaCEP" }) : reply({ error: "Nenhum CEP encontrado para esse endereço." }, 404);
  } catch {
    return reply({ error: "Não foi possível validar o endereço agora. Você ainda pode revisar e salvar os dados manualmente." }, 502);
  }
}
