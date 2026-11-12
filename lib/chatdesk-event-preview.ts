/** Side-effect-free customer communication previews.
 * This module must never send messages, approve budgets or mutate an OS.
 */
export type ProarEventKind = "os-scheduled" | "os-on-the-way" | "os-completed" | "quote-ready" | "pmoc-due";
export type ProarEventInput = { companyId: string; customerCompanyId: string; kind: ProarEventKind; customerName: string; reference: string; dateLabel?: string; locationLabel?: string; optOut: boolean; consent: boolean };
export type ProarEventPreview = { allowed: boolean; reason?: string; text?: string; requiresHumanApproval: true };
const clean = (value: string, max = 100) => String(value || "").replace(/[\r\n\t]+/g," ").trim().slice(0,max);
export function previewProarEvent(input: ProarEventInput): ProarEventPreview {
  if (!input.companyId || input.companyId !== input.customerCompanyId) return { allowed:false,reason:"Empresa do registro incompatível.",requiresHumanApproval:true };
  if (input.optOut || !input.consent) return { allowed:false,reason:"Contato sem autorização válida para mensagens automáticas.",requiresHumanApproval:true };
  const name = clean(input.customerName), ref = clean(input.reference,70), date = clean(input.dateLabel), location = clean(input.locationLabel);
  if (!name || !ref) return { allowed:false,reason:"Identificação do cliente ou referência ausente.",requiresHumanApproval:true };
  const messages: Record<ProarEventKind,string> = {
    "os-scheduled": `Olá, ${name}. O atendimento referente à OS ${ref} foi agendado${date ? ` para ${date}` : ""}. Confirme os detalhes com nossa equipe.`,
    "os-on-the-way": `Olá, ${name}. Nossa equipe registrou deslocamento para a OS ${ref}${location ? `, local ${location}` : ""}. O horário de chegada pode variar.`,
    "os-completed": `Olá, ${name}. A OS ${ref} foi registrada como concluída. Caso precise de suporte, responda a esta conversa.`,
    "quote-ready": `Olá, ${name}. Seu orçamento ${ref} está disponível para análise. A aprovação depende de sua confirmação no canal oficial.`,
    "pmoc-due": `Olá, ${name}. Existe uma preventiva PMOC prevista para a referência ${ref}${date ? ` em ${date}` : ""}. Nossa equipe confirmará a programação.`,
  };
  if (!Object.prototype.hasOwnProperty.call(messages,input.kind)) return { allowed:false,reason:"Evento desconhecido.",requiresHumanApproval:true };
  return { allowed:true,text:messages[input.kind],requiresHumanApproval:true };
}
