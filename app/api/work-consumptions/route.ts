import { NextResponse } from "next/server";
import { db } from "@/db";
import { workConsumptions, works } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";
import { desc, eq, and } from "drizzle-orm";

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
      const consumptions = await db
        .select()
        .from(workConsumptions)
        .where(eq(workConsumptions.workId, foundWork.id))
        .orderBy(desc(workConsumptions.data));
      return NextResponse.json({ success: true, count: consumptions.length, data: consumptions });
    }

    const session = await readSession(request);
    const companyId = session ? getEffectiveCompanyId(session) : 1;

    let conditions = [eq(workConsumptions.companyId, companyId)];
    if (workId) {
      conditions.push(eq(workConsumptions.workId, workId));
    }

    const list = await db
      .select()
      .from(workConsumptions)
      .where(and(...conditions))
      .orderBy(desc(workConsumptions.data));

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

    if (!body.workId || !body.item || !body.quantidade) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios: workId, item e quantidade." },
        { status: 400 }
      );
    }

    const qtd = Number(body.quantidade);
    const unitPrice = body.valorUnitario ? Number(body.valorUnitario) : 0;
    const total = body.valorTotal ? Number(body.valorTotal) : qtd * unitPrice;

    const [newConsumption] = await db
      .insert(workConsumptions)
      .values({
        workId: Number(body.workId),
        companyId,
        item: body.item,
        categoria: body.categoria || "material",
        quantidade: String(qtd),
        unidade: body.unidade || "un",
        valorUnitario: String(unitPrice),
        valorTotal: String(total),
      })
      .returning();

    return NextResponse.json({ success: true, data: newConsumption });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
