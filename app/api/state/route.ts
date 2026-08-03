import { NextResponse } from "next/server";
import { db } from "@/db";
import { systemState } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chave = searchParams.get("chave");

  if (!chave) {
    return NextResponse.json({ error: "Parâmetro chave obrigatório" }, { status: 400 });
  }

  try {
    const result = await db.select().from(systemState).where(eq(systemState.chave, chave)).limit(1);
    return NextResponse.json({ success: true, data: result[0]?.valor || null });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
