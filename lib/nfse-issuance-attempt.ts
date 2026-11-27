import { createHash } from "node:crypto";
import { routeRest } from "./work-route-store";
import {commitNeonOperationalState,PRIMARY_DATABASE_URL} from "./supabase-rest";
import type {TenantDb} from "./tenant-rest";
import type {NfseProviderOutcome} from "./nfse-issuance-status";

export type NfseAttempt = {
 companyId:string; orderId:string; idempotencyKey:string; _revision:number; status:NfseProviderOutcome;
 actor:string; updatedAt:string; number?:string; verificationCode?:string; protocol?:string;
};
function attemptId(company:string, orderId:string){
 return "nfse-os-attempt-v1:"+createHash("sha256").update(JSON.stringify([company,orderId])).digest("hex");
}
export async function loadNfseAttempt(db:TenantDb, company:string, orderId:string):Promise<NfseAttempt|null> {
 const response=await routeRest(db,"proar_state?id=eq."+encodeURIComponent(attemptId(company,orderId))+"&select=payload&limit=1");
 if(!response.ok)throw new Error("Registro de transmissão fiscal indisponível.");
 const row=(await response.json())[0]?.payload as NfseAttempt|undefined;
 if(row&&(row.companyId!==company||row.orderId!==orderId))throw new Error("Identidade do registro fiscal inválida.");
 return row??null;
}
export async function writeNfseAttempt(db:TenantDb, next:NfseAttempt, previous:NfseAttempt|null) {
 const key=attemptId(next.companyId,next.orderId);
 if(db.url===PRIMARY_DATABASE_URL)return Boolean(await commitNeonOperationalState(key,previous?._revision??null,next,[]));
 const path=previous?"proar_state?id=eq."+encodeURIComponent(key)+"&payload->>_revision=eq."+previous._revision+"&select=payload":"proar_state?on_conflict=id&select=payload";
 const response=await routeRest(db,path,{method:previous?"PATCH":"POST",headers:{Prefer:previous?"return=representation":"resolution=ignore-duplicates,return=representation"},body:JSON.stringify(previous?{payload:next,updated_at:next.updatedAt}:{id:key,payload:next,updated_at:next.updatedAt})});
 if(!response.ok)throw new Error("Registro de transmissão fiscal não confirmado.");
 return (await response.json()).length>0;
}
