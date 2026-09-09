import { NextResponse } from "next/server";
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { works, workExternalAccess } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";
import { hashPassword } from "@/lib/password";

function sanitizeAccess(record: any, workToken?: string, origin?: string) {
  return {
    id: record.id,
    companyId: record.companyId,
    workId: record.workId,
    accessTokenId: record.accessTokenId,
    nome: record.nome,
    empresa: record.empresa,
    telefone: record.telefone,
    email: record.email,
    funcao: record.funcao,
    tipo: record.tipo,
    enabled: record.enabled,
    allowLinkAccess: record.allowLinkAccess,
    lastAccessAt: record.lastAccessAt,
    criadoEm: record.criadoEm,
    atualizadoEm: record.atualizadoEm,
    accessLink: workToken && origin ? `${origin}/obra/${workToken}?access=${record.accessTokenId}` : null,
  };
}

export async function GET(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });

    const { searchParams, origin } = new URL(request.url);
    const workId = searchParams.get("work_id") ? Number(searchParams.get("work_id")) : null;
    const requestedCompanyId = searchParams.get("company_id") ? Number(searchParams.get("company_id")) : null;
    const companyId = getEffectiveCompanyId(session, requestedCompanyId);

    if (workId) {
      const [work] = await db.select().from(works).where(eq(works.id, workId)).limit(1);
      if (!work || work.companyId !== companyId) {
        return NextResponse.json({ success: false, error: "Obra não encontrada." }, { status: 404 });
      }

      const list = await db
        .select()
        .from(workExternalAccess)
        .where(eq(workExternalAccess.workId, workId))
        .orderBy(desc(workExternalAccess.criadoEm));

      return NextResponse.json({
        success: true,
        count: list.length,
        data: list.map((item) => sanitizeAccess(item, work.tokenPublico, origin)),
      });
    }

    const list = await db
      .select()
      .from(workExternalAccess)
      .where(eq(workExternalAccess.companyId, companyId))
      .orderBy(desc(workExternalAccess.criadoEm));

    return NextResponse.json({ success: true, count: list.length, data: list.map((item) => sanitizeAccess(item)) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });

    const body = await request.json();
    const companyId = assertCompanyAccess(session, body.companyId);

    if (!body.workId || !body.tipo || !body.nome || !body.funcao || !body.senha) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios: workId, tipo, nome, função e senha." },
        { status: 400 }
      );
    }

    const tipo = String(body.tipo).toLowerCase();
    if (!["engenharia", "fiscalizacao"].includes(tipo)) {
      return NextResponse.json({ success: false, error: "tipo deve ser engenharia ou fiscalizacao." }, { status: 400 });
    }

    const [work] = await db.select().from(works).where(eq(works.id, Number(body.workId))).limit(1);
    if (!work || work.companyId !== companyId) {
      return NextResponse.json({ success: false, error: "Obra não encontrada." }, { status: 404 });
    }

    const passwordHash = hashPassword(String(body.senha));
    const now = new Date();
    const accessTokenId = crypto.randomBytes(16).toString("hex");

    const [existing] = await db
      .select()
      .from(workExternalAccess)
      .where(and(eq(workExternalAccess.workId, work.id), eq(workExternalAccess.tipo, tipo)))
      .limit(1);

    let saved: any;
    if (existing) {
      const [updated] = await db
        .update(workExternalAccess)
        .set({
          nome: body.nome,
          empresa: body.empresa || null,
          telefone: body.telefone || null,
          email: body.email || null,
          funcao: body.funcao,
          passwordHash,
          enabled: body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled,
          allowLinkAccess: body.allowLinkAccess !== undefined ? Boolean(body.allowLinkAccess) : existing.allowLinkAccess,
          updatedBy: session.id,
          atualizadoEm: now,
        })
        .where(eq(workExternalAccess.id, existing.id))
        .returning();
      saved = updated;
    } else {
      const [inserted] = await db
        .insert(workExternalAccess)
        .values({
          companyId,
          workId: work.id,
          accessTokenId,
          nome: body.nome,
          empresa: body.empresa || null,
          telefone: body.telefone || null,
          email: body.email || null,
          funcao: body.funcao,
          tipo,
          passwordHash,
          enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
          allowLinkAccess: body.allowLinkAccess !== undefined ? Boolean(body.allowLinkAccess) : true,
          createdBy: session.id,
          updatedBy: session.id,
          criadoEm: now,
          atualizadoEm: now,
        })
        .returning();
      saved = inserted;
    }

    const { origin } = new URL(request.url);
    return NextResponse.json({
      success: true,
      data: sanitizeAccess(saved, work.tokenPublico, origin),
      message: "Acesso externo salvo com sucesso.",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });

    const body = await request.json();
    const companyId = assertCompanyAccess(session, body.companyId);

    let target: any = null;
    if (body.id) {
      [target] = await db.select().from(workExternalAccess).where(eq(workExternalAccess.id, Number(body.id))).limit(1);
    } else if (body.workId && body.tipo) {
      [target] = await db
        .select()
        .from(workExternalAccess)
        .where(and(eq(workExternalAccess.workId, Number(body.workId)), eq(workExternalAccess.tipo, String(body.tipo).toLowerCase())))
        .limit(1);
    }

    if (!target || target.companyId !== companyId) {
      return NextResponse.json({ success: false, error: "Credencial externa não encontrada." }, { status: 404 });
    }

    const action = String(body.action || "update");
    const updates: any = { updatedBy: session.id, atualizadoEm: new Date() };

    if (action === "block") updates.enabled = false;
    if (action === "unblock") updates.enabled = true;
    if (action === "toggle_link") updates.allowLinkAccess = Boolean(body.allowLinkAccess);
    if (action === "reset_password") {
      if (!body.novaSenha) {
        return NextResponse.json({ success: false, error: "novaSenha é obrigatória." }, { status: 400 });
      }
      updates.passwordHash = hashPassword(String(body.novaSenha));
    }
    if (action === "regenerate_link") {
      updates.accessTokenId = crypto.randomBytes(16).toString("hex");
    }

    if (action === "update") {
      if (body.nome !== undefined) updates.nome = body.nome;
      if (body.empresa !== undefined) updates.empresa = body.empresa;
      if (body.telefone !== undefined) updates.telefone = body.telefone;
      if (body.email !== undefined) updates.email = body.email;
      if (body.funcao !== undefined) updates.funcao = body.funcao;
      if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);
      if (body.allowLinkAccess !== undefined) updates.allowLinkAccess = Boolean(body.allowLinkAccess);
    }

    const [saved] = await db.update(workExternalAccess).set(updates).where(eq(workExternalAccess.id, target.id)).returning();
    const [work] = await db.select().from(works).where(eq(works.id, target.workId)).limit(1);
    const { origin } = new URL(request.url);

    return NextResponse.json({ success: true, data: sanitizeAccess(saved, work?.tokenPublico, origin) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
