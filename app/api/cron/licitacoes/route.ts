import { databaseFetch, masterDatabaseConfig } from "../../../../lib/supabase-rest";
import { NextRequest, NextResponse } from "next/server";
import { searchAutomaticTenders, type PncpTender } from "../../../../lib/licitacoes-search";
import { loadWhatsAppConfig, sendWhatsAppTemplate } from "../../../../lib/proar-whatsapp";

export const runtime = "nodejs";
export const maxDuration = 120;

type IndexedTender = PncpTender & { discoveredAt:string; updatedAt?:string; whatsappStatus?:string; canonicalKey?:string; score?:number; scoreReasons?:string[]; changeHistory?:Array<{at:string;summary:string}> };
type TenderStore = { items: IndexedTender[]; lastScan?: string; lastError?: string; sync?:{runs:number;lastSuccessfulScan?:string;sourceHealth?:Record<string,string>;indexed:number; checkpoints?:Record<string,{status:string;lastAttempt:string;lastSuccess?:string;pagesRead?:number;count:number;error?:string}>; coverage?:{received:number;indexed:number;incompleteSources:number;complete:boolean}} };

const canonicalTenderKey = (item: PncpTender) => {
  const cnpj = String(item.orgaoEntidade?.cnpj || "").replace(/\D/g, "");
  const year = String(item.anoCompra || "");
  const control = String(item.numeroControlePNCP || "").trim();
  return control || [cnpj, year, String(item.sequencialCompra || "")].filter(Boolean).join(":");
};

const scoreTender=(item:PncpTender)=>{
  const text=`${item.objetoCompra||""} ${item.modalidadeNome||""}`.toLocaleLowerCase("pt-BR"); let score=0; const reasons:string[]=[];
  const rules:[RegExp,number,string][]=[[/pmoc|manutenção.*(?:ar|climat|refrig)/i,30,"PMOC/manutenção"],[/ar.?condicionado|climatiza|hvac/i,25,"HVAC"],[/instala|split|cassete|piso.?teto|vrf|chiller/i,20,"Instalação/equipamentos"],[/refrigera|compressor|fluido refrigerante/i,15,"Refrigeração"],[/exaust|ventila/i,10,"Exaustão/ventilação"]];
  for(const [rx,points,label] of rules)if(rx.test(text)){score+=points;reasons.push(label);}
  const distance=item.distanciaMirassol; if(distance!==undefined){const points=distance<=100?20:distance<=200?12:distance<=400?5:0;score+=points;if(points)reasons.push(`${distance} km de Mirassol`);}
  if(item.dataEncerramentoProposta&&new Date(item.dataEncerramentoProposta).getTime()>Date.now()+3*86400000){score+=5;reasons.push("Prazo operacional");}
  return {score:Math.min(100,score),reasons};
};
const changeSummary=(previous:IndexedTender|undefined,next:PncpTender)=>{if(!previous)return "";const changes:string[]=[];if(previous.dataEncerramentoProposta!==next.dataEncerramentoProposta)changes.push("prazo alterado");if(previous.valorTotalEstimado!==next.valorTotalEstimado)changes.push("valor atualizado");if(previous.objetoCompra!==next.objetoCompra)changes.push("objeto/descrição atualizado");return changes.join(", ");};

const isAlertableTender = (item: PncpTender, now = Date.now()) => {
  if (!item.numeroControlePNCP || !item.dataEncerramentoProposta) return false;
  const closing = new Date(item.dataEncerramentoProposta).getTime();
  return Number.isFinite(closing) && closing > now;
};

const supabaseConfig = masterDatabaseConfig;

async function loadStore(): Promise<TenderStore> {
  const { url, key } = supabaseConfig();
  const response = await databaseFetch(`${url}/rest/v1/proar_state?id=eq.licitacoes&select=payload`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json();
  return rows[0]?.payload ?? { items: [] };
}

async function saveStore(store: TenderStore) {
  const { url, key } = supabaseConfig();
  const response = await databaseFetch(`${url}/rest/v1/proar_state?on_conflict=id`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: "licitacoes", payload: store, updated_at: new Date().toISOString() }) });
  if (!response.ok) throw new Error(await response.text());
}

async function notifyWhatsApp(items: PncpTender[]) {
  const config = await loadWhatsAppConfig();
  if (!config.active || !config.accessToken || !config.phoneNumberId || !items.length) return "Aguardando configuração da API oficial do WhatsApp";
  const first = items[0];
  const url = first.orgaoEntidade?.cnpj && first.anoCompra && first.sequencialCompra ? `https://pncp.gov.br/app/editais/${first.orgaoEntidade.cnpj}/${first.anoCompra}/${first.sequencialCompra}` : "https://pncp.gov.br/app/editais";
  await sendWhatsAppTemplate(config, config.tenderTo, config.tenderTemplate, [String(items.length), (first.objetoCompra ?? "Nova oportunidade").slice(0, 180), url]);
  return "Enviado";
}

