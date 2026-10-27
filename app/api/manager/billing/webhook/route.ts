import { NextResponse } from "next/server";
import { getMercadoPagoOrder, verifyMercadoPagoWebhook } from "../../../../../lib/mercado-pago";
import { reconcileMercadoPagoOrder } from "../../../../../lib/manager-billing";

export const runtime = "nodejs";

export async function POST(request:Request) {
  const url=new URL(request.url);
  const body=await request.json().catch(()=>({}));
  const dataId=String(body?.data?.id || url.searchParams.get("data.id") || "").trim();
  if (!dataId) return NextResponse.json({ok:false,error:"Notificação sem identificador."},{status:400});
  if (!verifyMercadoPagoWebhook(request,dataId)) return NextResponse.json({ok:false,error:"Assinatura inválida."},{status:401});
  try {
    const order=await getMercadoPagoOrder(dataId);
    const result=await reconcileMercadoPagoOrder(order);
    return NextResponse.json({ok:true,result});
  } catch(error) {
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Falha ao processar pagamento."},{status:502});
  }
}
