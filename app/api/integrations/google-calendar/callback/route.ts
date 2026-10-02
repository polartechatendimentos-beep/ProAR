import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, googleCalendarFetch, saveGoogleCalendarCredential, verifyGoogleState } from "../../../../../lib/google-calendar";

export async function GET(request:NextRequest){
  const code=request.nextUrl.searchParams.get("code")||""; const state=request.nextUrl.searchParams.get("state")||""; const denied=request.nextUrl.searchParams.get("error");
  const target=new URL("/",request.nextUrl.origin);
  if(denied){target.searchParams.set("googleCalendar","denied");return NextResponse.redirect(target);}
  const verified=verifyGoogleState(state);
  if(!code||!verified){target.searchParams.set("googleCalendar","invalid");return NextResponse.redirect(target);}
  try{
    const token=await exchangeGoogleCode(code,request.nextUrl.origin);
    let email="";
    try{
      const user=await fetch("https://www.googleapis.com/oauth2/v2/userinfo",{headers:{Authorization:`Bearer ${token.accessToken}`},cache:"no-store"});
      const profile=await user.json() as {email?:string}; email=profile.email||"";
    }catch{}
    await saveGoogleCalendarCredential(verified.companyId,verified.username,{...token,calendarId:"primary",connectedAt:new Date().toISOString(),email});
    target.searchParams.set("googleCalendar","connected");
  }catch{target.searchParams.set("googleCalendar","error");}
  return NextResponse.redirect(target);
}
