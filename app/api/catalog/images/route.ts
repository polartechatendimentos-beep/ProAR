import { createHash, randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../../lib/permissions";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

function tenantPrefix(companyId: string) {
  const tenant = createHash("sha256").update(companyId).digest("hex").slice(0, 24);
  return `proar/catalog/${tenant}/`;
}

function validImage(bytes: Buffer, type: string) {
  if (type === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/webp") return bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (type === "image/avif") return bytes.length > 12 && bytes.toString("ascii", 4, 8) === "ftyp" && /avif|avis/.test(bytes.toString("ascii", 8, 16));
  return false;
}

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "catalogo.editar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const form = await request.formData();
  const scope = sessionCompany(access.session, form.get("companyId"));
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const moduleName = String(form.get("module") ?? "");
  const file = form.get("image");
  if (moduleName !== "Produtos" && moduleName !== "Serviços") return NextResponse.json({ error: "O upload é permitido somente para Produtos e Serviços." }, { status: 400 });
  if (!(file instanceof File) || file.size <= 0) return NextResponse.json({ error: "Selecione uma imagem para enviar." }, { status: 400 });
  const extension = allowedTypes.get(file.type);
  if (!extension) return NextResponse.json({ error: "Formato não permitido. Use JPG, PNG, WebP ou AVIF." }, { status: 415 });
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "A imagem deve ter no máximo 5 MB." }, { status: 413 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "O armazenamento de imagens não está configurado neste ambiente." }, { status: 503 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!validImage(bytes, file.type)) return NextResponse.json({ error: "O arquivo selecionado não corresponde a uma imagem válida." }, { status: 415 });

  try {
    const pathname = `${tenantPrefix(scope.companyId)}${moduleName === "Produtos" ? "products" : "services"}/${randomUUID()}.${extension}`;
    const blob = await put(pathname, bytes, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
      contentType: file.type,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return NextResponse.json({ url: blob.url, pathname: blob.pathname, contentType: file.type, size: bytes.length }, { status: 201 });
  } catch (error) {
    console.error("Catalog image upload failed", error);
    return NextResponse.json({ error: "Não foi possível armazenar a imagem do catálogo." }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const access = requirePermission(request, "catalogo.editar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const scope = sessionCompany(access.session);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "O armazenamento de imagens não está configurado neste ambiente." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { url?: string };
  const url = String(body.url ?? "");
  let parsed: URL;
  try { parsed = new URL(url); } catch { return NextResponse.json({ error: "Imagem inválida." }, { status: 400 }); }
  if (parsed.protocol !== "https:" || !parsed.pathname.startsWith(`/${tenantPrefix(scope.companyId)}`)) {
    return NextResponse.json({ error: "A imagem não pertence à empresa desta sessão." }, { status: 403 });
  }
  try {
    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Catalog image deletion failed", error);
    return NextResponse.json({ error: "Não foi possível remover a imagem do armazenamento." }, { status: 502 });
  }
}
