import { databaseFetch, masterDatabaseConfig } from "./supabase-rest";
import { commitJsonState } from "./state-commit";
import { publicOrderIsCurrent, publicOrderSnapshotId, type PublicOrderProjection } from "./service-order-public-view";

type Row=Record<string,unknown>;
export async function publicOrderStore(){
 const {url,key}=masterDatabaseConfig();
 if(!url||!key)throw new Error("Base de acompanhamento indisponível.");
 const headers={apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
 async function read(companyId:string,orderId:string){
  const id=publicOrderSnapshotId(companyId,orderId);
  const response=await databaseFetch(`${url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload&limit=1`,{headers,cache:"no-store",signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw new Error("Não foi possível conferir o acompanhamento.");
  const rows=await response.json() as {payload?:Row}[];
  const row=rows[0]?.payload||null;
  if(row&&(row.companyId!==companyId||row.orderId!==orderId))throw new Error("Acompanhamento vinculado a outro registro.");
  return row;
 }
 return {read,async publish(expected:PublicOrderProjection,sourceRevision:number){
  const id=publicOrderSnapshotId(expected.companyId,expected.orderId);
  for(let i=0;i<3;i++){
   const previous=await read(expected.companyId,expected.orderId);
   if((Number(previous?.sourceRevision)||0)>sourceRevision)return {status:"newer" as const};
   if(publicOrderIsCurrent(previous,expected))return {status:"current" as const};
   const response=await commitJsonState(databaseFetch,url,headers,id,previous,{...expected,sourceRevision,revision:(Number(previous?.revision)||0)+1,updatedAt:new Date().toISOString()});
   if(response.ok)return {status:"published" as const};
   if(!response.conflict)throw new Error("Não foi possível publicar o acompanhamento.");
  }
  return {status:"conflict" as const};
 }};
}
