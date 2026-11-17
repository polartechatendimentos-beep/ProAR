export type ReplyMessage={direction:string;text:string};
/** Only customer-visible conversation data and explicit approved templates enter the prompt. */
export function chatReplyContext(messages:ReplyMessage[],draft:string,mode:string,references:string[]){
 return {mode,draft:draft.slice(0,3000),references:references.slice(0,8).map(text=>text.slice(0,600)),messages:messages.filter(m=>m.direction==='in'||m.direction==='out').slice(-12).map(m=>({direction:m.direction,text:m.text.slice(0,1200)}))};
}
