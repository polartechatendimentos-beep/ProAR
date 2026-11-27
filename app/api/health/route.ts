import { NextResponse } from "next/server";

/** Liveness only: does not imply database, tenant or integration readiness. */
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(
    { service: "proar", status: "running", database: "not_checked", integrations: "not_checked" },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
