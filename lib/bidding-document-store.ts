import {createHash} from "node:crypto";
import {routeRest} from "./work-route-store";
import type {TenantDb} from "./tenant-rest";
import {commitNeonOperationalState,PRIMARY_DATABASE_URL} from "./supabase-rest";
import type {BiddingDocument} from "./bidding-documents";
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
export const biddingDocumentPrefix=(company:string)=>"bidding-doc-v1:"+hash(company)+":";
export const biddingDocumentKey=(company:string,id:string)=>biddingDocumentPrefix(company)+id;
export const biddingDocumentPath=(company:string,id:string,extension:string)=>"proar-private/bidding/"+hash(company)+"/"+id+"."+extension;
export async function loadBiddingDocument(db:TenantDb,company:string,id:string){
 if(!/^[0-9a-f-]{36}$/.test(id))throw new Error("Documento inválido.");
 const result=await routeRest(db,"proar_state?id=eq."+encodeURIComponent(biddingDocumentKey(company,id))+"&select=payload&limit=1");
 if(!result.ok)throw new Error("Não foi possível carregar o documento.");
 const row=(await result.json())[0]?.payload as BiddingDocument|undefined;
 if(row&&(row.companyId!==company||row.id!==id))throw new Error("Documento pertence a outra empresa.");
 return row??null;
}
export async function saveBiddingDocument(db:TenantDb,next:BiddingDocument,previous:BiddingDocument|null){
 const key=biddingDocumentKey(next.companyId,next.id);
 if(db.url===PRIMARY_DATABASE_URL)return Boolean(await commitNeonOperationalState(key,previous?previous._revision:null,next,[]));
 const path=previous?"proar_state?id=eq."+encodeURIComponent(key)+"&payload->>_revision=eq."+previous._revision+"&select=payload":"proar_state?on_conflict=id&select=payload";
 const result=await routeRest(db,path,{method:previous?"PATCH":"POST",headers:{Prefer:previous?"return=representation":"resolution=ignore-duplicates,return=representation"},body:JSON.stringify(previous?{payload:next,updated_at:new Date().toISOString()}:{id:key,payload:next,updated_at:new Date().toISOString()})});
 return result.ok&&(await result.json()).length>0;
}
export function biddingTenderOptions(state:{moduleRecords?:Record<string,Record<string,unknown>[]>}){
 const options=new Map<string,string>();
 for(const moduleName of ["Certames","Acompanhamento de licitações","Oportunidades importadas"]){
  for(const row of state.moduleRecords?.[moduleName]??[]){if(row.id)options.set(String(row.id),String(row.name||row.id));}
 }
 return [...options].map(([id,name])=>({id,name}));
}
