import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "../../../../lib/password";
import { supabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";
import { tenantSlugFromHost } from "../../../../lib/tenant-host";

const hash=(value:string)=>createHash("sha256").update(value).digest("hex");

export async function POST(request: NextRequest){
  if(!supabaseConfigured()) return NextResponse.json({error:"Recuperação indisponível."},{status:503});
  const {token="",password=""}=await request.json();
  const raw=String(password);
  if(raw.length<10||!/[A-Z]/.test(raw)||!/[a-z]/.test(raw)||!/[0-9]/.test(raw)) return NextResponse.json({error:"Use pelo menos 10 caracteres, com maiúscula, minúscula e número."},{status:400});
  const tokenHash=hash(String(token)); const id=`password-reset-${tokenHash}`;
  const response=await supabaseRest(`proar_state?select=payload&id=eq.${encodeURIComponent(id)}&limit=1`);
  const rows=response.ok?await response.json():[]; const record=rows[0]?.payload;
  const tenant=tenantSlugFromHost(request.headers.get("host"));
  if(!record||record.used||record.tokenHash!==tokenHash||new Date(record.expiresAt).getTime()<Date.now()||(tenant&&record.companySlug!==tenant)) return NextResponse.json({error:"Link inválido, expirado ou já utilizado."},{status:400});
  const updated=await supabaseRest(`proar_trial_users?company_id=eq.${encodeURIComponent(record.companyId)}&username=eq.${encodeURIComponent(record.username)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({password_hash:hashPassword(raw),must_change_password:false,updated_at:new Date().toISOString()})});
  if(!updated.ok) return NextResponse.json({error:"Não foi possível redefinir a senha."},{status:502});
  await supabaseRest(`proar_state?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({payload:{...record,used:true,usedAt:new Date().toISOString()},updated_at:new Date().toISOString()})});
  return NextResponse.json({saved:true});
}
