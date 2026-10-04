import { NextRequest, NextResponse } from "next/server";
import { normalizeHost, rootDomain, tenantSlugFromHost } from "./lib/tenant-host";

const withPublicSecurity = (response: NextResponse) => {
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
};

export function proxy(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host"));
  const domain = rootDomain();
  const pathname = request.nextUrl.pathname;
  const mobilePath = pathname === "/mobile" || pathname.startsWith("/mobile/");
  const effectivePathname = mobilePath ? (pathname.slice(7) || "/") : pathname;

  if ((host === domain || host === `www.${domain}`) && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/") && pathname !== "/favicon.ico" && pathname !== "/termos" && pathname !== "/privacidade" && pathname !== "/robots.txt" && pathname !== "/sitemap.xml" && pathname !== "/.well-known/security.txt") {
    if (pathname !== "/site") { const url = request.nextUrl.clone(); url.pathname = "/site"; return NextResponse.rewrite(url); }
  }
  if (host === `teste.${domain}` && pathname === "/") {
    const url = request.nextUrl.clone(); url.pathname = "/teste"; return withPublicSecurity(NextResponse.rewrite(url));
  }
  if (host === `manager.${domain}` && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/") && pathname !== "/favicon.ico" && pathname !== "/robots.txt" && pathname !== "/.well-known/security.txt") {
    if (pathname !== "/manager") { const url = request.nextUrl.clone(); url.pathname = "/manager"; return withPublicSecurity(NextResponse.rewrite(url)); }
  }

  const mobileHost = host.startsWith("mobile.");
  const mobileExperience = mobileHost || mobilePath;
  const tenantHost = mobileHost ? host.replace(/^mobile\\./, "") : host;
  const tenant = tenantSlugFromHost(tenantHost, domain);
  const headers = new Headers(request.headers);
  if (tenant) headers.set("x-proar-tenant", tenant); else headers.delete("x-proar-tenant");
  if (mobileExperience) { headers.set("x-proar-experience","mobile"); headers.set("x-proar-mobile-tenant",tenant||"default"); }
  if (mobilePath) { const url=request.nextUrl.clone(); url.pathname=effectivePathname; const rewritten=NextResponse.rewrite(url,{request:{headers}}); rewritten.cookies.set("proar-experience","mobile",{sameSite:"lax",secure:true,path:"/"}); rewritten.cookies.set("proar-mobile-tenant",tenant||"default",{sameSite:"lax",secure:true,path:"/"}); return withPublicSecurity(rewritten); }

  // Todo tenant possui uma porta de entrada pública. Os aliases renderizam a mesma
  // tela de autenticação da raiz sem depender de cookie ou sessão pré-existente.
  if (tenant && ["/login", "/auth", "/signin"].includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return withPublicSecurity(NextResponse.rewrite(url, { request: { headers } }));
  }

  const response = NextResponse.next({ request: { headers } });
  if (mobileExperience) { response.cookies.set("proar-experience","mobile",{sameSite:"lax",secure:true,path:"/"}); response.cookies.set("proar-mobile-tenant",tenant||"default",{sameSite:"lax",secure:true,path:"/"}); }
  if (tenant && pathname === "/") return withPublicSecurity(response);
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
