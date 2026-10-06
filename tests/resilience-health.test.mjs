import test from "node:test";
import assert from "node:assert/strict";
import { isReadOnlyRequest, isRetryableDatabaseError, retryDatabaseOperation } from "../lib/database-resilience.ts";
import { classifyProarError, proarError } from "../lib/system-errors.ts";

test("database resilience retries only safe operations by policy",()=>{
  assert.equal(isReadOnlyRequest({}),true);
  assert.equal(isReadOnlyRequest({method:"GET"}),true);
  assert.equal(isReadOnlyRequest({method:"POST"}),false);
  assert.equal(isRetryableDatabaseError(new Error("Connection terminated due to connection timeout")),true);
});

test("database retry succeeds after transient failures",async()=>{
  let attempts=0;
  const result=await retryDatabaseOperation(async()=>{
    attempts+=1;
    if(attempts<3) throw new Error("fetch failed");
    return "ok";
  },{attempts:3,baseDelayMs:25});
  assert.equal(result,"ok");
  assert.equal(attempts,3);
});

test("database unavailable has stable user-safe error code",()=>{
  assert.equal(classifyProarError("connection terminated").code,"PROAR-DB-001");
  assert.equal(proarError("PROAR-DB-003").severity,"critical");
});
