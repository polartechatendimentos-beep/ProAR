import { NextResponse } from "next/server";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";
import { desc, eq, and } from "drizzle-orm";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parentType = searchParams.get("parent_type");
    const parentId = searchParams.get("parent_id");

    const session = await readSession(request);
    const companyId = session ? getEffectiveCompanyId(session) : 1;

    let conditions = [eq(attachments.companyId, companyId)];
    if (parentType) conditions.push(eq(attachments.parentType, parentType));
    if (parentId) conditions.push(eq(attachments.parentId, parentId));

    const list = await db
      .select()
      .from(attachments)
      .where(and(...conditions))
      .orderBy(desc(attachments.criadoEm));

    return NextResponse.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const companyId = assertCompanyAccess(session, body.companyId);

    const { parentType, parentId, nomeArquivo, url, mimeType, tamanhoBytes } = body;

    if (!parentType || !parentId || !nomeArquivo || !url) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios: parentType, parentId, nomeArquivo, url." },
        { status: 400 }
      );
    }

    if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: `Tipo de arquivo não permitido (${mimeType}). Permitidos: Imagens (JPG, PNG, WebP) e Documentos (PDF, DOCX).` },
        { status: 400 }
      );
    }

    const size = Number(tamanhoBytes) || 0;
    if (size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Arquivo excede o limite máximo permitido de 10 MB." },
        { status: 400 }
      );
    }

    const sanitizedName = nomeArquivo.replace(/[^a-zA-Z0-9._-]/g, "_");

    const [newAttachment] = await db
      .insert(attachments)
      .values({
        companyId,
        parentType,
        parentId: String(parentId),
        nomeArquivo: sanitizedName,
        url,
        mimeType: mimeType || "application/octet-stream",
        tamanhoBytes: size,
      })
      .returning();

    return NextResponse.json({ success: true, data: newAttachment });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
