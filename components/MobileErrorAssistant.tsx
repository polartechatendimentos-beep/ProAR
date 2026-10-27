'use client';
import {useEffect,useRef,useState} from 'react';
import {errorAssistantContext,guidedErrorQuestions,localErrorAssistantMessages,parseErrorAssistantSelection,type diagnosticQuestions} from '@/lib/mobile-error-assistant';
import styles from './ProARFieldMobile.module.css';
type Question=(typeof diagnosticQuestions)[number];
export function MobileErrorAssistant({brand,family,code}:{brand:string;family:string;code:string}){
 const [model,setModel]=useState(''),[symptoms,setSymptoms]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[notice,setNotice]=useState(''),[questions,setQuestions]=useState<Question[]>([]),[mode,setMode]=useState<'rules'|'ai'|null>(null);
 const worker=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),alive=useRef(true);
 const input={brand,family,code,model,symptoms,confirmed},context=errorAssistantContext(input);
 function stop(){worker.current?.terminate();worker.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;setReady(false);setBusy(false);}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;worker.current?.terminate();if(timer.current)clearTimeout(timer.current)}},[]);
 function invalidate(){setQuestions([]);setMode(null);setNotice('');}
 async function load(){if(busy)return;setBusy(true);setNotice('Verificando suporte à IA local…');
  try{const gpu=(navigator as Navigator&{gpu?:{requestAdapter:()=>Promise<unknown>}}).gpu;if(!gpu||!await gpu.requestAdapter())throw new Error('IA local indisponível neste aparelho. A consulta guiada por regras continua disponível.');
   if(!alive.current)return;const w=new Worker('/proar-local-ai-worker.mjs',{type:'module'});worker.current=w;
   timer.current=setTimeout(()=>{if(!alive.current)return;stop();setNotice('Carregamento excedeu o prazo. Use a consulta guiada ou tente novamente com conexão.')},300000);
   w.onmessage=({data})=>{if(!alive.current||worker.current!==w)return;if(data.kind==='progress'){setNotice(`Baixando modelo no aparelho: ${Math.round(Math.max(0,Math.min(1,Number(data.progress)||0))*100)}%`);return;}if(timer.current)clearTimeout(timer.current);timer.current=null;setBusy(false);
    if(data.kind==='ready'){setReady(true);setNotice('IA local pronta. O próximo botão organiza as perguntas; o significado continua vindo da fonte.');}
    else if(data.kind==='result'){try{setQuestions(parseErrorAssistantSelection(data.text));setMode('ai');setNotice('Roteiro organizado por IA local. Revise com o manual e as evidências.')}catch{setQuestions([]);setMode(null);setNotice('A IA retornou uma seleção inválida. Nenhum conteúdo livre foi aplicado; use a consulta guiada.');}}
    else {stop();setNotice('Não foi possível executar a IA local. A consulta guiada continua disponível.');}};
   w.onerror=()=>{if(!alive.current||worker.current!==w)return;stop();setNotice('Falha no modelo local. Confira memória e conexão ou use a consulta guiada.');};w.postMessage({action:'load'});
  }catch(error){if(alive.current){stop();setNotice(error instanceof Error?error.message:'IA local indisponível.')}}
 }
 function generate(){if(!worker.current||!ready||!context.canUseAI||busy)return;setQuestions([]);setMode(null);setBusy(true);setNotice('IA organizando o roteiro neste aparelho…');timer.current=setTimeout(()=>{stop();setNotice('A IA excedeu o prazo. Nenhuma sugestão foi aplicada.')},120000);worker.current.postMessage({action:'generate',messages:localErrorAssistantMessages(input)});}
 return <section className={styles.detailCard} aria-label="Assistente de investigação de códigos"><h3>Assistente técnico • IA local opcional</h3><p>A referência do fabricante fica acima. A IA apenas organiza perguntas de investigação, sem alterar OS, diagnosticar uma peça ou autorizar reparo. Primeiro uso baixa um modelo; depende de WebGPU, memória e conexão.</p>
 <label className={styles.formLabel}>Modelo completo da placa<input maxLength={120} value={model} disabled={busy} onChange={e=>{setModel(e.target.value);invalidate()}} placeholder="Informe a identificação exata"/></label>
 <label className={styles.formLabel}>Sintoma e evidências observadas<textarea maxLength={1500} disabled={busy} value={symptoms} onChange={e=>{setSymptoms(e.target.value);invalidate()}} placeholder="Quando ocorre, modo de operação e resultados já verificados. Não inclua dados pessoais do cliente."/></label>
 <label className={styles.checkLabel}><input type="checkbox" disabled={busy} checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);invalidate()}}/>Conferi marca, linha, mercado e aplicabilidade do documento ao equipamento.</label>
 {context.modelStatus==='not-specific'&&context.entry&&<p className={styles.warning}>Referência por família ou artigo geral. A seleção não comprova compatibilidade com o modelo exato; confirme no manual do equipamento.</p>}
 {context.missing.length>0&&<ul>{context.missing.map(m=><li key={m}>{m}</li>)}</ul>}
 <div className={styles.insightActions}><button type="button" disabled={busy||!context.canUseAI} onClick={()=>{setQuestions(guidedErrorQuestions(input));setMode('rules');setNotice('Consulta por regras, sem IA generativa.')}}>Consulta guiada • sem IA</button>{!ready?<button type="button" disabled={busy||!context.canUseAI} onClick={()=>void load()}>Baixar e ativar IA local</button>:<button type="button" disabled={busy||!context.canUseAI} onClick={generate}>Organizar investigação com IA</button>}{busy&&<button type="button" onClick={()=>{stop();setNotice('IA interrompida.')}}>Cancelar IA</button>}</div>
 {notice&&<p role="status" className={styles.syncBanner}>{notice}</p>}{questions.length>0&&<div className={styles.reviewPanel}><h4>{mode==='ai'?'Perguntas selecionadas pela IA local':'Perguntas da consulta guiada sem IA'}</h4><ol>{questions.map(q=><li key={q.id}>{q.text}</li>)}</ol><p>Registre as respostas e as medições reais na OS. Nada foi preenchido ou enviado automaticamente.</p></div>}
 </section>;
}
