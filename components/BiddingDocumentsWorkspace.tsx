"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {upload} from "@vercel/blob/client";
import {DOCUMENT_CATEGORIES,DOCUMENT_LIMIT,documentChecklist,type BiddingDocument,type DocumentCategory} from "@/lib/bidding-documents";
type DocumentReader=ReturnType<typeof import("@/lib/browser-document-reader")["createDocumentReader"]>;
type BatchItem={key:string;file:File;serverId?:string;pathname?:string;uploadDone?:boolean;received?:boolean;audited?:boolean;stage:string;error?:string};
type DocumentView=Omit<BiddingDocument,"pathname">&{status:string};
type TenderRequirement={id:string;category:string;description:string;threshold:string;unit:string;documentId:string;sourcePage?:number;sourceQuote?:string;phase?:string;dueDate?:string;technicalEvidence?:{issuer:string;service:string;quantity:string;unit:string;startDate:string;endDate:string;professionalRecord:string}};
type FinancialAuditView={currentAssets:number;currentLiabilities:number;realizableLongTerm:number;longTermLiabilities:number;totalAssets:number;minimumCurrent:string;minimumGeneral:string;minimumSolvency:string;sourceNote:string;documentIds:string[];ratios:{name:string;value:number|null;minimum:number|null;status:"ok"|"below"|"missing"|"undefined"}[];updatedAt:string;updatedBy:string};
type RequirementApproval={status:"pending"|"approved"|"rejected";submittedAt:string;submittedBy:string;reviewedAt?:string;reviewedBy?:string;note?:string};
const endpoint="/api/bidding-documents";
export function BiddingDocumentsWorkspace({companyName}:{companyName:string}){
 const [documents,setDocuments]=useState<DocumentView[]>([]),[tenders,setTenders]=useState<{id:string;name:string}[]>([]);
 const [files,setFiles]=useState<BatchItem[]>([]),[category,setCategory]=useState<DocumentCategory|"auto">("auto"),[tenderId,setTenderId]=useState("");
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[canEdit,setCanEdit]=useState(false),[configured,setConfigured]=useState(false),[hasMore,setHasMore]=useState(false);
 const [selected,setSelected]=useState<DocumentView|null>(null),[review,setReview]=useState("received"),[note,setNote]=useState(""),[validUntil,setValidUntil]=useState(""),[noExpiry,setNoExpiry]=useState(false),[identityChecked,setIdentityChecked]=useState(false),[contentChecked,setContentChecked]=useState(false),[tenderChecked,setTenderChecked]=useState(false);
 const lock=useRef(false),pauseRequested=useRef(false);
 const [requirements,setRequirements]=useState<TenderRequirement[]>([]),[requirementRevision,setRequirementRevision]=useState(0),[requirementBusy,setRequirementBusy]=useState(false),[approval,setApproval]=useState<RequirementApproval|null>(null),[canApprove,setCanApprove]=useState(false),[managerNote,setManagerNote]=useState(""),[financialAudit,setFinancialAudit]=useState<FinancialAuditView|null>(null),[financialBusy,setFinancialBusy]=useState(false),[financialDocumentIds,setFinancialDocumentIds]=useState<string[]>([]),[financialInputs,setFinancialInputs]=useState({currentAssets:"",currentLiabilities:"",realizableLongTerm:"",longTermLiabilities:"",totalAssets:"",minimumCurrent:"",minimumGeneral:"",minimumSolvency:"",sourceNote:""}),[extracting,setExtracting]=useState(false),[extractionProgress,setExtractionProgress]=useState(""),[priceInputs,setPriceInputs]=useState({materials:"",labor:"",travel:"",other:"",tax:"",margin:""});
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
 useEffect(()=>{if(!tenderId){setRequirements([]);setRequirementRevision(0);setApproval(null);setFinancialAudit(null);return;}let active=true;fetch("/api/bidding-requirements?tenderId="+encodeURIComponent(tenderId),{cache:"no-store"}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||"Não foi possível carregar a matriz.");if(active){setRequirements(body.requirements||[]);setRequirementRevision(body.revision||0);setApproval(body.approval||null);setFinancialAudit(body.financialAudit||null);setFinancialDocumentIds(body.financialAudit?.documentIds||[]);setCanApprove(body.canApprove===true);}}).catch(error=>{if(active)setNotice(error instanceof Error?error.message:"Falha ao carregar exigências.");});return()=>{active=false;};},[tenderId]);
 const saveRequirements=async()=>{if(!tenderId||requirementBusy)return;setRequirementBusy(true);try{const response=await fetch("/api/bidding-requirements",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenderId,expectedRevision:requirementRevision,requirements})});const body=await response.json();if(!response.ok)throw new Error(body.error||"Não foi possível salvar a matriz.");setRequirementRevision(body.revision);setApproval(body.approval||null);setFinancialAudit(body.financialAudit||null);setNotice("Matriz de exigências salva para este edital. A análise financeira e a aprovação anteriores foram invalidadas.");}catch(error){setNotice(error instanceof Error?error.message:"Falha ao salvar exigências.");}finally{setRequirementBusy(false);}};
 const updateRequirement=(index:number,patch:Partial<TenderRequirement>)=>setRequirements(current=>current.map((item,i)=>i===index?{...item,...patch}:item));
 const extractTender=async(file:File)=>{
  if(!tenderId){setNotice("Selecione primeiro o edital ao qual este arquivo pertence.");return;}
  if(file.size>DOCUMENT_LIMIT||file.type!=="application/pdf"){setNotice("Use um edital em PDF de até 10 MB.");return;}
  setExtracting(true);setExtractionProgress("Preparando leitura do edital…");let reader:DocumentReader|null=null;
  try{const {createDocumentReader}=await import("@/lib/browser-document-reader");reader=createDocumentReader();const extracted=await reader.read(file,message=>setExtractionProgress(message));
   const response=await fetch("/api/bidding-requirements",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"extract-edital",tenderId,text:extracted.text,extraction:extracted.extraction})});
   const body=await response.json();if(!response.ok)throw new Error(body.error||"Falha ao extrair exigências.");
   setRequirements(current=>[...current,...body.requirements]);setNotice(body.requirements.length+" exigência(s) sugerida(s). Confira as páginas e trechos originais antes de salvar.");setExtractionProgress("");
  }catch(error){setNotice(error instanceof Error?error.message:"Não foi possível analisar este edital.");}finally{try{await reader?.dispose();}catch{}setExtracting(false);}
 };
 const saveFinancialAudit=async()=>{
  if(!tenderId||financialBusy)return;setFinancialBusy(true);
  try{const response=await fetch("/api/bidding-requirements",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"financial-audit",tenderId,expectedRevision:requirementRevision,financial:{...financialInputs,documentIds:financialDocumentIds}})});const body=await response.json();if(!response.ok)throw new Error(body.error||"Falha ao salvar auditoria financeira.");setFinancialAudit(body.financialAudit||null);setRequirementRevision(body.revision);setApproval(null);setNotice("Índices financeiros calculados e auditoria salva com os documentos de origem.");}catch(error){setNotice(error instanceof Error?error.message:"Falha ao salvar auditoria financeira.");}finally{setFinancialBusy(false);}
 };
 const parseAmount=(raw:string)=>{const value=Number(raw.includes(",")?raw.replace(/\\./g,"").replace(",","."):raw);return Number.isFinite(value)?value:0;};
 const priceCost=["materials","labor","travel","other"].reduce((sum,key)=>sum+parseAmount(priceInputs[key as keyof typeof priceInputs]),0);
 const taxRate=parseAmount(priceInputs.tax)/100,marginRate=parseAmount(priceInputs.margin)/100;
 const minimumBid=taxRate<1?priceCost/(1-taxRate):NaN,targetBid=taxRate+marginRate<1?priceCost/(1-taxRate-marginRate):NaN;
 const submitDossier=async()=>{if(!tenderId||requirementBusy)return;setRequirementBusy(true);try{const response=await fetch("/api/bidding-requirements",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"submit",tenderId,expectedRevision:requirementRevision})});const body=await response.json();if(!response.ok)throw new Error(body.error||"Não foi possível enviar o dossiê.");setRequirementRevision(body.revision);setApproval(body.approval||null);setNotice("Dossiê enviado para aprovação gerencial.");}catch(error){setNotice(error instanceof Error?error.message:"Falha ao enviar dossiê.");}finally{setRequirementBusy(false);}};
 const decideDossier=async(decision:"approved"|"rejected")=>{if(!tenderId||requirementBusy)return;setRequirementBusy(true);try{const response=await fetch("/api/bidding-requirements",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"decision",decision,tenderId,expectedRevision:requirementRevision,note:managerNote})});const body=await response.json();if(!response.ok)throw new Error(body.error||"Não foi possível registrar a decisão.");setRequirementRevision(body.revision);setApproval(body.approval||null);setManagerNote("");setNotice(decision==="approved"?"Dossiê aprovado pela gestão.":"Dossiê devolvido para ajustes.");}catch(error){setNotice(error instanceof Error?error.message:"Falha ao registrar decisão.");}finally{setRequirementBusy(false);}};
 const exportDossier=()=>{const tenderName=tenders.find(item=>item.id===tenderId)?.name||tenderId;const lines=["DOSSIÊ PRELIMINAR DE HABILITAÇÃO — "+tenderName,"Empresa: "+companyName,"Gerado em: "+new Date().toLocaleString("pt-BR"),"Situação gerencial: "+(approval?.status||"Em elaboração"),"",...requirements.map((item,index)=>{const doc=documents.find(value=>value.id===item.documentId),tech=item.technicalEvidence;return (index+1)+". ["+item.category+"] "+item.description+(item.threshold?" • mínimo "+item.threshold+(item.unit?" "+item.unit:""):"")+" — "+(doc?doc.name+" • "+doc.status:"Sem evidência vinculada")+(item.sourcePage?" • Fonte p. "+item.sourcePage:"")+(item.sourceQuote?" • Trecho: "+item.sourceQuote:"")+(tech?" • Emitente: "+tech.issuer+" • Serviço: "+tech.service+" • Quantidade: "+tech.quantity+" "+tech.unit+" • Período: "+tech.startDate+" a "+tech.endDate+" • Registro: "+tech.professionalRecord:"");}),"",...(financialAudit?["AUDITORIA ECONÔMICO-FINANCEIRA",...financialAudit.ratios.map(ratio=>ratio.name+": "+(ratio.value===null?"indefinido":ratio.value.toFixed(3))+" • mínimo "+(ratio.minimum===null?"não informado":ratio.minimum.toFixed(3))+" • "+ratio.status),"Origem dos valores: "+financialAudit.documentIds.join(", ")]:["Auditoria econômico-financeira: pendente"]),...requirements.filter(item=>item.dueDate).map(item=>"PRAZO • "+(item.phase||"Etapa")+" • "+item.dueDate+" • "+item.description),"",approval?.note?"Justificativa gerencial: "+approval.note:""];const blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="dossie-habilitacao-"+tenderId.replace(/[^a-z0-9_-]/gi,"-")+".txt";link.click();URL.revokeObjectURL(url);};
 const requirementCovered=(item:TenderRequirement)=>{const doc=documents.find(value=>value.id===item.documentId);if(!doc||doc.status!=="Aprovado")return false;if(item.category!=="Atestado técnico")return true;const tech=item.technicalEvidence;if(!tech?.issuer||!tech.service||!tech.unit||!tech.startDate||!tech.endDate)return false;const actual=Number(tech.quantity.replace(",", ".")),minimum=Number(item.threshold.replace(",", "."));if(Number.isFinite(minimum)&&minimum>0&&actual<minimum)return false;if(item.unit&&tech.unit.toLocaleLowerCase("pt-BR")!==item.unit.toLocaleLowerCase("pt-BR"))return false;return true;};
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
     <section className="panel" aria-label="Matriz de exigências do edital" style={{padding:16,marginTop:16,border:"1px solid #54799b",borderRadius:12}}>
    <h4>Matriz de exigências do edital</h4>
    {!tenderId?<p>Selecione um edital no campo “Vínculo ao edital” para registrar as exigências e relacionar documentos.</p>:<>
     <p>Cadastre os requisitos conferidos no edital oficial. O ProAR compara os vínculos e a situação dos documentos; a decisão de habilitação permanece humana.</p>
      <p>Use a IA para sugerir exigências com página e trecho do edital. Revise o PDF original antes de salvar; a extração não decide habilitação.</p>
      <label className="wide">Analisar edital em PDF<input type="file" accept="application/pdf,.pdf" disabled={extracting||!canEdit} onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void extractTender(file);}}/></label>
      {extracting&&<p role="status">{extractionProgress||"Analisando edital…"}</p>}

     {requirements.map((item,index)=>{const linked=documents.find(doc=>doc.id===item.documentId);const covered=requirementCovered(item);return <div key={item.id} className="form-grid" style={{padding:12,margin:"10px 0",border:"1px solid #36536a",borderRadius:10}}>
      <label className="wide">{item.sourcePage&&<p className="wide"><strong>Fonte sugerida:</strong> página {item.sourcePage} • “{item.sourceQuote||"Trecho não extraído"}”</p>}
       <label>Etapa/prazo<select value={item.phase||""} onChange={event=>updateRequirement(index,{phase:event.target.value})}><option value="">Sem etapa</option>{["Impugnação","Esclarecimentos","Proposta","Sessão","Validade documental","Outro"].map(value=><option key={value}>{value}</option>)}</select></label>
       <label>Data limite<input type="date" value={item.dueDate||""} onChange={event=>updateRequirement(index,{dueDate:event.target.value})}/></label>
       <label className="wide">Página e trecho do edital<input maxLength={500} value={item.sourceQuote||""} onChange={event=>updateRequirement(index,{sourceQuote:event.target.value})} placeholder="Registre a citação literal para conferência"/></label>
       <label className="wide">Exigência<input maxLength={500} value={item.description} onChange={event=>setRequirements(current=>current.map((value,i)=>i===index?{...value,description:event.target.value}:value))} placeholder="Ex.: atestado de instalação de sistemas de climatização"/></label>
      <label>Categoria<select value={item.category} onChange={event=>setRequirements(current=>current.map((value,i)=>i===index?{...value,category:event.target.value}:value))}>{DOCUMENT_CATEGORIES.map(category=><option key={category}>{category}</option>)}</select></label>
      <label>Quantidade mínima<input maxLength={80} value={item.threshold} onChange={event=>setRequirements(current=>current.map((value,i)=>i===index?{...value,threshold:event.target.value}:value))} placeholder="Opcional"/></label>
      <label>Unidade<input maxLength={40} value={item.unit} onChange={event=>setRequirements(current=>current.map((value,i)=>i===index?{...value,unit:event.target.value}:value))} placeholder="unidades, BTUs, meses…"/></label>
      <label className="wide">{item.category==="Atestado técnico"&&<div className="wide form-grid" style={{padding:10,border:"1px solid #36536a",borderRadius:8}}>
        <strong className="wide">Conferência do atestado • preencha com base no documento original</strong>
        <label>Contratante/emitente<input value={item.technicalEvidence?.issuer||""} onChange={event=>updateRequirement(index,{technicalEvidence:{issuer:event.target.value,service:item.technicalEvidence?.service||"",quantity:item.technicalEvidence?.quantity||"",unit:item.technicalEvidence?.unit||"",startDate:item.technicalEvidence?.startDate||"",endDate:item.technicalEvidence?.endDate||"",professionalRecord:item.technicalEvidence?.professionalRecord||""}})}/></label>
        <label>Serviço comprovado<input value={item.technicalEvidence?.service||""} onChange={event=>updateRequirement(index,{technicalEvidence:{issuer:item.technicalEvidence?.issuer||"",service:event.target.value,quantity:item.technicalEvidence?.quantity||"",unit:item.technicalEvidence?.unit||"",startDate:item.technicalEvidence?.startDate||"",endDate:item.technicalEvidence?.endDate||"",professionalRecord:item.technicalEvidence?.professionalRecord||""}})}/></label>
        <label>Quantidade no atestado<input inputMode="decimal" value={item.technicalEvidence?.quantity||""} onChange={event=>updateRequirement(index,{technicalEvidence:{issuer:item.technicalEvidence?.issuer||"",service:item.technicalEvidence?.service||"",quantity:event.target.value,unit:item.technicalEvidence?.unit||"",startDate:item.technicalEvidence?.startDate||"",endDate:item.technicalEvidence?.endDate||"",professionalRecord:item.technicalEvidence?.professionalRecord||""}})}/></label>
        <label>Unidade comprovada<input value={item.technicalEvidence?.unit||""} onChange={event=>updateRequirement(index,{technicalEvidence:{issuer:item.technicalEvidence?.issuer||"",service:item.technicalEvidence?.service||"",quantity:item.technicalEvidence?.quantity||"",unit:event.target.value,startDate:item.technicalEvidence?.startDate||"",endDate:item.technicalEvidence?.endDate||"",professionalRecord:item.technicalEvidence?.professionalRecord||""}})}/></label>
        <label>Início<input type="date" value={item.technicalEvidence?.startDate||""} onChange={event=>updateRequirement(index,{technicalEvidence:{issuer:item.technicalEvidence?.issuer||"",service:item.technicalEvidence?.service||"",quantity:item.technicalEvidence?.quantity||"",unit:item.technicalEvidence?.unit||"",startDate:event.target.value,endDate:item.technicalEvidence?.endDate||"",professionalRecord:item.technicalEvidence?.professionalRecord||""}})}/></label>
        <label>Fim<input type="date" value={item.technicalEvidence?.endDate||""} onChange={event=>updateRequirement(index,{technicalEvidence:{issuer:item.technicalEvidence?.issuer||"",service:item.technicalEvidence?.service||"",quantity:item.technicalEvidence?.quantity||"",unit:item.technicalEvidence?.unit||"",startDate:item.technicalEvidence?.startDate||"",endDate:event.target.value,professionalRecord:item.technicalEvidence?.professionalRecord||""}})}/></label>
        <label className="wide">CREA/CFT, ART/CAT/TRT relacionados<input value={item.technicalEvidence?.professionalRecord||""} onChange={event=>updateRequirement(index,{technicalEvidence:{issuer:item.technicalEvidence?.issuer||"",service:item.technicalEvidence?.service||"",quantity:item.technicalEvidence?.quantity||"",unit:item.technicalEvidence?.unit||"",startDate:item.technicalEvidence?.startDate||"",endDate:item.technicalEvidence?.endDate||"",professionalRecord:event.target.value}})}/></label>
       </div>}
       <label className="wide">Documento relacionado<select value={item.documentId} onChange={event=>setRequirements(current=>current.map((value,i)=>i===index?{...value,documentId:event.target.value}:value))}><option value="">Sem evidência vinculada</option>{documents.filter(doc=>!doc.tenderId||doc.tenderId===tenderId).map(doc=><option key={doc.id} value={doc.id}>{doc.name} • {doc.status}</option>)}</select></label>
      <p className="wide" role="status">{covered?"Evidência aprovada vinculada":"Pendente de evidência ou aprovação"}{item.threshold?" • mínimo: "+item.threshold+(item.unit?" "+item.unit:""):""}</p>
      <button type="button" className="outline-btn" onClick={()=>setRequirements(current=>current.filter((_,i)=>i!==index))}>Remover exigência</button>
     </div>;})}
     <button type="button" className="outline-btn" disabled={requirementBusy||!canEdit||requirements.length>=100} onClick={()=>setRequirements(current=>[...current,{id:crypto.randomUUID(),category:"Atestado técnico",description:"",threshold:"",unit:"",documentId:""}])}>Adicionar exigência</button>{" "}
     <button type="button" className="primary-btn" disabled={requirementBusy||!canEdit} onClick={()=>void saveRequirements()}>{requirementBusy?"Salvando…":"Salvar matriz do edital"}</button>
     <section className="panel" aria-label="Auditoria econômico-financeira" style={{padding:14,marginTop:12,border:"1px solid #36536a",borderRadius:10}}>
       <h4>Auditoria econômico-financeira</h4>
       <p>Informe os valores do balanço e os mínimos exigidos no edital. O cálculo mostra as fórmulas; confira os demonstrativos originais e a regra do edital.</p>
       {["Balanço Patrimonial","DRE","Índices econômico-financeiros"].map(category=>documents.filter(doc=>doc.category===category&&(!doc.tenderId||doc.tenderId===tenderId)).map(doc=><label key={doc.id} style={{display:"block"}}><input type="checkbox" checked={financialDocumentIds.includes(doc.id)} onChange={event=>setFinancialDocumentIds(current=>event.target.checked?[...current,doc.id]:current.filter(id=>id!==doc.id))}/> {doc.name} • {doc.status}</label>))}
       <div className="form-grid">
        <label>Ativo circulante<input inputMode="decimal" value={financialInputs.currentAssets} onChange={event=>setFinancialInputs(v=>({...v,currentAssets:event.target.value}))}/></label>
        <label>Passivo circulante<input inputMode="decimal" value={financialInputs.currentLiabilities} onChange={event=>setFinancialInputs(v=>({...v,currentLiabilities:event.target.value}))}/></label>
        <label>Realizável a longo prazo<input inputMode="decimal" value={financialInputs.realizableLongTerm} onChange={event=>setFinancialInputs(v=>({...v,realizableLongTerm:event.target.value}))}/></label>
        <label>Exigível a longo prazo<input inputMode="decimal" value={financialInputs.longTermLiabilities} onChange={event=>setFinancialInputs(v=>({...v,longTermLiabilities:event.target.value}))}/></label>
        <label>Ativo total<input inputMode="decimal" value={financialInputs.totalAssets} onChange={event=>setFinancialInputs(v=>({...v,totalAssets:event.target.value}))}/></label>
        <label>Liquidez Corrente mínima<input inputMode="decimal" value={financialInputs.minimumCurrent} onChange={event=>setFinancialInputs(v=>({...v,minimumCurrent:event.target.value}))}/></label>
        <label>Liquidez Geral mínima<input inputMode="decimal" value={financialInputs.minimumGeneral} onChange={event=>setFinancialInputs(v=>({...v,minimumGeneral:event.target.value}))}/></label>
        <label>Solvência Geral mínima<input inputMode="decimal" value={financialInputs.minimumSolvency} onChange={event=>setFinancialInputs(v=>({...v,minimumSolvency:event.target.value}))}/></label>
        <label className="wide">Observação e referência do edital<input maxLength={1000} value={financialInputs.sourceNote} onChange={event=>setFinancialInputs(v=>({...v,sourceNote:event.target.value}))}/></label>
       </div>
       <button type="button" className="primary-btn" disabled={financialBusy||!canEdit} onClick={()=>void saveFinancialAudit()}>{financialBusy?"Calculando…":"Calcular e salvar auditoria"}</button>
       {financialAudit&&<div><p>Auditoria registrada em {new Date(financialAudit.updatedAt).toLocaleString("pt-BR")} • responsável {financialAudit.updatedBy}</p><ul>{financialAudit.ratios.map(ratio=><li key={ratio.name}><strong>{ratio.name}:</strong> {ratio.value===null?"Indefinido":ratio.value.toFixed(3)} • mínimo {ratio.minimum===null?"não informado":ratio.minimum.toFixed(3)} • {ratio.status==="ok"?"Atende ao índice numérico":ratio.status==="below"?"Abaixo do mínimo informado":ratio.status==="undefined"?"Denominador zero; revisar":"Sem mínimo para comparar"}</li>)}</ul><small>Resultado matemático auxiliar; não certifica balanço, autenticidade, enquadramento legal ou habilitação.</small></div>}
      </section>
      <section className="panel" aria-label="Agenda de prazos da licitação" style={{padding:14,marginTop:12,border:"1px solid #36536a",borderRadius:10}}>
       <h4>Agenda de prazos da licitação</h4>
       {requirements.filter(item=>item.dueDate).sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))).length?requirements.filter(item=>item.dueDate).sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))).map(item=><p key={item.id}><strong>{new Date(item.dueDate+"T12:00:00").toLocaleDateString("pt-BR")}</strong> • {(()=>{const diff=Math.ceil((Date.parse(item.dueDate+"T23:59:59")-Date.now())/86400000);return diff<0?"ATRASADO":diff<=2?"URGENTE":""})()} • {item.phase||"Prazo do edital"} • {item.description}</p>):<p>Use os campos de etapa e data em cada requisito para formar a agenda deste edital.</p>}
      </section>
      <section className="panel" aria-label="Simulador de preço de lance" style={{padding:14,marginTop:12,border:"1px solid #36536a",borderRadius:10}}>
       <h4>Simulador de preço mínimo de lance</h4>
       <p>Preencha os custos estimados do lote. A simulação considera tributos e margem como percentuais do preço de venda.</p>
       <div className="form-grid">
        <label>Materiais (R$)<input inputMode="decimal" value={priceInputs.materials} onChange={event=>setPriceInputs(v=>({...v,materials:event.target.value}))}/></label>
        <label>Mão de obra (R$)<input inputMode="decimal" value={priceInputs.labor} onChange={event=>setPriceInputs(v=>({...v,labor:event.target.value}))}/></label>
        <label>Deslocamento (R$)<input inputMode="decimal" value={priceInputs.travel} onChange={event=>setPriceInputs(v=>({...v,travel:event.target.value}))}/></label>
        <label>Outros custos (R$)<input inputMode="decimal" value={priceInputs.other} onChange={event=>setPriceInputs(v=>({...v,other:event.target.value}))}/></label>
        <label>Tributos sobre venda (%)<input type="number" min="0" max="99" step="0.01" value={priceInputs.tax} onChange={event=>setPriceInputs(v=>({...v,tax:event.target.value}))}/></label>
        <label>Margem desejada (%)<input type="number" min="0" max="99" step="0.01" value={priceInputs.margin} onChange={event=>setPriceInputs(v=>({...v,margin:event.target.value}))}/></label>
       </div>
       <p>Custo informado: <strong>{priceCost.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong> • Piso sem margem: <strong>{Number.isFinite(minimumBid)?minimumBid.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"percentuais inválidos"}</strong> • Lance-alvo: <strong>{Number.isFinite(targetBid)?targetBid.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"percentuais inválidos"}</strong></p>
       <small>Simulação auxiliar. Confirme custos, regime tributário e regras de formação de preço antes do lance.</small>
      </section>
      <div style={{padding:12,marginTop:12,border:"1px solid #36536a",borderRadius:10}}>
      <strong>Riscos e aprovação do dossiê</strong>
      <p>{requirements.filter(item=>{const doc=documents.find(value=>value.id===item.documentId);return !requirementCovered(item);}).length} exigência(s) sem evidência aprovada vinculada.</p>
      <p>Situação gerencial: {approval?.status==="pending"?"Aguardando aprovação de outra pessoa":approval?.status==="approved"?"Aprovado pela gestão":approval?.status==="rejected"?"Devolvido para ajustes":"Em elaboração"}{approval?.submittedAt?" • enviado em "+new Date(approval.submittedAt).toLocaleString("pt-BR"):""}{approval?.reviewedAt?" • decisão em "+new Date(approval.reviewedAt).toLocaleString("pt-BR"):""}</p>
      {approval?.note&&<p>Justificativa gerencial: {approval.note}</p>}
      <button type="button" className="outline-btn" disabled={!requirements.length} onClick={exportDossier}>Exportar dossiê preliminar</button>{" "}
      <button type="button" className="primary-btn" disabled={!canEdit||requirementBusy||!requirements.length||approval?.status==="pending"||approval?.status==="approved"} onClick={()=>void submitDossier()}>{requirementBusy?"Processando…":"Enviar para aprovação gerencial"}</button>
      {approval?.status==="pending"&&canApprove&&<div style={{marginTop:10}}>
       <label>Justificativa da decisão<textarea value={managerNote} maxLength={1000} onChange={event=>setManagerNote(event.target.value)} placeholder="Registre a revisão gerencial, com ao menos 5 caracteres."/></label>
       <button type="button" className="primary-btn" disabled={requirementBusy||managerNote.trim().length<5} onClick={()=>void decideDossier("approved")}>Aprovar dossiê</button>{" "}
       <button type="button" className="outline-btn" disabled={requirementBusy||managerNote.trim().length<5} onClick={()=>void decideDossier("rejected")}>Devolver para ajustes</button>
      </div>}
     </div>
     <small style={{display:"block",marginTop:8}}>Versão {requirementRevision}. A matriz é separada por empresa e edital; apenas arquivos aprovados aparecem como evidência atendida.</small>
    </>}
   </section>
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
