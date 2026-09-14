import { NextResponse } from "next/server";
import { readSession } from "@/lib/proar-auth";
import { getEffectiveCompanyId } from "@/lib/company-access";

const text = (value: unknown) => value === null || value === undefined ? "" : String(value).trim();

function isAllowedHost(hostname: string) {
  return (
    hostname === "pncp.gov.br" ||
    hostname.endsWith(".pncp.gov.br") ||
    hostname === "gov.br" ||
    hostname.endsWith(".gov.br")
  );
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "documento-pncp";
}

function filenameFromHeaders(contentDisposition: string | null, fallbackUrl: URL) {
  const utf8Match = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return sanitizeFilename(decodeURIComponent(utf8Match[1]));
  const plainMatch = contentDisposition?.match(/filename=\"?([^\";]+)\"?/i);
  if (plainMatch?.[1]) return sanitizeFilename(plainMatch[1]);
  const pathnamePart = fallbackUrl.pathname.split("/").filter(Boolean).pop();
  return sanitizeFilename(pathnamePart || "documento-pncp");
}

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const requestedCompany = searchParams.get("company_id");
    getEffectiveCompanyId(session, requestedCompany ? Number(requestedCompany) : null);

    const rawUrl = text(searchParams.get("url"));
    if (!rawUrl) {
      return NextResponse.json({ success: false, error: "URL do documento é obrigatória." }, { status: 400 });
    }

    const targetUrl = new URL(rawUrl);
    if (targetUrl.protocol !== "https:" || !isAllowedHost(targetUrl.hostname)) {
      return NextResponse.json({ success: false, error: "Host do documento não permitido." }, { status: 400 });
    }

    const upstream = await fetch(targetUrl, {
      headers: {
        Accept: "*/*",
        "User-Agent": "ProAR-Licitacoes/1.0",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json({ success: false, error: `Falha ao baixar o documento (${upstream.status}).` }, { status: 502 });
    }

    const fileBuffer = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const fileName = filenameFromHeaders(upstream.headers.get("content-disposition"), targetUrl);

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível baixar o documento do PNCP.",
    }, { status: 500 });
  }
}
