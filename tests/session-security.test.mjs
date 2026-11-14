import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createSessionForUser, readSession } from "../lib/proar-auth.ts";
import { readManagerSession } from "../lib/manager-auth.ts";

test("Signed sessions reject trailing segments, invalid expiration and tampering", () => {
  const old = process.env.PROAR_SESSION_SECRET;
  const secret = "test-only-session-secret-at-least-32-characters";
  process.env.PROAR_SESSION_SECRET = secret;
  try {
    const token = createSessionForUser({username:"audit",displayName:"Audit",role:"Técnico",permissions:[],companySlug:"audit"});
    assert.equal(readSession(token)?.username,"audit");
    assert.equal(readSession(token+".extra"),null);
    assert.equal(readSession(token.slice(0,-1)+"!"),null);
    for (const exp of ["never", null, 0, -1]) {
      const data = Buffer.from(JSON.stringify({username:"audit",role:"Técnico",permissions:[],exp})).toString("base64url");
      const sig = createHmac("sha256",secret).update(`v2.${data}`).digest("hex");
      assert.equal(readSession(`v2.${data}.${sig}`),null);
    }
  } finally { if(old===undefined) delete process.env.PROAR_SESSION_SECRET; else process.env.PROAR_SESSION_SECRET=old; }
});

test("Manager rejects malformed Unicode signatures without throwing", () => {
  const request = {cookies:{get:()=>({value:"payload."+"é".repeat(43)})}};
  assert.equal(readManagerSession(request),null);
});
