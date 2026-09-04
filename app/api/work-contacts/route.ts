import { NextResponse } from "next/server";
import { db } from "@/db";
import { workContacts, works } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";
import { eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workId = searchParams.get("work_id") ? Number(searchParams.get("work_id")) : null;
    const token = searchParams.get("token");

    if (token) {
      const [foundWork] = await db.select().from(works).where(eq(works.tokenPublico, token)).limit(1);
      if (!foundWork) {
        return NextResponse.json({ success: false, error: "Obra não encontrada." }, { status: 404 });
      }
      const contacts = await db
        .select()
        .from(workContacts)
        .where(eq(workContacts.workId, foundWork.id));
      return NextResponse.json({ success: true, count: contacts.length, data: contacts });
    }

    const session = await readSession(request);
    const companyId = session ? getEffectiveCompanyId(session) : 1;

    let conditions = [eq(workContacts.companyId, companyId)];
    if (workId) {
      conditions.push(eq(workContacts.workId, workId));
    }

    const list = await db
      .select()
      .from(workContacts)
      .where(and(...conditions));

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

    if (!body.workId || !body.nome || !body.cargo) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios: workId, nome e cargo." },
        { status: 400 }
      );
    }

    const [newContact] = await db
      .insert(workContacts)
      .values({
        workId: Number(body.workId),
        companyId,
        nome: body.nome,
        cargo: body.cargo,
        telefone: body.telefone || null,
        email: body.email || null,
      })
      .returning();

    return NextResponse.json({ success: true, data: newContact });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
