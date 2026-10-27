import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../../../lib/permissions";
import { createGoogleState, googleOAuthConfig } from "../../../../../lib/google-calendar";

export async function GET(request:NextRequest){
  const auth=requirePermission(request,"configuracoes.editar"); if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
  const scope=sessionCompany(auth.session); if(!scope.ok)return NextResponse.json({error:scope.error},{status:scope.status});
  try{
    const cfg=googleOAuthConfig(request.nextUrl.origin);
    const state=createGoogleState(scope.companyId,auth.session.username);
    const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id",cfg.clientId); url.searchParams.set("redirect_uri",cfg.redirectUri); url.searchParams.set("response_type","code");
    url.searchParams.set("scope","https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly openid email");
    url.searchParams.set("access_type","offline"); url.searchParams.set("prompt","consent"); url.searchParams.set("include_granted_scopes","true"); url.searchParams.set("state",state);
    return NextResponse.json({authorizationUrl:url.toString(),redirectUri:cfg.redirectUri});
  }catch(error){
    const message=error instanceof Error?error.message:"";
    return NextResponse.json({error:message==="GOOGLE_OAUTH_NOT_CONFIGURED"?"Configure GOOGLE_CALENDAR_CLIENT_ID e GOOGLE_CALENDAR_CLIENT_SECRET no ambiente do ProAR.":"Não foi possível iniciar a conexão com o Google Agenda."},{status:message==="GOOGLE_OAUTH_NOT_CONFIGURED"?428:500});
  }
}
