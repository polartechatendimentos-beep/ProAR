"use client";
import { useState } from "react";
import styles from "../app/atendimento/workspace.module.css";
type Row = Record<string,string>;
type Context = { records: Row[]; customers: Row[]; orders: Row[]; technicians: Row[]; modules: {module:string;count:number}[]; capabilities: {customer:boolean;schedule:boolean;confirmation:boolean} };
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
  const headers = {"Content-Type":"application/json","X-Proar-Company-ID":companyId};
  async function consult() {
    setBusy(true);setFeedback("");
    try {
      const response = await fetch(`/api/atendimento/acoes?q=${encodeURIComponent(query)}&module=${encodeURIComponent(module)}`,{headers,cache:"no-store"});
      const data = await response.json();if(!response.ok)throw new Error(data.error);
      setContext(data);
    } catch(error) {setFeedback(error instanceof Error?error.message:"Consulta indisponível.");}
    finally{setBusy(false);}
  }
  const value = (key:string) => fields[key] || "";
  function edit(key:string,text:string){setFields(previous=>({...previous,[key]:text}));setReview(null);}
  async function run(execute=false) {
    const command = execute ? review!.command : kind === "customer" ? ["cadastrar",value("name"),value("phone"),value("address")].join(" | ") : kind === "schedule" ? ["agendar",value("customer"),value("date"),value("time"),value("duration")||"60",value("tech"),value("service"),value("address")].join(" | ") : ["confirmar",value("order")].join(" | ");
    setBusy(true);setFeedback("");
    try {
      const response = await fetch("/api/atendimento/acoes",{method:"POST",headers,body:JSON.stringify({command,...(execute?{review:review!.review}:{})})});
      const data = await response.json();if(!response.ok)throw new Error(data.error);
      if(execute){setLog(previous=>[`${data.message}${data.recordId?` Registro: ${data.recordId}`:""}`,...previous].slice(0,10));setReview(null);}
      else setReview({...data,command});
    }catch(error){setFeedback(error instanceof Error?error.message:"Ação sem confirmação. Consulte o sistema antes de repetir.");}
    finally{setBusy(false);}
  }
  return <section className={`${styles.panel} ${styles.systemActions}`} aria-label="Assistente operacional do sistema">
    <span className={styles.badge}>AÇÕES REAIS NO PROAR</span><h2>Assistente operacional</h2>
    <p>Consulte os dados da empresa, cadastre clientes e agende atendimentos. Comandos guiados locais, sem serviço externo de IA. Cada ação respeita seu perfil e fica registrada no sistema.</p>
    <form className={styles.actions} onSubmit={event=>{event.preventDefault();void consult();}}><label>Buscar cliente ou agendamento<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Nome, telefone, OS ou data" maxLength={100}/></label><label>Módulo<select value={module} onChange={event=>setModule(event.target.value)}><option value="">Clientes e agenda</option>{context?.modules.map(item=><option key={item.module} value={item.module}>{item.module}</option>)}</select></label><button disabled={busy}>Consultar sistema</button></form>
    {context && <><p>Consulta limitada a 30 clientes e 50 OS por busca. Refine o termo para localizar outros registros.</p><details><summary>Módulos disponíveis ao seu perfil</summary><p>{context.modules.map(module=>`${module.module}: ${module.count}`).join(" • ") || "Nenhum módulo adicional disponível."}</p></details>
      {module && <div className={styles.tableWrap}><table><caption>Registros do módulo selecionado • até 50 resultados</caption><thead><tr><th>ID</th><th>Registro</th><th>Cliente</th><th>Data</th><th>Status</th></tr></thead><tbody>{context.records.map(row=><tr key={row.id}><td>{row.id}</td><td>{row.name}</td><td>{row.client}</td><td>{row.date}</td><td>{row.status}</td></tr>)}</tbody></table></div>}
      <div className={styles.tableWrap}><table><caption>Clientes encontrados</caption><thead><tr><th>Cliente</th><th>ID</th><th>Contato</th><th>Ação</th></tr></thead><tbody>{context.customers.map(row=><tr key={row.id}><td>{row.name}</td><td>{row.id}</td><td>{row.phone}</td><td><button onClick={()=>{setKind("schedule");setFields(previous=>({...previous,customer:row.id,address:row.address||""}));setReview(null);}}>Agendar</button></td></tr>)}</tbody></table></div>
      <div className={styles.tableWrap}><table><caption>Agendamentos encontrados</caption><thead><tr><th>OS / Cliente</th><th>Data e hora</th><th>Técnico</th><th>Confirmação</th><th>Ação</th></tr></thead><tbody>{context.orders.map(row=><tr key={row.id}><td>{row.id}<br/>{row.client}</td><td>{row.date} {row.time}</td><td>{row.tech}</td><td>{row.confirmation}</td><td><button onClick={()=>{setKind("confirmation");edit("order",row.id);}}>Pedir confirmação</button></td></tr>)}</tbody></table></div></>}
    <hr/><form onSubmit={event=>{event.preventDefault();void run();}}>
      <label>O que deseja fazer?<select value={kind} onChange={event=>{setKind(event.target.value);setReview(null);}}><option value="customer">Cadastrar cliente</option><option value="schedule">Criar agendamento</option><option value="confirmation">Enviar pedido de confirmação</option></select></label>
      {kind === "customer" && <><label>Nome completo<input required value={value("name")} onChange={event=>edit("name",event.target.value)} maxLength={150}/></label><label>WhatsApp com DDD<input required type="tel" value={value("phone")} onChange={event=>edit("phone",event.target.value)} maxLength={20}/></label></>}
      {kind === "schedule" && <><label>Cliente<select required value={value("customer")} onChange={event=>edit("customer",event.target.value)}><option value="">Consulte e selecione o cliente</option>{context?.customers.map(row=><option key={row.id} value={row.id}>{row.name} • {row.id}</option>)}</select></label><div className={styles.actions}><label>Data<input required type="date" value={value("date")} onChange={event=>edit("date",event.target.value)}/></label><label>Horário de Brasília<input required type="time" value={value("time")} onChange={event=>edit("time",event.target.value)}/></label><label>Duração em minutos<input type="number" min={15} max={480} value={value("duration")||"60"} onChange={event=>edit("duration",event.target.value)}/></label></div><label>Técnico<select required value={value("tech")} onChange={event=>edit("tech",event.target.value)}><option value="">Consulte e selecione o técnico</option>{context?.technicians.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>Serviço<input required value={value("service")} maxLength={500} onChange={event=>edit("service",event.target.value)}/></label></>}
      {kind !== "confirmation" && <label>Endereço do atendimento<input required maxLength={500} value={value("address")} onChange={event=>edit("address",event.target.value)}/></label>}
      {kind === "confirmation" && <><label>Número da OS<input required value={value("order")} onChange={event=>edit("order",event.target.value)}/></label><p>O destinatário e o horário serão carregados da OS. A resposta CONFIRMAR + número da OS registra a presença; REAGENDAR registra um pedido, sem mudar o horário automaticamente.</p></>}
      <button disabled={busy}>Preparar ação</button>
    </form>
    {review && <section className={styles.actionReview} aria-label="Revisão da ação"><h3>Confira os dados</h3><p>{review.summary}</p><div className={styles.actions}><button disabled={busy} onClick={()=>void run(true)}>{review.kind==="confirmation"?"Enviar confirmação pelo WhatsApp":"Executar no ProAR"}</button><button disabled={busy} onClick={()=>setReview(null)}>Descartar</button></div></section>}
    {feedback && <p role="alert">{feedback}</p>}
    <div role="log" aria-label="Resultados das ações">{log.map((message,index)=><p key={`${index}-${message}`}>{message}</p>)}</div>
  </section>;
}
