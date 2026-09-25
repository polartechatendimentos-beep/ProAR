import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { systemState } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Sessão inválida." }, { status: 401 });
  const key = `catalog:products:${session.companyId || 1}`;
  const rows = await db.select().from(systemState).where(eq(systemState.chave, key)).limit(1);
  const value = rows[0]?.valor;
  const products = Array.isArray(value) ? value : [];
  return NextResponse.json({ success: true, products });
}