async function processCustomerReminders() {
  const { url, key } = supabaseConfig();
  const response = await databaseFetch(`${url}/rest/v1/proar_state?id=eq.main&select=payload`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json();
  const state = rows[0]?.payload;
  if (!state?.moduleRecords?.Lembretes) return { sent: 0, pending: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const due = state.moduleRecords.Lembretes.filter((item: Record<string, unknown>) => item.status === "Agendado" && String(item.date ?? "") <= today);
  let sent = 0;
  for (const reminder of due) {
    const config = await loadWhatsAppConfig();
    const to = String(reminder.category ?? "").replace(/\D/g, "");
    if (!config.active || !to) continue;
    try { await sendWhatsAppTemplate(config, to, config.reminderTemplate, [String(reminder.client ?? "cliente"), String(reminder.reminderMessage ?? reminder.description ?? "Está na hora da higienização.").slice(0, 300)]); reminder.status = "Enviado"; reminder.description = `${reminder.description} • WhatsApp enviado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`; sent += 1; } catch (error) { console.error("Reminder WhatsApp failed", error); }
  }
  if (sent) {
    const save = await databaseFetch(`${url}/rest/v1/proar_state?on_conflict=id`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: "main", payload: state, updated_at: new Date().toISOString() }) });
    if (!save.ok) throw new Error(await save.text());
  }
  return { sent, pending: due.length - sent };
}

async function runTenderMonitor() {
  const store = await loadStore();
  // O cron faz a coleta pesada; a interface consome somente esta base consolidada.
  const result = await searchAutomaticTenders({ radius: 1000 });
  const previousByKey=new Map(store.items.map(item=>[canonicalTenderKey(item),item]));
  const discoveredAt = new Date().toISOString();
  const indexed:IndexedTender[]=result.data.map(item=>{
    const key=canonicalTenderKey(item); const previous=previousByKey.get(key); const scored=scoreTender(item); const changed=changeSummary(previous,item);
    return {...previous,...item,canonicalKey:key,discoveredAt:previous?.discoveredAt||discoveredAt,updatedAt:discoveredAt,score:scored.score,scoreReasons:scored.reasons,changeHistory:changed?[{at:discoveredAt,summary:changed},...(previous?.changeHistory||[])].slice(0,20):(previous?.changeHistory||[])};
  });
  const currentKeys=new Set(indexed.map(canonicalTenderKey));
  const retained=store.items.filter(item=>!currentKeys.has(canonicalTenderKey(item))&&(!item.dataEncerramentoProposta||new Date(item.dataEncerramentoProposta).getTime()>Date.now()-90*86400000));
  const items=[...indexed,...retained].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,5000);
  const known=new Set(store.items.map(canonicalTenderKey).filter(Boolean));
  const newItems=indexed.filter(item=>isAlertableTender(item)&&!known.has(canonicalTenderKey(item)));
  let whatsappStatus="Nenhuma nova oportunidade";
  const priority=newItems.filter(item=>(item.score||0)>=50);
  if(priority.length){try{whatsappStatus=await notifyWhatsApp(priority);}catch(error){whatsappStatus=error instanceof Error?error.message:"Falha no WhatsApp";}}
  const failedCount=result.failedSources.length;
  const sourceHealth=Object.fromEntries(result.diagnostics.map(item=>[item.source,item.status]));
  const checkpoints=Object.fromEntries(result.diagnostics.map(item=>{
    const previous=store.sync?.checkpoints?.[item.source];
    return [item.source,{status:item.status,lastAttempt:discoveredAt,lastSuccess:item.status==="ok"?discoveredAt:previous?.lastSuccess,pagesRead:(item as typeof item & {pagesRead?:number}).pagesRead,count:item.count,error:(item as typeof item & {error?:string}).error}];
  }));
  const coverage={received:result.data.length,indexed:items.length,incompleteSources:failedCount,complete:failedCount===0};
  const updated:TenderStore={items,lastScan:discoveredAt,lastError:failedCount?`${failedCount} fonte(s) com atenção`:"",sync:{runs:(store.sync?.runs||0)+1,lastSuccessfulScan:failedCount===0?discoveredAt:store.sync?.lastSuccessfulScan,sourceHealth,indexed:items.length,checkpoints,coverage}};
  await saveStore(updated);
  return {newItems:newItems.length,priority:priority.length,total:items.length,lastScan:discoveredAt,whatsappStatus,failedSources:result.failedSources};
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try { const tenders = await runTenderMonitor(); const reminders = await processCustomerReminders(); return NextResponse.json({ success: true, ...tenders, reminders }); }
  catch (error) { console.error("Tender monitor failed", error); return NextResponse.json({ error: "Falha no monitor diário" }, { status: 500 }); }
}
