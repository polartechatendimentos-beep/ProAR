"use client";
import { useEffect, useRef, useState } from "react";
import { parseAppointmentVoice, type AppointmentVoiceDraft } from "../lib/chatdesk-voice";
import styles from "../app/atendimento/workspace.module.css";
type Row = Record<string,string>;
type Context = { records: Row[]; customers: Row[]; orders: Row[]; technicians: Row[]; modules: {module:string;count:number}[]; capabilities: {customer:boolean;schedule:boolean;confirmation:boolean} };
type VoiceRecognition = { lang:string; continuous:boolean; interimResults:boolean; maxAlternatives:number; onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null; onerror:((event:{error?:string})=>void)|null; onend:(()=>void)|null; start:()=>void; stop:()=>void };
type VoiceConstructor = new()=>VoiceRecognition;
type CepMatch = {zipCode:string;street:string;complement:string;neighborhood:string;city:string;state:string};
export function ChatdeskSystemActions({ companyId, phone = "", name = "" }: {companyId:string;phone?:string;name?:string}) {
  const [context,setContext] = useState<Context|null>(null);
  const [query,setQuery] = useState(phone);
  const [module,setModule] = useState("");
  const [kind,setKind] = useState("customer");
  const [fields,setFields] = useState<Record<string,string>>({name,phone});
  const [review,setReview] = useState<{command:string;review:string;summary:string;kind:string}|null>(null);
  const [feedback,setFeedback] = useState("");
  const [busy,setBusy] = useState(false);
  const [log,setLog] = useState<string[]>([]);
  const [voiceTranscript,setVoiceTranscript] = useState("");
  const [voiceDraft,setVoiceDraft] = useState<AppointmentVoiceDraft|null>(null);
  const [voiceCity,setVoiceCity] = useState("");
  const [voiceState,setVoiceState] = useState("SP");
  const [voiceStreet,setVoiceStreet] = useState("");
  const [cepMatches,setCepMatches] = useState<CepMatch[]>([]);
  const [cepFeedback,setCepFeedback] = useState("");
  const [cepBusy,setCepBusy] = useState(false);
  const [similarCustomers,setSimilarCustomers] = useState<Row[]>([]);
  const [similarCheck,setSimilarCheck] = useState<"idle"|"clear"|"matches">("idle");
  const [allowSimilarCreate,setAllowSimilarCreate] = useState(false);
  const [listening,setListening] = useState(false);
  const voiceRef = useRef<VoiceRecognition|null>(null);
  useEffect(()=>()=>{voiceRef.current?.stop();},[]);
  const headers = {"Content-Type":"application/json","X-Proar-Company-ID":companyId};
  async function consult(search=query):Promise<Context|null> {
    setBusy(true);setFeedback("");
    try {
      const response = await fetch(`/api/atendimento/acoes?q=${encodeURIComponent(search)}&module=${encodeURIComponent(module)}`,{headers,cache:"no-store"});
      const data = await response.json();if(!response.ok)throw new Error(data.error);
      setContext(data);return data as Context;
    } catch(error) {setFeedback(error instanceof Error?error.message:"Consulta indisponível.");return null;}
    finally{setBusy(false);}
  }
  const value = (key:string) => fields[key] || "";
  function edit(key:string,text:string){setFields(previous=>({...previous,[key]:text}));setReview(null);if(kind==="customer"&&["name","address"].includes(key)){setSimilarCheck("idle");setSimilarCustomers([]);setAllowSimilarCreate(false);}}
  const normalizeComparable=(input:string)=>input.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g," ").trim();
  async function checkSimilarCustomers() {
    const customerName=value("name").trim(), customerAddress=value("address").trim();
    if(customerName.length<3||customerAddress.length<5){setFeedback("Preencha nome e endereço para verificar cadastros parecidos.");return;}
    setBusy(true);setFeedback("");
    try {
      const searches=[customerName,customerAddress].filter(Boolean);
      const results=await Promise.all(searches.map(async term=>{
        const response=await fetch(`/api/atendimento/acoes?q=${encodeURIComponent(term)}&module=`,{headers,cache:"no-store"});
        const data=await response.json();if(!response.ok)throw new Error(data.error||"Consulta de clientes indisponível.");
        return (data.customers||[]) as Row[];
      }));
      const unique=new Map<string,Row>();results.flat().forEach(row=>unique.set(row.id,row));
      const nameKey=normalizeComparable(customerName), addressKey=normalizeComparable(customerAddress);
      const nameTokens=nameKey.split(" ").filter(token=>token.length>2), addressTokens=addressKey.split(" ").filter(token=>token.length>3&&!["rua","avenida","numero","cep","balsamo","mirassol","sp"].includes(token));
      const candidates=[...unique.values()].filter(row=>{
        const existingName=normalizeComparable(String(row.name||"")), existingAddress=normalizeComparable(String(row.address||""));
        const exactOrNearName=existingName===nameKey||(nameKey.length>=5&&(existingName.includes(nameKey)||nameKey.includes(existingName)));
        const sharedName=nameTokens.filter(token=>existingName.includes(token)).length;
        const similarName=nameTokens.length>0&&sharedName>=Math.min(2,nameTokens.length);
        const sharedAddress=addressTokens.filter(token=>existingAddress.includes(token)).length;
        const similarAddress=addressTokens.length>0&&sharedAddress>=Math.min(2,addressTokens.length);
        return exactOrNearName||similarName||similarAddress;
      }).slice(0,8);
      setSimilarCustomers(candidates);setSimilarCheck(candidates.length?"matches":"clear");setAllowSimilarCreate(false);
      setFeedback(candidates.length?"Encontramos possíveis cadastros semelhantes. Confira antes de criar outro.":"Nenhum cliente parecido foi localizado pelo nome ou endereço.");
    } catch(error){setSimilarCheck("idle");setFeedback(error instanceof Error?error.message:"Não foi possível verificar possíveis duplicados.");}
    finally{setBusy(false);}
  }
  function useSimilarCustomer(row:Row) {
    setContext(previous=>previous?({...previous,customers:[row,...previous.customers.filter(item=>item.id!==row.id)]}):previous);
    setKind("schedule");setFields(previous=>({...previous,customer:row.id,address:String(row.address||previous.address||""),voiceName:String(row.name||"")}));
    setFeedback("Cadastro existente selecionado. Complete data, horário e técnico para preparar o agendamento.");
    setSimilarCheck("idle");setAllowSimilarCreate(false);
  }
  async function run(execute=false) {
    const command = execute ? review!.command : kind === "customer" ? ["cadastrar",value("name"),value("phone"),value("address")].join(" | ") : kind === "schedule" ? ["agendar",value("customer"),value("date"),value("time"),value("duration")||"60",value("tech"),value("service"),value("address")].join(" | ") : ["confirmar",value("order")].join(" | ");
    setBusy(true);setFeedback("");
    try {
      const response = await fetch("/api/atendimento/acoes",{method:"POST",headers,body:JSON.stringify({command,...(execute?{review:review!.review}:{})})});
      const data = await response.json();if(!response.ok)throw new Error(data.error);
      if(execute){const completedKind=review?.kind;setLog(previous=>[`${data.message}${data.recordId?` Registro: ${data.recordId}`:""}`,...previous].slice(0,10));setReview(null);if(completedKind==="customer"&&voiceDraft?.name&&data.recordId){setKind("schedule");setFields(previous=>({...previous,customer:data.recordId,voiceName:voiceDraft.name,address:voiceDraft.address||previous.address,service:voiceDraft.service||previous.service,date:voiceDraft.date||previous.date,time:voiceDraft.time||previous.time}));setFeedback("Cliente cadastrado. Complete data, horário e técnico para preparar o agendamento.");}}
      else setReview({...data,command});
    }catch(error){setFeedback(error instanceof Error?error.message:"Ação sem confirmação. Consulte o sistema antes de repetir.");}
    finally{setBusy(false);}
  }
  function startVoice() {
    if(listening){voiceRef.current?.stop();return;}
    const voiceWindow=window as Window & {SpeechRecognition?:VoiceConstructor;webkitSpeechRecognition?:VoiceConstructor};
    const Constructor=voiceWindow.SpeechRecognition||voiceWindow.webkitSpeechRecognition;
    if(!Constructor){setFeedback("Este navegador não oferece ditado por voz. Digite o relato no campo de transcrição.");return;}
    const recognition=new Constructor();recognition.lang="pt-BR";recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
    recognition.onresult=event=>{const transcript=event.results[0]?.[0]?.transcript||"";setVoiceTranscript(transcript);void applyVoice(transcript);};
    recognition.onerror=event=>{setFeedback(event.error==="not-allowed"?"Permissão de microfone negada. Você ainda pode digitar o relato.":"Não foi possível reconhecer o áudio. Tente novamente ou digite o relato.");};
    recognition.onend=()=>{setListening(false);voiceRef.current=null;};
    voiceRef.current=recognition;setFeedback("");setListening(true);recognition.start();
  }
  async function applyVoice(transcript=voiceTranscript) {
    const parsed=parseAppointmentVoice(transcript);
    setVoiceDraft(parsed);setVoiceCity(parsed.city);setVoiceState(parsed.state||"SP");setVoiceStreet(parsed.street);setCepMatches([]);setCepFeedback("");setKind("schedule");setReview(null);
    setFields(previous=>({...previous,voiceName:parsed.name,address:parsed.address||previous.address||"",service:parsed.service||previous.service||"",date:parsed.date||previous.date||"",time:parsed.time||previous.time||"",duration:previous.duration||"60",customer:""}));
    if(!parsed.name&&!parsed.address&&!parsed.service){setFeedback("Não consegui separar nome, endereço e problema. Revise o texto ou dite em frases curtas.");return;}
    setFeedback("Relato interpretado. Confira os campos e complete os dados que faltam antes de criar o agendamento.");
    const search=parsed.phone||parsed.name;
    if(search){
      const found=await consult(search);
      const normalize=(value:string)=>value.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
      const phoneDigits=(value:string)=>value.replace(/\\D/g,"").replace(/^55/,"");
      const parsedDigits=phoneDigits(parsed.phone);
      const matches=(found?.customers||[]).filter(row=>parsed.phone?phoneDigits(String(row.phone||""))===parsedDigits:normalize(row.name)===normalize(parsed.name));
      if(matches.length===1){setFields(previous=>({...previous,customer:matches[0].id,address:parsed.address||matches[0].address||previous.address}));setFeedback("Cliente localizado. Confira o endereço, relato, data, horário e técnico antes de gravar.");}
      else if(parsed.name)setFeedback("Relato interpretado, mas o cliente não foi localizado de forma única. Selecione o cadastro correto ou cadastre o cliente com telefone.");
    }
  }
  async function validateVoiceAddress() {
    if(voiceCity.trim().length<3||voiceStreet.trim().length<3||voiceState.trim().length!==2){setCepFeedback("Informe cidade, UF e ao menos 3 letras do logradouro.");return;}
    setCepBusy(true);setCepFeedback("");
    try {
      const params=new URLSearchParams({city:voiceCity.trim(),state:voiceState.trim().toUpperCase(),street:voiceStreet.trim()});
      const response=await fetch(`/api/cep/search?${params.toString()}`,{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Não foi possível localizar o CEP.");
      setCepMatches((data.matches||[]) as CepMatch[]);
      setCepFeedback(data.matches?.length===1?"Encontramos uma opção. Confira o logradouro e selecione para preencher o endereço.":"Selecione a correspondência correta para preencher o CEP e complementar o endereço.");
    } catch(error){setCepFeedback(error instanceof Error?error.message:"Consulta de CEP indisponível.");setCepMatches([]);}
    finally{setCepBusy(false);}
  }
  function useCepMatch(match:CepMatch) {
    const number=voiceDraft?.address.match(/\\b(?:n(?:ú|u)mero|n[º°o]|#)\\s*(\\d+[A-Za-z]?)\\b/i)?.[1];
    const reference=voiceDraft?.address.match(/\\(([^)]+)\\)/)?.[1];
    const address=[match.street,number?`nº ${number}`:null,match.complement,match.neighborhood,match.city+`/${match.state}`,`CEP ${match.zipCode}`,reference?`Referência: ${reference}`:null].filter(Boolean).join(" • ");
    setFields(previous=>({...previous,address}));
    setVoiceDraft(previous=>previous?({...previous,address,city:match.city,state:match.state,street:match.street}):previous);
    setCepFeedback("Endereço e CEP preenchidos. Confirme com o cliente o número, bloco e complemento.");
    setCepMatches([]);
  }
  function prepareVoiceCustomer() {
    if(!voiceDraft)return;
    setKind("customer");setReview(null);setFields(previous=>({...previous,name:voiceDraft.name||previous.name,phone:voiceDraft.phone||previous.phone,address:voiceDraft.address||previous.address}));
    setFeedback("Complete o WhatsApp com DDD e confirme o cadastro. Depois consulte e selecione o cliente para agendar.");
  }
  return <section className={`${styles.panel} ${styles.systemActions}`} aria-label="Assistente operacional do sistema">
    <span className={styles.badge}>AÇÕES REAIS NO PROAR</span><h2>Assistente operacional</h2>
    <p>Consulte os dados da empresa, cadastre clientes e agende atendimentos. Comandos guiados locais, sem serviço externo de IA. Cada ação respeita seu perfil e fica registrada no sistema.</p>
    <form className={styles.actions} onSubmit={event=>{event.preventDefault();void consult();}}><label>Buscar cliente ou agendamento<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Nome, telefone, OS ou data" maxLength={100}/></label><label>Módulo<select value={module} onChange={event=>setModule(event.target.value)}><option value="">Clientes e agenda</option>{context?.modules.map(item=><option key={item.module} value={item.module}>{item.module}</option>)}</select></label><button disabled={busy}>Consultar sistema</button></form>
    {context && <><p>Consulta limitada a 30 clientes e 50 OS por busca. Refine o termo para localizar outros registros.</p><details><summary>Módulos disponíveis ao seu perfil</summary><p>{context.modules.map(module=>`${module.module}: ${module.count}`).join(" • ") || "Nenhum módulo adicional disponível."}</p></details>
      {module && <div className={styles.tableWrap}><table><caption>Registros do módulo selecionado • até 50 resultados</caption><thead><tr><th>ID</th><th>Registro</th><th>Cliente</th><th>Data</th><th>Status</th></tr></thead><tbody>{context.records.map(row=><tr key={row.id}><td>{row.id}</td><td>{row.name}</td><td>{row.client}</td><td>{row.date}</td><td>{row.status}</td></tr>)}</tbody></table></div>}
      <div className={styles.tableWrap}><table><caption>Clientes encontrados</caption><thead><tr><th>Cliente</th><th>ID</th><th>Contato</th><th>Ação</th></tr></thead><tbody>{context.customers.map(row=><tr key={row.id}><td>{row.name}</td><td>{row.id}</td><td>{row.phone}</td><td><button onClick={()=>{setKind("schedule");setFields(previous=>({...previous,customer:row.id,address:row.address||""}));setReview(null);}}>Agendar</button></td></tr>)}</tbody></table></div>
      <div className={styles.tableWrap}><table><caption>Agendamentos encontrados</caption><thead><tr><th>OS / Cliente</th><th>Data e hora</th><th>Técnico</th><th>Confirmação</th><th>Ação</th></tr></thead><tbody>{context.orders.map(row=><tr key={row.id}><td>{row.id}<br/>{row.client}</td><td>{row.date} {row.time}</td><td>{row.tech}</td><td>{row.confirmation}</td><td><button onClick={()=>{setKind("confirmation");edit("order",row.id);}}>Pedir confirmação</button></td></tr>)}</tbody></table></div></>}
    <section className={styles.voiceCapture} aria-label="Agendamento por áudio">
      <div><span className={styles.badge}>DITADO EM PORTUGUÊS</span><h3>Agendar por áudio</h3><p>Dite o nome, endereço, problema e, se souber, a data e o horário. O ProAR prepara um rascunho para revisão; não cria a OS automaticamente.</p></div>
      <button type="button" disabled={busy} onClick={startVoice}>{listening?"Parar gravação":"Falar com o microfone"}</button>
      <label>Transcrição para revisar<textarea value={voiceTranscript} onChange={event=>setVoiceTranscript(event.target.value)} maxLength={1500} placeholder="Ex.: José da Silva. Rua João Paulo II, 3017, bloco 6, AP 302, Mirassol. Ar não está gelando."/></label>
      <div className={styles.voiceButtons}><button type="button" disabled={busy||!voiceTranscript.trim()} onClick={()=>void applyVoice()}>Interpretar e preencher</button>{voiceDraft?.name&&<button type="button" disabled={busy} onClick={prepareVoiceCustomer}>Cadastrar novo cliente</button>}</div>
      <small>O reconhecimento usa o navegador ou serviço de voz do aparelho; o áudio não é enviado ao ProAR. Revise a transcrição antes de salvar.</small>
      {voiceDraft&&<div className={styles.voicePreview}><b>Confira o que foi entendido</b><span>Cliente: {voiceDraft.name||"não identificado"}</span><span>Endereço informado: {voiceDraft.address||"não identificado"}</span><div className={styles.addressLookup}><label>Cidade<input value={voiceCity} onChange={event=>setVoiceCity(event.target.value)} maxLength={80} placeholder="Ex.: Bálsamo"/></label><label>UF<input value={voiceState} onChange={event=>setVoiceState(event.target.value.toUpperCase().slice(0,2))} maxLength={2} placeholder="SP"/></label><label>Logradouro para busca de CEP<input value={voiceStreet} onChange={event=>setVoiceStreet(event.target.value)} maxLength={100} placeholder="Ex.: Elson Pelisson"/></label><button type="button" disabled={cepBusy||busy} onClick={()=>void validateVoiceAddress()}>{cepBusy?"Buscando CEP…":"Validar endereço e buscar CEP"}</button></div>{cepFeedback&&<small role="status">{cepFeedback}</small>}{cepMatches.length>0&&<div className={styles.cepMatches} aria-label="Endereços encontrados">{cepMatches.map(match=><button type="button" key={match.zipCode+match.street} onClick={()=>useCepMatch(match)}><b>{match.street}</b><span>{[match.neighborhood,match.city+"/"+match.state,"CEP "+match.zipCode].filter(Boolean).join(" • ")}</span></button>)}</div>}<small>O CEP identifica o logradouro ou região. Confirme número, bloco e apartamento com o cliente antes de salvar.</small><span>Relato: {voiceDraft.service||"não identificado"}</span><span>Data e horário: {voiceDraft.date||"pendentes"} {voiceDraft.time||""}</span></div>}
    </section>
    <hr/><form onSubmit={event=>{event.preventDefault();if(kind==="customer"){if(similarCheck==="idle"){void checkSimilarCustomers();return;}if(similarCheck==="matches"&&!allowSimilarCreate){setFeedback("Confira os resultados e selecione o cadastro existente ou confirme que é outra pessoa.");return;}}void run();}}>
      <label>O que deseja fazer?<select value={kind} onChange={event=>{setKind(event.target.value);setReview(null);}}><option value="customer">Cadastrar cliente</option><option value="schedule">Criar agendamento</option><option value="confirmation">Enviar pedido de confirmação</option></select></label>
      {kind === "customer" && <><label>Nome completo<input required value={value("name")} onChange={event=>edit("name",event.target.value)} maxLength={150}/></label><label>WhatsApp com DDD<input required type="tel" value={value("phone")} onChange={event=>edit("phone",event.target.value)} maxLength={20}/></label><label>Endereço<input required value={value("address")} onChange={event=>edit("address",event.target.value)} maxLength={500} placeholder="Rua, número, bairro, cidade e CEP"/></label><button type="button" disabled={busy} onClick={()=>void checkSimilarCustomers()}>{busy?"Verificando…":"Verificar nome e endereço parecidos"}</button>{similarCheck==="clear"&&<p role="status">Verificação concluída: nenhum cadastro parecido localizado.</p>}{similarCustomers.length>0&&<div className={styles.similarCustomers} role="status"><b>Possíveis cadastros existentes</b>{similarCustomers.map(row=><article key={row.id}><span><strong>{row.name}</strong> • {row.id}</span><small>{row.address||"Endereço não informado"}{row.phone?` • ${row.phone}`:""}</small><button type="button" onClick={()=>useSimilarCustomer(row)}>Usar este cadastro</button></article>)}<label className={styles.similarConsent}><input type="checkbox" checked={allowSimilarCreate} onChange={event=>setAllowSimilarCreate(event.target.checked)}/>Conferi os resultados e este cadastro é de outra pessoa.</label></div>}</>}
      {kind === "schedule" && <>{voiceDraft?.name&&<label>Nome informado por áudio<input value={value("voiceName")} onChange={event=>edit("voiceName",event.target.value)} maxLength={150}/></label>}<label>Cliente<select required value={value("customer")} onChange={event=>edit("customer",event.target.value)}><option value="">Consulte e selecione o cliente</option>{context?.customers.map(row=><option key={row.id} value={row.id}>{row.name} • {row.id}</option>)}</select></label><div className={styles.actions}><label>Data<input required type="date" value={value("date")} onChange={event=>edit("date",event.target.value)}/></label><label>Horário de Brasília<input required type="time" value={value("time")} onChange={event=>edit("time",event.target.value)}/></label><label>Duração em minutos<input type="number" min={15} max={480} value={value("duration")||"60"} onChange={event=>edit("duration",event.target.value)}/></label></div><label>Técnico<select required value={value("tech")} onChange={event=>edit("tech",event.target.value)}><option value="">Consulte e selecione o técnico</option>{context?.technicians.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>Serviço<input required value={value("service")} maxLength={500} onChange={event=>edit("service",event.target.value)}/></label></>}
      {kind !== "confirmation" && <label>Endereço do atendimento<input required maxLength={500} value={value("address")} onChange={event=>edit("address",event.target.value)}/></label>}
      {kind === "confirmation" && <><label>Número da OS<input required value={value("order")} onChange={event=>edit("order",event.target.value)}/></label><p>O destinatário e o horário serão carregados da OS. A resposta CONFIRMAR + número da OS registra a presença; REAGENDAR registra um pedido, sem mudar o horário automaticamente.</p></>}
      <button disabled={busy}>Preparar ação</button>
    </form>
    {review && <section className={styles.actionReview} aria-label="Revisão da ação"><h3>Confira os dados</h3><p>{review.summary}</p><div className={styles.actions}><button disabled={busy} onClick={()=>void run(true)}>{review.kind==="confirmation"?"Enviar confirmação pelo WhatsApp":"Executar no ProAR"}</button><button disabled={busy} onClick={()=>setReview(null)}>Descartar</button></div></section>}
    {feedback && <p role="alert">{feedback}</p>}
    <div role="log" aria-label="Resultados das ações">{log.map((message,index)=><p key={`${index}-${message}`}>{message}</p>)}</div>
  </section>;
}
