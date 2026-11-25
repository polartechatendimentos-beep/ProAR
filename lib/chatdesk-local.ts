import type { DeliveryStatus, PendingDeliveryReceipt } from "./chatdesk-delivery";

export const chatSectors = ["Geral", "Técnico", "Financeiro", "Comercial", "PMOC"] as const;
export type ChatSector = typeof chatSectors[number];
export const chatStages = ["Novo contato", "Em atendimento", "Orçamento", "Aguardando cliente", "Concluído"] as const;
export type ChatStage = typeof chatStages[number];
export type ChatMessage = { id: string; direction: "in" | "out" | "note" | "event"; text: string; at: string; actor?: string; status?: string; providerMessageId?: string; assistantReplyKey?: string; assistantNudge?: boolean; replyToId?: string; deliveryStatus?: DeliveryStatus };
export type ChatConversation = { companyId: string; phone: string; name: string; sector: ChatSector; stage: ChatStage; assignee: string; revision: number; botPaused: boolean; optOut: boolean; messages: ChatMessage[]; requests: string[]; updatedAt: string; orderId?: string; assistantHandoffAt?: string; pendingDeliveryReceipts?: PendingDeliveryReceipt[]; queueActivity?: { incoming?: ChatMessage; humanReplyAt?: string; lastOutbound?: Pick<ChatMessage, "at" | "status" | "deliveryStatus"> } };
export type ChatActor = { username: string; displayName: string; role: string; sectors: ChatSector[]; writeSectors: ChatSector[]; canWrite: boolean; admin: boolean };
export type LocalChatSettings = { companyId: string; revision: number; botEnabled: boolean; botActivatedAt?: string; botTestPhone?: string; companyName: string; greeting: string; quickReplies?: ChatQuickReply[] };
const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const isNudge = (text: string) => /^[.…]+$/u.test(text.trim());
const leakIntent = /\b(?:ping(?:a|ando|ou)|gotej(?:a|ando|ou)|vazando(?: agua)?|vazamento de agua|(?:cai|caindo|escorre|escorrendo) agua)\b/;
export function localTriage(text: string) {
  const value = normalized(text);
  const urgent = /(?:cheiro de queimad|fumaca|faisca|choque eletric|curto.circuito|fio(?:s)? (?:esta(?:o)? )?derretend|disjuntor (?:esta )?(?:desarmand|caind)|tomada (?:esta )?(?:esquentand|derretend))/.test(value);
  const optOut = /(?:nao (?:quero|desejo) (?:mais )?receber|nao (?:me )?(?:mande|envie) mais mensagens|pare de (?:me )?enviar|pare de mandar mensagens|retire meu (?:numero|contato)|cancelar (?:as )?mensagens|remover meu (?:numero|contato))/.test(value) || /^(?:sair|parar|stop|cancelar)[.!\s]*$/.test(value.trim());
  const matches: [ChatSector, RegExp][] = [["Financeiro", /boleto|\bpix\b|nota fiscal|cobranca|pagamento|financeiro/], ["PMOC", /\bpmoc\b|contrato|laudo|preventiva|certificado/], ["Comercial", /orcamento|preco|comprar|venda|instalacao/], ["Técnico", /nao gela|pingando|pinga\b|gotejando|goteja\b|caindo agua|escorrendo agua|vazando|vazamento|erro|defeito|barulho|manutencao|higienizacao|limpeza do ar|parou de gelar/]];
  const found = matches.filter(([, expression]) => expression.test(value)).map(([sector]) => sector);
  const sector: ChatSector = urgent || leakIntent.test(value) ? "Técnico" : found[0] || "Geral";
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

const leakInside = /\b(?:evaporadora|unidade interna|unidade de dentro|parte de dentro|aparelho interno|por dentro|parte interna|dentro do (?:quarto|imovel|ambiente|apartamento)|dentro de casa)\b/;
const leakOutside = /\b(?:condensadora|unidade externa|unidade de fora|parte de fora|aparelho externo|por fora|parte externa|lado de fora|fora de casa)\b/;
const leakWhen = /\b(?:quando (?:liga|desliga)|so (?:quando|a noite|de manha)|o tempo todo|direto|desde (?:ontem|hoje)|a noite|de manha)\b/;
const equipmentDetail = /\b(?:marca|modelo|etiqueta|fujitsu|carrier|gree|elgin|samsung|midea|daikin|philco|tcl|lg|agr[aá]tto|[0-9]{1,3}(?:[. ][0-9]{3})?\s*btus?)\b/;
const applianceIdentity = /\b(?:fujitsu|carrier|gree|elgin|samsung|midea|daikin|philco|tcl|lg|agratto|consul|electrolux|springer|hitachi|komeco|panasonic)\b|\bmodelo\s*[:−-]?\s*[a-z]{1,7}[- ]?\d{2,}[a-z0-9-]*\b/;
const placeDetail = /\b(?:(?:moro|sou|estou|fica) (?:em|de|no|na)\s+[a-z]{2,}|(?:cidade(?: de)?|bairro|rua|avenida)\s+[a-z]{2,}|mirassol|rio preto|balsamo|jaci|olimpia|tanabi|bady bassitt)\b/;
const serviceSite = /\b(?:escola(?: municipal| estadual)?|creche|emei|emef|colegio|clinica|unidade de saude|ubs|prefeitura|empresa)\b/;
const siteNameKnown = /\blocal de atendimento identificado\b|\b(?:escola(?: municipal| estadual)?|creche|emei|emef|colegio|clinica|ubs)\s+(?!municipal\b|estadual\b|no\b|na\b|em\b|do\b|da\b|de\b|aqui\b|centro\b|bairro\b|que\b|esta\b|fica\b)[a-z]{2,}(?:\s+[-a-z]+)?/;
const serviceRoom = /\b(?:sala de aula|sala\s+(?:[0-9]{1,3}[a-z]?|d[ao]s?\s+[a-z]+)|secretaria|recepcao|diretoria|biblioteca|cozinha|refeitorio|laboratorio|setor de atendimento)\b/;
const localCity = /\b(?:mirassol|[a-z ]{0,13}rio preto|balsamo|jaci|olimpia|tanabi|bady bassitt|neves paulista|sao jose do rio preto)\b|\b(?:cidade(?: de)?|(?:sou|moro) (?:de|em)|estou em)\s+(?!(?:casa|na|no|uma?|escola|bairro|centro|atendimento)\b)[a-z]{2,}/;
const localNeighborhood = /\b(?:bairro\s+[a-z]{2,}|centro|bairro informado)\b/;
const installationIntent = /\b(?:instalacao|instalar|instalam)\b/;
const capacityDetail = /\b(?:[0-9]{1,3}(?:[. ][0-9]{3})?\s*btus?|[0-9]{1,2}\s*(?:mil|k))\b/;
const infrastructureDetail = /\b(?:tubulacao|infraestrutura|cobre|ponto eletrico|nao tem nada|sem infra)\b/;
const leakingReplies = {
  where: "A água está saindo da unidade de dentro ou da unidade de fora?",
  clarify: "Só para confirmar: é na unidade de dentro, na de fora ou nas duas?",
  inside: "Certo, está pingando pela unidade de dentro. Em qual cidade e bairro fica o aparelho?",
  outside: "Entendi, está saindo do lado de fora. Acontece com o aparelho ligado ou só depois de desligar?",
  both: "Entendi, está saindo água nas duas unidades. Isso acontece com o aparelho ligado ou depois que desliga?",
  place: "Em qual cidade e bairro fica o aparelho?",
  city: "E em qual cidade fica o aparelho?",
  neighborhood: "E em qual bairro fica o aparelho?",
  "site-name": "Qual é o nome da unidade onde fica o aparelho?",
  school: "Qual é o nome da escola?",
  "site-room": "Em qual sala ou setor fica o aparelho?",
  brand: "Você sabe a marca ou o modelo do aparelho? Se for mais fácil, pode mandar uma foto da etiqueta.",
  complete: "Obrigado! Com essas informações, a equipe técnica pode avaliar o próximo passo.",
} as const;

/** Expand a short answer only when a prior, related question gives it meaning. */
function interpretChatAnswers(active: ChatMessage[], eventPosition: number) {
  let question: ChatMessage | undefined;
  const revised = new Map<string, { value: string; clarifyLocation: boolean }>();
  for (const message of active.slice(0, eventPosition + 1)) {
    if (message.direction === "out") {
      question = message.actor === "local-assistant"
        && (!message.status || message.status === "accepted" || message.deliveryStatus === "delivered" || message.deliveryStatus === "read")
        && message.deliveryStatus !== "failed" ? message : undefined;
      continue;
    }
    if (message.direction !== "in") continue;
    const original = normalized(message.text);
    if (isNudge(original)) continue;
    const answer = original.trim().replace(/[.!?,…\s]+$/gu, "");
    const key = question?.assistantReplyKey;
    const timely = question && Math.floor(Date.parse(message.at)/1000) >= Math.floor(Date.parse(question.at)/1000);
    let value = original, clarifyLocation = false;
    if (timely && (key === "leak:where" || key === "leak:clarify")) {
      if (/^(?:(?:e|na|no|do|pela|pelo)\s+)*(?:a\s+|de\s+)?(?:dentro|interna|interno|lado de dentro)$/.test(answer)) value = "unidade de dentro";
      else if (/^(?:(?:e|na|no|do|pela|pelo)\s+)*(?:a\s+|de\s+)?(?:fora|externa|externo|lado de fora)$/.test(answer)) value = "unidade de fora";
      else if (/^(?:(?:nas|nos|em)\s+)?(?:(?:as|os)\s+)?(?:duas|dois|ambas|ambos)$|^dentro e fora$/.test(answer)) value = "unidade de dentro e unidade de fora";
      else if (/^(?:sim|nao|isso|acho que sim|nao sei)$/.test(answer)) clarifyLocation = true;
    } else if (timely && (key === "leak:outside" || key === "leak:both")) {
      if (/^(?:so )?(?:(?:com (?:ele|o aparelho) |quando esta ))?ligad[oa]$/.test(answer)) value = "quando liga";
      else if (/^(?:so )?(?:(?:com (?:ele|o aparelho) |quando esta ))?desligad[oa]$/.test(answer)) value = "quando desliga";
    } else if (timely && /^installation:[01]{2}0$/.test(key || "")) {
      if (/^(?:sim|ja tem|tem sim|ja existe)$/.test(answer)) value = "ja tem tubulacao de cobre";
      else if (/^(?:nao|nao tem|nao tenho|ainda nao)$/.test(answer)) value = "nao tem tubulacao de cobre";
    } else if (timely && (key === "leak:school" || key === "leak:site-name")
      && /^(?:[a-z][a-z0-9.'’-]*\s+){1,8}[a-z0-9.'’-]+$/.test(answer)
      && !/^(?:(?:eu )?nao\b|(?:pode|consegue|por favor|qual)\b|(?:escola|creche|colegio) (?:municipal|estadual)$)/.test(answer)
      && localTriage(answer).sector === "Geral" && !localTriage(answer).optOut
      && !placeDetail.test(answer) && !customerFollowUp.test(answer) && !equipmentDetail.test(answer)) {
      // Remember that the requested name was provided without reprinting it.
      value = "local de atendimento identificado";
    } else if (timely && key === "leak:site-room" && /^(?:sala\s+)?[0-9]{1,3}[a-z]?$/.test(answer)) {
      value = "setor de atendimento";
    } else if (timely && key === "leak:neighborhood"
      && /^(?:jardim|vila|parque|residencial|loteamento)\s+[a-z]/.test(answer)) {
      value = "bairro informado";
    }
    revised.set(message.id, { value, clarifyLocation });
    // A question is bound to the next inbound turn, not an arbitrary later text.
    question = undefined;
  }
  return revised;
}

/** Select a reply only when it advances this conversation; never quote user input. */
export function eventReplyPlan(messages: ChatMessage[], eventId: string, activatedAt: string, now = Date.now()) {
  const activation = Date.parse(activatedAt);
  const event = messages.find(message => message.id === eventId && message.direction === "in");
  if (!event || !Number.isFinite(activation) || Date.parse(event.at) < activation) return null;
  const nudge = isNudge(event.text);
  // A new punctuation-only follow-up may use recent history from before a
  // rollout. Only the new event can send; no old messages are replayed.
  const history = messages.slice(0, messages.indexOf(event));
  const lastHuman = history.findLastIndex(message => message.direction === "out" && message.actor !== "local-assistant");
  const priorNudge = history.slice(lastHuman + 1).findLast(message => message.direction === "out" && message.actor === "local-assistant" && message.assistantNudge);
  const resumedAt = Date.parse(priorNudge?.at || "");
  const continuing = !nudge && resumedAt >= Math.max(activation, now - 15 * 60_000);
  const since = nudge ? now - 45 * 60_000
    : continuing ? resumedAt - 45 * 60_000
    : Math.max(activation, now - 30 * 60_000);
  let active = (continuing ? messages.slice(lastHuman + 1) : messages).filter(message => Date.parse(message.at) >= since);
  if (nudge) {
    const pos = active.indexOf(event);
    if (pos < 0 || active.slice(pos + 1).some(message => message.direction === "in" || message.direction === "out")) return null;
    const recentHuman = active.slice(0, pos).findLastIndex(message => message.direction === "out" && message.actor !== "local-assistant");
    active = active.slice(recentHuman + 1);
    const turns = active.slice(0, pos - recentHuman - 1);
    const lastDetail = turns.findLastIndex(message => message.direction === "in" && /[\p{L}\p{N}]/u.test(message.text)
      && !message.text.startsWith("Mensagem sem texto."));
    if (lastDetail < 0 || turns.slice(lastDetail + 1).some(message => message.assistantNudge)) return null;
    if (event.replyToId) {
      const quote = turns.findIndex(message => message.id === event.replyToId || message.providerMessageId === event.replyToId);
      // Match only stored same-chat messages, never re-use provider-embedded quoted text.
      if (quote < 0 || !["in", "out"].includes(turns[quote].direction)) return null;
      const newerTopic = turns.slice(quote + 1).some(message => message.direction === "in"
        && (leakIntent.test(normalized(message.text)) || installationIntent.test(normalized(message.text))));
      if (newerTopic) return null;
    }
  }
  const eventPosition = active.indexOf(event);
  if (eventPosition < 0) return null;
  const bots = active.filter(message => message.actor === "local-assistant" && message.direction === "out");
  const recent = bots.filter(message => now - Date.parse(message.at) < 5 * 60_000);
  const triage = localTriage(event.text);
  if (triage.optOut) return null;
  const interpreted = interpretChatAnswers(active, eventPosition);
  const read = (message: ChatMessage) => interpreted.get(message.id)?.value ?? normalized(message.text);
  const value = read(event);
  const lastQuestion = active.slice(0, eventPosition).findLast(message => message.direction === "out");
  const lastKey = lastQuestion?.actor === "local-assistant" ? lastQuestion.assistantReplyKey || "" : "";
  const asksForPerson = /\b(?:falar com (?:uma pessoa|um humano|um atendente|a equipe|o tecnico|um tecnico)|atendimento humano|(?:pode|consegue|por favor) me ligar|me liga(?:m|r)?|quero um atendente)\b/.test(value);
  const cannotAnswer = /^(?:(?:eu )?nao (?:sei|lembro)(?: (?:a marca|o modelo|o nome|o bairro|a cidade|a sala|o setor))?|nao tenho certeza|nao consigo (?:ver|conferir))[.!?,…\s]*$/u.test(value.trim());
  const unresolvedQuestion = /^(?:leak:(?:clarify|inside|outside|both|place|city|neighborhood|school|site-name|site-room|brand)|installation:[01]{3})$/.test(lastKey);
  if (!triage.urgent && (asksForPerson || (cannotAnswer && unresolvedQuestion)) && !bots.some(message => message.assistantReplyKey === "handoff")) {
    return { key: "handoff", reply: "Tudo bem. Deixei a conversa para a equipe continuar daqui.", first: bots.length === 0, handoff: true as const };
  }
  if (value === normalized(event.text) && !interpreted.get(event.id)?.clarifyLocation
    && /^(?:sim|nao|dentro|fora|interna|externa|ligad[oa]|desligad[oa])[.!?,…\s]*$/u.test(value.trim())) return null;
  if (!triage.urgent && triage.sector === "Geral" && customerFollowUp.test(value) && !leakInside.test(value) && !leakOutside.test(value) && !equipmentDetail.test(value) && !placeDetail.test(value)) return null;
  const inbound = active.slice(0, eventPosition + 1).filter(message => message.direction === "in" && Date.parse(message.at) <= Date.parse(event.at));
  const idx = inbound.findIndex(message => leakIntent.test(normalized(message.text)));
  const clarifyLocation = interpreted.get(event.id)?.clarifyLocation === true;
  const leakTopic = (nudge && idx >= 0) || leakIntent.test(value) || (idx >= 0 && (clarifyLocation || leakInside.test(value) || leakOutside.test(value) || leakWhen.test(value) || equipmentDetail.test(value) || applianceIdentity.test(value) || placeDetail.test(value) || localNeighborhood.test(value) || serviceSite.test(value) || siteNameKnown.test(value) || serviceRoom.test(value)));
  const installationIndex = inbound.reduce((last, message, index) => installationIntent.test(normalized(message.text)) ? index : last, -1);
  const installationTopic = installationIntent.test(value) || (installationIndex >= 0
    && (nudge || capacityDetail.test(value) || placeDetail.test(value) || infrastructureDetail.test(value))
    && (idx < 0 || installationIndex > idx));
  if (nudge && !leakTopic && !installationTopic) return null;
  // Give material, deduplicated steps room to progress without making
  // generic replies more frequent or replaying a question.
  if (recent.length >= (leakTopic || installationTopic ? 8 : 4) && !triage.urgent) return null;
  let key = "sector:" + triage.sector, reply = triage.reply;
  if (triage.urgent) key = "urgent";
  else if (leakTopic && !(nudge && installationTopic) && triage.sector !== "Financeiro" && triage.sector !== "PMOC") {
    const facts = (idx < 0 ? inbound : inbound.slice(idx)).map(read).join("\n");
    const inside = leakInside.test(facts), outside = leakOutside.test(facts);
    const locationKnown = inside || outside;
    const situationKnown = leakWhen.test(facts);
    const applianceKnown = applianceIdentity.test(facts);
    const cityKnown = localCity.test(facts);
    const neighborhoodKnown = localNeighborhood.test(facts);
    const institution = serviceSite.test(facts);
    const school = /\b(?:escola|creche|emei|emef|colegio)\b/.test(facts);
    const step = !locationKnown ? (clarifyLocation ? "clarify" : "where")
      : institution && !siteNameKnown.test(facts) ? (school ? "school" : "site-name")
      : institution && !serviceRoom.test(facts) ? "site-room"
      : !cityKnown && !neighborhoodKnown && inside && !outside ? "inside"
      : outside && !situationKnown && !cityKnown && !neighborhoodKnown ? (inside ? "both" : "outside")
      : !cityKnown && !neighborhoodKnown ? "place"
      : !cityKnown ? "city"
      : !neighborhoodKnown ? "neighborhood"
      : !institution && !applianceKnown ? "brand" : "complete";
    key = "leak:" + step;
    reply = leakingReplies[step];
    if ((!nudge || step === "complete") && bots.some(message => message.assistantReplyKey === key)) return null;
  } else if (installationTopic && ["Comercial", "Geral"].includes(triage.sector)) {
    const facts = inbound.slice(Math.max(0, installationIndex)).map(read).join("\n");
    const capacityKnown = capacityDetail.test(facts);
    const placeKnown = placeDetail.test(facts);
    const infrastructureKnown = infrastructureDetail.test(facts);
    key = `installation:${Number(capacityKnown)}${Number(placeKnown)}${Number(infrastructureKnown)}`;
    const missing = [
      !capacityKnown && "a capacidade do aparelho em BTUs",
      !placeKnown && "a cidade e o bairro",
      !infrastructureKnown && "se já há tubulação de cobre instalada",
    ].filter(Boolean);
    reply = missing.length
      ? `Para preparar seu orçamento de instalação, pode informar ${missing.join(", ").replace(/, ([^,]+)$/, " e $1")}?`
      : "Obrigado pelos detalhes da instalação. A equipe pode usar esses dados para avaliar o orçamento. O valor depende da conferência do local e dos materiais necessários.";
    if ((!nudge || key === "installation:111") && bots.some(message => message.assistantReplyKey === key)) return null;
  } else if (triage.sector === "Geral" && bots.length) return null;
  else if (triage.sector === "Geral" && /^(?:oi+|ola|bom dia|boa tarde|boa noite)(?:[!.?,\s]*(?:tudo bem|tudo bom))?[!.?,\s]*$/.test(value.trim())) {
    reply = "Oi! Como posso ajudar com seu ar-condicionado?";
  }
  if (recent.some(message => (message.assistantReplyKey === key || message.text.endsWith(reply))
    && (!nudge || now - Date.parse(message.at) < 60_000 || message.status === "processing" || message.status === "unknown"))) return null;
  if (recent.length && !triage.urgent && !leakTopic && !installationTopic && recent.some(message => !message.assistantReplyKey)) return null;
  const handoff = key === "leak:complete" || key === "installation:111";
  return { key, reply: handoff ? "Obrigado! Deixei seu atendimento para a equipe conferir e dar continuidade." : bots.length ? reply.replace(/^Olá!\s*/, "") : reply, first: bots.length === 0, handoff, nudge };
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
    case "claim": if (next.assignee && next.assignee !== actor.username && !actor.admin) throw new Error("Atendimento já atribuído. Solicite transferência ao responsável."); next.assignee = actor.username; next.botPaused = true; delete next.assistantHandoffAt; next.stage = "Em atendimento"; event(`${actor.displayName} assumiu o atendimento.`); break;
    case "transfer": {
      if (!chatSectors.includes(command.sector as ChatSector)) throw new Error("Selecione um setor válido.");
      const previous = next.sector; next.sector = command.sector as ChatSector; next.assignee = ""; next.botPaused = true;
      event(`${actor.displayName} transferiu o atendimento de ${previous} para ${next.sector}.`); break;
    }
    case "stage": if (!chatStages.includes(command.stage as ChatStage)) throw new Error("Etapa inválida."); next.stage = command.stage as ChatStage; if (next.stage === "Concluído") delete next.assistantHandoffAt; event(`Etapa alterada para ${next.stage} por ${actor.displayName}.`); break;
    case "bot": if (typeof command.paused !== "boolean") throw new Error("Estado inválido."); if (next.assignee && next.assignee !== actor.username && !actor.admin) throw new Error("Solicite a liberação ao responsável."); next.botPaused = command.paused; if (!next.botPaused) { next.assignee = ""; delete next.assistantHandoffAt; } event(`Assistente ${next.botPaused ? "pausado" : "liberado"} por ${actor.displayName}.`); break;
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

export type ChatQuickReply = { shortcut: string; sector: ChatSector | "Todos"; text: string };
export const defaultChatQuickReplies: ChatQuickReply[] = [
  {shortcut:"/endereco",sector:"Todos",text:"Pode informar o endereço completo e um ponto de referência para o atendimento?"},
  {shortcut:"/etiqueta",sector:"Técnico",text:"Pode enviar uma foto legível da etiqueta do equipamento e informar o sintoma observado?"},
  {shortcut:"/agenda",sector:"Todos",text:"Quais dias e períodos são melhores para você? Vou conferir a disponibilidade na nossa agenda."},
  {shortcut:"/pmoc",sector:"PMOC",text:"Informe a unidade e a quantidade de equipamentos para conferirmos seu atendimento de manutenção e PMOC."},
];
export function validateChatQuickReplies(value: unknown): ChatQuickReply[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error("Cadastre até 30 respostas rápidas.");
  const seen = new Set<string>();
  return value.map(item => {
    if (!item || typeof item !== "object") throw new Error("Resposta rápida inválida.");
    const shortcut = String(item.shortcut || "").trim().toLowerCase();
    const text = String(item.text || "").trim();
    const sector = String(item.sector || "");
    if (!/^\/[a-z0-9_-]{2,24}$/.test(shortcut) || seen.has(shortcut)) throw new Error("Use atalhos únicos como /agenda ou /etiqueta.");
    if (text.length < 3 || text.length > 1200 || !["Todos",...chatSectors].includes(sector)) throw new Error("Informe o setor e um texto de 3 a 1200 caracteres.");
    seen.add(shortcut);
    return {shortcut,text,sector:sector as ChatQuickReply["sector"]};
  });
}
const customerFollowUp = /\b(?:no aguardo|aguardando (?:um |o )?(?:retorno|resposta)|(?:sem|nenhum) retorno|(?:nao|ainda nao) (?:respondeu|responderam|retornou|retornaram)|nao esqueca (?:de mim|do meu)|algum(?:a)? (?:retorno|novidade|posicao)|(?:ninguem|nada) (?:ainda|apareceu|retornou)|(?:faz|tem) .{1,24}que (?:estou esperando|estou aguardando))\b/;
const lastHumanReplyAt = (chat: ChatConversation) => chat.messages.findLast(message =>
  message.direction === "out" && message.actor !== "local-assistant" && message.deliveryStatus !== "failed" && (!message.status || message.status === "accepted")
)?.at;
const recentDay = (at: number, now: number) => Number.isFinite(at) && Number.isFinite(now) && now >= at && now - at < 24 * 60 * 60_000;

export function chatQueuePriority(chat: ChatConversation, nowMs: number) {
  const lastCustomer = chat.queueActivity?.incoming || chat.messages.findLast(message => message.direction === "in");
  const humanReplyAt = chat.queueActivity ? chat.queueActivity.humanReplyAt : lastHumanReplyAt(chat);
  const lastOutbound = chat.queueActivity ? chat.queueActivity.lastOutbound : chat.messages.findLast(message => message.direction === "out");
  const customerAt = Date.parse(lastCustomer?.at || "");
  const open = chat.stage !== "Concluído";
  const waiting = open && Number.isFinite(customerAt) && (!humanReplyAt || customerAt > Date.parse(humanReplyAt));
  const elapsed = waiting && Number.isFinite(nowMs) ? Math.max(0, nowMs - customerAt) : 0;
  const urgent = Boolean(waiting && lastCustomer && localTriage(lastCustomer.text).urgent);
  const followUp = Boolean(waiting && lastCustomer && recentDay(customerAt, nowMs) && customerFollowUp.test(normalized(lastCustomer.text)));
  const handoff = Boolean(waiting && !chat.assignee && chat.assistantHandoffAt && !chat.optOut);
  const outboundAt = Date.parse(lastOutbound?.at || "");
  const deliveryIssue = open && recentDay(outboundAt, nowMs) && lastOutbound
    ? lastOutbound.deliveryStatus === "failed" || lastOutbound.status === "disconnected" ? "failed"
      : !lastOutbound.deliveryStatus && (lastOutbound.status === "unknown" || (lastOutbound.status === "processing" && nowMs - outboundAt >= 2 * 60_000)) ? "uncertain"
        : null
    : null;
  return { waiting, urgent, followUp, handoff, deliveryIssue, waitingMinutes: Math.floor(elapsed / 60000), band: !open ? 4 : urgent ? 0 : followUp || handoff || deliveryIssue ? 1 : waiting ? 2 : 3 };
}
export function sortChatQueue(items: ChatConversation[], nowMs: number) {
  return [...items].sort((a,b)=>{const first=chatQueuePriority(a,nowMs),second=chatQueuePriority(b,nowMs);return first.band-second.band || second.waitingMinutes-first.waitingMinutes || Date.parse(b.updatedAt)-Date.parse(a.updatedAt);});
}
export function chatQueueSummary(chat: ChatConversation): ChatConversation {
  // Internal notes and receipt buffering never leave the summary or count as a public reply.
  const { pendingDeliveryReceipts: _pending, ...visible } = chat;
  const incoming = chat.messages.findLast(message => message.direction === "in");
  const outbound = chat.messages.findLast(message => message.direction === "out");
  const lastOutbound = outbound && { at: outbound.at, status: outbound.status, deliveryStatus: outbound.deliveryStatus };
  return { ...visible, messages: chat.messages.filter(message=>message.direction==="in"||message.direction==="out").slice(-1), requests: [], queueActivity: { incoming, humanReplyAt: lastHumanReplyAt(chat), lastOutbound } };
}
