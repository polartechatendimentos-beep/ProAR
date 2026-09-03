import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/proar-auth";
import { insertOperational, listOperational } from "@/lib/operational-repository";

const entityTypes = new Set([
  "ordem_servico", "obra", "alteracao_medida", "equipamento", "assistencia_tecnica",
  "pmoc", "higienizacao_hospitalar", "cliente", "produto", "certame", "empenho", "relatorio",
]);

const categories = new Set(["foto", "situacao_atual", "croqui_projeto", "local_alteracao", "durante_execucao", "depois_alteracao", "documento", "certificado"]);
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const documentTypes = new Set(["application/pdf"]);
const maxBytes = 12 * 1024 * 1024;

function cleanFileName(value: string) {
  const normalized = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^-|-$/g, "").slice(0, 120) || "anexo";
}

function validTarget(entityType: unknown, entityId: unknown) {
  return typeof entityType === "string" && entityTypes.has(entityType) && typeof entityId === "string" && entityId.trim().length > 0 && entityId.length <= 160;
}

export async function GET(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const entityType = request.nextUrl.searchParams.get("entityType");
  const entityId = request.nextUrl.searchParams.get("entityId");
  if (!validTarget(entityType, entityId)) return NextResponse.json({ error: "Registro de anexo inválido." }, { status: 400 });
  try {
    const attachments = await listOperational<Record<string, unknown>>(user, "proar_attachments", `entity_type=eq.${encodeURIComponent(entityType!)}&entity_id=eq.${encodeURIComponent(entityId!)}&order=created_at.desc`);
    const safeAttachments = attachments.map(({ storage_url: _storageUrl, ...attachment }) => ({
      ...attachment,
      view_url: `/api/attachments/${attachment.id}`,
    }));
    return NextResponse.json({ attachments: safeAttachments });
  } catch {
    return NextResponse.json({ error: "Anexos indisponíveis. Execute a migração operacional." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Armazenamento de anexos não configurado." }, { status: 503 });
  try {
    const form = await request.formData();
    const entityType = form.get("entityType");
    const entityId = form.get("entityId");
    const categoryValue = form.get("category");
    const caption = form.get("caption");
    const file = form.get("file");
    if (!validTarget(entityType, entityId) || !(file instanceof File)) return NextResponse.json({ error: "Registro e arquivo são obrigatórios." }, { status: 400 });
    if (!imageTypes.has(file.type) && !documentTypes.has(file.type)) return NextResponse.json({ error: "Formato não suportado. Envie JPG, PNG, WEBP, HEIC/HEIF ou PDF." }, { status: 415 });
    if (!file.size || file.size > maxBytes) return NextResponse.json({ error: "O arquivo deve ter no máximo 12 MB." }, { status: 413 });
    const category = typeof categoryValue === "string" && categories.has(categoryValue) ? categoryValue : "documento";
    const company = String(user.companyId || "empresa").replace(/[^a-zA-Z0-9_-]/g, "-");
    const key = `proar/${company}/${entityType}/${encodeURIComponent(String(entityId))}/${Date.now()}-${cleanFileName(file.name)}`;
    const uploaded = await put(key, file, { access: "private", addRandomSuffix: true, contentType: file.type });
    const rows = await insertOperational(user, "proar_attachments", {
      entity_type: entityType, entity_id: entityId, category, storage_url: uploaded.url,
      file_name: file.name.slice(0, 240), mime_type: file.type, byte_size: file.size,
      caption: typeof caption === "string" ? caption.slice(0, 1000) : null, created_by: user.displayName || "Usuário",
    });
    return NextResponse.json({ saved: true, attachment: rows[0] }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar o anexo." }, { status: 503 });
  }
}
