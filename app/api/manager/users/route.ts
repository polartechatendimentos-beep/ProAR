import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readManagerSession } from "../../../../lib/manager-auth";
import { hashPassword } from "../../../../lib/password";
import { supabaseRest } from "../../../../lib/supabase-rest";

const auth=(request:NextRequest)=>readManagerSession(request);
const tempPassword=()=>randomBytes(9).toString("base64url").slice(0,12);

export async function GET(request:NextRequest){
  const user=auth(request); if(!user)return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  const url=new URL(request.url); const companyId=url.searchParams.get("companyId")||"";
  if(!companyId)return NextResponse.json({users:[]});
  const r=await supabaseRest(`proar_trial_users?select=id,company_id,username,display_name,role,permissions,active,must_change_password,created_at,updated_at&company_id=eq.${encodeURIComponent(companyId)}&order=created_at.asc`);
  if(!r.ok)return NextResponse.json({error:"Não foi possível carregar os usuários administrativos."},{status:502});
  return NextResponse.json({users:await r.json()});
}

export async function POST(request:NextRequest){
  const user=auth(request); if(!user)return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  const body=await request.json(); const companyId=String(body.companyId||"").trim(); const username=String(body.username||"").trim().toLowerCase(); const displayName=String(body.displayName||username).trim();
  if(!companyId||!username)return NextResponse.json({error:"Informe empresa e usuário."},{status:400});
  const password=tempPassword();
  const r=await supabaseRest("proar_trial_users",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({company_id:companyId,username,display_name:displayName,password_hash:hashPassword(password),role:"Administrador",permissions:["*"],active:true,must_change_password:true,updated_at:new Date().toISOString()})});
  if(!r.ok)return NextResponse.json({error:"Não foi possível criar o administrador do tenant."},{status:502});
  await supabaseRest("proar_manager_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({company_id:companyId,action:"TENANT_ADMIN_CREATED",actor:user.username,details:{username}})});
  return NextResponse.json({created:true,user:(await r.json())?.[0],temporaryPassword:password});
}

export async function PATCH(request:NextRequest){
  const user=auth(request); if(!user)return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  const body=await request.json(); const id=String(body.id||"").trim(); const companyId=String(body.companyId||"").trim();
  if(!id)return NextResponse.json({error:"Usuário não informado."},{status:400});
  const patch:Record<string,unknown>={updated_at:new Date().toISOString()};
  let temporaryPassword:string|undefined;
  if(typeof body.active==="boolean")patch.active=body.active;
  if(body.resetPassword===true){temporaryPassword=tempPassword();patch.password_hash=hashPassword(temporaryPassword);patch.must_change_password=true;}
  if(typeof body.displayName==="string")patch.display_name=body.displayName.slice(0,120);
  const r=await supabaseRest(`proar_trial_users?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(patch)});
  if(!r.ok)return NextResponse.json({error:"Não foi possível atualizar o usuário."},{status:502});
  const action=body.resetPassword===true?"TENANT_ADMIN_PASSWORD_RESET":"TENANT_ADMIN_UPDATED";
  await supabaseRest("proar_manager_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({company_id:companyId,action,actor:user.username,details:{userId:id,active:patch.active}})});
  return NextResponse.json({saved:true,user:(await r.json())?.[0],temporaryPassword});
}
