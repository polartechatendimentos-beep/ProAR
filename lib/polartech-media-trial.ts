import type { ChatConversation } from "./chatdesk-local";

export const mediaTrialStart = "2026-11-25T23:33:00.000Z";
export const mediaTrialEnd = "2026-11-26T23:33:00.000Z";
export const mediaTrialAge = 2 * 60 * 60_000;
export function mediaTrialAttachment(chat:ChatConversation|null,id:string,now:number) {
  if (!chat || chat.optOut || chat.assignee || chat.stage==="Concluído" || (chat.botPaused && !chat.assistantHandoffAt)
    || now < Date.parse(mediaTrialStart) || now >= Date.parse(mediaTrialEnd)) return null;
  const message=chat.messages.find(m=>m.id===id && m.direction==="in" && m.pilotTurn &&
    (m.mediaKind==="foto" || m.mediaKind==="áudio"));
  if (!message || (message.mediaKind!=="foto" && message.mediaKind!=="áudio")) return null;
  const at=Date.parse(message.at);
  if (!Number.isFinite(at) || at<=Date.parse(mediaTrialStart) || at>now || now-at>mediaTrialAge ||
    Object.hasOwn(chat.mediaTrial || {},message.mediaKind)) return null;
  return {id:message.id,at:message.at,kind:message.mediaKind};
}
