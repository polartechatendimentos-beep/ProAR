import "server-only";
import { randomUUID } from "node:crypto";
import { createMercadoPagoOrder, mercadoPagoConfigured, mercadoPagoOrderPaid, mercadoPagoOrderPaymentInfo } from "./mercado-pago";
import { supabaseRest } from "./supabase-rest";
import { ALL_MANAGER_MODULES, normalizeManagerModules, REQUIRED_MANAGER_MODULES } from "./manager-plans";

export type BillingCompany = {
  id:string;
  slug?:string;
  trade_name?:string;
  legal_name?:string;
  responsible_name?:string;
  email?:string;
  billing_email?:string;
  cnpj?:string;
  cpf?:string;
  person_type?:string;
  zip_code?:string;
  street?:string;
  address_number?:string;
  neighborhood?:string;
  city?:string;
  state?:string;
  status?:string;
  plan_code?:string;
  trial_expires_at?:string;
  billing_enabled?:boolean;
  monthly_fee_cents?:number;
  billing_day?:number;
  billing_issue_lead_days?:number;
  billing_method?:"pix"|"boleto"|"card";
  billing_auto_block?:boolean;
  access_block_source?:string | null;
  suspended_reason?:string | null;
};

export type ManagerReceivable = {
  id:string;
  company_id:string;
  reference_month:string;
  description:string;
  amount_cents:number;
  due_date:string;
  status:"pending"|"paid"|"canceled"|"refunded";
  payment_method:"pix"|"boleto"|"card"|"manual";
  provider:string;
  provider_order_id?:string | null;
  provider_transaction_id?:string | null;
  provider_status?:string | null;
  public_token?:string;
  external_reference:string;
  idempotency_key:string;
  payment_url?:string | null;
  pix_qr_code?:string | null;
  pix_qr_code_base64?:string | null;
  boleto_digitable_line?:string | null;
  paid_at?:string | null;
  created_at?:string;
  updated_at?:string;
};

export type ManagerModuleEntitlement = {
  company_id:string;
  module_name:string;
  enabled:boolean;
  monthly_price_cents:number;
  plan_code?:string|null;
  created_at?:string;
  updated_at?:string;
};

