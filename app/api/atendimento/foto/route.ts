import type { NextRequest } from "next/server";
import { chatAccess, readChat } from "../../../../lib/chatdesk-store";
import { canReadChat } from "../../../../lib/chatdesk-local";
import { assertActiveWhatsAppCompany, evolutionConnection } from "../../../../lib/evolution-tenant";
import { evolutionRequestWithConfig } from "../../../../lib/proar-evolution";
import { makeProfilePhotoLookup } from "../../../../lib/chatdesk-profile-photo";

export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
};
const photo = makeProfilePhotoLookup(async (company, phone) => {
  const connection = await evolutionConnection(company);
  if (!connection) return null;
  return evolutionRequestWithConfig(connection.config, "chat/fetchProfilePictureUrl", { number: phone }, 5_000);
});
const unavailable = () => new Response(null, { status: 404, headers });
export async function GET(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return unavailable();
  const access = chatAccess(request);
  const phone = request.nextUrl.searchParams.get("phone") || "";
  if (!access || request.nextUrl.searchParams.get("company") !== access.companyId || !/^[1-9]\d{9,14}$/.test(phone)) return unavailable();
  try {
    await assertActiveWhatsAppCompany(access.companyId);
    // Always authorize the conversation before consulting even a cached photo.
    const chat = await readChat(access.companyId, phone);
    if (!chat || !canReadChat(access.actor, chat)) return unavailable();
    const url = await photo(access.companyId, chat.phone);
    return url ? new Response(null, { status: 302, headers: { ...headers, Location: url } }) : unavailable();
  } catch {
    return unavailable();
  }
}
