export type FriendlyErrorContext = {
  status?: number;
  fallback?: string;
};

const DEFAULT_MESSAGE = "Não foi possível concluir esta operação. Tente novamente.";
const NETWORK_MESSAGE = "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
const TIMEOUT_MESSAGE = "A operação demorou mais que o esperado. Tente novamente.";
const DATABASE_MESSAGE = "Não foi possível acessar os dados do sistema neste momento. Tente novamente.";
const PERMISSION_MESSAGE = "Você não possui permissão para realizar esta operação.";
const SESSION_MESSAGE = "Sua sessão expirou. Entre novamente no sistema.";
const CONFLICT_MESSAGE = "Este registro foi alterado por outro usuário. Atualize a tela e tente novamente.";

export function technicalErrorDetail(input: unknown) {
  if (input instanceof Error) return input.stack || input.message;
  if (typeof input === "string") return input;
  try { return JSON.stringify(input); } catch { return String(input ?? ""); }
}

function rawMessage(input: unknown) {
  if (input instanceof Error) return input.message;
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const value = input as Record<string, unknown>;
    for (const key of ["error","message","detail","reason"]) {
      if (typeof value[key] === "string" && value[key]) return String(value[key]);
    }
  }
  return "";
}

export function friendlyErrorMessage(input: unknown, context: FriendlyErrorContext = {}) {
  const fallback = context.fallback || DEFAULT_MESSAGE;
  const original = rawMessage(input).trim();
  const value = original.toLocaleLowerCase("pt-BR");
  const status = Number(context.status || 0);

  if (status === 401 || /unauthorized|sess[aã]o inv[aá]lida|jwt.*expir|token.*expir/.test(value)) return SESSION_MESSAGE;
  if (status === 403 || /forbidden|permission denied|sem permiss[aã]o|acesso negado/.test(value)) {
    if (/sistema bloqueado|system_blocked/.test(value)) return "Sistema bloqueado. Entre em contato com a equipe da ProAR.";
    return PERMISSION_MESSAGE;
  }
  if (status === 409 || /conflict|conflito|revision|vers[aã]o mais recente|duplicate key/.test(value)) return CONFLICT_MESSAGE;
  if (status === 408 || status === 504 || /timeout|timed out|aborted|aborterror|tempo limite|excedeu .*segundos/.test(value)) return TIMEOUT_MESSAGE;
  if (status >= 500 || /econnreset|econnrefused|database|postgres|supabase|neon|relation .* does not exist|connection.*closed|fetch failed/.test(value)) return DATABASE_MESSAGE;
  if (/failed to fetch|networkerror|network request failed|load failed|internet|offline/.test(value)) return NETWORK_MESSAGE;

  if (/rate limit|too many requests|429/.test(value)) return "Muitas solicitações foram feitas em pouco tempo. Aguarde um momento e tente novamente.";
  if (/payload too large|413|request entity too large/.test(value)) return "O arquivo ou conteúdo enviado é maior que o permitido.";
  if (/unsupported media|415/.test(value)) return "O formato do arquivo enviado não é suportado.";
  if (/not found|404|n[aã]o encontrado|n[aã]o localizado/.test(value)) return "O registro ou recurso solicitado não foi encontrado.";

  // Mensagens já escritas para o usuário podem passar, desde que não pareçam resposta técnica/bruta.
  const looksTechnical =
    !original ||
    /^\s*[\[{]/.test(original) ||
    /<!doctype|<html|stack trace|traceback|at \w+.*\(|typeerror|referenceerror|syntaxerror|internal server error|unexpected token|request id|error code[:=]|status code[:=]|openai|anthropic|assistant|system prompt|tool call|function call/i.test(original) ||
    /\b(GET|POST|PUT|PATCH|DELETE)\s+\/api\//i.test(original) ||
    /https?:\/\/[^\s]+\/rest\/v1\//i.test(original);

  if (looksTechnical) return fallback;

  const cleaned = original
    .replace(/\s+/g, " ")
    .replace(/\b(?:request|trace|correlation)[-_ ]?id\s*[:=]\s*[\w-]+/gi, "")
    .trim();

  if (!cleaned || cleaned.length > 240) return fallback;
  return cleaned;
}

export async function friendlyResponseError(response: Response, fallback = DEFAULT_MESSAGE) {
  let payload: unknown = "";
  try { payload = await response.clone().json(); }
  catch {
    try { payload = await response.clone().text(); } catch {}
  }
  return friendlyErrorMessage(payload, { status: response.status, fallback });
}
