'use client';
import {useEffect,useRef,useState} from 'react';
type Props={phone:string;companyId:string;draft:string;disabled:boolean;canRemember?:boolean;onApply:(text:string)=>void;onOpenSettings?:()=>void};
export function ChatReplyAssistant({phone,companyId,draft,disabled,canRemember=false,onApply,onOpenSettings}:Props){
 const [result,setResult]=useState<{text:string;input:string}|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[automatic,setAutomatic]=useState(true);
 const sequence=useRef(0),controller=useRef<AbortController|null>(null),latest=useRef({phone,draft}),applied=useRef('');
 useEffect(()=>{latest.current={phone,draft};},[phone,draft]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function suggest(mode:string){
  const id=++sequence.current,original={phone,draft};controller.current?.abort();const abort=new AbortController();controller.current=abort;setBusy(true);setNotice('');setResult(null);
  try{
   const response=await fetch('/api/atendimento/sugestao',{method:'POST',headers:{'Content-Type':'application/json','X-Proar-Company-ID':companyId},body:JSON.stringify({phone,draft,mode}),signal:abort.signal});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Sugestão indisponível.');
   if(id===sequence.current&&latest.current.phone===original.phone&&latest.current.draft===original.draft)setResult({text:data.suggestion,input:original.draft});
  }catch(e){if(!abort.signal.aborted&&id===sequence.current)setNotice(e instanceof Error?e.message:'Falha na sugestão.');}finally{if(id===sequence.current)setBusy(false);}
 }
 useEffect(()=>{
  if(!automatic||disabled||draft.trim().length<12||draft===applied.current)return;
  const timer=setTimeout(()=>void suggest('completar'),2000);return()=>clearTimeout(timer);
  // A suggestion is requested after the text settles, never on every keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[draft,phone,automatic,disabled]);
 async function remember(){
  const model=window.prompt('Revise o modelo da empresa. Remova nomes, telefones, endereços, valores e datas específicos. Você poderá editar ou remover em Assistente → Respostas rápidas.',draft);
  if(!model)return;setBusy(true);setNotice('');
  try{const r=await fetch('/api/atendimento/sugestao',{method:'POST',headers:{'Content-Type':'application/json','X-Proar-Company-ID':companyId},body:JSON.stringify({action:'remember',phone,text:model})});const d=await r.json();if(!r.ok)throw Error(d.error||'Modelo não salvo.');setNotice('Referência salva para a empresa. As próximas sugestões poderão usar esse estilo.');}catch(e){setNotice(e instanceof Error?e.message:'Falha ao salvar referência.');}finally{setBusy(false);}
 }
 return <div className="chat-reply-ai" aria-label="Sugestões de mensagem com IA">
  <div className="chat-reply-ai-toolbar"><button type="button" disabled={disabled||busy} onClick={()=>void suggest(draft.trim()?'completar':'responder')}>✨ {busy?'Consultando IA…':'Sugerir mensagem'}</button><button type="button" disabled={disabled||busy||!draft.trim()} onClick={()=>void suggest('melhorar')}>Melhorar texto</button><button type="button" disabled={disabled||busy||!draft.trim()} onClick={()=>void suggest('cordial')}>Mais cordial</button><button type="button" disabled={disabled||busy||!draft.trim()} onClick={()=>void suggest('direto')}>Mais direto</button><label><input type="checkbox" checked={automatic} onChange={e=>setAutomatic(e.target.checked)}/>Sugerir ao digitar</label></div>
  {result&&result.input===draft&&<section aria-label="Prévia da sugestão"><p>{result.text}</p><small>Confira antes de enviar.</small><div><button type="button" disabled={disabled||busy} onClick={()=>{applied.current=result.text;onApply(result.text);setResult(null);}}>Usar sugestão</button><button type="button" onClick={()=>setResult(null)}>Descartar</button></div></section>}
  {canRemember&&<button type="button" disabled={disabled||busy||draft.trim().length<10} onClick={()=>void remember()}>Salvar texto como referência da empresa</button>}
  <small>Considera esta conversa e os modelos aprovados da empresa. O envio continua com você.</small>
  {notice&&<p role="status">{notice}{onOpenSettings&&/ative a ia|configura[cç][aã]o/i.test(notice)&&<> <button type="button" onClick={onOpenSettings}>Abrir configurações do assistente</button></>}</p>}
 </div>;
}
