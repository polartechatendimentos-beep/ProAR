import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../../../lib/permissions";
import { googleCalendarFetch, loadGoogleCalendarCredential, refreshGoogleCredential } from "../../../../../lib/google-calendar";

type OrderPayload={id?:string;client?:string;unit?:string;service?:string;tech?:string;date?:string;time?:string;address?:string;status?:string;estimatedDurationMinutes?:number;googleCalendarEventId?:string;googleCalendarId?:string};

function eventBody(order:OrderPayload){
 const date=String(order.date||""); const time=/^\d{2}:\d{2}/.test(String(order.time||""))?String(order.time).slice(0,5):"08:00";
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("INVALID_DATE");
 const start=new Date(`${date}T${time}:00-03:00`); const end=new Date(start.getTime()+Math.max(15,Number(order.estimatedDurationMinutes||90))*60_000);
 return {
   summary:`ProAR • ${order.id||"OS"} • ${order.client||"Cliente"}`,
   description:[`Ordem de Serviço: ${order.id||"—"}`,`Cliente: ${order.client||"—"}`,`Unidade: ${order.unit||"—"}`,`Serviço: ${order.service||"—"}`,`Técnico: ${order.tech||"—"}`,`Status: ${order.status||"—"}`,"","Gerado pelo ProAR"].join("\n"),
   location:order.address||order.unit||"",
   start:{dateTime:start.toISOString(),timeZone:"America/Sao_Paulo"},
   end:{dateTime:end.toISOString(),timeZone:"America/Sao_Paulo"},
   reminders:{useDefault:false,overrides:[{method:"popup",minutes:30},{method:"popup",minutes:120}]},
   extendedProperties:{private:{proarOrderId:String(order.id||""),source:"ProAR"}}
 };
}

export async function POST(request:NextRequest){
 const auth=requirePermission(request,"os.editar"); if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 const scope=sessionCompany(auth.session); if(!scope.ok)return NextResponse.json({error:scope.error},{status:scope.status});
 const {order}=await request.json().catch(()=>({order:null})) as {order:OrderPayload|null};
 if(!order?.id)return NextResponse.json({error:"Ordem de Serviço inválida."},{status:400});
 try{
   let credential=await loadGoogleCalendarCredential(scope.companyId,auth.session.username);
   if(!credential)return NextResponse.json({error:"Google Agenda não conectado para este usuário.",requiresConnection:true},{status:428});
   credential=await refreshGoogleCredential(scope.companyId,auth.session.username,credential,request.nextUrl.origin);
   const calendarId=encodeURIComponent(order.googleCalendarId||credential.calendarId||"primary"); const body=eventBody(order);
   let response:Response;
   if(order.googleCalendarEventId){
     response=await googleCalendarFetch(credential,`/calendars/${calendarId}/events/${encodeURIComponent(order.googleCalendarEventId)}`,{method:"PATCH",body:JSON.stringify(body)});
     if(response.status===404) response=await googleCalendarFetch(credential,`/calendars/${calendarId}/events`,{method:"POST",body:JSON.stringify(body)});
   }else response=await googleCalendarFetch(credential,`/calendars/${calendarId}/events`,{method:"POST",body:JSON.stringify(body)});
   const result=await response.json() as Record<string,unknown>;
   if(!response.ok)return NextResponse.json({error:String(result.error&&typeof result.error==="object"?(result.error as {message?:string}).message:"Google Agenda recusou a sincronização.")},{status:502});
   return NextResponse.json({synced:true,eventId:String(result.id||""),eventUrl:String(result.htmlLink||""),calendarId:order.googleCalendarId||credential.calendarId||"primary",syncedAt:new Date().toISOString()});
 }catch(error){
   const message=error instanceof Error?error.message:"";
   return NextResponse.json({error:message==="INVALID_DATE"?"Informe data e horário válidos na OS.":message==="GOOGLE_RECONNECT_REQUIRED"?"Reconecte o Google Agenda em Configurações.":"Não foi possível sincronizar a OS com o Google Agenda."},{status:message==="GOOGLE_RECONNECT_REQUIRED"?428:500});
 }
}
