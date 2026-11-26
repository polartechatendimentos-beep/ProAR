import type { DeliveryStatus, PendingDeliveryReceipt } from "./chatdesk-delivery";

export const chatSectors = ["Geral", "Técnico", "Financeiro", "Comercial", "PMOC"] as const;
export type ChatSector = typeof chatSectors[number];
export const chatStages = ["Novo contato", "Em atendimento", "Orçamento", "Aguardando cliente", "Concluído"] as const;
export type ChatStage = typeof chatStages[number];
export type ServiceIntake = {
  intents?: ChatIntent[];
  urgent?: boolean;
  updatedAt: string;
  service?: string;
  symptom?: string;
  since?: string;
  city?: string;
  district?: string;
  site?: string;
  address?: string;
  room?: string;
  appliance?: string;
  capacity?: string;
  infrastructure?: string;
  preference?: string;
  media?: string;
  pending: string[];
  lastQuestion?: string;
  responses?: {key:string; text:string; at:string}[];
};
export type ChatMessage = { id: string; direction: "in" | "out" | "note" | "event"; text: string; at: string; actor?: string; status?: string; providerMessageId?: string; assistantReplyKey?: string; assistantNudge?: boolean; hoursNoticeFor?: string; pilotTurn?: boolean; replyToId?: string; mediaKind?: "foto" | "áudio" | "vídeo" | "documento"; deliveryStatus?: DeliveryStatus };
export type ChatConversation = { tags?:string[]; companyId: string; phone: string; name: string; sector: ChatSector; stage: ChatStage; assignee: string; revision: number; botPaused: boolean; optOut: boolean; messages: ChatMessage[]; requests: string[]; updatedAt: string; orderId?: string; assistantHandoffAt?: string; mediaTrial?: Partial<Record<"foto"|"áudio",{id:string;at:string;state:string}>>; intake?: ServiceIntake; pendingDeliveryReceipts?: PendingDeliveryReceipt[]; queueActivity?: { urgent?: boolean; incoming?: ChatMessage; humanReplyAt?: string; lastOutbound?: Pick<ChatMessage, "at" | "status" | "deliveryStatus"> } };
export type ChatActor = { username: string; displayName: string; role: string; sectors: ChatSector[]; writeSectors: ChatSector[]; canWrite: boolean; admin: boolean };
export type LocalChatSettings = { companyId: string; revision: number; botEnabled: boolean; botActivatedAt?: string; botTestPhone?: string; companyName: string; greeting: string; quickReplies?: ChatQuickReply[]; flows?: ChatAutomationFlow[]; businessHours?: BusinessDay[]; followUp?: {enabled:boolean;delayMinutes:number;enabledAt:string} };
const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export type ChatAutomationFlow = { id:string; name:string; enabled:boolean; keywords:string[]; matchMode:"any"|"all"; sector:"Todos"|ChatSector; response:string; targetSector?:ChatSector; targetStage?:ChatStage; addTags?:string[] };
export function validateChatAutomationFlows(value:unknown):ChatAutomationFlow[]{
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>50)throw new Error("Cadastre até 50 automações.");
  const ids=new Set<string>();
  return value.map((raw,index)=>{
    if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error(`Automação ${index+1} inválida.`);
    const flow=raw as Record<string,unknown>,id=String(flow.id||"").trim(),name=String(flow.name||"").trim(),response=String(flow.response||"").trim();
    const keywords=Array.isArray(flow.keywords)?flow.keywords.map(item=>String(item).trim()).filter(Boolean).slice(0,20):[];
    const addTags=Array.isArray(flow.addTags)?[...new Set(flow.addTags.map(item=>String(item).trim()).filter(Boolean))].slice(0,10):[];
    const matchMode=flow.matchMode==="all"?"all":"any",sector=String(flow.sector||"Todos");
    const targetSector=String(flow.targetSector||""),targetStage=String(flow.targetStage||"");
    if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||ids.has(id))throw new Error(`Identificação inválida ou repetida na automação ${index+1}.`);
    if(name.length<2||name.length>80)throw new Error(`Informe um nome de 2 a 80 caracteres na automação ${index+1}.`);
    if(!keywords.length||keywords.some(word=>word.length<2||word.length>80))throw new Error(`Informe de 1 a 20 palavras-chave de 2 a 80 caracteres na automação ${index+1}.`);
    if(response.length<2||response.length>1200)throw new Error(`A resposta da automação ${index+1} deve ter de 2 a 1.200 caracteres.`);
    if(!["Todos",...chatSectors].includes(sector as ChatSector|"Todos"))throw new Error(`Setor inválido na automação ${index+1}.`);
    if(targetSector&&!chatSectors.includes(targetSector as ChatSector))throw new Error(`Setor de destino inválido na automação ${index+1}.`);
    if(targetStage&&!chatStages.includes(targetStage as ChatStage))throw new Error(`Etapa de destino inválida na automação ${index+1}.`);
    if(addTags.some(tag=>tag.length>30))throw new Error(`As etiquetas da automação ${index+1} devem ter até 30 caracteres.`);
    ids.add(id);
    return {id,name,enabled:flow.enabled===true,keywords,matchMode,sector:sector as ChatAutomationFlow["sector"],response,...(targetSector?{targetSector:targetSector as ChatSector}:{}),...(targetStage?{targetStage:targetStage as ChatStage}:{}),...(addTags.length?{addTags}:{})};
  });
}
export function matchChatAutomation(flows:ChatAutomationFlow[]|undefined,text:string,sector:ChatSector){
  const value=normalized(text);
  return (flows||[]).find(flow=>flow.enabled&&(flow.sector==="Todos"||flow.sector===sector)&&flow.keywords.length>0&&(flow.matchMode==="all"?flow.keywords.every(keyword=>value.includes(normalized(keyword))):flow.keywords.some(keyword=>value.includes(normalized(keyword)))))||null;
}
export type ChatIntent = "Orçamento" | "Manutenção" | "Instalação" | "Agendamento" | "Licitação" | "Dúvida geral";
export type BusinessDay = { day:number; opens:string; closes:string };
export function detectChatIntents(text:string):ChatIntent[] {
  const value=normalized(text);
  const patterns:[ChatIntent,RegExp][] = [
    ["Licitação",/\b(?:licitacao|licitacoes|edital|pregao|pncp|compras publicas)\b/],
    ["Agendamento",/\b(?:agendar|agendamento|reagendar|remarcar|cancelar (?:a |o )?(?:visita|horario)|(?:podem|conseguem) vi(?:r|m)|tem como vir)\b/],
    ["Instalação",/\b(?:instalacao|instalam|instalar|desinstalacao|remocao|retirada do aparelho)\b/],
    ["Manutenção",/\b(?:manutencao|higienizacao|pmoc|nao gela|nao liga|barulho|defeito|esta pingando|pingando|pinga|vazamento|gotejando|limpeza do ar|parou de gelar)\b/],
    ["Orçamento",/\b(?:orcamento|preco|quanto (?:custa|fica)|qual (?:e )?o valor|cotacao)\b/],
  ];
  const found=patterns.filter(([,pattern])=>pattern.test(value)).map(([label])=>label);
  return found.length ? found : ["Dúvida geral"];
}
export function validateBusinessHours(raw:unknown):BusinessDay[] {
  if (!Array.isArray(raw) || raw.length>7) throw new Error("Informe até sete dias de expediente.");
  const days = new Set<number>();
  return raw.map((row:BusinessDay)=>{
    const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if(!row || !Number.isInteger(row.day)||row.day<0||row.day>6||days.has(row.day)||typeof row.opens!=="string"||typeof row.closes!=="string"
      || !time.test(row.opens)|| !time.test(row.closes)||row.opens>=row.closes) throw new Error("Horário inválido: informe abertura e fechamento no mesmo dia.");
    days.add(row.day);
    return {day:row.day,opens:row.opens,closes:row.closes};
  });
}
const weekdayLabel=["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
export function businessHoursNotice(hours:BusinessDay[]|undefined, now=new Date()) {
  if (!hours?.length || !Number.isFinite(now.getTime())) return null;
  const fmt=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  for(let offset=0;offset<=7;offset++){
    const parts=Object.fromEntries(fmt.formatToParts(new Date(now.getTime()+offset*86400000)).map(p=>[p.type,p.value]));
    const date=parts.year+"-"+parts.month+"-"+parts.day;
    const day=new Date(date+"T12:00:00Z").getUTCDay();
    const time=parts.hour+":"+parts.minute;
    const window=hours.find(row=>row.day===day);
    if(!window)continue;
    if(offset===0 && time>=window.opens && time<window.closes)return null;
    if(offset===0 && time>=window.opens)continue;
    return {key:date+"T"+window.opens,text:"A equipe está fora do expediente. O próximo expediente começa "+(offset===0?"hoje":weekdayLabel[day])+" às "+window.opens+". Sua solicitação fica registrada por aqui."};
  }
  return null;
}

const isNudge = (text: string) => /^[.…]+$/u.test(text.trim());
const leakIntent = /\b(?:ping(?:a|ando|ano|andu|ou)|gotej(?:a|ando|ou)|vazando(?: agua)?|vazamento de agua|(?:cai|caindo|escorre|escorrendo) agua)\b/;
export function localTriage(text: string) {
  const value = normalized(text);
  const urgent = /(?:agua\s+(?:perto|proxima|caindo)\s+(?:d[oa]s?\s+|n[ao]s?\s+)?(?:tomada|fiacao|componentes? eletricos?|partes? eletricas?)|cheiro de queimad|fumaca|faisca|choque eletric|curto.circuito|fio(?:s)? (?:esta(?:o)? )?derretend|disjuntor (?:esta )?(?:desarmand|caind)|tomada (?:esta )?(?:esquentand|derretend))/.test(value);
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
const siteNameKnown = /\b(?:rua|avenida|av\.|travessa|alameda)\s+[^\n,;!?]{3,90}[, ]+\d{1,6}\b|\blocal de atendimento identificado\b|\b(?:escola(?: municipal| estadual)?|creche|emei|emef|colegio|clinica|ubs)\s+(?!municipal\b|estadual\b|no\b|na\b|em\b|do\b|da\b|de\b|aqui\b|centro\b|bairro\b|que\b|esta\b|fica\b)[a-z]{2,}(?:\s+[-a-z]+)?/;
const serviceRoom = /\b(?:sala de aula|sala\s+(?:(?:infantil\s+)?[0-9]{1,3}[a-z]?|d[ao]s?\s+[a-z]+)|secretaria|recepcao|diretoria|biblioteca|cozinha|refeitorio|laboratorio|setor de atendimento)\b/;
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

const mediaPlaceholder = (message: ChatMessage) => normalized(message.text).startsWith("mensagem sem texto.");
const schoolQuestion = (key?: string) => ["leak:school","leak:school-after-room","leak:site-name"].includes(key || "");
const genericSite = (value: string) => /^(?:escola|creche|colegio)(?: municipal| estadual)?(?: (?:de|em|do|da) (?:balsamo|mirassol|jaci|olimpia|tanabi|rio preto|sao jose do rio preto|bady bassitt|neves paulista))?[.!\s]*$/.test(normalized(value));
const acceptedQuestion = (message: ChatMessage) => message.direction === "out" && message.actor === "local-assistant"
  && message.deliveryStatus !== "failed" && (!message.status || message.status === "accepted" || message.deliveryStatus === "delivered" || message.deliveryStatus === "read");
const quotedQuestion = (history: ChatMessage[], event: ChatMessage) => event.replyToId ? history.findLast(message =>
  (message.id === event.replyToId || message.providerMessageId === event.replyToId) && acceptedQuestion(message)
  && Date.parse(event.at) >= Math.floor(Date.parse(message.at)/1000)*1000 && Date.parse(event.at) - Date.parse(message.at) <= 30 * 60_000) : undefined;

/** Expand a short answer only when a prior, related question gives it meaning. */
function interpretChatAnswers(active: ChatMessage[], eventPosition: number) {
  let question: ChatMessage | undefined;
  const revised = new Map<string, { value: string; clarifyLocation: boolean }>();
  for (const [index, message] of active.slice(0, eventPosition + 1).entries()) {
    if (message.direction === "out") {
      question = acceptedQuestion(message) ? message : undefined;
      continue;
    }
    if (message.direction !== "in") continue;
    const original = normalized(message.text);
    if (isNudge(original) || mediaPlaceholder(message)) continue;
    const answer = original.trim().replace(/[.!?,…\s]+$/gu, "");
    const related = message.replyToId ? quotedQuestion(active.slice(0,index),message) : question;
    const key = related?.assistantReplyKey;
    const timely = related && Math.floor(Date.parse(message.at)/1000) >= Math.floor(Date.parse(related.at)/1000);
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
    } else if (timely && schoolQuestion(key)
      && /^(?:[a-z][a-z0-9.'’-]*\s+){0,8}[a-z][a-z0-9.'’-]{2,}$/.test(answer)
      && !genericSite(answer) && !serviceRoom.test(answer) && !/^(?:sim|isso|centro|obrigad[oa]|beleza|entendi|valeu)$/.test(answer)
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

const serviceAside = (value:string) => /\b(?:voces (?:fazem|faz|atendem|trabalham com)|tambem (?:fazem|faz|atendem)|tem (?:servico|como fazer))\b|^(?:fazem|faz|e sobre|tambem tem)\b/.test(value)
  && /\b(?:instalacao|instalam|higienizacao|limpeza|manutencao|pmoc)\b/.test(value);
const visitAside = (value:string) => /\b(?:como funciona|o que e|para que serve|o que (?:fazem|e feito) na)\b.*\b(?:visita|avaliacao)\b|\b(?:na visita tecnica|na avaliacao tecnica)\b.*\b(?:o que|como)\b/.test(value);
const detailCorrection = /\b(?:corrigindo|correcao|na verdade|retificando|mudei|o correto|endereco novo|novo endereco|endereco certo|troquei|e outro)\b/;
const worried = (value:string) => /\b(?:estou|to|ficamos|fiquei|muito) (?:bem |muito )?(?:preocupad[oa]s?|irritad[oa]s?|chatead[oa]s?|nervos[oa]s?|indignad[oa]s?)\b|\b(?:estou com medo|to com medo|e urgente|muita urgencia|preciso urgente|nao posso esperar|ninguem me responde|ja falei (?:isso|duas vezes)|ja (?:mandei|passei) (?:isso|esses dados))\b/.test(value);
const usefulQuestion = (text?:string) => text?.match(/(?:^|[.!?]\s+)([^.!?]+\?)\s*$/u)?.[1]?.trim();
export function recordIntakeReply(intake:ServiceIntake|undefined,key:string,text:string,at:string,hold:boolean) {
  if (!intake) return intake;
  const question = usefulQuestion(text);
  return {...intake,lastQuestion:hold ? undefined : question || intake.lastQuestion,
    responses:[...(intake.responses || []).slice(-7),{key,text:text.slice(0,320),at}]};
}

const intakeLocalCities = /\b(?:são josé do rio preto|rio preto|mirassol|bálsamo|balsamo|jaci|olímpia|olimpia|tanabi|bady bassitt|neves paulista)\b/iu;
const compact = (value?: string) => value?.trim().replace(/[\s.,!?]+$/u, "").slice(0, 200) || undefined;

/** Evidence for staff review, not an address lookup or a confirmed diagnosis. */
export function updateServiceIntake(previous: ServiceIntake | undefined, messages: ChatMessage[], eventId: string): ServiceIntake | undefined {
  const index = messages.findIndex(message => message.direction === "in" && message.id === eventId);
  if (index < 0) return previous;
  const event = messages[index];
  if (previous && Date.parse(event.at) < Date.parse(previous.updatedAt)) return previous;
  const chat = messages.slice(0, index);
  const before = event.replyToId ? quotedQuestion(chat,event) : chat.findLast(acceptedQuestion);
  const facts: ServiceIntake = previous && Date.parse(event.at) - Date.parse(previous.updatedAt) <= 24 * 60 * 60_000
    ? {...previous, pending: []} : {updatedAt: event.at, pending: []};
  const value = event.text.trim();
  const clue = normalized(value);
  const prompt = before?.assistantReplyKey;
  const recentPrompt = before && Math.abs(Date.parse(event.at) - Date.parse(before.at)) < 30 * 60_000;
  const correcting = detailCorrection.test(clue);
  const labels=detectChatIntents(value).filter(label=>label!=="Dúvida geral");
  if(labels.length) facts.intents=Array.from(new Set([...(facts.intents || []),...labels]));
  facts.urgent ||= localTriage(value).urgent;
  const aside = Boolean((facts.symptom || facts.service) && (serviceAside(clue) || visitAside(clue)));
  const standalone = /^[\p{L}\p{N}][\p{L}\p{N} .'-]{0,70}$/u.test(value) && !/^(?:oi|sim|não|nao|ok|obrigad[oa]|não sei|nao sei)$/iu.test(value);
  if (!aside && (leakIntent.test(clue) || /\b(?:nao gela|nao esta gelando|parou de gelar|nao liga|barulho|cheiro de queimado|agua perto|falha|erro|higienizacao|limpeza do ar|manutencao)\b/.test(clue))) {
    facts.symptom = compact(value);
    facts.service = /\b(?:higienizacao|limpeza do ar)\b/.test(clue) ? "Higienização" : "Avaliação técnica";
  }
  else if (!aside && installationIntent.test(clue) && (!facts.symptom || correcting)) { facts.service = "Instalação"; facts.symptom = undefined; }
  const namedCity = value.match(/(?:sou de|moro em|cidade de)\s+([\p{L}][\p{L} '’-]{1,55}?)(?=\s*(?:,|\bbairro\b|\/|[.!?]|$))/iu)?.[1];
  const bareDistrict = value.replace(intakeLocalCities, "").trim();
  const namedDistrict = bareDistrict.match(/\bbairro\s+([\p{L}][\p{L} '’-]{1,55})(?=[,.!?/]|$)/iu)?.[1];
  const namedSite = value.match(/\b(?:escola|creche|emei|emef|colégio|clínica|ubs|prefeitura)\b[^,;!?\n]{0,90}/iu)?.[0];
  const knownCity = !namedSite || namedCity ? value.match(intakeLocalCities)?.[0] : undefined;
  const namedRoom = value.match(/\b(?:sala\s+(?:de aula|(?:infantil\s+)?[0-9]{1,3}[a-z]?|d[ao]s?\s+[\p{L}]+)|secretaria|recepção|diretoria|biblioteca|cozinha|refeitório|laboratório)\b/iu)?.[0];
  const address = value.match(/\b(?:rua|avenida|av\.|estrada|travessa|alameda)\s+[^\n!?;]{3,125}/iu)?.[0];
  if (knownCity || namedCity) {
    const city = compact(knownCity || namedCity);
    if (facts.city && city && normalized(facts.city) !== normalized(city)) {
      delete facts.district; delete facts.address; delete facts.site; delete facts.room;
    }
    facts.city = city;
  }
  if (namedDistrict || /^centro[.!]?$/i.test(value)) {
    const district = compact(namedDistrict || "Centro");
    if (correcting && facts.district && district && normalized(facts.district) !== normalized(district)) {
      delete facts.address; delete facts.site; delete facts.room;
    }
    facts.district = district;
  }
  if (namedSite && (!facts.site || genericSite(facts.site) || !genericSite(namedSite))) facts.site = compact(namedSite);
  else if (!namedSite && recentPrompt && schoolQuestion(prompt) && standalone && !mediaPlaceholder(event)
    && !namedRoom && !knownCity && !namedDistrict && !address && !equipmentDetail.test(clue) && !customerFollowUp.test(clue)) facts.site = compact(value);
  if (address) {
    const nextAddress = compact(address);
    if (correcting && facts.address && nextAddress && normalized(facts.address) !== normalized(nextAddress)) {
      delete facts.site; delete facts.room;
    }
    facts.address = nextAddress;
  }
  if (namedRoom || (recentPrompt && prompt === "leak:site-room" && standalone && !mediaPlaceholder(event) && !namedSite)) facts.room = compact(namedRoom || value);
  const appliance = clue.match(applianceIdentity)?.[0] || clue.match(capacityDetail)?.[0];
  if (appliance) facts.appliance = compact(appliance);
  const capacity = clue.match(capacityDetail)?.[0];
  if (capacity) facts.capacity = compact(capacity);
  if (facts.service==="Instalação" && (infrastructureDetail.test(clue) || (recentPrompt && /^installation:110(?::clarify)?$/.test(prompt || "") && /^(?:sim|nao)[.!]?$/i.test(clue)))) {
    facts.infrastructure = /\b(?:nao|sem)\b/.test(clue) ? "Não informada como existente" : /^(?:sim|ja tem|tem sim)|\b(?:ja tem|ja existe|tem tubulacao|tem infraestrutura)\b/.test(clue) ? "Existente segundo o cliente" : undefined;
  }
  const since = value.match(/\b(?:desde\s+[^,;.!?\n]{2,48}|h[áa]\s+(?:\d{1,3}|um[aa]?|dois|três)\s+(?:dias?|semanas?|meses?|horas?))/iu)?.[0];
  if (since) facts.since = compact(since);
  const preference = value.match(/\b(?:de manhã|à tarde|à noite|amanhã|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado|domingo)\b(?:\s+(?:de manhã|à tarde|à noite))?/iu)?.[0];
  if (preference && !since) facts.preference = compact(preference);
  if (event.mediaKind) facts.media = event.mediaKind;
  if (before?.text && usefulQuestion(before.text) && !facts.lastQuestion) facts.lastQuestion = usefulQuestion(before.text);
  if (facts.lastQuestion && (
    (/cidade/i.test(facts.lastQuestion) && (knownCity || namedCity) && (!/bairro/i.test(facts.lastQuestion) || facts.district)) ||
    (/bairro/i.test(facts.lastQuestion) && (namedDistrict || /^centro/i.test(value)) && (!/cidade/i.test(facts.lastQuestion) || facts.city)) ||
    (/nome da escola|nome da unidade|endere[cç]o/i.test(facts.lastQuestion) && (address || (facts.site && !genericSite(facts.site)))) ||
    (/sala ou setor/i.test(facts.lastQuestion) && facts.room) ||
    (/desde quando|quando isso come[cç]ou/i.test(facts.lastQuestion) && facts.since) ||
    (/marca|modelo/i.test(facts.lastQuestion) && appliance) ||
    (/o que est[aá] acontecendo/i.test(facts.lastQuestion) && facts.symptom)
  )) delete facts.lastQuestion;
  facts.updatedAt = event.at;
  facts.pending = [
    !facts.service && !facts.symptom && "serviço ou problema",
    facts.symptom && !facts.since && !installationIntent.test(normalized(facts.symptom)) && "quando começou",
    !facts.city && "município", !facts.district && "bairro", !facts.address && (!facts.site || genericSite(facts.site)) && "endereço ou nome da unidade",
    facts.site && !facts.room && "sala ou setor", facts.service==="Instalação" && !facts.capacity && "capacidade em BTUs",
    facts.service==="Instalação" && !facts.infrastructure && "tubulação de cobre",
    facts.service!=="Instalação" && !facts.appliance && "marca/modelo ou etiqueta (se disponível)",
  ].filter((item): item is string => typeof item === "string");
  return facts;
}

// New turns in the pilot must either advance, ask one useful question, or be
// routed to a person. Distinct exception paths prevent fake send confirmations.
export function pilotReplyPlan(messages: ChatMessage[], eventId: string, activatedAt: string, now = Date.now(), agendaFailed = false, appointmentHandled = false, intake?: ServiceIntake) {
  const event = messages.find(message => message.id === eventId && message.direction === "in");
  if (!event || localTriage(event.text).optOut || Date.parse(event.at) <= Date.parse(activatedAt)) return null;
  const earlier = messages.slice(0, messages.indexOf(event));
  const recent = earlier.filter(message => Date.parse(message.at) >= now - 30 * 60_000);
  const bots = recent.filter(message => message.direction === "out" && message.actor === "local-assistant");
  const first = !bots.length;
  const safeHandoff = "Já registrei as informações e encaminhei para nossa equipe. Assim que confirmarem, seguimos por aqui.";
  const handoff = (key: string, reply = safeHandoff) => ({key, reply, first, handoff: true});
  const value = normalized(event.text.trim());
  const triage = localTriage(event.text);
  const plan = eventReplyPlan(messages, eventId, activatedAt, now);
  if (triage.urgent) return handoff("urgent", "Por segurança, desligue o aparelho apenas se puder fazer isso sem contato com água ou partes elétricas. Evite tocar no equipamento. Registrei o caso para avaliação da equipe técnica.");
  if (appointmentHandled) return {key:"agenda:recorded",reply:"Registrei sua resposta sobre o agendamento. Se precisar ajustar algum detalhe, me avise por aqui.",first,handoff:false};
  if (agendaFailed) return handoff("agenda:failure", "Não consegui concluir a confirmação na agenda. Deixei a conversa para nossa equipe verificar. Seguimos por aqui.");
  const intents = detectChatIntents(value);
  if (intents.includes("Licitação") || (intents.includes("Manutenção") && (intents.includes("Instalação") || intents.includes("Agendamento") || intents.includes("Orçamento")) && !serviceAside(value))) {
    const lines = intents.map(intent=>({
      Licitação:"Sobre a licitação, a equipe pode conferir o edital ou o número do pregão.",
      Instalação:"Para a instalação, a equipe vai separar os dados do aparelho e do local.",
      Manutenção:leakIntent.test(value) ? "Para o vazamento, recomendo uma visita técnica: pode haver várias causas." : "Para a manutenção, a equipe vai verificar o problema relatado.",
      Agendamento:"Para marcar horário, a equipe precisa conferir a agenda. Nenhuma visita foi reservada.",
      "Orçamento":"O orçamento depende dos dados de cada serviço; não vou te passar um valor sem confirmação.",
      "Dúvida geral":"Sua dúvida ficou registrada.",
    })[intent]);
    return handoff("triagem:equipe",lines.join(" ")+" Separei os assuntos para a equipe continuar por aqui.");
  }
  if (intents.includes("Orçamento") && !intents.includes("Instalação") && !intents.includes("Manutenção") && !/quanto|valor|preco/.test(value)) {
    return {key:"orcamento:servico",reply:"Para preparar o orçamento, qual serviço você precisa?",first,handoff:false};
  }
  if (/\b(?:podem|conseguem|da para) vi(?:r|m) (?:ver|olhar)\b/.test(value) && !intake?.symptom) {
    return {key:"tecnico:visita-triagem",reply:"Podemos verificar uma visita técnica. O que está acontecendo com o aparelho?",first,handoff:false};
  }
  if (/\b(?:agendar|marcar (?:uma? |o )?(?:visita|atendimento)|horario (?:disponivel|para)|(?:podem|conseguem|tem como) vir)\b/.test(value)) {
    return handoff("agenda:review", "Vou pedir à equipe que confira a agenda antes de oferecer um horário. Nenhum horário foi reservado; seguimos por aqui.");
  }
  if (/\b(?:quanto (?:custa|fica)|qual (?:e )?o (?:valor|preco|prazo)|garantia|preco|faz por)\b/.test(value)) return handoff("informacao:review", "Preciso confirmar essa informação com a equipe para te passar a orientação certa. Seguimos por aqui.");
  if ((intake?.symptom || intake?.service) && (serviceAside(value) || visitAside(value))) {
    const answer = visitAside(value) ? "Na visita, o técnico avalia o aparelho no local para identificar a causa e orientar o próximo passo."
      : /\bpmoc\b/.test(value) ? "Sim, a PolarTech faz PMOC."
      : /\b(?:instalacao|instalam)\b/.test(value) ? "Sim, também fazemos instalação."
      : /\b(?:limpeza|higienizacao)\b/.test(value) ? "Sim, também fazemos higienização."
      : "Sim, também fazemos manutenção.";
    const question = intake.lastQuestion;
    return {key:"assunto:retomar",reply:answer+(question ? " Voltando ao seu atendimento: "+question : " Podemos continuar com o problema do seu aparelho por aqui."),first,handoff:false};
  }
  if (intake && detailCorrection.test(value)) {
    const changed = /\b(?:rua|avenida|estrada|travessa|alameda)\b/.test(value) && intake.address ? "o endereço"
      : /\bbairro\b/.test(value) && intake.district ? "o bairro"
      : /\bcidade\b/.test(value) && intake.city ? "a cidade"
      : /\b(?:escola|unidade)\b/.test(value) && intake.site ? "a unidade"
      : serviceRoom.test(value) && intake.room ? "a sala"
      : (applianceIdentity.test(value) || capacityDetail.test(value)) && intake.appliance ? "os dados do aparelho"
      : "";
    if (changed) {
      const next = !intake.city ? "Em qual cidade fica o aparelho?" : !intake.district ? "Em qual bairro fica o aparelho?"
        : !intake.address && (!intake.site || genericSite(intake.site)) ? "Qual é o endereço ou o nome da unidade?"
        : intake.site && !intake.room ? "Em qual sala ou setor fica o aparelho?"
        : intake.symptom && !intake.since ? "Desde quando isso está acontecendo?"
        : !intake.appliance ? "Você sabe a marca ou o modelo do aparelho?" : "";
      if (next) return {key:"dados:corrigidos",reply:"Certo, atualizei "+changed+" na ficha. "+next,first,handoff:false};
      return handoff("dados:corrigidos","Certo, atualizei "+changed+" na ficha. Deixei o atendimento para a equipe seguir por aqui.");
    }
  }
  if (worried(value) && !leakIntent.test(value) && !triage.urgent) {
    if (intake?.lastQuestion && !bots.some(message => message.assistantReplyKey === "acolhimento")) {
      return {key:"acolhimento",reply:"Entendo a sua preocupação. Para seguir com o atendimento, só preciso confirmar uma coisa: "+intake.lastQuestion,first,handoff:false};
    }
    return handoff("acolhimento:equipe","Entendo a sua preocupação. Já deixei o caso para a equipe dar continuidade por aqui.");
  }
  const pendingTechnical = bots.some(message => message.assistantReplyKey === "piloto:detalhes-tecnicos");
  if (pendingTechnical && intake?.since && !intake.appliance && !event.mediaKind
    && !bots.some(message => message.assistantReplyKey === "piloto:etiqueta") && !/\b(?:nao sei|nao tenho|nao consigo)\b/.test(value)) {
    return {key:"piloto:etiqueta",reply:"Você sabe a marca ou o modelo do aparelho? Se preferir, pode mandar uma foto da etiqueta.",first,handoff:false};
  }
  if (pendingTechnical && (intake?.since || intake?.appliance || event.mediaKind === "foto" || /\b(?:nao sei|nao tenho|nao consigo)\b/.test(value))) return handoff("leak:complete");
  if (plan?.key === "leak:complete" && !pendingTechnical && intake && (!intake.since || !intake.appliance)) {
    const time = !intake.since ? "Desde quando isso está acontecendo?" : "";
    const label = !intake.appliance ? "Se souber, qual é a marca ou o modelo? Pode mandar uma foto da etiqueta também." : "";
    return {key:"piloto:detalhes-tecnicos",reply:time || label,first,handoff:false};
  }
  if (plan?.key === "leak:school") return {...plan, reply:"Entendi, é uma escola. Qual é o nome da escola ou o endereço?"};
  if (intake?.room && intake.site && genericSite(intake.site) && !intake.address
    && (serviceRoom.test(value) || /^(?:sala\s+)?[0-9]{1,3}[a-z]?$/.test(value))
    && !bots.some(message => message.assistantReplyKey === "leak:school-after-room")) {
    return {key:"leak:school-after-room",reply:"Anotei a sala. Qual é o nome da escola ou o endereço?",first,handoff:false};
  }
  if (intake?.service === "Instalação" && !isNudge(value) && !event.mediaKind
    && !customerFollowUp.test(value) && (!plan?.handoff || plan.key==="installation:111")) {
    const steps:[string,string,boolean][] = [
      ["installation:btu","Para preparar seu orçamento, qual é a capacidade do aparelho em BTUs?",Boolean(intake.capacity)],
      ["installation:cidade","Em qual cidade será a instalação?",Boolean(intake.city)],
      ["installation:bairro","Em qual bairro será a instalação?",Boolean(intake.district)],
      ["installation:110","O local já tem tubulação de cobre instalada?",Boolean(intake.infrastructure)],
    ];
    const step=steps.find(([, , complete])=>!complete);
    if (!step) return handoff("installation:111");
    const [key, reply] = step;
    if (!bots.some(message=>message.assistantReplyKey===key)) return {key,reply,first,handoff:false};
    const lastCustomer=recent.findLast(message=>message.direction==="in");
    if (lastCustomer && normalized(lastCustomer.text.trim())===value) return null;
    if (/\b(?:nao sei|nao tenho certeza|nao consigo)\b/.test(value)) return handoff("installation:review");
    if (bots.some(message=>message.assistantReplyKey===key+":clarify")) return handoff("installation:review");
    return {key:key+":clarify",reply:"Só para eu registrar certo: "+reply,first,handoff:false};
  }
  if (plan?.handoff) return {...plan, reply: safeHandoff};
  if (plan && !plan.key.startsWith("sector:")) {
    if (plan.key === "leak:inside" || plan.key === "leak:place") {
      if (!intake?.city && intake?.district) return {...plan,key:"leak:city",reply:leakingReplies.city};
      if (!intake?.city && !intake?.district) return {...plan,reply:(plan.key === "leak:inside" ? "Certo, está pingando pela unidade de dentro. " : "")+"Em qual cidade fica o aparelho?"};
    }
    if (leakIntent.test(value) && plan.key.startsWith("leak:")
      && !bots.some(message => message.assistantReplyKey?.startsWith("leak:"))) {
      return {...plan, reply:"Pode haver várias causas para o vazamento. Recomendo uma visita técnica para avaliar. " + plan.reply};
    }
    return plan;
  }
  // Never treat a placeholder as a verified image, transcription or symptom.
  if (event.mediaKind && value.startsWith("mensagem sem texto.")) {
    const key = "anexo:" + event.mediaKind;
    if (bots.some(message => message.assistantReplyKey === key)) return handoff("anexo:review", "Recebi os anexos e deixei a conversa para a equipe conferir. Seguimos por aqui.");
    const reply = event.mediaKind === "áudio" ? "Recebi o áudio, mas não consegui ouvir por aqui. Pode me contar por texto o que está acontecendo?"
      : event.mediaKind === "foto" ? "Recebi a foto. Pode me dizer se ela mostra a etiqueta ou o problema do aparelho?"
      : "Recebi o anexo. Pode me dizer por texto o que devo considerar nele?";
    return {key, reply, first, handoff: false};
  }
  if (isNudge(value)) return plan; // The nudge guard owns blank/repeated references.
  if (intake?.symptom && !leakIntent.test(normalized(intake.symptom)) && !installationIntent.test(normalized(intake.symptom))
    && ["Técnico", "Geral"].includes(triage.sector) && !customerFollowUp.test(value)) {
    const steps: [string, string, boolean][] = [
      ["inicio", "Desde quando isso começou?", Boolean(intake.since)],
      [!intake.city ? "cidade" : "bairro", !intake.city ? "Em qual cidade fica o aparelho?" : "Em qual bairro fica o aparelho?", Boolean(intake.city && intake.district)],
      ["unidade", "Pode me dizer o endereço ou o nome da unidade?", Boolean(intake.address || (intake.site && !genericSite(intake.site)))],
      ["etiqueta", "Se souber, qual é a marca ou o modelo? Pode mandar uma foto da etiqueta também.", Boolean(intake.appliance)],
    ];
    const step = steps.find(([, , done]) => !done);
    if (step) {
      const key = "tecnico:" + step[0];
      if (!bots.some(message => message.assistantReplyKey === key)) return {key,reply:step[1],first,handoff:false};
      if (/\b(?:nao sei|nao lembro|nao tenho|nao consigo)\b/.test(value)) return handoff("tecnico:review");
    } else return handoff("tecnico:complete");
  }
  const prevCustomer = recent.findLast(message => message.direction === "in" && !isNudge(message.text));
  if (prevCustomer && normalized(prevCustomer.text.trim()) === value && !customerFollowUp.test(value)) return null;
  if (/^(?:ok|t[aá]|beleza|certo|entendi|(?:muito )?obrigad[oa]|valeu)[.!\s]*$/i.test(value)) {
    if (bots.some(message => message.assistantReplyKey === "cortesia")) return null;
    const pending = bots.at(-1)?.text.includes("?");
    if (pending) return {key:"cortesia",reply:"Tudo bem. Quando puder, me mande essa informação para eu continuar.",first,handoff:false};
    return {key:"cortesia",reply:"Por nada! Se precisar de mais alguma coisa, me avise por aqui.",first,handoff:false};
  }
  if (plan && (plan.key !== "sector:Geral" || /^(?:oi+|ola|bom dia|boa tarde|boa noite)\b/.test(value))) return plan;
  if (customerFollowUp.test(value) || bots.some(message => message.assistantReplyKey === "esclarecer")) return handoff("handoff");
  return {key:"esclarecer",reply:"Pode me contar um pouco mais sobre o que você precisa? Assim eu encaminho da forma certa.",first,handoff:false};
}

/** A pending human transfer is not a manual pause. Acknowledge new facts without
 * reopening automation, interfering with a handler, or promising availability. */
export function handoffSupplementPlan(chat: ChatConversation, eventId: string, now = Date.now(), appointmentHandled = false, agendaFailed = false) {
  const handoff = Date.parse(chat.assistantHandoffAt || "");
  if (!chat.botPaused || chat.assignee || chat.optOut || chat.stage === "Concluído" || !Number.isFinite(handoff) || now - handoff > 24 * 60 * 60_000) return null;
  const position = chat.messages.findIndex(message => message.id === eventId && message.direction === "in");
  if (position < 0) return null;
  const event = chat.messages[position];
  if (Date.parse(event.at) < Math.floor(handoff/1000)*1000) return null;
  const previous = chat.messages.slice(0,position);
  if (previous.some(message => message.direction === "out" && message.actor !== "local-assistant" && Date.parse(message.at) >= handoff)) return null;
  const value = normalized(event.text).trim().replace(/[.!?,…]+$/u,"").trim();
  const quoted = quotedQuestion(previous,event);
  const kind = agendaFailed ? "agenda-falha" : appointmentHandled ? "agenda-confirmacao"
    : event.mediaKind ? "anexo" : siteNameKnown.test(value) || (schoolQuestion(quoted?.assistantReplyKey) && /^[\p{L}][\p{L} '-]{2,60}$/u.test(value)
      && !genericSite(value) && !/^(?:sim|nao|obrigad[oa]|valeu|certo|beleza|entendi|isso|nao sei|nao lembro|centro)$/.test(value)) && !serviceRoom.test(value) ? "unidade"
    : serviceRoom.test(value) ? "sala"
    : applianceIdentity.test(value) || capacityDetail.test(value) ? "equipamento"
    : /\b(?:quando (?:podem|conseguem)|tem como vir|cons(?:egue|eguem) vi(?:r|m)|(?:a|de) (?:manha|tarde|noite)|amanha)\b/.test(value) ? "preferencia"
    : /\b(?:desde|bairro)\s+[a-z]|\b(?:rua|avenida)\s/.test(value) ? "dados" : "";
  if (!kind || localTriage(event.text).optOut) return null;
  const supplements = previous.filter(message => message.direction === "out" && message.actor === "local-assistant" && Date.parse(message.at) >= handoff
    && message.assistantReplyKey?.startsWith("suplemento:"));
  if (supplements.length >= 5 || supplements.some(message => message.assistantReplyKey === "suplemento:" + kind)) return null;
  const replies: Record<string,string> = {
    unidade:"Anotei o nome da escola ou o endereço na ficha. A equipe vai ver esse complemento por aqui.",
    sala:"Anotei a sala na ficha para a equipe.",
    equipamento:"Anotei os dados do aparelho na ficha para a equipe.",
    anexo:"Recebi o anexo e deixei junto da conversa para a equipe conferir.",
    preferencia:"Deixei seu pedido com a equipe para conferir a agenda. Ainda não há horário confirmado.",
    dados:"Anotei esse complemento na ficha para a equipe.",
    "agenda-falha":"Não consegui concluir a confirmação na agenda. A equipe pode conferir o pedido por aqui.",
    "agenda-confirmacao":"Registrei sua resposta sobre o agendamento.",
  };
  const reply = kind === "unidade" && /^(?:escola|creche|colegio)\b/.test(value) ? "Anotei o nome da escola na ficha para a equipe." : replies[kind];
  return {key:"suplemento:"+kind,reply,first:false,handoff:false};
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
    case "bot": if (typeof command.paused !== "boolean") throw new Error("Estado inválido."); if (next.assignee && next.assignee !== actor.username && !actor.admin) throw new Error("Solicite a liberação ao responsável."); next.botPaused = command.paused; delete next.assistantHandoffAt; if (!next.botPaused) { next.assignee = ""; } event(`Assistente ${next.botPaused ? "pausado" : "liberado"} por ${actor.displayName}.`); break;
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
  const urgent = Boolean(waiting && (chat.intake?.urgent || chat.queueActivity?.urgent || (lastCustomer && localTriage(lastCustomer.text).urgent)));
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
  const { pendingDeliveryReceipts: _pending, intake, mediaTrial: _mediaTrial, ...visible } = chat;
  const incoming = chat.messages.findLast(message => message.direction === "in");
  const outbound = chat.messages.findLast(message => message.direction === "out");
  const lastOutbound = outbound && { at: outbound.at, status: outbound.status, deliveryStatus: outbound.deliveryStatus };
  return { ...visible, messages: chat.messages.filter(message=>message.direction==="in"||message.direction==="out").slice(-1), requests: [], queueActivity: { urgent:intake?.urgent, incoming, humanReplyAt: lastHumanReplyAt(chat), lastOutbound } };
}
