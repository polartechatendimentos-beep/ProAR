import { NextRequest, NextResponse } from "next/server";
import { readManagerSession } from "../../../../../lib/manager-auth";
import { resolveTenantDb, tenantHeaders } from "../../../../../lib/tenant-rest";
import { databaseFetch } from "../../../../../lib/supabase-rest";
import { createStateSnapshot, getStateSnapshot, listStateSnapshots } from "../../../../../lib/state-snapshots";
import { recordSystemIncident } from "../../../../../lib/system-observability";

export const runtime="nodejs";

function manager(request:NextRequest){return readManagerSession(request)}
function stateId(companyId:string,dedicated:boolean){return dedicated?"main":companyId}
function rest(db:{url:string;key:string},path:string,init:RequestInit={}){
  return databaseFetch(`${db.url}/rest/v1/${path}`,{...init,headers:{...tenantHeaders(db.key),...init.headers},cache:"no-store"});
}

async function currentState(companyId:string){
  const db=await resolveTenantDb(companyId);
  if(!db.url||!db.key)throw new Error("Banco do tenant indisponível.");
  const id=stateId(companyId,db.dedicated);
  const response=await rest(db,`proar_state?id=eq.${encodeURIComponent(id)}&select=payload`);
  if(!response.ok)throw new Error("Não foi possível ler o estado atual.");
  const rows=await response.json() as {payload?:Record<string,unknown>}[];
  return{db,id,payload:rows[0]?.payload||null};
}

export async function GET(request:NextRequest){
  if(!manager(request))return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  const companyId=String(request.nextUrl.searchParams.get("companyId")||"").trim();
  if(!companyId)return NextResponse.json({error:"Empresa não informada."},{status:400});
  return NextResponse.json({snapshots:await listStateSnapshots(companyId,40)});
}

export async function POST(request:NextRequest){
  const user=manager(request);
  if(!user)return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  const body=await request.json().catch(()=>({}));
  const companyId=String(body.companyId||"").trim();
  const action=String(body.action||"snapshot");
  if(!companyId)return NextResponse.json({error:"Empresa não informada."},{status:400});

  if(action==="snapshot"){
    const current=await currentState(companyId);
    if(!current.payload)return NextResponse.json({error:"A empresa ainda não possui estado operacional para backup."},{status:404});
    await createStateSnapshot({companyId,stateId:current.id,payload:current.payload,reason:"manual-manager",createdBy:user.username});
    return NextResponse.json({saved:true,snapshots:await listStateSnapshots(companyId,40)});
  }

  if(action==="restore"){
    const snapshotId=Number(body.snapshotId);
    if(!Number.isInteger(snapshotId)||snapshotId<=0)return NextResponse.json({error:"Snapshot inválido."},{status:400});
    if(String(body.confirmation||"")!==`RESTORE ${snapshotId}`)return NextResponse.json({error:`Confirmação obrigatória: RESTORE ${snapshotId}`},{status:409});
    const snapshot=await getStateSnapshot(companyId,snapshotId);
    if(!snapshot)return NextResponse.json({error:"Snapshot não encontrado."},{status:404});

    const current=await currentState(companyId);
    if(current.payload)await createStateSnapshot({companyId,stateId:current.id,payload:current.payload,reason:"pre-restore-safety",createdBy:user.username});

    const currentRevision=Number(current.payload?._revision||0);
    const restored={...snapshot.payload,_revision:currentRevision+1,_updatedAt:new Date().toISOString(),_companyId:companyId,_restoredFromSnapshot:snapshotId,_restoredBy:user.username};
    const revisionFilter=current.payload?._revision===undefined?"payload->>_revision=is.null":"payload->>_revision=eq."+currentRevision;
    const response=current.payload
      ? await rest(current.db,`proar_state?id=eq.${encodeURIComponent(current.id)}&${revisionFilter}&select=payload`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({payload:restored,updated_at:new Date().toISOString()})})
      : await rest(current.db,"proar_state?on_conflict=id&select=payload",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=representation"},body:JSON.stringify({id:current.id,payload:restored,updated_at:new Date().toISOString()})});
    if(!response.ok)return NextResponse.json({error:"O estado mudou durante a restauração. Nada foi sobrescrito."},{status:409});

    await recordSystemIncident({companyId,module:"Centro de Recuperação",operation:"Restauração de snapshot",severity:"warning",metadata:{snapshotId,actor:user.username,previousRevision:currentRevision,newRevision:currentRevision+1}});
    return NextResponse.json({restored:true,snapshotId,newRevision:currentRevision+1});
  }

  return NextResponse.json({error:"Ação de recuperação desconhecida."},{status:400});
}