const money = (cents:number) => (cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const pad = (value:number) => String(value).padStart(2,"0");
function safeExternalReference(companyId:string,referenceMonth:string){
  const company=companyId.replace(/[^A-Za-z0-9_-]/g,"_").slice(0,42);
  const month=referenceMonth.slice(0,7).replace("-","");
  return `proar_${company}_${month}`.slice(0,64);
}

function saoPauloYmd(date=new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA",{
    timeZone:"America/Sao_Paulo",
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function monthStart(ymd:string) {
  return `${ymd.slice(0,7)}-01`;
}

function addMonths(referenceMonth:string, offset:number) {
  const [year,month] = referenceMonth.slice(0,7).split("-").map(Number);
  const date = new Date(Date.UTC(year,month-1+offset,1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-01`;
}

function dueDate(referenceMonth:string, day:number) {
  return `${referenceMonth.slice(0,8)}${pad(Math.max(1,Math.min(28,day||10)))}`;
}

function ordinal(ymd:string) {
  const [year,month,day] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(year,month-1,day)/86400000);
}

function daysBetween(from:string,to:string) {
  return ordinal(to)-ordinal(from);
}

export function billingReferenceCandidates(company:BillingCompany, now=new Date()) {
  const today=saoPauloYmd(now);
  const current=monthStart(today);
  const next=addMonths(current,1);
  const billingDay=Math.max(1,Math.min(28,Number(company.billing_day||10)));
  const lead=Math.max(0,Math.min(20,Number(company.billing_issue_lead_days??7)));
  const result:string[]=[];
  const currentDue=dueDate(current,billingDay);
  const currentDistance=daysBetween(today,currentDue);
  if (currentDistance<=lead) result.push(current);
  const nextDue=dueDate(next,billingDay);
  const nextDistance=daysBetween(today,nextDue);
  if (nextDistance>=0 && nextDistance<=lead) result.push(next);
  return [...new Set(result)];
}

function expiryDaysForOrder(due:string, method:"pix"|"boleto"|"card") {
  const today=saoPauloYmd();
  const distance=daysBetween(today,due);
  if (distance>0) return Math.max(method==="boleto"?1:1,Math.min(30,distance));
  return method==="boleto"?3:1;
}

function payerFromCompany(company:BillingCompany) {
  const documentType = company.cnpj ? "CNPJ" as const : "CPF" as const;
  const documentNumber = String(company.cnpj || company.cpf || "");
  const firstName = String(company.responsible_name || company.trade_name || company.legal_name || "Cliente").trim();
  return {
    email:String(company.billing_email || company.email || "").trim(),
    firstName,
    lastName:"ProAR",
    identification:{type:documentType,number:documentNumber},
    address:{
      zipCode:String(company.zip_code||""),
      streetName:String(company.street||""),
      streetNumber:String(company.address_number||"S/N"),
      neighborhood:String(company.neighborhood||""),
      city:String(company.city||""),
      state:String(company.state||""),
    },
  };
}

async function audit(companyId:string,action:string,actor:string,details:Record<string,unknown>={}) {
  await supabaseRest("proar_manager_audit",{
    method:"POST",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify({company_id:companyId,action,actor,details}),
  }).catch(()=>null);
}

export async function listCompanyModuleEntitlements(companyId:string) {
  try {
    const response=await supabaseRest(`proar_manager_module_entitlements?select=*&company_id=eq.${encodeURIComponent(companyId)}&order=module_name.asc`);
    if (!response.ok) return [] as ManagerModuleEntitlement[];
    return await response.json() as ManagerModuleEntitlement[];
  } catch {
    return [] as ManagerModuleEntitlement[];
  }
}

export async function setCompanyModuleEntitlements(companyId:string,entitlements:{moduleName:string;enabled:boolean;monthlyPriceCents:number}[],planCode:string,actor:string) {
  const now=new Date().toISOString();
  const entitlementMap=new Map(entitlements.map(item=>[item.moduleName,item]));
  const normalizedNames=normalizeManagerModules(entitlements.filter(item=>item.enabled).map(item=>item.moduleName));
  const normalized=Array.from(new Set([...entitlements.map(item=>item.moduleName),...REQUIRED_MANAGER_MODULES])).filter(moduleName=>ALL_MANAGER_MODULES.includes(moduleName)).map(moduleName=>({
    moduleName,
    enabled:normalizedNames.includes(moduleName),
    monthlyPriceCents:Math.max(0,Math.round(Number(entitlementMap.get(moduleName)?.monthlyPriceCents)||0)),
  }));
  for (const item of normalized) {
    await supabaseRest("proar_manager_module_entitlements?on_conflict=company_id,module_name",{
      method:"POST",
      headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify({
        company_id:companyId,
        module_name:item.moduleName,
        enabled:Boolean(item.enabled),
        monthly_price_cents:Math.max(0,Math.round(Number(item.monthlyPriceCents)||0)),
        plan_code:planCode,
        updated_at:now,
      }),
    });
  }
  const saved=await listCompanyModuleEntitlements(companyId);
  const enabled=saved.filter(item=>item.enabled);
  const monthlyFeeCents=enabled.reduce((sum,item)=>sum+Number(item.monthly_price_cents||0),0);
  const modules=normalizeManagerModules(enabled.map(item=>item.module_name));
  await supabaseRest(`proar_companies?id=eq.${encodeURIComponent(companyId)}`,{
    method:"PATCH",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify({modules,monthly_fee_cents:monthlyFeeCents,updated_at:now}),
  });
  await audit(companyId,"MODULE_ENTITLEMENTS_UPDATED",actor,{planCode,modules,monthlyFeeCents});
  return {entitlements:saved,modules,monthlyFeeCents};
}

export async function syncPlanEntitlements(companyId:string,planCode:string,planModules:string[],actor:string) {
  const existing=await listCompanyModuleEntitlements(companyId);
  const existingMap=new Map(existing.map(item=>[item.module_name,item]));
  const known=new Set([...existing.map(item=>item.module_name),...planModules]);
  const next=[...known].map(moduleName=>({
    moduleName,
    enabled:planModules.includes(moduleName),
    monthlyPriceCents:Number(existingMap.get(moduleName)?.monthly_price_cents||0),
  }));
  return setCompanyModuleEntitlements(companyId,next,planCode,actor);
}

export async function getBillingCompany(companyId:string) {
  const response=await supabaseRest(`proar_companies?select=*&id=eq.${encodeURIComponent(companyId)}&limit=1`);
  if (!response.ok) throw new Error("Não foi possível consultar a empresa.");
  const rows=await response.json();
  const company=rows?.[0] as BillingCompany|undefined;
  if (!company) throw new Error("Empresa não encontrada.");
  return company;
}

export async function getReceivableByPublicToken(publicToken:string) {
  const response=await supabaseRest(`proar_manager_receivables?select=*&public_token=eq.${encodeURIComponent(publicToken)}&limit=1`);
  if (!response.ok) throw new Error("Não foi possível consultar a cobrança.");
  const rows=await response.json();
  return (rows?.[0] || null) as ManagerReceivable|null;
}

export async function getReceivableByExternalReference(externalReference:string) {
  const response=await supabaseRest(`proar_manager_receivables?select=*&external_reference=eq.${encodeURIComponent(externalReference)}&limit=1`);
  if (!response.ok) throw new Error("Não foi possível consultar a mensalidade.");
  const rows=await response.json();
  return (rows?.[0] || null) as ManagerReceivable|null;
}

export async function listManagerReceivables(limit=120) {
  try {
    const response=await supabaseRest(`proar_manager_receivables?select=*&order=due_date.desc&limit=${Math.max(1,Math.min(500,limit))}`);
    if (!response.ok) return [] as ManagerReceivable[];
    return await response.json() as ManagerReceivable[];
  } catch {
    return [] as ManagerReceivable[];
  }
}

export async function issueReceivable(receivable:ManagerReceivable,company:BillingCompany,actor:string,regenerate=false) {
  if (!mercadoPagoConfigured()) {
    await supabaseRest(`proar_manager_receivables?id=eq.${encodeURIComponent(receivable.id)}`,{
      method:"PATCH",
      headers:{Prefer:"return=minimal"},
      body:JSON.stringify({provider_status:"configuration_required",updated_at:new Date().toISOString()}),
    });
    return {...receivable,provider_status:"configuration_required"};
  }
  if (receivable.payment_method==="card") {
    const base=(process.env.PROAR_MANAGER_BASE_URL || "https://manager.proar.online").replace(/\/$/,"");
    const paymentUrl=receivable.public_token?`${base}/pagamento/${receivable.public_token}`:"";
    await supabaseRest(`proar_manager_receivables?id=eq.${encodeURIComponent(receivable.id)}`,{
      method:"PATCH",
      headers:{Prefer:"return=minimal"},
      body:JSON.stringify({provider_status:"awaiting_card",payment_url:paymentUrl||null,updated_at:new Date().toISOString()}),
    });
    return {...receivable,provider_status:"awaiting_card",payment_url:paymentUrl};
  }
  if (receivable.provider_order_id && !regenerate) return receivable;
  const idempotencyKey = regenerate ? randomUUID() : receivable.idempotency_key;
  try {
    const order=await createMercadoPagoOrder({
      amount:receivable.amount_cents/100,
      externalReference:receivable.external_reference,
      payerEmail:String(company.billing_email || company.email || ""),
      description:receivable.description,
      expirationDays:expiryDaysForOrder(receivable.due_date,receivable.payment_method==="boleto"?"boleto":"pix"),
      payer:payerFromCompany(company),
      payment:receivable.payment_method==="boleto"?{kind:"boleto"}:{kind:"pix"},
    },idempotencyKey);
    const info=mercadoPagoOrderPaymentInfo(order);
    const patch={
      idempotency_key:idempotencyKey,
      provider_order_id:info.orderId,
      provider_transaction_id:info.transactionId,
      provider_status:`${info.status}:${info.statusDetail}`,
      payment_url:info.ticketUrl || null,
      pix_qr_code:info.qrCode || null,
      pix_qr_code_base64:info.qrCodeBase64 || null,
      boleto_digitable_line:info.digitableLine || null,
      updated_at:new Date().toISOString(),
    };
    await supabaseRest(`proar_manager_receivables?id=eq.${encodeURIComponent(receivable.id)}`,{
      method:"PATCH",
      headers:{Prefer:"return=minimal"},
      body:JSON.stringify(patch),
    });
    await audit(company.id,regenerate?"BILLING_REISSUED":"BILLING_ISSUED",actor,{receivableId:receivable.id,referenceMonth:receivable.reference_month,method:receivable.payment_method,orderId:info.orderId});
    return {...receivable,...patch};
  } catch(error) {
    const message=error instanceof Error?error.message:"Falha ao emitir cobrança.";
    await supabaseRest(`proar_manager_receivables?id=eq.${encodeURIComponent(receivable.id)}`,{
      method:"PATCH",
      headers:{Prefer:"return=minimal"},
      body:JSON.stringify({provider_status:"issuance_error",updated_at:new Date().toISOString()}),
    }).catch(()=>null);
    await audit(company.id,"BILLING_ISSUE_FAILED",actor,{receivableId:receivable.id,error:message});
    return {...receivable,provider_status:"issuance_error"};
  }
}

export async function ensureMonthlyReceivable(company:BillingCompany,referenceMonth:string,actor="system-billing") {
  if (!company.billing_enabled || !Number(company.monthly_fee_cents)) return null;
  const existingResponse=await supabaseRest(`proar_manager_receivables?select=*&company_id=eq.${encodeURIComponent(company.id)}&reference_month=eq.${referenceMonth}&limit=1`);
  if (!existingResponse.ok) throw new Error("Falha ao consultar mensalidade existente.");
  const existing=(await existingResponse.json())?.[0] as ManagerReceivable|undefined;
  if (existing) return issueReceivable(existing,company,actor,false);

  const billingDay=Math.max(1,Math.min(28,Number(company.billing_day||10)));
  const method=company.billing_method==="boleto"?"boleto":company.billing_method==="card"?"card":"pix";
  const amountCents=Math.round(Number(company.monthly_fee_cents||0));
  const referenceLabel=`${referenceMonth.slice(5,7)}/${referenceMonth.slice(0,4)}`;
  const record={
    company_id:company.id,
    reference_month:referenceMonth,
    description:`Mensalidade ProAR • ${referenceLabel}`,
    amount_cents:amountCents,
    due_date:dueDate(referenceMonth,billingDay),
    status:"pending",
    payment_method:method,
    provider:"mercado_pago",
    external_reference:safeExternalReference(company.id,referenceMonth),
    idempotency_key:randomUUID(),
    provider_status:"pending_issuance",
    updated_at:new Date().toISOString(),
  };
  const inserted=await supabaseRest("proar_manager_receivables",{
    method:"POST",
    headers:{Prefer:"return=representation"},
    body:JSON.stringify(record),
  });
  if (!inserted.ok) {
    const retry=await supabaseRest(`proar_manager_receivables?select=*&company_id=eq.${encodeURIComponent(company.id)}&reference_month=eq.${referenceMonth}&limit=1`);
    const rows=retry.ok?await retry.json():[];
    if (rows?.[0]) return issueReceivable(rows[0] as ManagerReceivable,company,actor,false);
    throw new Error("Não foi possível criar a mensalidade.");
  }
  const rows=await inserted.json();
  const receivable=rows?.[0] as ManagerReceivable;
  await audit(company.id,"BILLING_CREATED",actor,{receivableId:receivable.id,referenceMonth,amountCents,dueDate:record.due_date,method});
  return issueReceivable(receivable,company,actor,false);
}

export async function syncCompanyBillingAccess(companyId:string,actor="system-billing") {
  const company=await getBillingCompany(companyId);
  const today=saoPauloYmd();
  const overdueResponse=await supabaseRest(`proar_manager_receivables?select=id,due_date,amount_cents&company_id=eq.${encodeURIComponent(companyId)}&status=eq.pending&due_date=lt.${today}&limit=50`);
  const overdue=overdueResponse.ok?await overdueResponse.json():[];
  const shouldBlock=Boolean(company.billing_enabled && company.billing_auto_block!==false && overdue.length);
  if (shouldBlock && company.status==="active") {
    const total=overdue.reduce((sum:number,row:Record<string,unknown>)=>sum+Number(row.amount_cents||0),0);
    const reason=`Mensalidade ProAR em atraso (${overdue.length} pendência${overdue.length>1?"s":""}, ${money(total)}).`;
    await supabaseRest(`proar_companies?id=eq.${encodeURIComponent(companyId)}`,{
      method:"PATCH",
      headers:{Prefer:"return=minimal"},
      body:JSON.stringify({status:"blocked",access_block_source:"billing",suspended_reason:reason,access_blocked_at:new Date().toISOString(),updated_at:new Date().toISOString()}),
    });
    await audit(companyId,"BILLING_ACCESS_BLOCKED",actor,{overdueCount:overdue.length,totalCents:total});
    return {blocked:true,overdueCount:overdue.length};
  }
  if (!shouldBlock && company.status!=="active" && company.access_block_source==="billing") {
    const trialExpired=company.plan_code==="trial" && company.trial_expires_at && new Date(company.trial_expires_at).getTime()<Date.now();
    if (!trialExpired) {
      await supabaseRest(`proar_companies?id=eq.${encodeURIComponent(companyId)}`,{
        method:"PATCH",
        headers:{Prefer:"return=minimal"},
        body:JSON.stringify({status:"active",access_block_source:null,suspended_reason:null,access_blocked_at:null,updated_at:new Date().toISOString()}),
      });
      await audit(companyId,"BILLING_ACCESS_RELEASED",actor,{reason:"Nenhuma mensalidade vencida em aberto."});
      return {blocked:false,released:true,overdueCount:0};
    }
  }
  return {blocked:company.status!=="active",overdueCount:overdue.length};
}

export async function payReceivableByCard(input:{
  publicToken:string;
  cardToken:string;
  paymentMethodId:string;
  installments:number;
  payerEmail:string;
  identificationType:string;
  identificationNumber:string;
}) {
  const receivable=await getReceivableByPublicToken(input.publicToken);
  if (!receivable) throw new Error("Cobrança não encontrada.");
  if (receivable.status==="paid") return {alreadyPaid:true,receivable};
  if (receivable.status!=="pending") throw new Error("Esta cobrança não está disponível para pagamento.");
  if (receivable.payment_method!=="card") throw new Error("Esta cobrança não está configurada para cartão.");
  const company=await getBillingCompany(receivable.company_id);
  const order=await createMercadoPagoOrder({
    amount:receivable.amount_cents/100,
    externalReference:receivable.external_reference,
    payerEmail:String(input.payerEmail||company.billing_email||company.email||""),
    description:receivable.description,
    payer:{
      ...payerFromCompany(company),
      identification:{type:input.identificationType==="CNPJ"?"CNPJ":"CPF",number:input.identificationNumber},
    },
    payment:{
      kind:"credit_card",
      paymentMethodId:String(input.paymentMethodId||""),
      token:String(input.cardToken||""),
      installments:Math.max(1,Math.min(12,Number(input.installments)||1)),
    },
  },randomUUID());
  const info=mercadoPagoOrderPaymentInfo(order);
  await supabaseRest(`proar_manager_receivables?id=eq.${encodeURIComponent(receivable.id)}`,{
    method:"PATCH",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify({
      provider_order_id:info.orderId,
      provider_transaction_id:info.transactionId||null,
      provider_status:`${info.status}:${info.statusDetail}`,
      updated_at:new Date().toISOString(),
    }),
  });
  return reconcileMercadoPagoOrder(order,"card-checkout");
}

export async function reconcileMercadoPagoOrder(order:Record<string,unknown>,actor="mercado-pago-webhook") {
  const info=mercadoPagoOrderPaymentInfo(order);
  if (!info.externalReference) throw new Error("Order sem referência externa.");
  const receivable=await getReceivableByExternalReference(info.externalReference);
  if (!receivable) return {ignored:true,reason:"Mensalidade não encontrada."};
  if (receivable.provider_order_id && receivable.provider_order_id!==info.orderId) return {ignored:true,reason:"Notificação de order antiga ignorada."};

  const paid=mercadoPagoOrderPaid(order);
  const refunded=info.status==="refunded" || info.statusDetail==="refunded";
  const canceled=["canceled","expired","failed"].includes(info.status);
  const patch:Record<string,unknown>={
    provider_order_id:info.orderId,
    provider_transaction_id:info.transactionId || receivable.provider_transaction_id || null,
    provider_status:`${info.status}:${info.statusDetail}`,
    payment_url:info.ticketUrl || receivable.payment_url || null,
    pix_qr_code:info.qrCode || receivable.pix_qr_code || null,
    pix_qr_code_base64:info.qrCodeBase64 || receivable.pix_qr_code_base64 || null,
    boleto_digitable_line:info.digitableLine || receivable.boleto_digitable_line || null,
    updated_at:new Date().toISOString(),
  };
  if (paid) {
    patch.status="paid";
    patch.paid_at=new Date().toISOString();
  } else if (refunded) {
    patch.status="refunded";
  } else if (canceled && receivable.status!=="paid") {
    patch.provider_status=`${info.status}:${info.statusDetail}`;
  }
  await supabaseRest(`proar_manager_receivables?id=eq.${encodeURIComponent(receivable.id)}`,{
    method:"PATCH",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify(patch),
  });
  if (paid) await audit(receivable.company_id,"BILLING_PAID",actor,{receivableId:receivable.id,orderId:info.orderId,amountCents:receivable.amount_cents});
  await syncCompanyBillingAccess(receivable.company_id,actor);
  return {updated:true,paid,companyId:receivable.company_id,receivableId:receivable.id};
}


export async function getReceivableById(receivableId:string) {
  const response=await supabaseRest(`proar_manager_receivables?select=*&id=eq.${encodeURIComponent(receivableId)}&limit=1`);
  if (!response.ok) throw new Error("Não foi possível consultar a mensalidade.");
  const rows=await response.json();
  const receivable=rows?.[0] as ManagerReceivable|undefined;
  if (!receivable) throw new Error("Mensalidade não encontrada.");
  return receivable;
}

export async function markReceivablePaidManually(receivableId:string,actor:string) {
  const receivable=await getReceivableById(receivableId);
  if (receivable.status==="paid") {
    await syncCompanyBillingAccess(receivable.company_id,actor);
    return receivable;
  }
  if (receivable.status==="canceled") throw new Error("Mensalidade cancelada não pode ser baixada sem reativação.");
  const paidAt=new Date().toISOString();
  await supabaseRest(`proar_manager_receivables?id=eq.${encodeURIComponent(receivable.id)}`,{
    method:"PATCH",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify({status:"paid",payment_method:"manual",provider_status:"manual:paid",paid_at:paidAt,updated_at:paidAt}),
  });
  await audit(receivable.company_id,"BILLING_PAID_MANUAL",actor,{receivableId:receivable.id,amountCents:receivable.amount_cents});
  await syncCompanyBillingAccess(receivable.company_id,actor);
  return {...receivable,status:"paid" as const,payment_method:"manual" as const,provider_status:"manual:paid",paid_at:paidAt};
}

export async function cancelReceivable(receivableId:string,actor:string) {
  const receivable=await getReceivableById(receivableId);
  if (receivable.status==="paid") throw new Error("Mensalidade paga não pode ser cancelada. Use estorno quando aplicável.");
  const canceledAt=new Date().toISOString();
  await supabaseRest(`proar_manager_receivables?id=eq.${encodeURIComponent(receivable.id)}`,{
    method:"PATCH",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify({status:"canceled",canceled_at:canceledAt,updated_at:canceledAt}),
  });
  await audit(receivable.company_id,"BILLING_CANCELED",actor,{receivableId:receivable.id});
  await syncCompanyBillingAccess(receivable.company_id,actor);
  return {...receivable,status:"canceled" as const,canceled_at:canceledAt};
}

export async function issueCurrentMonth(companyId:string,actor:string) {
  const company=await getBillingCompany(companyId);
  if (!company.billing_enabled) throw new Error("Ative a cobrança recorrente desta empresa antes de gerar a mensalidade.");
  const reference=monthStart(saoPauloYmd());
  return ensureMonthlyReceivable(company,reference,actor);
}

export async function runManagerBillingCycle(actor="system-cron") {
  const response=await supabaseRest("proar_companies?select=*&order=created_at.asc");
  if (!response.ok) throw new Error("Falha ao consultar empresas para faturamento.");
  const companies=await response.json() as BillingCompany[];
  let createdOrChecked=0,blocked=0,released=0,errors=0;
  for (const company of companies) {
    try {
      if (company.billing_enabled && Number(company.monthly_fee_cents||0)>0) {
        for (const reference of billingReferenceCandidates(company)) {
          await ensureMonthlyReceivable(company,reference,actor);
          createdOrChecked+=1;
        }
      }
      const access=await syncCompanyBillingAccess(company.id,actor);
      if (access.blocked && access.overdueCount) blocked+=1;
      if (access.released) released+=1;
    } catch(error) {
      errors+=1;
      await audit(company.id,"BILLING_CYCLE_ERROR",actor,{error:error instanceof Error?error.message:"Falha desconhecida"});
    }
  }
  return {companies:companies.length,createdOrChecked,blocked,released,errors};
}

export function summarizeManagerBilling(receivables:ManagerReceivable[],companies:BillingCompany[]) {
  const today=saoPauloYmd();
  const currentMonth=monthStart(today);
  const overdue=receivables.filter(row=>row.status==="pending" && row.due_date<today);
  const open=receivables.filter(row=>row.status==="pending");
  const paidThisMonth=receivables.filter(row=>row.status==="paid" && String(row.paid_at||"").slice(0,7)===currentMonth.slice(0,7));
  const mrr=companies.filter(c=>c.billing_enabled).reduce((sum,c)=>sum+Number(c.monthly_fee_cents||0),0);
  return {
    openCount:open.length,
    openCents:open.reduce((sum,row)=>sum+Number(row.amount_cents||0),0),
    overdueCount:overdue.length,
    overdueCents:overdue.reduce((sum,row)=>sum+Number(row.amount_cents||0),0),
    paidThisMonthCount:paidThisMonth.length,
    paidThisMonthCents:paidThisMonth.reduce((sum,row)=>sum+Number(row.amount_cents||0),0),
    mrrCents:mrr,
  };
}
