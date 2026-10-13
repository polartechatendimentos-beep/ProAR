import { databaseFetch, commitNeonOperationalState, PRIMARY_DATABASE_URL } from "./supabase-rest";
import { tenantHeaders, type TenantDb } from "./tenant-rest";
import { fieldSupportKey, FieldSupportError, type FieldSupportState } from "./field-support.ts";

export async function loadFieldSupport(db: TenantDb, companyId: string) {
  const response=await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(fieldSupportKey(companyId))}&select=payload`,{headers:tenantHeaders(db.key),cache:"no-store"});
  if (!response.ok) throw new FieldSupportError("Falha ao consultar a central de campo.",503);
  const rows=await response.json() as {payload:FieldSupportState}[];
  const state=rows[0]?.payload;
  if (state && state.companyId !== companyId) throw new FieldSupportError("Central de outra empresa.",403);
  return state || {companyId,_revision:0,records:[],requests:{}};
}
export async function commitFieldSupport(db:TenantDb,next:FieldSupportState,previous:FieldSupportState) {
  const id=fieldSupportKey(next.companyId);
  // A new state has no records and revision zero; a successful first write increments it.
  const exists=previous._revision > 0;
  if(db.url === PRIMARY_DATABASE_URL) return Boolean(await commitNeonOperationalState(id,exists?previous._revision:null,next as unknown as Record<string,unknown>,[]));
  const filter=exists?`id=eq.${encodeURIComponent(id)}&payload->>_revision=eq.${previous._revision}&select=payload`:"on_conflict=id&select=payload";
  const response=await databaseFetch(`${db.url}/rest/v1/proar_state?${filter}`,{method:exists?"PATCH":"POST",headers:{...tenantHeaders(db.key),Prefer:exists?"return=representation":"resolution=ignore-duplicates,return=representation"},body:JSON.stringify({...(!exists?{id}:{}),payload:next,updated_at:new Date().toISOString()})});
  if(!response.ok)throw new FieldSupportError("Falha ao confirmar registro de campo.",503);
  return (await response.json()).length>0;
}
