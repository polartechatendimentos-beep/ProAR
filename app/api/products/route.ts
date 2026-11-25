import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function decimal(value: unknown, field: string) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${field} deve ser um número igual ou maior que zero.`);
  return parsed.toFixed(2);
}

function toProduct(body: Record<string, unknown>) {
  const tipo = clean(body.tipo, 20).toUpperCase() || "PRODUTO";
  const descricao = clean(body.descricao, 240);
  const codigo = clean(body.codigo, 64).toUpperCase();
  const unidade = clean(body.unidade, 8).toUpperCase() || (tipo === "SERVICO" || tipo === "SERVIÇO" ? "SV" : "UN");
  const estoqueAtual = Number(String(body.estoqueAtual ?? "0").replace(",", "."));
  const estoqueMinimo = Number(String(body.estoqueMinimo ?? "0").replace(",", "."));
  if (!Number.isFinite(estoqueAtual) || estoqueAtual < 0 || !Number.isFinite(estoqueMinimo) || estoqueMinimo < 0) {
    throw new Error("Estoque atual e mínimo devem ser números iguais ou maiores que zero.");
  }
  if (!["PRODUTO", "SERVICO", "SERVIÇO"].includes(tipo)) throw new Error("Tipo deve ser Produto ou Serviço.");
  if (!/^[A-Z0-9._/-]{1,64}$/.test(codigo)) throw new Error("Informe um código com letras, números ou . _ / -.");
  if (!/^[A-Z0-9]{1,8}$/.test(unidade)) throw new Error("Informe uma unidade válida, por exemplo UN, M, KG ou SV.");
  if (body.ncm && !/^\d{8}$/.test(clean(body.ncm, 16))) throw new Error("O NCM deve conter exatamente 8 números.");
  return {
    codigo,
    codigoBarras: clean(body.codigoBarras, 64) || null,
    descricao,
    tipo: tipo === "SERVIÇO" ? "SERVICO" : tipo,
    unidade,
    ncm: clean(body.ncm, 8) || null,
    custo: decimal(body.custo, "Custo"),
    precoVenda: decimal(body.precoVenda, "Preço de venda"),
    estoqueAtual: estoqueAtual.toFixed(3),
    estoqueMinimo: estoqueMinimo.toFixed(3),
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
    const filters = [eq(products.companyId, companyId)];
    if (search) filters.push(or(ilike(products.codigo, `%${search}%`), ilike(products.codigoBarras, `%${search}%`), ilike(products.descricao, `%${search}%`))!);
    const data = await db.select().from(products).where(and(...filters)).orderBy(desc(products.atualizadoEm)).limit(100);
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Falha ao consultar catálogo." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null);
    const data = toProduct(body);
    if (!data.descricao) return NextResponse.json({ success: false, error: "Descrição do produto ou serviço é obrigatória." }, { status: 400 });
    const [duplicate] = await db.select({ id: products.id }).from(products).where(and(eq(products.companyId, companyId), eq(products.codigo, data.codigo))).limit(1);
    if (duplicate) return NextResponse.json({ success: false, error: "Já existe um produto ou serviço com esse código nesta empresa." }, { status: 409 });
    const [created] = await db.insert(products).values({ ...data, companyId }).returning();
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Falha ao cadastrar item." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    const companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ success: false, error: "ID do item inválido." }, { status: 400 });
    const data = toProduct(body);
    if (!data.descricao) return NextResponse.json({ success: false, error: "Descrição do produto ou serviço é obrigatória." }, { status: 400 });
    const [duplicate] = await db.select({ id: products.id }).from(products).where(and(eq(products.companyId, companyId), eq(products.codigo, data.codigo))).limit(1);
    if (duplicate && duplicate.id !== id) return NextResponse.json({ success: false, error: "Já existe outro produto ou serviço com esse código nesta empresa." }, { status: 409 });
    const [updated] = await db.update(products).set({ ...data, atualizadoEm: new Date() }).where(and(eq(products.id, id), eq(products.companyId, companyId))).returning();
    if (!updated) return NextResponse.json({ success: false, error: "Item não encontrado nesta empresa." }, { status: 404 });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Falha ao atualizar item." }, { status: 400 });
  }
}
