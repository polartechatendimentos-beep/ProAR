import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return true;
  if (digits.length === 11) {
    if (/^(\d)\1+$/.test(digits)) return false;
    const calc = (length: number) => {
      const sum = digits.slice(0, length).split("").reduce((total, n, i) => total + Number(n) * (length + 1 - i), 0);
      const rest = (sum * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
  }
  if (digits.length === 14) {
    if (/^(\d)\1+$/.test(digits)) return false;
    const check = (base: string, weights: number[]) => {
      const sum = base.split("").reduce((total, n, i) => total + Number(n) * weights[i], 0);
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };
    return check(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[12]) &&
      check(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[13]);
  }
  return false;
}

function toCustomer(body: Record<string, unknown>) {
  const document = clean(body.documento, 32).replace(/\D/g, "");
  const tipoPessoa = clean(body.tipoPessoa, 2).toUpperCase() || (document.length === 14 ? "PJ" : "PF");
  return {
    tipoPessoa,
    nome: clean(body.nome, 180),
    nomeFantasia: clean(body.nomeFantasia, 180) || null,
    documento: document || null,
    email: clean(body.email, 180).toLowerCase() || null,
    telefone: clean(body.telefone, 32) || null,
    whatsapp: clean(body.whatsapp, 32) || null,
    cep: clean(body.cep, 12).replace(/\D/g, "") || null,
    logradouro: clean(body.logradouro, 180) || null,
    numero: clean(body.numero, 32) || null,
    complemento: clean(body.complemento, 120) || null,
    bairro: clean(body.bairro, 120) || null,
    cidade: clean(body.cidade, 120) || null,
    uf: clean(body.uf, 2).toUpperCase() || null,
    observacoes: clean(body.observacoes, 2000) || null,
    ativo: body.ativo === undefined ? true : Boolean(body.ativo),
  };
}

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
  try {
    const url = new URL(request.url);
    const companyId = getEffectiveCompanyId(session, url.searchParams.has("company_id") ? Number(url.searchParams.get("company_id")) : null);
    const search = (url.searchParams.get("q") || "").trim().slice(0, 100);
    const filters = [eq(customers.companyId, companyId)];
    if (search) filters.push(or(ilike(customers.nome, `%${search}%`), ilike(customers.documento, `%${search.replace(/\D/g, "")}%`))!);
    const data = await db.select().from(customers).where(and(...filters)).orderBy(desc(customers.atualizadoEm)).limit(100);
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Falha ao consultar clientes." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null);
    const data = toCustomer(body);
    if (!data.nome) return NextResponse.json({ success: false, error: "Nome ou razão social é obrigatório." }, { status: 400 });
    if (!validCpfCnpj(data.documento || "")) return NextResponse.json({ success: false, error: "CPF/CNPJ inválido. Confira os números informados." }, { status: 400 });
    if (data.documento) {
      const [duplicate] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.companyId, companyId), eq(customers.documento, data.documento))).limit(1);
      if (duplicate) return NextResponse.json({ success: false, error: "Já existe um cliente desta empresa com esse CPF/CNPJ." }, { status: 409 });
    }
    const [created] = await db.insert(customers).values({ ...data, companyId }).returning();
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Falha ao cadastrar cliente." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    const companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ success: false, error: "ID do cliente inválido." }, { status: 400 });
    const data = toCustomer(body);
    if (!data.nome) return NextResponse.json({ success: false, error: "Nome ou razão social é obrigatório." }, { status: 400 });
    if (!validCpfCnpj(data.documento || "")) return NextResponse.json({ success: false, error: "CPF/CNPJ inválido. Confira os números informados." }, { status: 400 });
    if (data.documento) {
      const [duplicate] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.companyId, companyId), eq(customers.documento, data.documento))).limit(1);
      if (duplicate && duplicate.id !== id) return NextResponse.json({ success: false, error: "Já existe outro cliente desta empresa com esse CPF/CNPJ." }, { status: 409 });
    }
    const [updated] = await db.update(customers).set({ ...data, atualizadoEm: new Date() }).where(and(eq(customers.id, id), eq(customers.companyId, companyId))).returning();
    if (!updated) return NextResponse.json({ success: false, error: "Cliente não encontrado nesta empresa." }, { status: 404 });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Falha ao atualizar cliente." }, { status: 400 });
  }
}
