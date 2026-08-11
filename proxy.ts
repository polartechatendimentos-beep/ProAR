import { NextRequest, NextResponse } from "next/server";
import { normalizeHost, rootDomain, tenantSlugFromHost } from "./lib/tenant-host";

export function proxy(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host"));
  const domain = rootDomain();
  const pathname = request.nextUrl.pathname;

  if (host === `teste.${domain}` && pathname === "/") {
    const url = request.nextUrl.clone(); url.pathname = "/teste"; return NextResponse.rewrite(url);
  }
  if (host === `manager.${domain}` && pathname === "/") {
    const url = request.nextUrl.clone(); url.pathname = "/manager"; return NextResponse.rewrite(url);
  }

  const tenant = tenantSlugFromHost(host, domain);
  const headers = new Headers(request.headers);
  if (tenant) headers.set("x-proar-tenant", tenant); else headers.delete("x-proar-tenant");
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
