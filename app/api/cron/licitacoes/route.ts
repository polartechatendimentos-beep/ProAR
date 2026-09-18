import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { licitacoes } from "@/db/schema";

const KEYWORDS = ["ar condicionado", "climatizacao", "pmoc", "refrigeracao", "chiller", "split", "fan coil"];

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const auth = request.headers.get("authorization") || "";
  return Boolean(secret) && safeEqual(auth, `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Cron não autorizado." }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const pncpUrl = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${today}&dataFinal=${today}&codigoModalidadeContratacao=6&pagina=1&tamanhoPagina=50`;
    let novasLicitacoes = 0;
    let registrosLidos = 0;

    const response = await fetch(pncpUrl, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: "PNCP indisponível.", sourceStatus: response.status, timestamp: new Date().toISOString() },
        { status: 502 }
      );
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    registrosLidos = rows.length;

    for (const item of rows) {
      const objeto = String(item.objetoCompra || item.objetoContratacao || "").toLowerCase();
      if (!KEYWORDS.some((kw) => objeto.includes(kw))) continue;

      const numeroControle = item.numeroControlePNCP || item.numeroControlePncp;
      if (!numeroControle) continue;

      await db.insert(licitacoes).values({
        numeroControlePncp: numeroControle,
        numeroPregao: item.numeroCompra || null,
        numeroProcesso: item.processo || null,
        titulo: item.objetoCompra || item.objetoContratacao || "Objeto não informado",
        descricao: item.informacaoComplementar || item.objetoCompra || item.objetoContratacao || "Não informado",
        orgao: item.orgaoEntidade?.razaoSocial || "Não informado",
        plataforma: item.nomeSistemaOrigem || "Não confirmado",
        uf: item.unidadeOrgao?.ufSigla || null,
        modalidade: item.modalidadeNome || "Não informado",
        tipoJulgamento: null,
        modoDisputa: null,
        valorEstimado: item.valorTotalEstimado != null
          ? `R$ ${Number(item.valorTotalEstimado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          : "Não informado",
        status: "em_andamento",
        linkEdital: item.linkSistemaOrigem || null,
        categoria: "Climatização / PMOC",
      }).onConflictDoNothing();

      novasLicitacoes += 1;
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      registrosLidos,
      novasLicitacoes,
      source: "PNCP",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erro no processamento da rotina." },
      { status: 500 }
    );
  }
}
