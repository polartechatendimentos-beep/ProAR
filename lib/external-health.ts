export type ExternalHealthState="ok"|"degraded"|"error";

export type ExternalProbe={
  id:string;
  label:string;
  state:ExternalHealthState;
  status:number|null;
  latencyMs:number;
  checkedAt:string;
  code?:string;
  message:string;
  emptyResponse?:boolean;
};

async function timedFetch(url:string,init:RequestInit,timeoutMs:number){
  const started=Date.now();
  try{
    const response=await fetch(url,{...init,cache:"no-store",signal:AbortSignal.timeout(timeoutMs)});
    const text=await response.text();
    return {response,text,latencyMs:Date.now()-started,error:null as unknown};
  }catch(error){
    return {response:null,text:"",latencyMs:Date.now()-started,error};
  }
}

function classifyExternal(id:string,label:string,result:Awaited<ReturnType<typeof timedFetch>>):ExternalProbe{
  const checkedAt=new Date().toISOString();
  if(result.error){
    const timeout=/timeout|abort/i.test(result.error instanceof Error?result.error.message:String(result.error));
    return {
      id,label,state:"error",status:null,latencyMs:result.latencyMs,checkedAt,
      code:timeout?"PROAR-INTEGRATION-003":"PROAR-INTEGRATION-001",
      message:timeout?"A API excedeu o tempo de resposta.":"A API externa não respondeu.",
    };
  }
  const status=result.response?.status??null;
  const empty=!result.text.trim();
  if(status!==null && status>=500) return {id,label,state:"error",status,latencyMs:result.latencyMs,checkedAt,code:"PROAR-INTEGRATION-001",message:`API respondeu HTTP ${status}.`};
  if(status===429) return {id,label,state:"degraded",status,latencyMs:result.latencyMs,checkedAt,code:"PROAR-INTEGRATION-001",message:"API limitou temporariamente as requisições."};
  if(empty) return {id,label,state:"degraded",status,latencyMs:result.latencyMs,checkedAt,code:"PROAR-INTEGRATION-004",message:"API respondeu sem conteúdo.",emptyResponse:true};
  return {id,label,state:result.latencyMs>3000?"degraded":"ok",status,latencyMs:result.latencyMs,checkedAt,message:result.latencyMs>3000?"API disponível, mas com latência elevada.":"API disponível."};
}

export async function probePncp():Promise<ExternalProbe>{
  const today=new Date().toISOString().slice(0,10).replaceAll("-","");
  const query=new URLSearchParams({dataInicial:today,dataFinal:today,pagina:"1",tamanhoPagina:"1",uf:"SP"});
  const result=await timedFetch(`https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?${query}`,{
    headers:{Accept:"application/json","User-Agent":"ProAR-Health/1.0 (+https://polartech.proar.online)"},
  },6500);
  return classifyExternal("pncp","PNCP",result);
}

export async function probeCnpjApis():Promise<ExternalProbe>{
  // CNPJ sintaticamente inválido de propósito: 4xx confirma conectividade sem consultar dados de terceiros.
  const result=await timedFetch("https://brasilapi.com.br/api/cnpj/v1/00000000000000",{
    headers:{Accept:"application/json","User-Agent":"ProAR-Health/1.0 (+https://polartech.proar.online)"},
  },6500);
  const probe=classifyExternal("cnpj","Consulta CNPJ / BrasilAPI",result);
  if(probe.status!==null && probe.status>=400 && probe.status<500){
    return {...probe,state:probe.latencyMs>3000?"degraded":"ok",code:undefined,message:probe.latencyMs>3000?"API CNPJ disponível, mas com latência elevada.":"API CNPJ disponível."};
  }
  return probe;
}
