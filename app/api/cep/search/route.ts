import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
export async function GET(request: NextRequest) {
  const state = String(request.nextUrl.searchParams.get("state") || "").trim().toUpperCase();
  const city = String(request.nextUrl.searchParams.get("city") || "").trim().slice(0, 80);
  const street = String(request.nextUrl.searchParams.get("street") || "").trim().slice(0, 100);
  if (!/^[A-Z]{2}$/.test(state) || city.length < 3 || street.length < 3) return reply({ error: "Informe UF, cidade e ao menos 3 letras do logradouro." }, 400);
  const candidates = [street];
  // A common dictation/typing variation is a final "i" on a surname ending in "on".
  if (/oni$/i.test(street)) candidates.push(street.slice(0, -1));
  try {
    const collected = new Map<string, { zipCode:string; street:string; complement:string; neighborhood:string; city:string; state:string }>();
    for (const candidate of candidates) {
      const url = "https://viacep.com.br/ws/" + encodeURIComponent(state) + "/" + encodeURIComponent(city) + "/" + encodeURIComponent(candidate) + "/json/";
      const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": "ProAR/1.0" }, signal: AbortSignal.timeout(7000) });
      if (!response.ok) return reply({ error: "A consulta de CEP está indisponível." }, 502);
      const data = await response.json();
      if (!Array.isArray(data)) continue;
      for (const row of data.slice(0, 50)) {
        const match = {
          zipCode: String(row.cep || ""), street: String(row.logradouro || ""), complement: String(row.complemento || ""),
          neighborhood: String(row.bairro || ""), city: String(row.localidade || ""), state: String(row.uf || ""),
        };
        if (/^\d{5}-?\d{3}$/.test(match.zipCode.replace(/\D/g, "")) && match.street) collected.set(match.zipCode, match);
      }
      if (collected.size) break;
    }
    const matches = [...collected.values()].slice(0, 10);
    return matches.length ? reply({ matches, source: "ViaCEP" }) : reply({ error: "Nenhum CEP encontrado para esse logradouro. Confira a grafia, cidade e UF." }, 404);
  } catch {
    return reply({ error: "Não foi possível validar o endereço agora. Você ainda pode revisar e salvar os dados manualmente." }, 502);
  }
}
