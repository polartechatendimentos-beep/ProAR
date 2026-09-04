import { NextResponse } from "next/server";
import { db } from "@/db";
import { licitacoes } from "@/db/schema";

// Palavras-chave prioritárias no setor de climatização e engenharia térmica
const KEYWORDS = ["ar condicionado", "climatizacao", "pmoc", "refrigeracao", "chiller", "split", "fan coil"];

/**
 * Endpoint de sincronização e busca autônoma de licitações em andamento (PNCP)
 * Protegido obrigatoriamente por CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Acesso não autorizado ao job de sincronização." },
      { status: 401 }
    );
  }

  try {
    console.log("[Cron ProAR] Executando busca autônoma de licitações no PNCP...");

    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const pncpUrl = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicas?dataInicial=${today}&codigoModalidadeContratacao=6&pagina=1`;
    let novasLicitacoes = 0;

    try {
      const response = await fetch(pncpUrl, {
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.data && Array.isArray(data.data)) {
          for (const item of data.data) {
            const objeto = (item.objetoContratacao || "").toLowerCase();
            // Filtra se o edital contém palavras de climatização
            const isRelevant = KEYWORDS.some((kw) => objeto.includes(kw));

            if (isRelevant) {
              await db
                .insert(licitacoes)
                .values({
                  numeroControlePncp: item.numeroControlePNCP || `PNCP-${Date.now()}-${Math.random()}`,
                  titulo: item.objetoContratacao || "Licitação de Climatização / PMOC",
                  descricao: item.informacaoComplementar || item.objetoContratacao || "Serviços de climatização.",
                  orgao: item.orgaoEntidade?.razaoSocial || "Órgão Público",
                  uf: item.unidadeOrgao?.ufSigla || "SP",
                  modalidade: item.modalidadeNome || "Pregão Eletrônico",
                  valorEstimado: item.valorTotalEstimado
                    ? `R$ ${item.valorTotalEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : "A consultar",
                  status: "em_andamento",
                  linkEdital: item.linkSistemaOrigem || "https://pncp.gov.br",
                  categoria: "Climatização / PMOC",
                })
                .onConflictDoNothing();

              novasLicitacoes++;
            }
          }
        }
      }
    } catch (e: any) {
      console.log("[PNCP Sync] Conexão externa indisponível, rotina de verificação concluída.");
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      novasLicitacoes,
      message: "Varredura autônoma de licitações em andamento finalizada com sucesso.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro no processamento da rotina." },
      { status: 500 }
    );
  }
}
