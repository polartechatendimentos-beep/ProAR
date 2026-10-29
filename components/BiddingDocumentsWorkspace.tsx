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
 const scoped=documents.filter(doc=>tenderId?doc.tenderId===tenderId:!doc.tenderId);
 const checklist=documentChecklist(documents as BiddingDocument[],tenderId);
 return <section className="panel bidding-private-documents" aria-label="Arquivos reais de habilitação" style={{padding:18,marginBottom:18}}>
  <h3>Arquivos e conferência de habilitação</h3><p><strong>Empresa: {companyName}</strong>. Arquivos privados por empresa. Anexar não significa aprovar; cada documento exige revisão humana.</p>
  {!configured&&<p role="status">Armazenamento privado não confirmado nesta instalação. O envio ficará bloqueado até a configuração estar disponível.</p>}
  <fieldset disabled={busy||!canEdit} style={{border:0,padding:0,margin:0}}>
   <div className="form-grid" style={{padding:0}}>
    <label>Categoria<select value={category} onChange={event=>setCategory(event.target.value as DocumentCategory)}>{DOCUMENT_CATEGORIES.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Vínculo ao edital<select value={tenderId} onChange={event=>setTenderId(event.target.value)}><option value="">Cofre da empresa • sem edital específico</option>{tenders.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><small>Salve o edital no acompanhamento para vinculá-lo aqui.</small></label>
    <label className="wide">Arquivos reais • PDF, JPG ou PNG • até 10 MB cada<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" disabled={!configured} onChange={event=>{
     const batch=Array.from(event.target.files||[]);event.target.value="";
     const valid=batch.filter(file=>file.size>0&&file.size<=DOCUMENT_LIMIT&&["application/pdf","image/png","image/jpeg"].includes(file.type));
     setFiles(valid.slice(0,10));setNotice(valid.length!==batch.length||batch.length>10?"Selecione até 10 arquivos PDF/JPG/PNG, com até 10 MB por arquivo. Os demais não foram selecionados.":"Arquivos selecionados apenas neste aparelho; use Enviar para salvar no servidor.");
    }}/></label>
   </div><ul>{files.map((file,index)=><li key={file.name+index}>{file.name} • {(file.size/1024/1024).toFixed(2)} MB</li>)}</ul>
   <button type="button" className="primary-btn" disabled={!configured||!files.length||busy} onClick={()=>void send()}>{busy?"Processando…":"Enviar arquivos privados"}</button>
  </fieldset>
  <p role="status" aria-live="polite">{notice}</p>
  <p style={{fontSize:12}}>Recebido confirma o arquivo no servidor. Aprovado exige conferência registrada. Validade é verificada diariamente pela data informada. A verificação de formato não é antivírus nem validação automática do conteúdo legal.</p>
  <button type="button" className="outline-btn" disabled={busy} onClick={()=>void load().catch(error=>setNotice(error.message))}>Atualizar documentos</button>
  <div style={{overflowX:"auto",marginTop:14}}><table style={{width:"100%",minWidth:720}}><thead><tr><th>Documento</th><th>Edital</th><th>Situação</th><th>Validade</th><th>Arquivo / Conferência</th></tr></thead><tbody>{scoped.map(doc=><tr key={doc.id}>
   <td><strong>{doc.name}</strong><small style={{display:"block"}}>{doc.category} • {(doc.size/1024/1024).toFixed(2)} MB</small></td><td>{doc.tenderId?tenders.find(item=>item.id===doc.tenderId)?.name||"Edital vinculado":"Cofre da empresa"}</td><td>{doc.status}</td><td>{doc.validUntil|| (doc.noExpiry?"Sem vencimento • conferido":"Não conferida")}</td><td>{doc.uploaded?<a href={endpoint+"?id="+doc.id+"&download=1"} target="_blank" rel="noopener noreferrer">Baixar arquivo real</a>:<button type="button" disabled={busy||!canEdit} onClick={()=>void confirmReceipt(doc.id)}>Confirmar recebimento</button>} <button type="button" className="outline-btn" disabled={busy||!canEdit||!doc.uploaded} onClick={()=>openReview(doc)}>Conferir</button><details><summary>Histórico</summary>{doc.audit.map((event,index)=><p key={index}>{new Date(event.at).toLocaleString("pt-BR")} • {event.actor} • {event.action}: {event.note}</p>)}</details></td>
  </tr>)}</tbody></table>{!scoped.length&&<p>Nenhum arquivo persistido para este vínculo. Registros antigos por nome continuam abaixo e não são considerados arquivos recebidos.</p>}</div>
  {hasMore&&<button type="button" disabled={busy} onClick={()=>void load(true,documents.length).catch(error=>setNotice(error.message))}>Carregar mais documentos</button>}
  {selected&&<section aria-label="Conferência do arquivo" style={{padding:16,border:"1px solid #54799b",borderRadius:12,marginTop:16}}>
   <h4>Conferir: {selected.name}</h4><p>A decisão será registrada para esta versão do arquivo e este vínculo.</p><fieldset disabled={busy} style={{border:0,padding:0}}><div className="form-grid" style={{padding:0}}>
    <label>Decisão<select value={review} onChange={event=>setReview(event.target.value)}><option value="received">Recebido • aguardar revisão</option><option value="approved">Aprovar manualmente</option><option value="rejected">Rejeitar</option></select></label>
    <label>Validade informada no documento<input type="date" value={validUntil} onChange={event=>{setValidUntil(event.target.value);setNoExpiry(false);}}/></label>
    <label className="wide"><span><input type="checkbox" checked={noExpiry} onChange={event=>{setNoExpiry(event.target.checked);if(event.target.checked)setValidUntil("");}}/> Conferi que este documento não possui vencimento</span></label>
    <label className="wide"><span><input type="checkbox" checked={identityChecked} onChange={event=>setIdentityChecked(event.target.checked)}/> Conferi a identificação da empresa no arquivo</span></label>
    <label className="wide"><span><input type="checkbox" checked={contentChecked} onChange={event=>setContentChecked(event.target.checked)}/> Li o conteúdo e conferi autenticidade e condições na origem</span></label>
    {selected.tenderId&&<label className="wide"><span><input type="checkbox" checked={tenderChecked} onChange={event=>setTenderChecked(event.target.checked)}/> Conferi adequação às exigências deste edital</span></label>}
    <label className="wide">Justificativa / observações • obrigatório<textarea value={note} onChange={event=>setNote(event.target.value)} maxLength={2000}/></label>
   </div><button type="button" className="outline-btn" onClick={()=>setSelected(null)}>Cancelar conferência</button> <button type="button" className="primary-btn" onClick={()=>void saveReview()}>Salvar conferência</button></fieldset>
  </section>}
  <details style={{marginTop:16}}><summary>Checklist de conferência • {tenderId?"somente este edital":"cofre da empresa"}</summary><p>Checklist de apoio. Os documentos exigidos devem ser conferidos no edital; a lista não garante habilitação. Documentos do cofre não aprovam automaticamente um edital.</p><ul>{checklist.map(item=><li key={item.category}>{item.approved?"✓ Aprovado":"○ Pendente"} — {item.category} • {item.received} arquivo(s) recebido(s)</li>)}</ul>{hasMore&&<p>Lista parcial: carregue as demais páginas antes de concluir a conferência.</p>}</details>
 </section>;
}
