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
  const tone=payload.tone ?? inferFeedbackTone(payload.message);
  window.dispatchEvent(new CustomEvent<FeedbackMessage>(feedbackEventName,{
    detail:{
      ...payload,
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
