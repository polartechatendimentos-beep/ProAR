import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeProfilePhotoLookup, whatsappProfilePhotoUrl } from "../lib/chatdesk-profile-photo.ts";

const url = "https://pps.whatsapp.net/v/t61.24694-24/image.jpg?test=signed";
const provider = { profilePictureUrl: url };

test("profile thumbnails use only supported HTTPS provider URLs", () => {
  assert.equal(whatsappProfilePhotoUrl(provider), url);
  assert.equal(whatsappProfilePhotoUrl(null), null);
  assert.equal(whatsappProfilePhotoUrl({ profilePictureUrl: null }), null);
  assert.equal(whatsappProfilePhotoUrl({ profilePictureUrl: "http://pps.whatsapp.net/v/photo.jpg" }), null);
  assert.equal(whatsappProfilePhotoUrl({ profilePictureUrl: "https://images.example.com/v/photo.jpg" }), null);
  assert.equal(whatsappProfilePhotoUrl({ profilePictureUrl: "https://pps.whatsapp.net/not-a-photo" }), null);
});

test("two views of one contact share a lookup; tenants and expiration remain separate", async () => {
  let count = 0, now = 0;
  const lookup = makeProfilePhotoLookup(async (company) => {
    count++;
    return company === "a" ? provider : null;
  }, () => now);
  assert.deepEqual(await Promise.all([lookup("a", "1"), lookup("a", "1"), lookup("b", "1")]), [url, url, null]);
  assert.equal(count, 2);
  now = 61_000;
  assert.equal(await lookup("a", "1"), url);
  assert.equal(await lookup("b", "1"), null);
  assert.equal(count, 3);
  now = 301_000;
  assert.equal(await lookup("a", "1"), url);
  assert.equal(count, 4);
});

test("a transient provider failure falls back and does not poison future lookups", async () => {
  let calls = 0;
  const lookup = makeProfilePhotoLookup(async () => {
    if (++calls === 1) throw new Error("unavailable");
    return provider;
  });
  assert.equal(await lookup("a", "1"), null);
  assert.equal(await lookup("a", "1"), url);
});

test("avatar access requires the session company and readable conversation before provider lookup", () => {
  const code = readFileSync(new URL("../app/api/atendimento/foto/route.ts", import.meta.url), "utf8");
  assert.match(code, /searchParams\.get\("company"\) !== access\.companyId/);
  assert.match(code, /readChat\(access\.companyId, phone\)[\s\S]*canReadChat\(access\.actor, chat\)[\s\S]*photo\(access\.companyId, chat\.phone\)/);
  assert.match(code, /"Cache-Control": "private, no-store"/);
});
