import {NextRequest,NextResponse} from "next/server";
export function middleware(req:NextRequest){
 const host=(req.headers.get("host")||"").split(":")[0].toLowerCase();
 const mobile=host.startsWith("mobile.");
 const headers=new Headers(req.headers);
 if(mobile){
  headers.set("x-proar-experience","mobile");
  const tenant=host.replace(/^mobile\./,"").split(".")[0]||"default";
  headers.set("x-proar-mobile-tenant",tenant);
 }
 const res=NextResponse.next({request:{headers}});
 if(mobile){res.cookies.set("proar-experience","mobile",{sameSite:"lax",secure:true,path:"/"});res.cookies.set("proar-mobile-tenant",headers.get("x-proar-mobile-tenant")||"default",{sameSite:"lax",secure:true,path:"/"});}
 return res;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"]};
