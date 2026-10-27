import "server-only";
import { supabaseRest } from "./supabase-rest";

export type StateSnapshot = {
  id:number;
  company_id:string;
  state_id:string;
  revision:number;
  payload:Record<string,unknown>;
  reason:string;
  created_by?:string|null;
  created_at:string;
};

export async function createStateSnapshot(input:{
  companyId:string;
  stateId:string;
  payload:Record<string,unknown>;
  reason:string;
  createdBy?:string;
}) {
  const revision=Number(input.payload._revision||0);
  const response=await supabaseRest("proar_state_snapshots?on_conflict=company_id,state_id,revision",{
    method:"POST",
    headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},
    body:JSON.stringify({
      company_id:input.companyId,
      state_id:input.stateId,
      revision,
      payload:input.payload,
      reason:input.reason.slice(0,120),
      created_by:input.createdBy?.slice(0,120)||null,
      created_at:new Date().toISOString(),
    }),
  });
  return response.ok;
}

export async function listStateSnapshots(companyId:string,limit=30):Promise<StateSnapshot[]> {
  const safeLimit=Math.max(1,Math.min(100,limit));
  const response=await supabaseRest(`proar_state_snapshots?company_id=eq.${encodeURIComponent(companyId)}&select=id,company_id,state_id,revision,reason,created_by,created_at&order=created_at.desc&limit=${safeLimit}`);
  if(!response.ok)return[];
  return await response.json() as StateSnapshot[];
}

export async function getStateSnapshot(companyId:string,snapshotId:number):Promise<StateSnapshot|null> {
  const response=await supabaseRest(`proar_state_snapshots?company_id=eq.${encodeURIComponent(companyId)}&id=eq.${snapshotId}&select=*&limit=1`);
  if(!response.ok)return null;
  const rows=await response.json() as StateSnapshot[];
  return rows[0]||null;
}
