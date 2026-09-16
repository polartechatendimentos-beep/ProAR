import { NextResponse } from "next/server";
import { searchPncp } from "@/lib/procurement/pncp";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Job desabilitado ou não autorizado." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const companyId = Number(params.get("company_id"));
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return NextResponse.json({ success: false, error: "company_id explícito é obrigatório." }, { status: 400 });
  }
  const writeRequested = params.get("write") === "true";
  const writeEnabled = process.env.LICITACOES_SYNC_WRITE === "true";
  if (writeRequested && !writeEnabled) {
    return NextResponse.json({ success: false, error: "Persistência do Radar está desativada por segurança.", mode: "preview" }, { status: 403 });
  }

  const result = await searchPncp({
    uf: params.get("uf") || "SP",
    days: Number(params.get("days")) || 2,
    maxPages: Number(params.get("max_pages")) || 2,
  });
  return NextResponse.json({
    success: result.success,
    timestamp: new Date().toISOString(),
    companyId,
    mode: "preview",
    writeEnabled,
    writesPerformed: 0,
    health: result.health,
    count: result.data.length,
    message: result.success
      ? "Varredura oficial PNCP concluída em modo somente leitura."
      : "A fonte PNCP ficou indisponível; nenhum dado persistido foi alterado.",
  }, { status: result.success ? 200 : 502 });
}
