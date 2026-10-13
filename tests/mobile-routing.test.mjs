import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";

const source = stripTypeScriptTypes(await readFile(new URL("../proxy.ts", import.meta.url), "utf8"))
  .replace(/^import .*;$/gm, "")
  .replace(/export /g, "");
function route(host, pathname) {
  const response = (kind, url, options) => ({
    kind, pathname: url?.pathname, requestHeaders: options?.request?.headers,
    headers: new Headers(), cookies: { set() {} },
  });
  const proxy = runInNewContext(source + "\nproxy;", {
    Headers,
    NextResponse: {
      next: options => response("next", undefined, options),
      rewrite: (url, options) => response("rewrite", url, options),
    },
    normalizeHost: value => value,
    rootDomain: () => "proar.online",
    tenantSlugFromHost: value => value === "polartech.proar.online" ? "polartech" : null,
  });
  return proxy({
    headers: new Headers({ host }),
    nextUrl: { pathname, clone: () => ({ pathname }) },
    cookies: { get: () => undefined },
  });
}
test("mobile entry renders its dedicated page rather than desktop", () => {
  assert.equal(route("polartech.proar.online", "/mobile").kind, "next");
  assert.equal(route("preview.vercel.app", "/mobile").kind, "next");
});
test("mobile subdomain root renders Field and preserves tenant identity", () => {
  const result = route("mobile.polartech.proar.online", "/");
  assert.equal(result.pathname, "/mobile");
  assert.equal(result.requestHeaders.get("x-proar-tenant"), "polartech");
});
test("legacy nested mobile routes and full desktop remain reachable", () => {
  assert.equal(route("polartech.proar.online", "/mobile/relatorios").pathname, "/relatorios");
  assert.equal(route("polartech.proar.online", "/").kind, "next");
  assert.equal(route("mobile.polartech.proar.online", "/api/mobile/bootstrap").kind, "next");
});
