import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantDb } from "../../../../lib/tenant-rest";
import { appointmentDue } from "../../../../lib/whatsapp-appointment";
import { readCompanyState, sendOrderWhatsApp } from "../../../../lib/whatsapp-appointment-send";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const company = process.env.PROAR_META_WEBHOOK_COMPANY_ID;
  if (!company) return NextResponse.json({ enabled: false });
  const db = await resolveTenantDb(company);
  if (!db.url || !db.key) return NextResponse.json({ error: "Banco indisponível." }, { status: 503 });
  const rows = await readCompanyState(company, db.dedicated, db, true);
  const orders = rows[0]?.payload?.serviceOrders ?? [];
  const now = new Date();
  const due = orders.filter(order => appointmentDue(order, now));
  let accepted = 0;
  let errors = 0;
  for (let index = 0; index < due.length; index += 4) {
    if (Date.now() - now.getTime() > 35000) break;
    const batch = await Promise.allSettled(due.slice(index, index + 4).map(async order => {
      const response = await sendOrderWhatsApp(company, { username: "whatsapp-cron" }, {
        originId: String(order.id), kind: "appointment", consentConfirmed: true, parameters: [],
        eventKey: `appointment:${order.date}:${order.time}`,
      }, true);
      if (response.ok && (await response.json()).sent === true) accepted++;
      if (!response.ok && response.status !== 409) errors++;
    }));
    errors += batch.filter(result => result.status === "rejected").length;
  }
  return NextResponse.json({ due: due.length, accepted, errors });
}
