"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {AudioLines,CheckCircle2,LoaderCircle,MapPin,Mic,MicOff,Phone,UserRound,WandSparkles} from "lucide-react";
import {rankScheduleCustomers,type CustomerCandidate,type QuickScheduleCustomer} from "@/lib/quick-schedule-matching";
import type {OrderScheduleSeed} from "@/lib/order-workspace-state";
type Extracted={client:{name:string|null;phone:string|null};address:{street:string|null;number:string|null;neighborhood:string|null;city:string|null;complement:string|null};appointment:{service:string|null;equipment:string|null;date:string|null;time:string|null;technician:string|null;urgency:string|null;notes:string|null}};
type Props={customers:QuickScheduleCustomer[];technicians:string[];onCreate:(seed:OrderScheduleSeed)=>void};
type SpeechAlternative={transcript:string};type SpeechResult=ArrayLike<SpeechAlternative>&{isFinal?:boolean};type SpeechEvent={resultIndex:number;results:ArrayLike<SpeechResult>};
type SpeechRecognizer={lang:string;interimResults:boolean;continuous:boolean;onresult:((event:SpeechEvent)=>void)|null;onerror:((event:{error?:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
type SpeechConstructor=new()=>SpeechRecognizer;
const speechApi=()=>{const browser=window as unknown as {SpeechRecognition?:SpeechConstructor;webkitSpeechRecognition?:SpeechConstructor};return browser.SpeechRecognition||browser.webkitSpeechRecognition||null};
const titleCase=(value:string)=>value.trim();
const buildAddress=(fields:Extracted["address"])=>[fields.street,fields.number,fields.complement,fields.neighborhood,fields.city].filter(Boolean).join(", ");
export function QuickScheduleAssistant({customers,technicians,onCreate}:Props){
 const [text,setText]=useState(""),[busy,setBusy]=useState(false),[recording,setRecording]=useState(false),[transcribing,setTranscribing]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [fields,setFields]=useState<Extracted|null>(null),[candidates,setCandidates]=useState<CustomerCandidate[]>([]),[selectedId,setSelectedId]=useState(""),[homonymChoice,setHomonymChoice]=useState<"same"|"new"|null>(null);
 const recognitionRef=useRef<SpeechRecognizer|null>(null),recorderRef=useRef<MediaRecorder|null>(null),streamRef=useRef<MediaStream|null>(null),chunksRef=useRef<Blob[]>([]),speechBaseRef=useRef(""),speechFinalRef=useRef("");
 const selected=useMemo(()=>candidates.find(item=>item.customer.id===selectedId)||null,[candidates,selectedId]);
 useEffect(()=>()=>{recognitionRef.current?.abort();recorderRef.current?.stop();streamRef.current?.getTracks().forEach(track=>track.stop());},[]);
 const transcribeFallback=async(blob:Blob)=>{
  setTranscribing(true);setError("");setNotice("Transcrevendo áudio...");
  try{const form=new FormData();form.append("audio",blob,"agendamento.webm");const response=await fetch("/api/quick-schedule/transcribe",{method:"POST",body:form});const result=await response.json();if(!response.ok)throw new Error(result.error||"Não foi possível transcrever o áudio.");if(!String(result.text||"").trim())throw new Error("Não foi possível reconhecer a fala. Tente gravar novamente.");setText(current=>[current,String(result.text).trim()].filter(Boolean).join(" "));setNotice("Áudio transcrito. Revise o texto antes de interpretar.");}
  catch(reason){setError(reason instanceof Error?reason.message:"Falha na transcrição.");setNotice("")}finally{setTranscribing(false)}
 };
 const startRecorder=async()=>{
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){setError("Este navegador não permite gravar áudio. Digite o agendamento no campo.");return}
  try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});streamRef.current=stream;const recorder=new MediaRecorder(stream);chunksRef.current=[];recorder.ondataavailable=event=>{if(event.data.size)chunksRef.current.push(event.data)};recorder.onstop=()=>{const blob=new Blob(chunksRef.current,{type:recorder.mimeType||"audio/webm"});stream.getTracks().forEach(track=>track.stop());streamRef.current=null;setRecording(false);if(blob.size)void transcribeFallback(blob)};recorderRef.current=recorder;recorder.start();setRecording(true);setError("");setNotice("Gravando. Toque novamente para transcrever.");}catch{setError("Permita o acesso ao microfone ou digite o agendamento.");}
 };
 const toggleVoice=()=>{
  setError("");setNotice("");
  if(recording){if(recorderRef.current?.state==="recording")recorderRef.current.stop();else recognitionRef.current?.stop();return}
  if(transcribing)return;
  const Constructor=speechApi();
  if(Constructor){try{speechBaseRef.current=text.trim();speechFinalRef.current="";const recognition=new Constructor();recognition.lang="pt-BR";recognition.interimResults=true;recognition.continuous=false;recognition.onresult=event=>{let final="",interim="";for(let i=0;i<event.results.length;i++){const phrase=event.results[i][0]?.transcript||"";if(event.results[i].isFinal)final+=phrase;else interim+=phrase}speechFinalRef.current=final.trim();const spoken=[speechBaseRef.current,speechFinalRef.current,interim.trim()].filter(Boolean).join(" ");if(spoken)setText(spoken)};recognition.onerror=event=>{setError(event.error==="not-allowed"?"Permita o acesso ao microfone ou digite a solicitação.":"Não foi possível reconhecer a fala. Tente novamente.");setRecording(false)};recognition.onend=()=>setRecording(false);recognitionRef.current=recognition;recognition.start();setRecording(true);return}catch{void startRecorder();return}}
  void startRecorder();
 };
 const parse=async()=>{
  if(!text.trim()){setError("Digite ou fale os dados do agendamento.");return}
  setBusy(true);setError("");setNotice("");setFields(null);setCandidates([]);setSelectedId("");setHomonymChoice(null);
  try{
   const response=await fetch("/api/quick-schedule/parse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:text.trim(),now:new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date())+" America/Sao_Paulo"})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||"Falha ao interpretar o agendamento.");
   const extracted=result.fields as Extracted;if(!extracted?.client||!extracted?.address||!extracted?.appointment)throw new Error("A IA retornou dados incompletos. Edite o texto e tente novamente.");
   setFields(extracted);
   const ranked=rankScheduleCustomers({name:extracted.client.name||"",phone:extracted.client.phone,street:extracted.address.street,number:extracted.address.number},customers,10);
   setCandidates(ranked);
   const strong=ranked.find(item=>item.kind==="strong");if(strong)setSelectedId(strong.customer.id);
   setNotice(strong?"Encontramos um vínculo forte. Confira o endereço e os dados antes de abrir a OS.":"Confira os possíveis cadastros; o ProAR não criará nem vinculará um cliente sem sua confirmação.");
  }catch(reason){setError(reason instanceof Error?reason.message:"Não foi possível interpretar. Preencha manualmente.");}
  finally{setBusy(false)}
 };
 const confirm=()=>{
  if(!fields)return;
  if(selected?.kind==="homonym"&&!homonymChoice){setError("Escolha se este é o mesmo cliente em outro endereço ou um cadastro novo.");return}
  const useExisting=Boolean(selected&&!(selected.kind==="homonym"&&homonymChoice==="new"));
  const clientName=useExisting?selected!.customer.name:titleCase(fields.client.name||"");
  const fullAddress=buildAddress(fields.address);
  const description=[fields.appointment.service,fields.appointment.equipment,fields.appointment.notes].filter(Boolean).join(" • ");
  const serviceType=fields.appointment.service||undefined;
  const urgency=fields.appointment.urgency||"";
  const newCustomer=useExisting?undefined:{name:clientName,legalName:clientName,tradeName:clientName,phone:fields.client.phone||"",address:fullAddress,city:fields.address.city||"",state:"SP",organizationType:"Empresa"};
  onCreate({date:fields.appointment.date||undefined,time:fields.appointment.time||undefined,tech:technicians.find(name=>name.toLocaleLowerCase("pt-BR")===String(fields.appointment.technician||"").toLocaleLowerCase("pt-BR")),customerId:useExisting?selected!.customer.id:undefined,customerName:clientName||undefined,customerPhone:fields.client.phone||undefined,newCustomer,address:fullAddress||undefined,description:description||undefined,serviceType,priority:/urgente|cr[ií]tica/i.test(urgency)?"Urgente":undefined,equipment:fields.appointment.equipment||undefined});
 };
 const newClient=!selected||selected.kind==="homonym"&&homonymChoice==="new";
 return <section className="quick-schedule-card" aria-label="Agendamento rápido por voz ou texto">
  <header><div><span><AudioLines size={16}/> AGENDAMENTO RÁPIDO</span><h3>Agende por voz ou texto</h3><p>Descreva cliente, endereço, serviço e, se souber, dia e horário. Revise antes de abrir a OS.</p></div></header>
  <div className="quick-schedule-input-row"><textarea aria-label="Descreva o agendamento" value={text} onChange={event=>setText(event.target.value)} placeholder="Ex.: José da Silva, Rua João Paulo II, 3017, bloco 6, ap. 302, Mirassol. O ar não está gelando. Amanhã às 14h." maxLength={3000}/><div className="quick-schedule-actions"><button type="button" onClick={toggleVoice} disabled={busy||transcribing} aria-pressed={recording}>{recording?<MicOff size={16}/>:<Mic size={16}/>} {recording?"Parar":transcribing?"Transcrevendo...":"Falar"}</button><button type="button" className="quick-schedule-primary" onClick={()=>void parse()} disabled={busy||recording||transcribing}>{busy?<LoaderCircle size={16} className="quick-schedule-spin"/>:<WandSparkles size={16}/>} {busy?"Interpretando...":"Interpretar"}</button></div></div>
  {notice&&<p className="quick-schedule-notice" role="status">{notice}</p>}{error&&<p className="quick-schedule-error" role="alert">{error}</p>}
  {fields && <div className="quick-schedule-review">
   <div className="quick-schedule-data"><b>Dados identificados</b><span><UserRound size={14}/>{fields.client.name||"Nome não identificado"}</span>{fields.client.phone&&<span><Phone size={13}/>{fields.client.phone}</span>}<span><MapPin size={14}/>{buildAddress(fields.address)||"Endereço não identificado"}</span><span>{[fields.appointment.service,fields.appointment.equipment].filter(Boolean).join(" • ")||"Serviço a confirmar"}</span><span>{[fields.appointment.date,fields.appointment.time,fields.appointment.technician].filter(Boolean).join(" • ")||"Data, horário e técnico a confirmar"}</span>{fields.appointment.notes&&<small>Observações: {fields.appointment.notes}</small>}</div>
   <div className="quick-schedule-matches"><b>Vínculo de cliente</b>{candidates.length?candidates.map(item=><button type="button" key={item.customer.id} className={selectedId===item.customer.id?"selected":""} onClick={()=>{setSelectedId(item.customer.id);setHomonymChoice(null);setError("")}}><span className="quick-schedule-score">{item.score}%</span><span><strong>{item.customer.name}</strong><small>{[item.customer.phone,item.customer.address||item.customer.city].filter(Boolean).join(" • ")||"Sem telefone ou endereço cadastrado"}</small></span>{item.kind==="strong"?<em>Match forte</em>:item.kind==="homonym"?<em>Possível homônimo</em>:<em>Possível vínculo</em>}</button>):<p className="quick-schedule-new"><CheckCircle2 size={15}/>Nenhum cliente semelhante na base. Será preparado um novo cadastro para revisão.</p>}
   {selected?.kind==="probable"&&<p className="quick-schedule-warning">Possível mesmo cliente: endereço e nome não coincidem com segurança. Confirme o cadastro antes de prosseguir.</p>}
   {selected?.kind==="homonym"&&<div className="quick-schedule-homonym"><b>O nome parece semelhante, mas o endereço é diferente.</b><button type="button" aria-pressed={homonymChoice==="same"} onClick={()=>setHomonymChoice("same")}>Mesmo cliente • usar este endereço nesta OS</button><button type="button" aria-pressed={homonymChoice==="new"} onClick={()=>setHomonymChoice("new")}>Pessoa/empresa diferente • novo cadastro</button></div>}
   {selected?.kind==="strong"&&<p className="quick-schedule-strong"><CheckCircle2 size={14}/>Vínculo forte {selected.phoneMatch?"pelo telefone":"pelo endereço e nome"}; confirme os dados.</p>}
   <footer><button type="button" className="quick-schedule-primary" onClick={confirm} disabled={!fields.client.name&&!fields.client.phone}>{newClient?"Preparar cliente e OS":"Usar cadastro e preparar OS"}</button></footer>
  </div>}
 </section>;
}
