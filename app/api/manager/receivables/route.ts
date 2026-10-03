import { NextRequest, NextResponse } from "next/server";
import { readManagerSession } from "../../../../lib/manager-auth";
import { supabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";
import { financialAccessState, receivableStatus } from "../../../../lib/manager-billing";

const auth=(request:NextRequest)=>readManagerSession(request);

export async function GET(request:NextRequest){
  const user=auth(request);
  if(!user)return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  if(!supabaseConfigured())return NextResponse.json({error:"Banco mestre não configurado."},{status:503});

  const url=new URL(request.url);
  const companyId=url.searchParams.get("companyId")||"";
  const companies=await supabaseRest(companyId
    ? `proar_companies?select=id,trade_name,legal_name,billing_auto_block,billing_grace_days&id=eq.${encodeURIComponent(companyId)}&limit=1`
    : "proar_companies?select=id,trade_name,legal_name,billing_auto_block,billing_grace_days&order=trade_name.asc"
  );
  if(!companies.ok)return NextResponse.json({error:"Falha ao consultar empresas."},{status:502});
  const companyRows=await companies.json();

  const receivables=await supabaseRest(companyId
    ? `proar_manager_receivables?select=*&company_id=eq.${encodeURIComponent(companyId)}&order=due_date.desc`
    : "proar_manager_receivables?select=*&order=due_date.desc"
  );
  if(!receivables.ok){
    return NextResponse.json({setupPending:true,receivables:[],companies:companyRows,message:"Estrutura de contas a receber ainda não aplicada no banco mestre."});
  }
  const rows=await receivables.json();
  const now=new Date();
  const enriched=rows.map((item:Record<string,unknown>)=>({...item,computed_status:receivableStatus(item as any,now)}));
  const financialSummary=companyRows.map((company:Record<string,unknown>)=>{
    const companyReceivables=enriched.filter((item:Record<string,unknown>)=>item.company_id===company.id);
    return {companyId:company.id,...financialAccessState(company as any,companyReceivables as any,now)};
  });
  return NextResponse.json({setupPending:false,receivables:enriched,companies:companyRows,financialSummary});
}

export async function POST(request:NextRequest){
  const user=auth(request);
  if(!user)return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  const body=await request.json();
  const companyId=String(body.companyId||"").trim();
  const amount=Number(body.amount||0);
  const dueDate=String(body.dueDate||"").trim();
  const description=String(body.description||"Mensalidade ProAR").trim().slice(0,160);
  if(!companyId||!dueDate||!Number.isFinite(amount)||amount<0)return NextResponse.json({error:"Informe empresa, valor e vencimento válidos."},{status:400});
  const response=await supabaseRest("proar_manager_receivables",{
    method:"POST",
    headers:{Prefer:"return=representation"},
    body:JSON.stringify({company_id:companyId,description,amount,due_date:dueDate,status:"open",created_by:user.username,notes:String(body.notes||"").slice(0,500)})
  });
  if(!response.ok)return NextResponse.json({error:"Não foi possível criar a conta a receber. Verifique se a migration do Manager foi aplicada."},{status:502});
  const rows=await response.json();
  await supabaseRest("proar_manager_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({company_id:companyId,action:"RECEIVABLE_CREATED",actor:user.username,details:{receivableId:rows?.[0]?.id,amount,dueDate,description}})});
  return NextResponse.json({created:true,receivable:rows?.[0]});
}

export async function PATCH(request:NextRequest){
  const user=auth(request);
  if(!user)return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  const body=await request.json();

  if(body.updateBillingSettings===true){
    const companyId=String(body.companyId||"").trim();
    const graceDays=Math.max(0,Math.min(Number(body.graceDays??5),90));
    const autoBlock=body.autoBlock!==false;
    const response=await supabaseRest(`proar_companies?id=eq.${encodeURIComponent(companyId)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({billing_auto_block:autoBlock,billing_grace_days:graceDays,updated_at:new Date().toISOString()})});
    if(!response.ok)return NextResponse.json({error:"Não foi possível atualizar a regra de cobrança."},{status:502});
    await supabaseRest("proar_manager_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({company_id:companyId,action:"BILLING_SETTINGS_UPDATED",actor:user.username,details:{autoBlock,graceDays}})});
    return NextResponse.json({saved:true});
  }

  const id=String(body.id||"").trim();
  if(!id)return NextResponse.json({error:"Conta a receber não informada."},{status:400});
  const status=["open","paid","cancelled"].includes(String(body.status))?String(body.status):"open";
  const patch:Record<string,unknown>={status,updated_at:new Date().toISOString()};
  if(status==="paid"){patch.paid_at=body.paidAt||new Date().toISOString();patch.payment_method=String(body.paymentMethod||"").slice(0,80);}
  if(status!=="paid")patch.paid_at=null;
  if(typeof body.notes==="string")patch.notes=body.notes.slice(0,500);
  const response=await supabaseRest(`proar_manager_receivables?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(patch)});
  if(!response.ok)return NextResponse.json({error:"Não foi possível atualizar a conta a receber."},{status:502});
  const rows=await response.json();
  const companyId=String(rows?.[0]?.company_id||body.companyId||"");
  await supabaseRest("proar_manager_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({company_id:companyId,action:status==="paid"?"RECEIVABLE_PAID":"RECEIVABLE_UPDATED",actor:user.username,details:{receivableId:id,status,paymentMethod:patch.payment_method||null}})});
  return NextResponse.json({saved:true,receivable:rows?.[0]});
}
