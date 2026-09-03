import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/proar-auth";
import { listOperational } from "@/lib/operational-repository";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return NextResponse.json({ error: "Anexo inválido." }, { status: 400 });
  try {
    const rows = await listOperational<Record<string, unknown>>(user, "proar_attachments", `id=eq.${encodeURIComponent(id)}&limit=1`);
    const attachment = rows[0];
    const storageUrl = typeof attachment?.storage_url === "string" ? attachment.storage_url : "";
    if (!storageUrl) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
    const file = await get(storageUrl, { access: "private" });
    if (!file || file.statusCode !== 200 || !file.stream) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
    const headers = new Headers();
    headers.set("Content-Type", file.blob.contentType || "application/octet-stream");
    headers.set("Content-Disposition", file.blob.contentDisposition);
    headers.set("Cache-Control", "private, max-age=300");
    return new NextResponse(file.stream, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar o anexo." }, { status: 503 });
  }
}
