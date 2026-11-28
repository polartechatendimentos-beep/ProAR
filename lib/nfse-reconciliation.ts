import {createHash} from "node:crypto";

export type NfseStatus = "Processando"|"Autorizada"|"Rejeitada";
export type NfseResult = {number?:string;verificationCode?:string};
export type NfseAttempt = {companyId:string;serviceOrderId:string;idempotencyKey:string;value:number;providerCompanyId?:string;status:NfseStatus;revision:number;result?:NfseResult};
export type NfseOrder = {nfseStatus?:unknown;nfseValue?:unknown;nfseNumber?:unknown;nfseVerificationCode?:unknown};
const pendingError="O resultado da emissão ainda não foi confirmado. Consulte a NFS-e novamente; não reenvie a DPS.";
const rejectedError="A SEFIN confirmou a rejeição. Revise os dados antes de emitir novamente.";
const safeObject=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
const token=(value:unknown)=>typeof value==="string"||typeof value==="number"?String(value).trim().slice(0,100):"";
export const validNfseOrderId=(value:unknown):value is string=>typeof value==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
export const nfseLedgerKey=(companyId:string,serviceOrderId:string)=>"nfse-attempt:"+createHash("sha256").update(JSON.stringify([companyId,serviceOrderId])).digest("hex");
const makeKey=(companyId:string,serviceOrderId:string,revision:number)=>createHash("sha256").update(JSON.stringify(["nfse/v2",companyId,serviceOrderId,revision])).digest("hex");
const legacyKey=(companyId:string,serviceOrderId:string,value:number)=>createHash("sha256").update(`${companyId}:${serviceOrderId}:${value}`).digest("hex");

function classify(data:unknown,httpStatus:number,attempt:NfseAttempt,lookup:boolean){
  const root=safeObject(data), provider=safeObject(root.result??root.data??root);
  const responseKey=root.idempotencyKey??provider.idempotencyKey;
  const company=root.companyId??provider.companyId;
  if((lookup||responseKey!==undefined)&&responseKey!==attempt.idempotencyKey)return {status:"Processando" as const};
  if((lookup||company!==undefined)&&company!==(attempt.providerCompanyId??attempt.companyId))return {status:"Processando" as const};
  if(!((httpStatus>=200&&httpStatus<300)||httpStatus===422))return {status:"Processando" as const};
  const state=token(provider.status??provider.situacao??provider.state).toLowerCase();
  if(httpStatus!==202&&["rejeitada","rejeitado","rejected","denegada","denied"].includes(state))return {status:"Rejeitada" as const};
  const number=token(provider.number??provider.numero??provider.nfseNumber);
  const verificationCode=token(provider.verificationCode??provider.codigoVerificacao??provider.chave??provider.key);
  if(httpStatus!==202&&httpStatus!==422&&Boolean(number||verificationCode)&&(provider.authorized===true||provider.autorizada===true||provider.issued===true||["autorizada","autorizado","authorized","aprovada","aprovado"].includes(state))){
    return {status:"Autorizada" as const,result:{...(number?{number}:{}),...(verificationCode?{verificationCode}:{})}};
  }
  return {status:"Processando" as const};
}
type Repository={load:()=>Promise<NfseAttempt|null>;order:()=>Promise<NfseOrder|null>;commit:(next:NfseAttempt,previous:NfseAttempt|null)=>Promise<boolean>};
type Input={companyId:string;legacyCompanyId?:string;serviceOrderId:string;repo:Repository;send?:(attempt:NfseAttempt)=>Promise<Response>;lookup?:(attempt:NfseAttempt)=>Promise<Response>;value?:number};
type Outcome={code:number;body:{status?:NfseStatus;issued?:boolean;value?:number;result?:NfseResult;error?:string}};
function outcome(attempt:Pick<NfseAttempt,"status"|"value"|"result">,issue=false):Outcome{
  const {status,value,result}=attempt;
  return {code:status==="Processando"?202:status==="Rejeitada"&&issue?422:200,body:{status,issued:status==="Autorizada",...(value>0?{value}:{}),...(result?{result}:{}),...(status==="Processando"?{error:pendingError}:status==="Rejeitada"?{error:rejectedError}:{})}};
}
export async function runNfse(input:Input,action:"issue"|"reconcile"):Promise<Outcome>{
  const {companyId,legacyCompanyId=companyId,serviceOrderId,repo}=input;
  const issue=action==="issue";
  let attempt=await repo.load();
  if(attempt?.status==="Autorizada"||(!issue&&attempt?.status==="Rejeitada"))return outcome(attempt);
  if(issue&&attempt?.status==="Processando")return outcome(attempt);
  if(!attempt){
    const order=await repo.order();
    if(!order)return {code:404,body:{error:"Ordem de serviço não encontrada."}};
    const status=token(order.nfseStatus).toLowerCase();
    const value=Number(order.nfseValue)||0;
    if(["autorizada","emitida","cancelada"].includes(status))return {code:409,body:{error:"Já existe documento fiscal registrado para esta OS. Não reemita por este fluxo."}};
    if(["processando","transmitindo","contingência","erro"].includes(status)){
      if(issue||value<=0)return outcome({status:"Processando",value});
      const legacy={companyId,serviceOrderId,status:"Processando" as const,value,providerCompanyId:legacyCompanyId,idempotencyKey:legacyKey(legacyCompanyId,serviceOrderId,value),revision:1};
      if(!await repo.commit(legacy,null))return outcome(await repo.load()??legacy);
      attempt=legacy;
    }else if(!issue)return {code:404,body:{error:"Não foi localizada tentativa de emissão para esta OS."}};
  }

  if(issue){
    if(!input.send)return {code:428,body:{error:"Adaptador do Sistema Nacional NFS-e não configurado. Nenhuma DPS foi transmitida."}};
    const revision=(attempt?.revision??0)+1;
    const next:NfseAttempt={companyId,serviceOrderId,status:"Processando",providerCompanyId:legacyCompanyId,value:input.value!,idempotencyKey:makeKey(companyId,serviceOrderId,revision),revision};
    if(!await repo.commit(next,attempt)){
      const current=await repo.load();
      return current?.status==="Autorizada"?outcome(current):outcome(next);
    }
    attempt=next;
  }
  if(!attempt) return {code:404,body:{error:"Tentativa não localizada."}};
  const request=issue?input.send:input.lookup;
  if(!request)return {code:202,body:{...outcome(attempt).body,error:"Consulta da SEFIN ainda não configurada. Não reenvie a DPS; confira o resultado no emissor nacional."}};

  // Each attempt is committed before any transmission. All ambiguous outcomes keep that lock.
  let next:NfseAttempt;
  try{
    const response=await request(attempt);
    const result=classify(await response.json(),response.status,attempt,!issue);
    if(result.status==="Processando")return outcome(attempt);
    next={...attempt,...result,revision:attempt.revision+1};
  }catch{return outcome(attempt);}
  try{
    if(await repo.commit(next,attempt))return outcome(next,issue);
    const current=await repo.load();
    return current?.idempotencyKey===attempt.idempotencyKey?outcome(current,issue):outcome(attempt);
  }catch{return outcome(attempt);}
}
