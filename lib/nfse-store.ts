import {commitNeonOperationalState,databaseFetch,PRIMARY_DATABASE_URL} from "./supabase-rest";
import {resolveTenantDb,tenantHeaders} from "./tenant-rest";
import {nfseLedgerKey,type NfseAttempt,type NfseOrder} from "./nfse-reconciliation";

export function nfseCompany(session:{companyId:string;companySlug?:string}){
  const normalized=String(session.companySlug||"").trim().toLowerCase();
  return normalized===(process.env.PROAR_PRIMARY_COMPANY_SLUG||"polartech").trim().toLowerCase()?process.env.PROAR_PRIMARY_COMPANY_ID||"polartech-principal":session.companyId;
}
export async function nfseStore(companyId:string, serviceOrderId:string){
  const db=await resolveTenantDb(companyId);
  if(!db.url||!db.key)throw Error("Cadastro fiscal indisponível.");
  const rest=(suffix:string,options:RequestInit={})=>databaseFetch(`${db.url}/rest/v1/proar_state?${suffix}`,{...options,cache:"no-store",headers:{...tenantHeaders(db.key),...options.headers}});
  const read=async (id:string)=>{
    const response=await rest(`id=eq.${encodeURIComponent(id)}&select=payload&limit=1`);
    if(!response.ok)throw Error("Não foi possível consultar o registro fiscal.");
    return (await response.json())[0]?.payload??null;
  };
  const key=nfseLedgerKey(companyId,serviceOrderId);
  return {
    async order(){
      const primary=process.env.PROAR_PRIMARY_COMPANY_ID||"polartech-principal";
      const rows=db.dedicated?["main"]:companyId===primary?[companyId,"main",(process.env.PROAR_PRIMARY_COMPANY_SLUG||"polartech")]:[companyId];
      let order:NfseOrder|null=null;
      for(const id of new Set(rows)){
        const state=await read(id);
        if((state?._companyId&&state._companyId!==companyId)||(state?.companyId&&state.companyId!==companyId))continue;
        const candidate=Array.isArray(state?.serviceOrders)?state.serviceOrders.find((item:{id?:string})=>item?.id===serviceOrderId):null;
        if(!candidate)continue;
        if(/^(autorizada|emitida|cancelada)$/i.test(String(candidate.nfseStatus||"")))return candidate;
        if(!order||/^(processando|transmitindo|contingência|erro)$/i.test(String(candidate.nfseStatus||"")))order=candidate;
      }
      return order;
    },
    async load(){
      const payload=await read(key) as (NfseAttempt&{_revision?:number})|null;
      if(payload&&(payload.companyId!==companyId||payload.serviceOrderId!==serviceOrderId||payload.revision!==payload._revision))throw Error("Registro fiscal incompatível.");
      return payload;
    },
    async commit(next:NfseAttempt,previous:NfseAttempt|null){
      if(next.companyId!==companyId||next.serviceOrderId!==serviceOrderId)throw Error("Registro fiscal incompatível.");
      const payload={...next,_revision:next.revision};
      if(db.url===PRIMARY_DATABASE_URL)return Boolean(await commitNeonOperationalState(key,previous?.revision??null,payload,[]));
      const response=await rest(previous?`id=eq.${encodeURIComponent(key)}&payload->>_revision=eq.${previous.revision}&select=payload`:"on_conflict=id&select=payload",{
        method:previous?"PATCH":"POST",
        headers:{Prefer:previous?"return=representation":"resolution=ignore-duplicates,return=representation"},
        body:JSON.stringify({...(previous?{}:{id:key}),payload,updated_at:new Date().toISOString()}),
      });
      if(!response.ok)throw Error("Não foi possível confirmar a tentativa fiscal.");
      return (await response.json()).length>0;
    }
  };
}
