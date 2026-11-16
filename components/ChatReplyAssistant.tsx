'use client';
import {useEffect,useRef,useState} from 'react';
export function ChatReplyAssistant({phone,companyId,draft,disabled,onApply}:{phone:string;companyId:string;draft:string;disabled:boolean;onApply:(text:string)=>void}){
 const [suggestion,setSuggestion]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[automatic,setAutomatic]=useState(false);
 const [suggestedDraft,setSuggestedDraft]=useState("");const sequence=useRef(0),controller=useRef<AbortController|null>(null),current=useRef({phone,draft});useEffect(()=>{current.current={phone,draft};},[phone,draft]);
 async function suggest(mode:string){
  const id=++sequence.current,original={phone,draft};controller.current?.abort();const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setSuggestion('');
  try{const r=await fetch('/api/atendimento/sugestao',{method:'POST',headers:{'Content-Type':'application/json','X-Proar-Company-ID':companyId},body:JSON.stringify({phone,draft,mode}),signal:abort.signal});const d=await r.json();if(!r.ok)throw Error(d.error||'Sugestão indisponível.');if(id===sequence.current&&current.current.phone===original.phone&&current.current.draft===original.draft){setSuggestedDraft(original.draft);setSuggestion(d.suggestion);}}
  catch(e){if(!abort.signal.aborted&&id===sequence.current)setError(e instanceof Error?e.message:'Falha na sugestão.');}finally{if(id===sequence.current)setBusy(false);}
 }
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{if(!automatic||disabled||draft.trim().length<12)return;const timer=setTimeout(()=>void suggest('completar'),1800);return()=>clearTimeout(timer);/* Debounced input is intentionally the trigger. */ // eslint-disable-next-line react-hooks/exhaustive-deps
 },[draft,phone,automatic,disabled]);
 return <div className="chat-reply-ai"><div><button type="button" disabled={disabled||busy} onClick={()=>void suggest('responder')}>✨ {busy?'Consultando IA…':'Sugerir resposta'}</button><button type="button" disabled={disabled||busy||!draft.trim()} onClick={()=>void suggest('melhorar')}>Melhorar texto</button><button type="button" disabled={disabled||busy||!draft.trim()} onClick={()=>void suggest('cordial')}>Mais cordial</button><button type="button" disabled={disabled||busy||!draft.trim()} onClick={()=>void suggest('direto')}>Mais direto</button><label><input type="checkbox" checked={automatic} onChange={e=>setAutomatic(e.target.checked)}/>Sugerir ao digitar</label></div>{suggestion&&suggestedDraft===draft&&<section aria-label="Sugestão da IA"><p>{suggestion}</p><small>Revise os dados antes de enviar.</small><button type="button" disabled={disabled} onClick={()=>{onApply(suggestion);setSuggestion('');}}>Usar sugestão</button><button type="button" onClick={()=>setSuggestion('')}>Descartar</button></section>}{error&&<p role="alert">{error}</p>}</div>;
}
