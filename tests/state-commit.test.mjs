import test from "node:test";
import assert from "node:assert/strict";
import { commitJsonState } from "../lib/state-commit.ts";

test("simultaneous cadastro edits preserve the first committed version", async () => {
  let stored = { revision: 3, externalAccess: [] };
  const fetcher = async (url, init) => {
    const expected = new URL(url).searchParams.get("payload->>revision");
    assert.equal(init.method, "PATCH");
    const body = JSON.parse(init.body);
    assert.deepEqual(Object.keys(body).sort(), ["payload", "updated_at"]);
    if (expected !== `eq.${stored.revision}`) return Response.json([]);
    stored = body.payload;
    return Response.json([{ payload: stored }]);
  };
  const previous = { revision: 3 };
  const first = await commitJsonState(fetcher, "https://database.example", {}, "work-tenant-a", previous, { revision: 4, externalAccess: ["first"] });
  const stale = await commitJsonState(fetcher, "https://database.example", {}, "work-tenant-a", previous, { revision: 4, externalAccess: ["second"] });
  assert.equal(first.ok, true);
  assert.equal(stale.ok, false);
  assert.equal(stale.conflict, true);
  assert.deepEqual(stored.externalAccess, ["first"]);
});

test("first cadastro save uses only columns present in the production state schema", async () => {
  const result = await commitJsonState(async (url, init) => {
    assert.equal(new URL(url).searchParams.get("on_conflict"), "id");
    assert.equal(init.method, "POST");
    assert.match(init.headers.Prefer, /ignore-duplicates/);
    const body = JSON.parse(init.body);
    assert.deepEqual(Object.keys(body).sort(), ["id", "payload", "updated_at"]);
    assert.equal(body.payload.updatedBy, "operator");
    return Response.json([{ payload: body.payload }]);
  }, "https://database.example", {}, "work-tenant-a", null, { revision: 1, updatedBy: "operator" });
  assert.equal(result.ok, true);
});

test("failed database write cannot report success", async () => {
  const result = await commitJsonState(async () => new Response("offline", { status: 503 }), "https://database.example", {}, "work-tenant-a", null, { revision: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.conflict, false);
  assert.equal(result.status, 503);
});
