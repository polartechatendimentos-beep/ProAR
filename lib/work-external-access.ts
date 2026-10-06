export type WorkExternalAccessRecord = {
  id: string;
  name: string;
  role: "Engenheiro" | "Fiscal";
  username: string;
  passwordHash: string;
  active: boolean;
  createdAt: string;
};

export type WorkExternalAccessMutation =
  | { action: "external_access_add"; workId: string; access: WorkExternalAccessRecord }
  | { action: "external_access_toggle"; workId: string; accessId: string; active: boolean };

export type WorkExternalAccessMutationResult =
  | { ok: true; projects: Record<string, unknown>[]; externalAccess: WorkExternalAccessRecord[]; changed: boolean }
  | { ok: false; status: number; code: string; error: string };

const text = (value: unknown) => String(value ?? "").trim();
const normalizeUsername = (value: unknown) => text(value).toLocaleLowerCase("pt-BR");

function normalizeAccess(value: unknown): WorkExternalAccessRecord | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const id = text(source.id);
  const name = text(source.name);
  const username = normalizeUsername(source.username);
  const role = text(source.role);
  const passwordHash = text(source.passwordHash).toLowerCase();
  const createdAt = text(source.createdAt);

  if (!id || id.length > 140) return null;
  if (!name || name.length > 160) return null;
  if (!["Engenheiro", "Fiscal"].includes(role)) return null;
  if (!/^[a-z0-9._-]{3,60}$/i.test(username)) return null;
  if (!/^[a-f0-9]{64}$/i.test(passwordHash)) return null;
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) return null;

  return {
    id,
    name,
    role: role as WorkExternalAccessRecord["role"],
    username,
    passwordHash,
    active: source.active !== false,
    createdAt,
  };
}

function currentAccessList(project: Record<string, unknown>) {
  if (!Array.isArray(project.externalAccess)) return [] as WorkExternalAccessRecord[];
  return project.externalAccess.map(normalizeAccess).filter((item): item is WorkExternalAccessRecord => Boolean(item));
}

export function mutateWorkExternalAccess(
  inputProjects: unknown[],
  mutation: WorkExternalAccessMutation,
): WorkExternalAccessMutationResult {
  if (!Array.isArray(inputProjects)) {
    return { ok: false, status: 400, code: "WORK_PROJECTS_INVALID", error: "Lista de obras inválida." };
  }

  const workId = text(mutation.workId);
  const projects = inputProjects.map(project => project && typeof project === "object" ? { ...(project as Record<string, unknown>) } : {});
  const index = projects.findIndex(project => text(project.id) === workId);

  if (index < 0) {
    return { ok: false, status: 404, code: "WORK_PROJECT_NOT_FOUND", error: "Obra não encontrada." };
  }

  const project = projects[index];
  const current = currentAccessList(project);

  if (mutation.action === "external_access_add") {
    const access = normalizeAccess(mutation.access);
    if (!access) {
      return {
        ok: false,
        status: 400,
        code: "WORK_EXTERNAL_ACCESS_INVALID",
        error: "Dados do acesso externo inválidos. Revise nome, função, usuário e senha.",
      };
    }

    const sameId = current.find(item => item.id === access.id);
    if (sameId) {
      if (sameId.username === access.username) {
        return { ok: true, projects, externalAccess: current, changed: false };
      }
      return {
        ok: false,
        status: 409,
        code: "WORK_EXTERNAL_ACCESS_ID_CONFLICT",
        error: "Identificador do acesso já utilizado nesta obra.",
      };
    }

    if (current.some(item => normalizeUsername(item.username) === access.username)) {
      return {
        ok: false,
        status: 409,
        code: "WORK_EXTERNAL_ACCESS_USERNAME_EXISTS",
        error: "Este usuário já possui acesso cadastrado nesta obra.",
      };
    }

    const externalAccess = [access, ...current];
    projects[index] = { ...project, externalAccess };
    return { ok: true, projects, externalAccess, changed: true };
  }

  const accessId = text(mutation.accessId);
  const targetIndex = current.findIndex(item => item.id === accessId);
  if (targetIndex < 0) {
    return {
      ok: false,
      status: 404,
      code: "WORK_EXTERNAL_ACCESS_NOT_FOUND",
      error: "Acesso externo não encontrado nesta obra.",
    };
  }

  if (current[targetIndex].active === mutation.active) {
    return { ok: true, projects, externalAccess: current, changed: false };
  }

  const externalAccess = current.map((item, itemIndex) =>
    itemIndex === targetIndex ? { ...item, active: mutation.active } : item,
  );
  projects[index] = { ...project, externalAccess };
  return { ok: true, projects, externalAccess, changed: true };
}
