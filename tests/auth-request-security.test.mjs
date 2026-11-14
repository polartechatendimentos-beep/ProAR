import test from "node:test";
import assert from "node:assert/strict";
import { assertAuthOrigin, readAuthBody, authString } from "../lib/auth-request-security.ts";

const request = (body, headers = {}) => new Request("https://polartech.proar.online/api/auth", {
  method:"POST", headers:{"content-type":"application/json", ...headers}, body,
});
test("Authentication accepts same-origin JSON and preserves password whitespace", async () => {
  const body = await readAuthBody(request('{"password":" password "}', {origin:"https://polartech.proar.online"}));
  assert.equal(authString(body,"password"), " password ");
});
test("Authentication rejects cross-origin and cross-site browser mutations", async () => {
  for (const headers of [{origin:"https://attacker.invalid"},{origin:"null"},{"sec-fetch-site":"cross-site"}]) {
    await assert.rejects(readAuthBody(request("{}",headers)), {status:403});
  }
  assert.throws(() => assertAuthOrigin(request("{}",{origin:"https://performance.proar.online"})), {status:403});
});
test("Authentication bounds streamed bytes even without Content-Length", async () => {
  await assert.rejects(readAuthBody(request(JSON.stringify({password:"é".repeat(5000)}))), {status:413});
  await assert.rejects(readAuthBody(request("{}",{"content-length":"9000"})), {status:413});
});
test("Authentication rejects malformed JSON, wrong types and oversized credential fields", async () => {
  for (const input of ["null","[]","broken",'"text"']) await assert.rejects(readAuthBody(request(input)), {status:400});
  await assert.rejects(readAuthBody(request("{}",{"content-type":"text/plain"})), {status:415});
  assert.throws(() => authString({password:{value:"x"}},"password"), {status:400});
  assert.throws(() => authString({password:"x".repeat(1025)},"password",1024), {status:400});
});
