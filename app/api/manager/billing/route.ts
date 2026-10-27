import { NextRequest, NextResponse } from "next/server";
import { readManagerSession } from "../../../../lib/manager-auth";
import {
  cancelReceivable,
  getBillingCompany,
  getReceivableById,
  issueCurrentMonth,
  issueReceivable,
  listManagerReceivables,
  markReceivablePaidManually,
  runManagerBillingCycle,
  summarizeManagerBilling,
  syncCompanyBillingAccess,
} from "../../../../lib/manager-billing";
import { mercadoPagoConfigured } from "../../../../lib/mercado-pago";
import { supabaseRest } from "../../../../lib/supabase-rest";

export const runtime = "nodejs";

function session(request:NextRequest) {
  return readManagerSession(request);
}

export async function GET(request:NextRequest) {
  if (!session(request)) return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  try {
    const [receivables,companiesResponse]=await Promise.all([
      listManagerReceivables(250),
      supabaseRest("proar_companies?select=*&order=created_at.desc"),
    ]);
    const companies=companiesResponse.ok?await companiesResponse.json():[];
    return NextResponse.json({
      receivables,
      summary:summarizeManagerBilling(receivables,companies),
      mercadoPagoConfigured:mercadoPagoConfigured(),
    });
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Falha ao carregar contas a receber."},{status:500});
  }
}

export async function POST(request:NextRequest) {
  const user=session(request);
  if (!user) return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  try {
    const body=await request.json();
    const action=String(body.action||"");
    if (action==="run-cycle") {
      return NextResponse.json({ok:true,result:await runManagerBillingCycle(user.username)});
    }
    if (action==="issue-current") {
      const companyId=String(body.companyId||"").trim();
      if (!companyId) return NextResponse.json({error:"Empresa não informada."},{status:400});
      return NextResponse.json({ok:true,receivable:await issueCurrentMonth(companyId,user.username)});
    }
    if (action==="reissue") {
      const receivable=await getReceivableById(String(body.receivableId||""));
      const company=await getBillingCompany(receivable.company_id);
      return NextResponse.json({ok:true,receivable:await issueReceivable(receivable,company,user.username,true)});
    }
    if (action==="mark-paid") {
      return NextResponse.json({ok:true,receivable:await markReceivablePaidManually(String(body.receivableId||""),user.username)});
    }
    if (action==="cancel") {
      return NextResponse.json({ok:true,receivable:await cancelReceivable(String(body.receivableId||""),user.username)});
    }
    if (action==="sync-access") {
      const companyId=String(body.companyId||"").trim();
      if (!companyId) return NextResponse.json({error:"Empresa não informada."},{status:400});
      return NextResponse.json({ok:true,result:await syncCompanyBillingAccess(companyId,user.username)});
    }
    return NextResponse.json({error:"Ação de cobrança inválida."},{status:400});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Falha na operação de cobrança."},{status:400});
  }
}
