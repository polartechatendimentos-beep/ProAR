"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {upload} from "@vercel/blob/client";
import {DOCUMENT_CATEGORIES,DOCUMENT_LIMIT,documentChecklist,type BiddingDocument,type DocumentCategory} from "@/lib/bidding-documents";
type DocumentReader=ReturnType<typeof import("@/lib/browser-document-reader")["createDocumentReader"]>;
type BatchItem={key:string;file:File;serverId?:string;pathname?:string;uploadDone?:boolean;received?:boolean;audited?:boolean;stage:string;error?:string};
type DocumentView=Omit<BiddingDocument,"pathname">&{status:string};
const endpoint="/api/bidding-documents";
export function BiddingDocumentsWorkspace({companyName}:{companyName:string}){
 const [documents,setDocuments]=useState<DocumentView[]>([]),[tenders,setTenders]=useState<{id:string;name:string}[]>([]);
 const [files,setFiles]=useState<BatchItem[]>([]),[category,setCategory]=useState<DocumentCategory|"auto">("auto"),[tenderId,setTenderId]=useState("");
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[canEdit,setCanEdit]=useState(false),[configured,setConfigured]=useState(false),[hasMore,setHasMore]=useState(false);
 const [selected,setSelected]=useState<DocumentView|null>(null),[review,setReview]=useState("received"),[note,setNote]=useState(""),[validUntil,setValidUntil]=useState(""),[noExpiry,setNoExpiry]=useState(false),[identityChecked,setIdentityChecked]=useState(false),[contentChecked,setContentChecked]=useState(false),[tenderChecked,setTenderChecked]=useState(false);
 const lock=useRef(false),pauseRequested=useRef(false);
 const [reviewCategory,setReviewCategory]=useState<DocumentCategory>("Outros");
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
 const updateItem=(key:string,patch:Partial<BatchItem>)=>setFiles(current=>current.map(item=>item.key===key?{...item,...patch}:item));
 const auditFile=async(docId:string,file:File,reader:DocumentReader,progress:(message:string)=>void)=>{
  const extracted=await reader.read(file,progress);
  const result=await post({action:"audit",id:docId,...extracted});if(result.audited!==true)throw new Error("Auditoria ainda não confirmada no servidor.");return result;
 };
 const send=async()=>{
  if(lock.current||!files.some(item=>!item.audited))return;
  lock.current=true;pauseRequested.current=false;setBusy(true);setNotice("");
  let reader:DocumentReader|null=null,received=0,audited=0,failed=0;
  try{
   const {createDocumentReader}=await import("@/lib/browser-document-reader");reader=createDocumentReader();
   for(const original of files){
    const item={...original};
    if(item.audited)continue;if(pauseRequested.current)break;
    try{
     if(!item.serverId){
      updateItem(item.key,{stage:"Preparando envio…",error:undefined});
      const prepared=await post({action:"prepare",name:item.file.name,filename:item.file.name,mime:item.file.type,size:item.file.size,category:category==="auto"?"Outros":category,tenderId,batchId:item.key.split(":")[0]});
      if(!prepared.prepared)throw new Error("Envio não preparado no servidor.");
      item.serverId=prepared.id;item.pathname=prepared.pathname;updateItem(item.key,{serverId:item.serverId,pathname:item.pathname});
     }
     if(!item.uploadDone){
      updateItem(item.key,{stage:"Enviando arquivo privado…",error:undefined});
      await upload(item.pathname!,item.file,{access:"private",handleUploadUrl:endpoint+"/upload",clientPayload:JSON.stringify({id:item.serverId}),multipart:item.file.size>4*1024*1024});
      item.uploadDone=true;updateItem(item.key,{uploadDone:true});
     }
     if(!item.received){
      updateItem(item.key,{stage:"Confirmando arquivo no servidor…"});
      const result=await post({action:"complete",id:item.serverId});if(result.saved!==true)throw new Error("Recebimento ainda não confirmado.");
      item.received=true;updateItem(item.key,{received:true});received++;
     }
     updateItem(item.key,{stage:"Auditando conteúdo…"});
     await auditFile(item.serverId!,item.file,reader,message=>updateItem(item.key,{stage:message}));
     item.audited=true;updateItem(item.key,{audited:true,stage:"Auditoria salva • revisão humana pendente",error:undefined});audited++;
    }catch(error){failed++;updateItem(item.key,{stage:item.received?"Arquivo recebido • auditoria pendente":"Envio pendente",error:error instanceof Error?error.message:"Falha neste arquivo. Os demais continuarão."});}
   }
   await load();setNotice(audited+" auditoria(s) salva(s), "+received+" novo(s) arquivo(s) recebido(s), "+failed+" falha(s). "+(pauseRequested.current?"Lote pausado; continue para processar os restantes.":"Confira os relatórios individuais abaixo."));
  }catch(error){setNotice(error instanceof Error?error.message:"Falha ao atualizar a lista. Os arquivos confirmados continuam no servidor.");}
  finally{try{await reader?.dispose();}catch{}lock.current=false;setBusy(false);}
 };
 const auditReceived=async(doc:DocumentView)=>{
  if(lock.current)return;lock.current=true;setBusy(true);setNotice("");
  let reader:DocumentReader|null=null;
  try{
   const {createDocumentReader}=await import("@/lib/browser-document-reader");reader=createDocumentReader();
   const response=await fetch(endpoint+"?id="+doc.id+"&download=1",{cache:"no-store"});if(!response.ok)throw new Error("Não foi possível carregar o arquivo privado.");
   const file=new File([await response.blob()],doc.filename,{type:doc.mime});
   await auditFile(doc.id,file,reader,message=>setNotice(doc.name+": "+message));await load();setNotice("Auditoria individual salva. A conferência humana continua pendente.");
  }catch(error){setNotice(error instanceof Error?error.message:"Falha ao auditar arquivo.");}finally{try{await reader?.dispose();}catch{}lock.current=false;setBusy(false);}
 };
 const openReview=(doc:DocumentView)=>{setSelected(doc);setReview(doc.review);setReviewCategory(doc.category);setNote("");setValidUntil(doc.validUntil);setNoExpiry(doc.noExpiry);setIdentityChecked(false);setContentChecked(false);setTenderChecked(false);};
 const saveReview=async()=>{
  if(!selected||lock.current)return;lock.current=true;setBusy(true);setNotice("");
  try{
   const result=await post({action:"review",id:selected.id,expectedRevision:selected._revision,category:reviewCategory,review,note,validUntil,noExpiry,identityChecked,contentChecked,tenderChecked});
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
 return <section className="panel bidding-private-documents" aria-label="Arquivos reais de habilitação" style={{padding:18,marginBottom:18}}>
  <h3>Anexar lote e auditar cada documento</h3><p><strong>Empresa: {companyName}</strong>. Arquivos privados por empresa. Anexar não significa aprovar; cada documento exige revisão humana.</p>
  {!configured&&<p role="status">Armazenamento privado não confirmado nesta instalação. O envio ficará bloqueado até a configuração estar disponível.</p>}
  <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
   <div className="form-grid" style={{padding:0}}>
    <label>Categoria<select disabled={!canEdit} value={category} onChange={event=>setCategory(event.target.value as DocumentCategory|"auto")}><option value="auto">Identificar cada documento pelo conteúdo</option>{DOCUMENT_CATEGORIES.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Vínculo ao edital<select value={tenderId} onChange={event=>setTenderId(event.target.value)}><option value="">Cofre da empresa • sem edital específico</option>{tenders.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><small>Salve o edital no acompanhamento para vinculá-lo aqui.</small></label>
    <label className="wide">Arquivos reais • PDF, JPG ou PNG • até 10 MB cada<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" disabled={!configured||!canEdit} onChange={event=>{
     const batch=Array.from(event.target.files||[]);event.target.value="";
     const valid=batch.filter(file=>file.size>0&&file.size<=DOCUMENT_LIMIT&&["application/pdf","image/png","image/jpeg"].includes(file.type));
     if(files.length+valid.length>200){setNotice("O lote comporta até 200 arquivos. Nenhum arquivo desta seleção foi adicionado; conclua ou reduza o lote antes de continuar.");return;}
     const batchId=crypto.randomUUID();
     setFiles(current=>{
      const added=valid.map((file,index)=>({key:batchId+":"+index,file,stage:"Aguardando envio"}));
      return [...current,...added].slice(0,200);
     });
     setNotice(valid.length!==batch.length?"Alguns arquivos foram recusados por formato ou tamanho. Cada arquivo deve ter até 10 MB.":"Lote selecionado. Use Enviar e auditar para processar cada arquivo. Limite de 200 arquivos por lote.");
    }}/></label>
   </div>
   <div role="status" aria-live="polite"><strong>{files.filter(item=>item.audited).length}/{files.length} arquivos auditados</strong></div>
   <ul>{files.map(item=><li key={item.key}><strong>{item.file.name}</strong> • {(item.file.size/1024/1024).toFixed(2)} MB — {item.stage}{item.error&&<span role="alert" style={{display:"block",color:"#ef6b6b"}}>{item.error}</span>}{!busy&&!item.audited&&<button type="button" className="outline-btn" onClick={()=>setFiles(current=>current.filter(value=>value.key!==item.key))}>Retirar do lote</button>}</li>)}</ul>
   <button type="button" className="primary-btn" disabled={!canEdit||!configured||!files.some(item=>!item.audited)||busy} onClick={()=>void send()}>{busy?"Processando lote…":"Enviar e auditar todos"}</button>
   {!busy&&files.some(item=>item.audited)&&<button type="button" className="outline-btn" onClick={()=>setFiles(current=>current.filter(item=>!item.audited))}>Limpar concluídos da fila</button>}
  </fieldset>
  {busy&&<button type="button" className="outline-btn" onClick={()=>{pauseRequested.current=true;setNotice("Pausa solicitada. O arquivo atual será concluído antes de parar.");}}>Pausar após este arquivo</button>}
  <p role="status" aria-live="polite">{notice}</p>
  <p style={{fontSize:12}}>Leitura local de PDF e OCR em português. A auditoria verifica o texto extraído e aponta pendências por arquivo; não consulta automaticamente os emissores, não verifica assinatura digital e não aprova documentos. Limites: 40 páginas por PDF, até 8 páginas com OCR e 250 mil caracteres; leituras parciais ficam sinalizadas. A validade oficial só muda após conferência.</p>
  <button type="button" className="outline-btn" disabled={busy} onClick={()=>void load().catch(error=>setNotice(error.message))}>Atualizar documentos</button>
  <div style={{overflowX:"auto",marginTop:14}}><table style={{width:"100%",minWidth:720}}><thead><tr><th>Documento</th><th>Edital</th><th>Situação</th><th>Validade</th><th>Arquivo / Conferência</th></tr></thead><tbody>{scoped.map(doc=><tr key={doc.id}>
   <td><strong>{doc.name}</strong><small style={{display:"block"}}>{doc.category} • {(doc.size/1024/1024).toFixed(2)} MB</small></td><td>{doc.tenderId?tenders.find(item=>item.id===doc.tenderId)?.name||"Edital vinculado":"Cofre da empresa"}</td><td>{doc.status}</td><td>{doc.validUntil|| (doc.noExpiry?"Sem vencimento • conferido":"Não conferida")}</td><td>{doc.uploaded?<a href={endpoint+"?id="+doc.id+"&download=1"} target="_blank" rel="noopener noreferrer">Baixar arquivo real</a>:<button type="button" disabled={busy||!canEdit} onClick={()=>void confirmReceipt(doc.id)}>Confirmar recebimento</button>} <button type="button" className="outline-btn" disabled={busy||!canEdit||!doc.uploaded} onClick={()=>openReview(doc)}>Conferir</button>{doc.uploaded&&<button type="button" className="outline-btn" disabled={busy||!canEdit} onClick={()=>void auditReceived(doc)}>Auditar arquivo</button>}{doc.automaticAudit&&<details><summary>Auditoria individual • {doc.automaticAudit.suggestedCategory}</summary><p>{new Date(doc.automaticAudit.at).toLocaleString("pt-BR")} • {doc.automaticAudit.extraction.pagesRead}/{doc.automaticAudit.extraction.totalPages} página(s) • {doc.automaticAudit.extraction.source}{doc.automaticAudit.extraction.partial?" • LEITURA PARCIAL":""}</p><p>CNPJ(s) encontrados: {doc.automaticAudit.cnpjs.join(", ")||"não identificado"} • Cadastro da empresa: {doc.automaticAudit.expectedCnpj||"indisponível para comparação"}</p><ul>{doc.automaticAudit.checks.map(check=><li key={check.label}><strong>{check.status==="identified"?"Identificado":check.status==="attention"?"Atenção":"Pendente"} — {check.label}:</strong> {check.detail}</li>)}</ul>{doc.automaticAudit.extraction.warnings.map((warning,index)=><p key={index}>{warning}</p>)}<p>A classificação é sugerida pela leitura local e precisa de revisão. Não representa validação oficial.</p></details>}<details><summary>Histórico • últimas revisões carregadas</summary><button type="button" className="outline-btn" onClick={()=>void fullHistory(doc.id)}>Carregar histórico completo</button>{doc.audit.map((event,index)=><p key={index}>{new Date(event.at).toLocaleString("pt-BR")} • {event.actor} • {event.action}: {event.note}</p>)}</details></td>
  </tr>)}</tbody></table>{!scoped.length&&<p>Nenhum arquivo persistido para este vínculo. Registros antigos por nome continuam abaixo e não são considerados arquivos recebidos.</p>}</div>
  {hasMore&&<button type="button" disabled={busy} onClick={()=>void load(true,documents.length).catch(error=>setNotice(error.message))}>Carregar mais documentos</button>}
  {selected&&<section aria-label="Conferência do arquivo" style={{padding:16,border:"1px solid #54799b",borderRadius:12,marginTop:16}}>
   <h4>Conferir: {selected.name}</h4>{selected.automaticAudit&&<button type="button" className="outline-btn" disabled={busy} onClick={()=>{setReviewCategory(selected.automaticAudit!.suggestedCategory);if(selected.automaticAudit!.expiryCandidates.length===1){setValidUntil(selected.automaticAudit!.expiryCandidates[0].date);setNoExpiry(false);}setNote("Sugestões da auditoria carregadas para conferência no original.");}}>Carregar sugestões para revisar</button>}<p>A decisão será registrada para esta versão do arquivo e este vínculo.</p><fieldset disabled={busy} style={{border:0,padding:0}}><div className="form-grid" style={{padding:0}}>
    <label>Categoria conferida<select value={reviewCategory} onChange={event=>setReviewCategory(event.target.value as DocumentCategory)}>{DOCUMENT_CATEGORIES.map(value=><option key={value}>{value}</option>)}</select></label><label>Decisão<select value={review} onChange={event=>setReview(event.target.value)}><option value="received">Recebido • aguardar revisão</option><option value="approved">Aprovar manualmente</option><option value="rejected">Rejeitar</option></select></label>
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
