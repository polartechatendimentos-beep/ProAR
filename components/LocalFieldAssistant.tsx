"use client";
import {useEffect,useRef,useState} from "react";
import {formatLocalFieldReport,localFieldReportMessages} from "@/lib/local-field-report";
import styles from "./ProARFieldMobile.module.css";
type Speech={lang:string;continuous:boolean;interimResults:boolean;processLocally?:boolean;onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};
type SpeechConstructor={new():Speech;available?:(options:{langs:string[];processLocally:boolean})=>Promise<string>};
export function LocalFieldAssistant({diagnosis,report,disabled,onApply}:{diagnosis:string;report:string;disabled:boolean;onApply:(value:string)=>void}){
  const [preview,setPreview]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[listening,setListening]=useState(false);
  const worker=useRef<Worker|null>(null),speech=useRef<Speech|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  function cancel(){worker.current?.terminate();worker.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;setBusy(false);setReady(false);setNotice("IA local interrompida.");}
  useEffect(()=>()=>{worker.current?.terminate();speech.current?.stop();if(timer.current)clearTimeout(timer.current);},[]);
  async function loadModel(){
    setNotice("");setBusy(true);
    try{
      const gpu=(navigator as Navigator&{gpu?:{requestAdapter:()=>Promise<unknown>}}).gpu;
      if(!gpu || !await gpu.requestAdapter())throw new Error("Este aparelho não oferece suporte à IA local. Use a formatação sem IA ou o ditado do teclado.");
      const w=new Worker("/proar-local-ai-worker.mjs",{type:"module"});worker.current=w;
      timer.current=setTimeout(()=>{w.terminate();worker.current=null;setBusy(false);setReady(false);setNotice("Tempo de carregamento excedido. Tente em uma conexão melhor ou use a formatação sem IA.");},300000);
      w.onmessage=({data})=>{if(data.kind==="progress"){setNotice(`Baixando modelo: ${Math.round(Math.max(0,Math.min(1,data.progress||0))*100)}%`);return;}if(timer.current)clearTimeout(timer.current);setBusy(false);if(data.kind==="ready"){setReady(true);setNotice("Modelo pronto neste aparelho.");}else if(data.kind==="result"){setPreview(data.text);setNotice("Sugestão da IA: confira os fatos antes de aplicar.");}else{setNotice(data.message);setReady(false);w.terminate();worker.current=null;}};
      w.onerror=()=>{if(timer.current)clearTimeout(timer.current);setBusy(false);setReady(false);setNotice("O navegador não conseguiu carregar a IA local. Use a formatação sem IA.");w.terminate();worker.current=null;};
      w.postMessage({action:"load"});
    }catch(e){setBusy(false);setNotice(e instanceof Error?e.message:"IA local indisponível.");}
  }
  function generate(){if(!worker.current||!ready)return;setBusy(true);setNotice("Revisando no aparelho…");timer.current=setTimeout(()=>cancel(),120000);worker.current.postMessage({action:"generate",messages:localFieldReportMessages(diagnosis,report)});}
  async function dictate(){
    try{
      const api=window as Window&{SpeechRecognition?:SpeechConstructor;webkitSpeechRecognition?:SpeechConstructor},Recognition=api.SpeechRecognition||api.webkitSpeechRecognition;
      if(!Recognition)throw new Error("Ditado local indisponível. Você pode usar o microfone do teclado do celular.");
      const instance=new Recognition();
      if(!("processLocally" in instance)||!Recognition.available)throw new Error("Ditado local não suportado neste navegador. Use o microfone do teclado conforme suas configurações.");
      if(await Recognition.available({langs:["pt-BR"],processLocally:true})!=="available")throw new Error("O pacote local de português não está disponível. Use o ditado do teclado.");
      instance.lang="pt-BR";instance.processLocally=true;instance.continuous=false;instance.interimResults=false;speech.current=instance;
      instance.onresult=event=>{const text=Array.from(event.results).map(result=>result[0]?.transcript||"").join(" ");setPreview(previous=>[previous,text.trim()].filter(Boolean).join("\n").slice(0,8000));setNotice("Transcrição local pronta para revisão.");};
      instance.onerror=()=>{setListening(false);setNotice("Não foi possível transcrever. Verifique a permissão de microfone ou use o teclado.");};instance.onend=()=>setListening(false);instance.start();setListening(true);setNotice("Ouvindo no aparelho…");
    }catch(e){setNotice(e instanceof Error?e.message:"Ditado indisponível.");}
  }
  return <details className={styles.journeyPanel}><summary>Assistente de relatório • sem chave de API</summary>
    <p>Formatação automática funciona sem modelo. A IA local usa o próprio aparelho e exige compatibilidade; o primeiro uso baixa o modelo e pode consumir bastante internet e memória.</p>
    <button type="button" className={styles.secondaryAction} disabled={disabled||busy||(!diagnosis.trim()&&!report.trim())} onClick={()=>{setPreview(formatLocalFieldReport(diagnosis,report));setNotice("Texto organizado por regras, sem IA e sem acrescentar fatos.");}}>Organizar texto sem IA</button>
    {!ready&&<button type="button" className={styles.secondaryAction} disabled={disabled||busy} onClick={()=>void loadModel()}>Baixar e ativar IA local</button>}
    {ready&&<button type="button" className={styles.secondaryAction} disabled={disabled||busy||!report.trim()} onClick={generate}>Revisar serviço com IA local</button>}
    {busy&&<button type="button" className={styles.secondaryAction} onClick={cancel}>Cancelar IA local</button>}
    <button type="button" className={styles.secondaryAction} disabled={disabled||busy} onClick={()=>listening?speech.current?.stop():void dictate()}>{listening?"Parar ditado":"Ditar texto localmente"}</button>
    {notice&&<p role="status" className={styles.warning}>{notice}</p>}
    {preview&&<><label className={styles.formLabel}>Sugestão para revisar<textarea value={preview} maxLength={8000} onChange={e=>setPreview(e.target.value)}/></label><button type="button" className={styles.primaryAction} disabled={disabled||busy} onClick={()=>{onApply(preview);setPreview("");setNotice("Aplicado ao rascunho. Salve o relatório para confirmar no servidor.");}}>Aplicar ao serviço executado</button></>}
  </details>;
}
