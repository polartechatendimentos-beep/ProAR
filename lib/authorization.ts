import type { UserSession } from "@/lib/proar-auth";

const normalizeRole = (role: string) => role.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export const PERMISSIONS = {
  WORK_CREATE: new Set(["administrador", "gerencia", "admin", "superadmin", "manager"]),
  WORK_UPDATE: new Set(["administrador", "gerencia", "admin", "superadmin", "manager"]),
  WORK_STATUS_UPDATE: new Set(["administrador", "gerencia", "admin", "superadmin", "manager"]),
  WORK_MAP_PUBLISH: new Set(["administrador", "gerencia", "admin", "superadmin", "manager"]),
  WORK_FINDING_REVIEW: new Set(["administrador", "gerencia", "admin", "superadmin", "manager"]),
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(session: UserSession, permission: Permission) {
  return PERMISSIONS[permission].has(normalizeRole(session.role));
}

export function authorizationError(session: UserSession, permission: Permission) {
  if (can(session, permission)) return null;
  return { status: 403, error: `Perfil ${session.role || "não identificado"} não autorizado para esta operação.` };
}
