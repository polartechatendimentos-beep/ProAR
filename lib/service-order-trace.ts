import { fiscalStatusText } from "./nfse-issuance-status.ts";

type Row = Record<string, unknown>;
type Modules = Record<string, Row[]>;
export type TraceAccess = { inventory?:boolean; fiscal?:boolean; finance?:boolean };
export type TraceStatus = "registrado" | "pendente" | "não se aplica" | "sem visibilidade" | "incerto" | "vínculo ausente" | "vínculo ambíguo";
export type TraceStep = { label:string; status:TraceStatus; detail:string; references:string[] };
const text=(value:unknown)=>typeof value==="string"||typeof value==="number"?String(value).trim():"";
const rows=(value:unknown):Row[]=>Array.isArray(value)?value.filter(row=>row&&typeof row==="object"&&!Array.isArray(row)):[];
const fmt=(value:number)=>value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const cents=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)?Math.round(value*100):NaN;
const ids=(items:Row[])=>[...new Set(items.map(item=>text(item.id)).filter(Boolean))];
const step=(label:string,status:TraceStatus,detail:string,references:string[]=[]):TraceStep=>({label,status,detail,references});
const allowed=(label:string)=>step(label,"sem visibilidade","Esta etapa não está disponível para o perfil ou não foi carregada.");
const canceled=(value:unknown)=>/^(cancelad[ao]|inativ[ao])$/.test(fiscalStatusText(value));
const osOrigin=(record:Row)=>text(record.originKey).match(/^([PR]):os:([^:]+)(?::(\d+))?$/i);
const explicitOs=(record:Row, id:string)=>text(record.serviceOrderId)===id || (text(record.sourceId)===id&&/^(os|ordem de servico|serviceorder)$/.test(fiscalStatusText(record.sourceType))) || osOrigin(record)?.[2]===id;
const contradictoryOs=(record:Row,id:string)=>[text(record.serviceOrderId),osOrigin(record)?.[2]||"",/^(os|ordem de servico|serviceorder)$/.test(fiscalStatusText(record.sourceType))?text(record.sourceId):""].some(reference=>reference&&reference!==id);
const isOut=(row:Row)=>/^(saida|consumo|estorno|devolucao)$/.test(fiscalStatusText(row.kind||row.category||row.movementType));
function materialStep(order:Row,modules:Modules,access:TraceAccess):TraceStep {
 const label="Materiais / estoque", id=text(order.id);
 if(!access.inventory)return allowed(label);
 const ledger=rows(modules["Livro de estoque"]).filter(row=>explicitOs(row,id)&&isOut(row));
 const legacy=rows(modules.Estoque).filter(row=>explicitOs(row,id)&&isOut(row)&&!ledger.some(item=>text(item.id)&&text(item.id)===text(row.id)));
 if([...ledger,...legacy].some(row=>contradictoryOs(row,id))||ids(ledger).length<ledger.length||ids(legacy).length<legacy.length)return step(label,"vínculo ambíguo","Há movimentos duplicados, sem identificador ou com referências de OS conflitantes. Não repita a baixa de estoque.",ids([...ledger,...legacy]));
 if(ledger.length&&legacy.length)return step(label,"incerto","Há lançamentos no livro e no estoque legado sem o mesmo identificador. Confira antes de somar ou repetir.",ids([...ledger,...legacy]));
 if(!ledger.length && legacy.length)return step(label,"incerto","Há lançamento no estoque legado sem trilha no livro. Confira a origem antes de baixar material novamente.",ids(legacy));
 if(ledger.length){
  const totals=new Map<string,number>();
  for(const row of ledger){
   const product=text(row.productId); const quantity=typeof row.quantity==="number"?row.quantity:NaN;
   if(!product||!Number.isFinite(quantity))return step(label,"incerto","Há movimento sem produto ou quantidade verificável.",ids(ledger));
   totals.set(product,(totals.get(product)||0)+Math.round(quantity*1000));
  }
  if([...totals.values()].some(quantity=>quantity>0))return step(label,"incerto","Há devolução acima das saídas registradas para esta OS.",ids(ledger));
  const consumed=[...totals.values()].filter(quantity=>quantity<0).length;
  return step(label,"registrado",consumed?`${ledger.length} movimento(s) no livro; ${consumed} produto(s) com consumo líquido.`:"Saídas e estornos se compensam no livro.",ids(ledger));
 }
 const expected=rows(order.catalogItems).some(item=>item.kind==="Produto"||rows(item.technicalSheetSnapshot).length>0||rows(item.actualMaterials).length>0);
 if(expected)return step(label,/^concluida$/.test(fiscalStatusText(order.status))?"vínculo ausente":"pendente","A OS tem material previsto, mas não há movimento explicitamente vinculado. Confira o estoque original; não crie uma segunda baixa.");
 return step(label,"não se aplica","Sem material identificado no cadastro atual da OS.");
}
function fiscalStep(order:Row,modules:Modules,access:TraceAccess,durable?:Row|null):TraceStep {
 const label="Nota fiscal",id=text(order.id);
 if(!access.fiscal)return allowed(label);
 const queue=rows(modules["Central Fiscal"]).filter(row=>explicitOs(row,id));
 const records=[...rows(modules["Documentos Fiscais"]),...rows(modules["Notas Fiscais"])].filter(row=>explicitOs(row,id));
 const fiscal=new Map<string,Row>();
 for(const row of records){const key=text(row.id);if(key&&!fiscal.has(key))fiscal.set(key,row);}
 const number=text(order.nfseNumber),reference=text(order.nfseVerificationCode);
 const numbers=[...new Set([number,text(durable?.number),...records.map(row=>text(row.nfseNumber||row.invoiceNumber||row.number))].filter(Boolean))];
 const proof=[...new Set([reference,text(durable?.verificationCode),text(durable?.protocol),...records.map(row=>text(row.verificationCode||row.protocol||row.accessKey))].filter(Boolean))];
 if([...queue,...records].some(row=>contradictoryOs(row,id))||fiscal.size>1||numbers.length>1)return step(label,"vínculo ambíguo","Há mais de uma referência fiscal ou vínculo inconsistente com esta OS. Não reemita.",ids(records));
 const confirmedRecord=[...fiscal.values()].some(row=>/^(autorizad[ao]|emitid[ao])$/.test(fiscalStatusText(row.status))&&Boolean(text(row.nfseNumber||row.invoiceNumber||row.number||row.protocol||row.accessKey||row.verificationCode)));
 const status=fiscalStatusText(durable?.status||order.nfseStatus),localStatus=fiscalStatusText(order.nfseStatus);
 if(durable?.status&&localStatus==="cancelada"&&status!=="cancelada")return step(label,"incerto","O cadastro indica cancelamento, mas há tentativa local em outro estado. Confira no provedor; não reemita.",ids(records));
 if(/^(processando|transmitindo|validando|contingencia|conferencia pendente|erro)$/.test(status))return step(label,"incerto","Autorização não confirmada. Consulte a situação no provedor; não reemita.",ids(records));
 if(status==="cancelada")return step(label,"registrado","Nota cancelada no cadastro. Não há autorização ativa; confira o documento original.",ids(records));
 if(/^rejeitad[ao]$/.test(status)&&(numbers.length||proof.length||confirmedRecord))return step(label,"incerto","O estado de rejeição conflita com uma referência fiscal. Confira no provedor; não reemita.",ids(records));
 if((/^(autorizad[ao]|emitid[ao])$/.test(status)&&(numbers.length||proof.length))||confirmedRecord)return step(label,"registrado",numbers.length?"NFS-e ou nota vinculada nº "+numbers[0]+".":"Autorização com protocolo, chave ou código registrado.",ids(records));
 if(numbers.length||proof.length||/^autorizad[ao]$/.test(status))return step(label,"incerto","Há indicação fiscal sem autorização e identificação suficientes. Confira no provedor; não reemita.",ids(records));
 if(status==="rejeitada")return step(label,"pendente","O cadastro indica rejeição. Confira a resposta do provedor; não presuma que a transmissão anterior falhou.",ids(records));
 if(queue.length||records.length)return step(label,"pendente","Há registro na fila fiscal, sem autorização confirmada.",ids([...queue,...records]));
 return step(label,"vínculo ausente","Nenhum documento fiscal encontrado por vínculo explícito com esta OS.");
}
function titleSteps(order:Row,modules:Modules,access:TraceAccess,nota:TraceStep,durable?:Row|null):TraceStep[] {
 const heading="Título financeiro", receipt="Recebimento", id=text(order.id);
 if(!access.finance)return [allowed(heading),allowed(receipt)];
 const titles=rows(modules.Financeiro).filter(row=>explicitOs(row,id)&&!canceled(row.status));
 if(!titles.length)return [
  step(heading,"vínculo ausente",order.certameId?"Não há título associado diretamente à OS. Verifique o empenho correspondente; não foi presumido vínculo indireto.":"Não há título associado diretamente à OS. Confira a origem antes de criar outro título."),
  step(receipt,"pendente","Sem título vinculável, não é possível confirmar recebimento nesta trilha."),
 ];
 const installments=titles.map(row=>text(row.installmentNumber||osOrigin(row)?.[3]||1));
 if(ids(titles).length!==titles.length||new Set(installments).size!==installments.length||titles.some(row=>contradictoryOs(row,id)||text(row.transactionType)==="Pagar"||osOrigin(row)?.[1].toUpperCase()==="P")){
  return [step(heading,"vínculo ambíguo","Há títulos duplicados, parcela repetida ou origem conflitante. Não liquide nem crie outro título por esta trilha.",ids(titles)),step(receipt,"incerto","Aba Financeiro: confirme o título correto antes de dar baixa.")];
 }
 const noteNumber=access.fiscal?text(durable?.number||order.nfseNumber):"";
 const noteKeys=access.fiscal?[text(durable?.verificationCode||order.nfseVerificationCode),...nota.references,...[...rows(modules["Documentos Fiscais"]),...rows(modules["Notas Fiscais"])].filter(row=>explicitOs(row,id)).flatMap(row=>[text(row.accessKey),text(row.fiscalDocumentKey)])].filter(Boolean):[];
 const titleConflict=titles.some(row=>(noteNumber&&text(row.invoiceNumber)&&text(row.invoiceNumber)!==noteNumber)||(noteKeys.length&&text(row.fiscalDocumentKey)&&!noteKeys.includes(text(row.fiscalDocumentKey))));
 const linkedNote=nota.status==="registrado"&&titles.every(row=>[text(row.fiscalDocumentKey),text(row.fiscalDocumentId)].some(key=>key&&noteKeys.includes(key)));
 const noteLinkMissing=nota.status==="registrado"&&!linkedNote&&(!noteNumber||!titles.every(row=>text(row.invoiceNumber)===noteNumber));
 const title=step(heading,titleConflict?"vínculo ambíguo":noteLinkMissing?"vínculo ausente":"registrado",titleConflict?"A referência fiscal no título diverge da OS. Confira antes de operar.":`${titles.length} título(s) com origem explícita na OS.`+(noteLinkMissing?" A associação da nota ao título não está demonstrada.":""),ids(titles));
 const ledger=rows(modules["Razão financeiro"]).filter(row=>ids(titles).includes(text(row.titleId)));
 let cash=0,principal=0,reversals=0,settled=0,total=0;
 if(ids(ledger).length!==ledger.length||titleConflict)return [title,step(receipt,"incerto","Vínculo financeiro ou identificadores do razão inconsistentes. Não repita a baixa.",ids(ledger))];
 for(const record of titles){
  const rid=text(record.id),history=rows(record.settlementHistory),reverse=rows(record.reversalHistory),movements=ledger.filter(row=>text(row.titleId)===rid);
  const retired=new Set(reverse.map(row=>text(row.settlementId)));
  const invalid=()=>[title,step(receipt,"incerto","A baixa, o estorno ou o valor do título não confere com o razão financeiro. Consulte o histórico antes de repetir.",ids(ledger))];
  if(ids(history).length!==history.length||retired.size!==reverse.length||reverse.some(row=>!text(row.id)||!retired.has(text(row.settlementId))||(!history.some(entry=>text(entry.id)===text(row.settlementId))&&text(row.settlementId)!==`LEGACY-${rid}`)))return invalid();
  const opening=cents(record._settlementOpening??0),recordTotal=cents(record.value),recordSettled=cents(record.settledValue??0);
  if(!Number.isFinite(recordTotal)||recordTotal<0||!Number.isFinite(recordSettled)||recordSettled<0||!Number.isFinite(opening)||opening<0)return invalid();
  let verifiedPrincipal=0;
  const used=new Set<string>();
  const matching=(predicate:(row:Row)=>boolean,expected:number)=>{
   const match=movements.filter(predicate);
   if(match.length!==1||!Number.isFinite(expected)||cents(match[0].signedValue)!==expected||used.has(text(match[0].id)))return false;
   used.add(text(match[0].id));cash+=expected;return true;
  };
  for(const entry of history){
   const entryId=text(entry.id),entryValue=cents(entry.value),entryPrincipal=cents(entry.principal??entry.value);
   if(!Number.isFinite(entryPrincipal)||entryPrincipal<=0||entryValue<0||!matching(row=>fiscalStatusText(row.kind)==="baixa"&&text(row.settlementId)===entryId,entryValue))return invalid();
   const original=movements.find(row=>used.has(text(row.id))&&text(row.settlementId)===entryId&&fiscalStatusText(row.kind)==="baixa");
   if(retired.has(entryId)){
    if(!matching(row=>fiscalStatusText(row.kind)==="estorno"&&text(row.reversesMovementId)===text(original?.id),-entryValue))return invalid();
    reversals++;
   }else verifiedPrincipal+=entryPrincipal;
  }
  if(opening){
   if(!matching(row=>fiscalStatusText(row.kind)==="saldo legado"&&text(row.id)===`OPEN-TITLE-${rid}`,opening))return invalid();
   if(retired.has(`LEGACY-${rid}`)){
    if(!matching(row=>fiscalStatusText(row.kind)==="estorno"&&text(row.reversesMovementId)===`OPEN-TITLE-${rid}`,-opening))return invalid();
    reversals++;
   }else verifiedPrincipal+=opening;
  }else if(retired.has(`LEGACY-${rid}`))return invalid();
  const recordStatus=fiscalStatusText(record.status);
  if(used.size!==movements.length||verifiedPrincipal!==recordSettled||verifiedPrincipal>recordTotal||(recordStatus==="recebida"&&recordTotal>0&&verifiedPrincipal!==recordTotal)||(recordStatus==="recebida parcialmente"&&!(verifiedPrincipal>0&&verifiedPrincipal<recordTotal)))return invalid();
  principal+=verifiedPrincipal; settled+=recordSettled;total+=recordTotal;
 }
 return [title,step(receipt,principal>0||reversals>0?"registrado":"pendente",principal>0?`${settled<total?"Baixa parcial":"Título(s) quitado(s)"} • principal liquidado ${fmt(principal/100)} • líquido no razão ${fmt(cash/100)}.`:reversals>0?"Baixa(s) estornada(s); não há recebimento líquido vigente.":"Título(s) sem baixa confirmada no razão.",ids(ledger))];
}
/** Só usa referências explícitas. Não emite, vincula, baixa, faz requisição ou escreve dados. */
export function deriveServiceOrderTrace(order:Row,modules:Modules,access:TraceAccess,durableAttempt?:Row|null):TraceStep[]{
 const nota=fiscalStep(order,modules,access,durableAttempt);
 return [step("Ordem de serviço","registrado",text(order.status)||"Status da OS não informado.",[text(order.id)].filter(Boolean)),materialStep(order,modules,access),nota,...titleSteps(order,modules,access,nota,durableAttempt)];
}
