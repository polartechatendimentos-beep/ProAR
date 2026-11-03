import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { routeContext } from "@/lib/work-route-store";
import { groupNationalOrders, type NationalOrder } from "@/lib/nfse-national-dps";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => NextResponse.json(body, {status, headers:{"Cache-Control":"private, no-store"}});
export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.emitir");
  if (!access.ok) return reply({error:access.error},access.status);
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply({error:"Origem inválida."},403);
  const body = await request.json().catch(()=>null);
  const ids: unknown = body?.orderIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some(id=>typeof id!=="string" || !id.trim() || id.length>128) || new Set(ids).size!==ids.length) return reply({error:"Seleção de OS inválida."},422);
  try {
    const {state} = await routeContext(access.session);
    const orders = (state.serviceOrders || []) as Record<string,unknown>[];
    const customers = (state.moduleRecords?.Clientes || []) as Record<string,unknown>[];
    const pending: {id:string; message:string}[] = [];
    const rows: NationalOrder[] = [];
    for (const id of ids as string[]) {
      const order = orders.find(row=>String(row.id)===id);
      if (!order || !/^conclu[ií]da$/i.test(String(order.status).trim()) || order.invoiceNumber || order.nfseAccessKey || /autorizad|emitid|processando|transmitindo|cancelad/i.test(String(order.nfseStatus??""))) {
        pending.push({id,message:"OS indisponível ou inelegível para faturamento."});continue;
      }
      const customer = order.customerId && customers.find(row=>String(row.id)===String(order.customerId));
      const fiscal = order.nationalFiscal as Record<string,unknown> | undefined;
      const document = customer && typeof customer==="object" ? String(customer.cnpj || customer.cpf || customer.doc || "").replace(/\D/g,"") : "";
      const retention = fiscal?.retention;
      const row: NationalOrder = {id, customerDocument:document, description:String(order.executedService || order.service || ""), cents:Number(fiscal?.serviceCents), serviceCode:String(fiscal?.serviceCode || ""), serviceCity:String(fiscal?.serviceCity || ""), competence:String(fiscal?.competence || ""), retention:retention as NationalOrder["retention"], taxProfileId:String(fiscal?.taxProfileId || "")};
      try { groupNationalOrders([row]); rows.push(row); }
      catch { pending.push({id,message:!document?"Confira CPF/CNPJ e vínculo com o cadastro do tomador.":"Confira valor de serviço, código nacional, município, competência e perfil tributário da OS."}); }
    }
    if (pending.length) return reply({error:"Corrija as pendências antes de preparar as notas.",pending},422);
    try { return reply({groups:groupNationalOrders(rows).map(group=>({ids:group.orders.map(row=>row.id),cents:group.cents,description:group.description,serviceCode:group.orders[0].serviceCode,competence:group.orders[0].competence}))}); }
    catch(error) {return reply({error:error instanceof Error?error.message:"Grupos fiscais inválidos."},422);}
  } catch {return reply({error:"Não foi possível consultar os dados fiscais da empresa."},503);}
}
