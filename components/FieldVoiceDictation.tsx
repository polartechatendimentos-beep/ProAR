"use client";
import {useEffect,useRef,useState} from "react";
type Result={results:ArrayLike<ArrayLike<{transcript:string}>>};
type Recognition={lang:string;interimResults:boolean;continuous:boolean;onresult:((event:Result)=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};
type RecognitionWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
/** Speech processing depends on browser support and may require network; never starts without a tap. */
export function FieldVoiceDictation({label,onTranscript,maxLength}:{label:string;onTranscript:(text:string)=>void;maxLength:number}){
 const active=useRef<Recognition|null>(null);
 const [listening,setListening]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>()=>{active.current?.stop();active.current=null;},[]);
 const toggle=()=>{
  if(active.current){active.current.stop();active.current=null;setListening(false);return;}
  const win=window as RecognitionWindow;
  const Constructor=win.SpeechRecognition||win.webkitSpeechRecognition;
  if(!Constructor){setMessage("Ditado não disponível neste navegador. Use o teclado.");return;}
  try{
   const recognition=new Constructor();recognition.lang="pt-BR";recognition.interimResults=false;recognition.continuous=false;
   recognition.onresult=event=>{const transcript=Array.from(event.results).map(result=>result[0]?.transcript||"").join(" ").trim().slice(0,maxLength);if(transcript)onTranscript(transcript);};
   recognition.onerror=event=>setMessage(event.error==="not-allowed"?"Permissão de microfone negada.":"Não foi possível reconhecer a fala.");
   recognition.onend=()=>{active.current=null;setListening(false);};
   active.current=recognition;recognition.start();setListening(true);setMessage("Ditado iniciado. Revise o texto antes de salvar.");
  }catch{active.current=null;setListening(false);setMessage("Não foi possível iniciar o microfone.");}
 };
 return <div><button type="button" onClick={toggle} aria-pressed={listening} aria-label={listening?"Parar ditado":label}>{listening?"Parar ditado":label}</button>{message&&<p role="status">{message}</p>}</div>;
}
