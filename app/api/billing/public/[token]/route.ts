import { NextRequest, NextResponse } from "next/server";
import { getBillingCompany, getReceivableByPublicToken, payReceivableByCard } from "../../../../../lib/manager-billing";
import { mercadoPagoConfigured } from "../../../../../lib/mercado-pago";

export const runtime = "nodejs";

export async function GET(_request:NextRequest,{params}:{params:Promise<{token:string}>}) {
  try {
    const {token}=await params;
    const receivable=await getReceivableByPublicToken(String(token||""));
    if (!receivable) return NextResponse.json({error:"Cobrança não encontrada."},{status:404});
    const company=await getBillingCompany(receivable.company_id);
    return NextResponse.json({
      receivable:{
        id:receivable.id,
        description:receivable.description,
        amountCents:receivable.amount_cents,
        dueDate:receivable.due_date,
        status:receivable.status,
        paymentMethod:receivable.payment_method,
        paymentUrl:receivable.payment_url,
        pixQrCode:receivable.pix_qr_code,
        pixQrCodeBase64:receivable.pix_qr_code_base64,
        boletoDigitableLine:receivable.boleto_digitable_line,
        providerStatus:receivable.provider_status,
      },
      company:{
        name:company.trade_name||company.legal_name||"Cliente ProAR",
        email:company.billing_email||company.email||"",
        document:company.cnpj||company.cpf||"",
      },
      mercadoPago:{
        configured:mercadoPagoConfigured(),
        publicKey:process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY?.trim()||"",
      },
    });
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Falha ao consultar cobrança."},{status:500});
  }
}

export async function POST(request:NextRequest,{params}:{params:Promise<{token:string}>}) {
  try {
    const {token}=await params;
    const body=await request.json();
    const result=await payReceivableByCard({
      publicToken:String(token||""),
      cardToken:String(body.cardToken||""),
      paymentMethodId:String(body.paymentMethodId||""),
      installments:Number(body.installments||1),
      payerEmail:String(body.payerEmail||""),
      identificationType:String(body.identificationType||"CPF"),
      identificationNumber:String(body.identificationNumber||""),
    });
    return NextResponse.json({ok:true,result});
  } catch(error) {
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Não foi possível processar o cartão."},{status:400});
  }
}
