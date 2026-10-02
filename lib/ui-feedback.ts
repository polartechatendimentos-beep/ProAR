function safeFeedbackError(message:string, fallback="Não foi possível concluir esta operação. Tente novamente.") {
  const value=String(message||"").trim();
  const lower=value.toLocaleLowerCase("pt-BR");
  if (/sistema bloqueado/.test(lower)) return "Sistema bloqueado. Entre em contato com a equipe da ProAR.";
  if (/unauthorized|sess[aã]o.*expir|jwt.*expir/.test(lower)) return "Sua sessão expirou. Entre novamente no sistema.";
  if (/forbidden|permission denied|sem permiss[aã]o|acesso negado/.test(lower)) return "Você não possui permissão para realizar esta operação.";
  if (/conflict|conflito|revision|duplicate key/.test(lower)) return "Este registro foi alterado por outro usuário. Atualize a tela e tente novamente.";
  if (/timeout|timed out|aborterror|tempo limite/.test(lower)) return "A operação demorou mais que o esperado. Tente novamente.";
  if (/failed to fetch|networkerror|network request failed|offline/.test(lower)) return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  if (/database|postgres|supabase|neon|econnreset|econnrefused|fetch failed/.test(lower)) return "Não foi possível acessar os dados do sistema neste momento. Tente novamente.";
  if (!value || /^\s*[\[{]/.test(value) || /<!doctype|<html|stack trace|traceback|typeerror|referenceerror|syntaxerror|internal server error|openai|anthropic|assistant|system prompt|tool call|function call|status code[:=]/i.test(value)) return fallback;
  return value.length>240?fallback:value.replace(/\s+/g," ").trim();
}

export type FeedbackTone = "success" | "error" | "warning" | "info";

export type FeedbackMessage = {
  id?: string;
  title?: string;
  message: string;
  tone?: FeedbackTone;
  duration?: number;
  detail?: string;
};

export const feedbackEventName = "proar:notify";

const defaultTitle: Record<FeedbackTone,string> = {
  success: "Operação concluída",
  error: "Não foi possível concluir",
  warning: "Atenção",
  info: "Informação",
};

export function inferFeedbackTone(message: string): FeedbackTone {
  const value=message.toLocaleLowerCase("pt-BR");
  if (/falha|erro|não foi possível|inval|bloquead|indisponível|não localizado/.test(value)) return "error";
  if (/atenção|conflito|sem internet|pendente|aguard|alerta/.test(value)) return "warning";
  if (/sucesso|salv|grav|criad|cadastrad|atualizad|alterad|exclu|removid|confirmad|conclu|sincronizad|emitid|aprovad|recebid/.test(value)) return "success";
  return "info";
}

export function notifyFeedback(input: FeedbackMessage | string) {
  if (typeof window === "undefined") return;
  const payload: FeedbackMessage = typeof input === "string" ? { message: input } : input;
  const safeMessage = payload.tone === "error" || inferFeedbackTone(payload.message) === "error" ? safeFeedbackError(payload.message) : payload.message;
  const safeDetail = payload.detail ? safeFeedbackError(payload.detail, "Detalhes técnicos registrados para suporte.") : payload.detail;
  const tone=payload.tone ?? inferFeedbackTone(safeMessage);
  window.dispatchEvent(new CustomEvent<FeedbackMessage>(feedbackEventName,{
    detail:{
      ...payload,
      message:safeMessage,
      detail:safeDetail,
      id:payload.id ?? `feedback-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      tone,
      title:payload.title ?? defaultTitle[tone],
      duration:payload.duration ?? (tone==="error" ? 6500 : tone==="warning" ? 5200 : 3600),
    }
  }));
}

export const notifySuccess=(message:string,title="Operação concluída",duration=3600)=>notifyFeedback({message,title,tone:"success",duration});
export const notifyError=(message:string,title="Não foi possível concluir",duration=6500)=>notifyFeedback({message,title,tone:"error",duration});
export const notifyWarning=(message:string,title="Atenção",duration=5200)=>notifyFeedback({message,title,tone:"warning",duration});
export const notifyInfo=(message:string,title="Informação",duration=3600)=>notifyFeedback({message,title,tone:"info",duration});
