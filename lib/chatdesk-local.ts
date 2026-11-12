export const chatSectors = ["Geral", "Técnico", "Financeiro", "Comercial", "PMOC"] as const;
export type ChatSector = typeof chatSectors[number];
export const chatStages = ["Novo contato", "Em atendimento", "Orçamento", "Aguardando cliente", "Concluído"] as const;
export type ChatStage = typeof chatStages[number];
export type ChatMessage = { id: string; direction: "in" | "out" | "note" | "event"; text: string; at: string; actor?: string; status?: string; providerMessageId?: string };
export type ChatConversation = { companyId: string; phone: string; name: string; sector: ChatSector; stage: ChatStage; assignee: string; revision: number; botPaused: boolean; optOut: boolean; messages: ChatMessage[]; requests: string[]; updatedAt: string; orderId?: string };
export type ChatActor = { username: string; displayName: string; role: string; sectors: ChatSector[]; writeSectors: ChatSector[]; canWrite: boolean; admin: boolean };
export type LocalChatSettings = { companyId: string; revision: number; botEnabled: boolean; companyName: string; greeting: string };
const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function localTriage(text: string) {
  const value = normalized(text);
  const urgent = /(?:cheiro de queimad|fumaca|faisca|choque eletric|curto.circuito|fio(?:s)? derretend|disjuntor (?:desarmand|caind)|tomada (?:esquentand|derretend))/.test(value);
  const optOut = /(?:nao (?:quero|desejo) (?:mais )?receber|nao (?:me )?(?:mande|envie) mais mensagens|pare de (?:me )?enviar|pare de mandar mensagens|cancelar (?:as )?mensagens|remover meu (?:numero|contato)|retire meu (?:numero|contato))/.test(value) || /^(?:sair|parar|stop|cancelar)[.!\s]*$/.test(value.trim());
  const matches: [ChatSector, RegExp][] = [["Financeiro", /boleto|\bpix\b|nota fiscal|cobranca|pagamento|financeiro/], ["PMOC", /\bpmoc\b|contrato|laudo|preventiva|certificado/], ["Comercial", /orcamento|preco|comprar|venda|instalacao/], ["Técnico", /nao gela|vazando|vazamento|erro|defeito|barulho|manutencao|parou de gelar/]];
  const found = matches.filter(([, expression]) => expression.test(value)).map(([sector]) => sector);
  const sector: ChatSector = urgent ? "Técnico" : found[0] || "Geral";
  const suggestions: Record<ChatSector, string> = {
    Geral: "Olá! Para encaminhar seu atendimento, informe como podemos ajudar e o local do serviço.",
    Técnico: "Olá! Informe a marca, o modelo, o sintoma observado e o local do equipamento. Se possível, envie uma foto da etiqueta e do código exibido. Nossa equipe fará a avaliação técnica.",
    Financeiro: "Olá! Para localizar seu atendimento financeiro, informe o nome do cliente e a referência da OS ou documento. A equipe financeira conferirá a solicitação.",
    Comercial: "Olá! Para preparar seu orçamento, informe o serviço desejado, a capacidade do equipamento e o endereço do atendimento.",
    PMOC: "Olá! Informe a unidade, a quantidade de equipamentos e a necessidade de manutenção ou PMOC. A equipe responsável conferirá os registros e dará continuidade.",
  };
  const reply = optOut ? "Registramos sua solicitação para interromper as mensagens automáticas." : urgent ? "Por segurança, interrompa o uso do equipamento e aguarde a avaliação de um profissional qualificado. Vou encaminhar sua solicitação à equipe técnica." : suggestions[sector];
  return { sector, urgent, optOut, mixed: found.length > 1, reason: urgent ? "Relato de possível risco elétrico." : found.length ? `Termos relacionados a ${found.join(" e ")}.` : "Mensagem sem categoria identificada.", reply, mode: "local-rules" as const };
}
export function chatSignature(actor: ChatActor) {
  return `*${actor.displayName.slice(0, 100)} — ${actor.role.slice(0, 70)}:*`;
}
export function localOrderDraft(chat: ChatConversation) {
  return { client: chat.name, phone: chat.phone, sector: chat.sector, symptoms: chat.messages.filter(message => message.direction === "in").slice(-5).map(message => message.text).join("\n").slice(0, 2500), notes: "Rascunho de solicitação. Confirmar cliente, equipamento, local e agenda antes de abrir a OS. Nenhum diagnóstico ou peça foi confirmado." };
}
export function canReadChat(actor: ChatActor, chat: ChatConversation) { return actor.admin || actor.sectors.includes(chat.sector); }
export function applyChatCommand(chat: ChatConversation, actor: ChatActor, command: { requestId: string; action: string; text?: string; sector?: string; stage?: string; paused?: boolean; orderId?: string }, now: string) {
  if (!canReadChat(actor, chat) || (!actor.admin && !actor.writeSectors.includes(chat.sector))) throw new Error("Acesso negado para este atendimento.");
  if (!/^[a-f0-9-]{36}$/i.test(command.requestId)) throw new Error("Identificação de operação inválida.");
  if (chat.requests.includes(command.requestId)) return { chat, replay: true };
  if (chat.messages.length >= 1500) throw new Error("Este atendimento atingiu o limite do histórico. Solicite arquivamento à gestão.");
  const next = structuredClone(chat);
  const event = (text: string) => next.messages.push({ id: command.requestId, direction: "event", actor: actor.username, at: now, text });
  switch (command.action) {
    case "claim": if (next.assignee && next.assignee !== actor.username && !actor.admin) throw new Error("Atendimento já atribuído. Solicite transferência ao responsável."); next.assignee = actor.username; next.botPaused = true; next.stage = "Em atendimento"; event(`${actor.displayName} assumiu o atendimento.`); break;
    case "transfer": {
      if (!chatSectors.includes(command.sector as ChatSector)) throw new Error("Selecione um setor válido.");
      const previous = next.sector; next.sector = command.sector as ChatSector; next.assignee = ""; next.botPaused = true;
      event(`${actor.displayName} transferiu o atendimento de ${previous} para ${next.sector}.`); break;
    }
    case "stage": if (!chatStages.includes(command.stage as ChatStage)) throw new Error("Etapa inválida."); next.stage = command.stage as ChatStage; event(`Etapa alterada para ${next.stage} por ${actor.displayName}.`); break;
    case "bot": if (typeof command.paused !== "boolean") throw new Error("Estado inválido."); if (next.assignee && next.assignee !== actor.username && !actor.admin) throw new Error("Solicite a liberação ao responsável."); next.botPaused = command.paused; if (!next.botPaused) next.assignee = ""; event(`Assistente ${next.botPaused ? "pausado" : "liberado"} por ${actor.displayName}.`); break;
    case "note": case "send": {
      const text = String(command.text || "").trim();
      if (!text || text.length > 3000) throw new Error("Escreva uma mensagem de até 3.000 caracteres.");
      if (command.action === "send" && next.assignee && next.assignee !== actor.username && !actor.admin) throw new Error("Assuma o atendimento ou solicite transferência ao responsável.");
      if (command.action === "send" && next.optOut) throw new Error("O cliente solicitou a interrupção das mensagens. Confira a solicitação antes de responder.");
      next.messages.push({ id: command.requestId, direction: command.action === "note" ? "note" : "out", text: command.action === "note" ? text : `${chatSignature(actor)}\n${text}`, at: now, actor: actor.username, ...(command.action === "send" ? { status: "processing" } : {}) });
      if (command.action === "send") { next.assignee ||= actor.username; next.botPaused = true; }
      break;
    }
    case "linkOrder": if (!command.orderId) throw new Error("Informe uma OS existente desta empresa."); next.orderId = command.orderId; event(`OS ${command.orderId} vinculada por ${actor.displayName}.`); break;
    case "consent": {
      if (!actor.admin || String(command.text || "").trim().length < 10) throw new Error("Somente a gestão pode registrar a nova autorização, com justificativa.");
      next.optOut = false; next.botPaused = true;
      event(`Nova autorização registrada por ${actor.displayName}: ${String(command.text).trim().slice(0, 500)}. Assistente permanece pausado para conferência.`); break;
    }
    default: throw new Error("Operação inválida.");
  }
  next.requests = [...next.requests, command.requestId].slice(-1500); next.updatedAt = now;
  return { chat: next, replay: false };
}
