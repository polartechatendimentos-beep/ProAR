import { NextRequest } from "next/server";
import { readSession } from "./proar-auth";

type ProarSession = NonNullable<ReturnType<typeof readSession>>;

export type Permission =
  | "obras.visualizar" | "obras.editar" | "obras.status.alterar"
  | "os.visualizar" | "os.editar"
  | "equipamentos.visualizar" | "equipamentos.editar"
  | "financeiro.visualizar" | "financeiro.editar" | "financeiro.baixar" | "financeiro.estornar"
  | "licitacoes.visualizar" | "licitacoes.editar" | "licitacoes.lance.registrar"
  | "configuracoes.visualizar" | "configuracoes.editar"
  | "clientes.visualizar" | "clientes.editar"
  | "estoque.visualizar" | "estoque.editar" | "estoque.ajustar"
  | "compras.visualizar" | "compras.editar" | "compras.receber"
  | "comercial.editar" | "catalogo.editar" | "financeiro.conciliar"
  | "integridade.visualizar";

const legacy: Record<string, string[]> = {
  obras: ["Obras"],
  os: ["Ordens de Serviço", "OS"],
  equipamentos: ["Equipamentos"],
  financeiro: ["Financeiro"],
  licitacoes: ["Licitações"],
  configuracoes: ["Configurações"],
  clientes: ["Clientes"],
  estoque: ["Estoque", "Produtos"],
  compras: ["Compras", "Fornecedores"],
  comercial: ["Vendas", "Orçamentos"],
  catalogo: ["Produtos", "Serviços"],
  integridade: ["Integridade do Sistema"],
};

export function sessionFromRequest(request: NextRequest) {
  return readSession(request.cookies.get("proar_session")?.value);
}

export function hasPermission(session: ProarSession | null, permission: Permission) {
  if (!session) return false;
  if (session.role === "Administrador" || session.permissions.includes("*")) return true;
  const [module] = permission.split(".");
  const explicit = session.permissions.includes(permission);
  const legacyModule = (legacy[module] || []).some(item => session.permissions.includes(item));
  if (!explicit && !legacyModule) return false;
  // Perfis externos nunca herdam mutações sensíveis apenas por permissão legada de módulo.
  if (["Fiscal", "Engenheiro"].includes(session.role) && /\.editar$|\.alterar$|\.baixar$|\.estornar$|\.registrar$|\.ajustar$|\.receber$|\.conciliar$/.test(permission)) {
    return explicit;
  }
  return true;
}

export function requirePermission(request: NextRequest, permission: Permission) {
  const session = sessionFromRequest(request);
  if (!session) return { ok: false as const, status: 401, error: "Sessão inválida." };
  if (!hasPermission(session, permission)) return { ok: false as const, status: 403, error: "Você não possui permissão para esta ação." };
  return { ok: true as const, session };
}

export function sessionCompany(session: ProarSession, requested?: unknown) {
  const companyId = String(session.companyId || "").trim();
  if (!companyId) return { ok: false as const, status: 401, error: "Sessão de empresa inválida." };
  const requestedId = String(requested || "").trim();
  if (requestedId && requestedId !== companyId) return { ok: false as const, status: 403, error: "Acesso negado para outra empresa." };
  return { ok: true as const, companyId };
}
