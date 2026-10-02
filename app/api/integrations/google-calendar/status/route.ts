import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../../../lib/permissions";
import { deleteGoogleCalendarCredential, loadGoogleCalendarCredential } from "../../../../../lib/google-calendar";

export async function GET(request:NextRequest){
 const auth=requirePermission(request,"configuracoes.visualizar"); if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 const scope=sessionCompany(auth.session); if(!scope.ok)return NextResponse.json({error:scope.error},{status:scope.status});
 try{const credential=await loadGoogleCalendarCredential(scope.companyId,auth.session.username);return NextResponse.json({connected:Boolean(credential),email:credential?.email||null,calendarId:credential?.calendarId||"primary",connectedAt:credential?.connectedAt||null,expiresAt:credential?.expiresAt||null});}
 catch{return NextResponse.json({connected:false,error:"Não foi possível consultar a integração."},{status:503});}
}
export async function DELETE(request:NextRequest){
 const auth=requirePermission(request,"configuracoes.editar"); if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 const scope=sessionCompany(auth.session); if(!scope.ok)return NextResponse.json({error:scope.error},{status:scope.status});
 try{await deleteGoogleCalendarCredential(scope.companyId,auth.session.username);return NextResponse.json({connected:false});}
 catch{return NextResponse.json({error:"Não foi possível desconectar o Google Agenda."},{status:503});}
}
