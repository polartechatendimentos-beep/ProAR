import { localTriage, type ChatConversation } from "./chatdesk-local";

/** Zero-token-cost reply assistant. Always drafts; never sends messages. */
export function suggestChatReply(chat: ChatConversation, expectedCompanyId: string) {
 if (!expectedCompanyId || chat.companyId !== expectedCompanyId) throw new Error("Atendimento de outra empresa.");
 const last = chat.messages.filter(m => m.direction === "in").at(-1);
 if (!last?.text.trim()) return { text: "", mode: "local-rules" as const, warning: "Nenhuma mensagem do cliente para responder." };
 const result = localTriage(last.text);
 const greeting = chat.name.trim() ? `Olá, ${chat.name.trim().slice(0,60)}! ` : "Olá! ";
 const text = result.optOut ? "Entendido. Registramos seu pedido para não receber mensagens automáticas. Um responsável poderá confirmar o atendimento, se necessário." : greeting + result.reply.replace(/^Olá!\s*/,"");
 return { text, mode: "local-rules" as const, warning: result.urgent ? "Possível risco elétrico: revisão humana obrigatória antes do envio." : "Sugestão automática baseada em regras; revise antes de enviar." };
}
