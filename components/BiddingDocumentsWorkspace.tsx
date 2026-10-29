"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {upload} from "@vercel/blob/client";
import {DOCUMENT_CATEGORIES,DOCUMENT_LIMIT,documentChecklist,type BiddingDocument,type DocumentCategory} from "@/lib/bidding-documents";
type DocumentView=Omit<BiddingDocument,"pathname">&{status:string};
const endpoint="/api/bidding-documents";
export function BiddingDocumentsWorkspace({companyName}:{companyName:string}){
 const [documents,setDocuments]=useState<DocumentView[]>([]),[tenders,setTenders]=useState<{id:string;name:string}[]>([]);
 const [files,setFiles]=useState<File[]>([]),[category,setCategory]=useState<DocumentCategory>("CND Federal"),[tenderId,setTenderId]=useState("");
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[canEdit,setCanEdit]=useState(false),[configured,setConfigured]=useState(false),[hasMore,setHasMore]=useState(false);
 const [selected,setSelected]=useState<DocumentView|null>(null),[review,setReview]=useState("received"),[note,setNote]=useState(""),[validUntil,setValidUntil]=useState(""),[noExpiry,setNoExpiry]=useState(false),[identityChecked,setIdentityChecked]=useState(false),[contentChecked,setContentChecked]=useState(false),[tenderChecked,setTenderChecked]=useState(false);
 const lock=useRef(false);
 const load=useCallback(async(append=false,offset=0)=>{
  const response=await fetch(endpoint+"?offset="+offset,{cache:"no-store"}),body=await response.json();
  if(!response.ok)throw new Error(body.error||"Não foi possível consultar documentos.");
  setDocuments(current=>append?[...current,...body.documents]:body.documents);setTenders(body.tenders||[]);setCanEdit(body.canEdit===true);setConfigured(body.storageConfigured===true);setHasMore(body.hasMore===true);
 },[]);
 useEffect(()=>{void load().catch(error=>setNotice(error.message));},[load]);
 const post=async(body:Record<string,unknown>)=>{
  const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),result=await response.json();
  if(!response.ok)throw new Error(result.error||"Operação não confirmada.");return result;
 };
 const send=async()=>{
  if(lock.current||!files.length)return;lock.current=true;setBusy(true);setNotice("");
  let saved=0;const failed:File[]=[],errors:string[]=[];
  try{
   for(const file of files){
    try{
     const prepared=await post({action:"prepare",name:file.name,filename:file.name,mime:file.type,size:file.size,category,tenderId});
     if(!prepared.prepared)throw new Error("Envio não preparado no servidor.");
     await upload(prepared.pathname,file,{access:"private",handleUploadUrl:endpoint+"/upload",clientPayload:JSON.stringify({id:prepared.id}),multipart:file.size>4*1024*1024});
     const result=await post({action:"complete",id:prepared.id});if(result.saved!==true)throw new Error("Arquivo enviado, mas recebimento ainda não confirmado.");
     saved++;
    }catch(error){failed.push(file);errors.push(file.name+": "+(error instanceof Error?error.message:"Falha no envio"));}
   }
   setFiles(failed);await load();setNotice(saved+" arquivo(s) recebido(s) e persistido(s), aguardando conferência. "+errors.join(" • "));
  }catch(error){setNotice(error instanceof Error?error.message:"Falha ao atualizar a lista. Confira os registros antes de reenviar.");}
  finally{lock.current=false;setBusy(false);}
 };
 const openReview=(doc:DocumentView)=>{setSelected(doc);setReview(doc.review);setNote("");setValidUntil(doc.validUntil);setNoExpiry(doc.noExpiry);setIdentityChecked(false);setContentChecked(false);setTenderChecked(false);};
 const saveReview=async()=>{
  if(!selected||lock.current)return;lock.current=true;setBusy(true);setNotice("");
  try{
   const result=await post({action:"review",id:selected.id,expectedRevision:selected._revision,review,note,validUntil,noExpiry,identityChecked,contentChecked,tenderChecked});
   if(result.saved!==true)throw new Error("Conferência não confirmada.");
   setSelected(null);await load();setNotice("Conferência salva no servidor, com responsável e histórico.");
  }catch(error){setNotice(error instanceof Error?error.message:"Falha ao salvar conferência.");}finally{lock.current=false;setBusy(false);}
 };
 const confirmReceipt=async(id:string)=>{
  if(lock.current)return;lock.current=true;setBusy(true);
  try{const result=await post({action:"complete",id});if(result.saved!==true)throw new Error("Recebimento não confirmado.");await load();setNotice("Arquivo recebido; ainda depende de conferência.");}
  catch(error){setNotice(error instanceof Error?error.message:"Falha ao confirmar.");}finally{lock.current=false;setBusy(false);}
 };
 const fullHistory=async(id:string)=>{
  try{const response=await fetch(endpoint+"?id="+id,{cache:"no-store"}),body=await response.json();if(!response.ok)throw new Error(body.error||"Histórico indisponível.");setDocuments(current=>current.map(doc=>doc.id===id?body.document:doc));setNotice("Histórico completo carregado para o documento.");}catch(error){setNotice(error instanceof Error?error.message:"Falha ao consultar histórico.");}
 };
 const scoped=documents.filter(doc=>tenderId?doc.tenderId===tenderId:!doc.tenderId);
 const checklist=documentChecklist(documents,tenderId);
 const today=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
 const expiring=scoped.filter(doc=>doc.uploaded&&doc.validUntil&&doc.validUntil>=today&&Math.ceil((Date.parse(doc.validUntil+"T12:00:00Z")-Date.parse(today+"T12:00:00Z"))/86400000)<=30);
 const expired=scoped.filter(doc=>doc.uploaded&&doc.validUntil&&doc.validUntil<today);
 const report=()=>{const lines=["PROAR — RELATÓRIO PRELIMINAR DE HABILITAÇÃO","Empresa: "+companyName,"Edital: "+(tenders.find(t=>t.id===tenderId)?.name||"Cofre da empresa"),"Emissão: "+new Date().toLocaleString("pt-BR"),"",...scoped.map(doc=>[doc.name,doc.category,doc.status,doc.validUntil||"Validade não informada",doc.reviewedBy||"Sem revisão"].join(" | ")),"","CHECKLIST DE REFERÊNCIA",...checklist.map(item=>item.category+": "+(item.approved?"Conferido":"Pendente")),"","Este relatório não substitui a análise do edital e a verificação de autenticidade."];const blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="proar-auditoria-documental.txt";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const suggestCategory=(name:string):DocumentCategory=>{const n=name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();if(/fgts|crf/.test(n))return "FGTS";if(/cndt|trabalhist/.test(n))return "Trabalhista";if(/federal|receita|uniao/.test(n))return "CND Federal";if(/estadual|sefaz/.test(n))return "CND Estadual";if(/municipal|prefeitura/.test(n))return "CND Municipal";if(/crea|cft/.test(n))return "CREA / CFT";if(/atestado|capacidade/.test(n))return "Atestado técnico";if(/\bart\b|anotacao.responsabilidade/.test(n))return "ART";return "Outros";};

 return <section className="panel bidding-private-documents" aria-label="Arquivos reais de habilitação" style={{padding:18,marginBottom:18}}>
  <h3>Arquivos e conferência de habilitação</h3><p><strong>Empresa: {companyName}</strong>. Arquivos privados por empresa. Anexar não significa aprovar; cada documento exige revisão humana.</p>
  {!configured&&<p role="status">Armazenamento privado não confirmado nesta instalação. O envio ficará bloqueado até a configuração estar disponível.</p>}
  <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
   <div className="form-grid" style={{padding:0}}>
    <label>Categoria<select disabled={!canEdit} value={category} onChange={event=>setCategory(event.target.value as DocumentCategory)}>{DOCUMENT_CATEGORIES.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Vínculo ao edital<select value={tenderId} onChange={event=>setTenderId(event.target.value)}><option value="">Cofre da empresa • sem edital específico</option>{tenders.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><small>Salve o edital no acompanhamento para vinculá-lo aqui.</small></label>
    <label className="wide">Arquivos reais • PDF, JPG ou PNG • até 10 MB cada<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" disabled={!configured||!canEdit} onChange={event=>{
     const batch=Array.from(event.target.files||[]);event.target.value="";
     const valid=batch.filter(file=>file.size>0&&file.size<=DOCUMENT_LIMIT&&["application/pdf","image/png","image/jpeg"].includes(file.type));
     setFiles(valid.slice(0,10));if(valid.length>0){const guess=suggestCategory(valid[0].name);if(guess!=="Outros")setCategory(guess);}setNotice(valid.length!==batch.length||batch.length>10?"Selecione até 10 arquivos PDF/JPG/PNG, com até 10 MB por arquivo. Os demais não foram selecionados.":"Arquivos selecionados apenas neste aparelho; use Enviar para salvar no servidor.");
    }}/></label>
   </div><ul>{files.map((file,index)=><li key={file.name+index}>{file.name} • {(file.size/1024/1024).toFixed(2)} MB</li>)}</ul>
   <button type="button" className="primary-btn" disabled={!canEdit||!configured||!files.length||busy} onClick={()=>void send()}>{busy?"Processando…":"Enviar arquivos privados"}</button>
  </fieldset>
  <p role="status" aria-live="polite">{notice}</p><div role="status" style={{padding:12,border:"1px solid #527493",borderRadius:8,marginTop:12}}><strong>Alertas documentais:</strong> {expired.length} vencido(s) • {expiring.length} com vencimento em até 30 dias. {expired.length>0&&<p>Vencidos: {expired.map(doc=>doc.name).join(" · ")}</p>}{expiring.length>0&&<p>Próximos do vencimento: {expiring.map(doc=>doc.name+" ("+doc.validUntil+")").join(" · ")}</p>}<button type="button" className="outline-btn" disabled={!scoped.length||hasMore} onClick={report}>Exportar relatório preliminar</button>{hasMore&&<small> Carregue todos os registros antes de exportar.</small>}</div>
  <p style={{fontSize:12}}>Recebido confirma o arquivo no servidor. Aprovado exige conferência registrada. Validade é verificada diariamente pela data informada. A verificação de formato não é antivírus nem validação automática do conteúdo legal.</p>
  <button type="button" className="outline-btn" disabled={busy} onClick={()=>void load().catch(error=>setNotice(error.message))}>Atualizar documentos</button>
  <div style={{overflowX:"auto",marginTop:14}}><table style={{width:"100%",minWidth:720}}><thead><tr><th>Documento</th><th>Edital</th><th>Situação</th><th>Validade</th><th>Arquivo / Conferência</th></tr></thead><tbody>{scoped.map(doc=><tr key={doc.id}>
   <td><strong>{doc.name}</strong><small style={{display:"block"}}>{doc.category} • {(doc.size/1024/1024).toFixed(2)} MB</small></td><td>{doc.tenderId?tenders.find(item=>item.id===doc.tenderId)?.name||"Edital vinculado":"Cofre da empresa"}</td><td>{doc.status}</td><td>{doc.validUntil|| (doc.noExpiry?"Sem vencimento • conferido":"Não conferida")}</td><td>{doc.uploaded?<a href={endpoint+"?id="+doc.id+"&download=1"} target="_blank" rel="noopener noreferrer">Baixar arquivo real</a>:<button type="button" disabled={busy||!canEdit} onClick={()=>void confirmReceipt(doc.id)}>Confirmar recebimento</button>} <button type="button" className="outline-btn" disabled={busy||!canEdit||!doc.uploaded} onClick={()=>openReview(doc)}>Conferir</button><details><summary>Histórico • últimas revisões carregadas</summary><button type="button" className="outline-btn" onClick={()=>void fullHistory(doc.id)}>Carregar histórico completo</button>{doc.audit.map((event,index)=><p key={index}>{new Date(event.at).toLocaleString("pt-BR")} • {event.actor} • {event.action}: {event.note}</p>)}</details></td>
  </tr>)}</tbody></table>{!scoped.length&&<p>Nenhum arquivo persistido para este vínculo. Registros antigos por nome continuam abaixo e não são considerados arquivos recebidos.</p>}</div>
  {hasMore&&<button type="button" disabled={busy} onClick={()=>void load(true,documents.length).catch(error=>setNotice(error.message))}>Carregar mais documentos</button>}
  {selected&&<section aria-label="Conferência do arquivo" style={{padding:16,border:"1px solid #54799b",borderRadius:12,marginTop:16}}>
   <h4>Conferir: {selected.name}</h4><p>A decisão será registrada para esta versão do arquivo e este vínculo.</p><fieldset disabled={busy} style={{border:0,padding:0}}><div className="form-grid" style={{padding:0}}>
    <label>Decisão<select value={review} onChange={event=>setReview(event.target.value)}><option value="received">Recebido • aguardar revisão</option><option value="approved">Aprovar manualmente</option><option value="rejected">Rejeitar</option></select></label>
    <label>Validade informada no documento<input type="date" value={validUntil} onChange={event=>{setValidUntil(event.target.value);setNoExpiry(false);}}/></label>
    <label className="wide"><span><input type="checkbox" style={{width:18,height:18,minHeight:0,display:"inline-block",margin:"0 8px 0 0",verticalAlign:"middle"}} checked={noExpiry} onChange={event=>{setNoExpiry(event.target.checked);if(event.target.checked)setValidUntil("");}}/> Conferi que este documento não possui vencimento</span></label>
    <label className="wide"><span><input type="checkbox" style={{width:18,height:18,minHeight:0,display:"inline-block",margin:"0 8px 0 0",verticalAlign:"middle"}} checked={identityChecked} onChange={event=>setIdentityChecked(event.target.checked)}/> Conferi a identificação da empresa no arquivo</span></label>
    <label className="wide"><span><input type="checkbox" style={{width:18,height:18,minHeight:0,display:"inline-block",margin:"0 8px 0 0",verticalAlign:"middle"}} checked={contentChecked} onChange={event=>setContentChecked(event.target.checked)}/> Li o conteúdo e conferi autenticidade e condições na origem</span></label>
    {selected.tenderId&&<label className="wide"><span><input type="checkbox" style={{width:18,height:18,minHeight:0,display:"inline-block",margin:"0 8px 0 0",verticalAlign:"middle"}} checked={tenderChecked} onChange={event=>setTenderChecked(event.target.checked)}/> Conferi adequação às exigências deste edital</span></label>}
    <label className="wide">Justificativa / observações • obrigatório<textarea value={note} onChange={event=>setNote(event.target.value)} maxLength={2000}/></label>
   </div><button type="button" className="outline-btn" onClick={()=>setSelected(null)}>Cancelar conferência</button> <button type="button" className="primary-btn" onClick={()=>void saveReview()}>Salvar conferência</button></fieldset>
  </section>}
  <details style={{marginTop:16}}><summary>Checklist de conferência • {tenderId?"somente este edital":"cofre da empresa"}</summary><p>Checklist de apoio. Os documentos exigidos devem ser conferidos no edital; a lista não garante habilitação. Documentos do cofre não aprovam automaticamente um edital.</p><ul>{checklist.map(item=><li key={item.category}>{item.approved?"✓ Aprovado":"○ Pendente"} — {item.category} • {item.received} arquivo(s) recebido(s)</li>)}</ul>{hasMore&&<p>Lista parcial: carregue as demais páginas antes de concluir a conferência.</p>}</details>
 </section>;
}
