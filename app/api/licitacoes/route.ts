import { NextRequest, NextResponse } from "next/server";

const PNCP_URL = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const dataInicial = (params.get("dataInicial") || "").replace(/-/g, "");
  const dataFinal = (params.get("dataFinal") || "").replace(/-/g, "");
  const uf = params.get("uf") || "";
  const requestedModality = params.get("modalidade") || "6";

  if (!/^\d{8}$/.test(dataInicial) || !/^\d{8}$/.test(dataFinal)) {
    return NextResponse.json({ error: "Informe um período válido." }, { status: 400 });
  }

  const modalities = requestedModality === "all" ? ["4", "6", "8", "9", "12"] : [requestedModality];
  const calls = modalities.map(async codigoModalidadeContratacao => {
    const query = new URLSearchParams({ dataInicial, dataFinal, codigoModalidadeContratacao, pagina: "1", tamanhoPagina: "50" });
    if (uf) query.set("uf", uf);
    const response = await fetch(`${PNCP_URL}?${query.toString()}`, { headers: { Accept: "application/json" }, next: { revalidate: 900 }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`PNCP respondeu ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload?.data) ? payload.data : [];
  });

  const settled = await Promise.allSettled(calls);
  const data = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const failed = settled.filter(result => result.status === "rejected").length;

  if (!data.length && failed === settled.length) {
    return NextResponse.json({ error: "O serviço oficial do PNCP está temporariamente indisponível." }, { status: 502 });
  }

  const unique = Array.from(new Map(data.map(item => [item.numeroControlePNCP || `${item.orgaoEntidade?.cnpj}-${item.anoCompra}-${item.sequencialCompra}`, item])).values());
  return NextResponse.json({ data: unique, source: "PNCP", warning: failed ? `${failed} modalidade(s) não responderam; os demais resultados foram carregados.` : "" });
}
