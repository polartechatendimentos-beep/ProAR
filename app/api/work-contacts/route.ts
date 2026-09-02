import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/proar-auth";
import { insertOperational, listOperational } from "@/lib/operational-repository";

const contactTypes = new Set(["engenharia", "fiscalizacao"]);

export async function GET(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const workId = request.nextUrl.searchParams.get("workId");
  if (!workId) return NextResponse.json({ error: "Obra obrigatória." }, { status: 400 });
  try {
    const contacts = await listOperational(user, "proar_work_contacts", `work_id=eq.${encodeURIComponent(workId)}&order=is_primary.desc,created_at.asc`);
    return NextResponse.json({ contacts });
  } catch {
    return NextResponse.json({ error: "Contatos da obra indisponíveis. Execute a migração operacional." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.workId || !body.name || !contactTypes.has(body.contactType)) {
      return NextResponse.json({ error: "Obra, tipo e nome são obrigatórios." }, { status: 400 });
    }
    const rows = await insertOperational(user, "proar_work_contacts", {
      work_id: String(body.workId), contact_type: body.contactType, name: String(body.name),
      company_name: body.companyName || null, role_name: body.roleName || null, registry: body.registry || null,
      phone: body.phone || null, whatsapp: body.whatsapp || null, email: body.email || null,
      is_primary: Boolean(body.isPrimary), is_active: body.isActive !== false,
      starts_at: body.startsAt || null, ends_at: body.endsAt || null, notes: body.notes || null,
      created_by: user.displayName || "Usuário"
    });
    return NextResponse.json({ saved: true, contact: rows[0] });
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar o contato da obra." }, { status: 503 });
  }
}
