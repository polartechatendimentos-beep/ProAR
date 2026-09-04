import { UserSession } from "./proar-auth";

export function assertCompanyAccess(session: UserSession, targetCompanyId?: number | null): number {
  const userCompanyId = session.companyId || 1;

  if (session.role === "superadmin" || session.role === "manager") {
    return targetCompanyId ? Number(targetCompanyId) : userCompanyId;
  }

  if (targetCompanyId && Number(targetCompanyId) !== userCompanyId) {
    throw new Error("Acesso negado: Você não possui autorização para operar dados desta empresa/filial.");
  }

  return userCompanyId;
}

export function getEffectiveCompanyId(session: UserSession, requestedCompanyId?: number | null): number {
  if ((session.role === "superadmin" || session.role === "manager") && requestedCompanyId) {
    return Number(requestedCompanyId);
  }
  return session.companyId || 1;
}
