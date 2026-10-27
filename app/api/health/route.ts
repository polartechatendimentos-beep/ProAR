import { NextResponse } from "next/server";
import { CURRENT_PROAR_RELEASE } from "../../../lib/release-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok:true,
    service:"ProAR",
    version:CURRENT_PROAR_RELEASE.version,
    environment:process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    commit:process.env.VERCEL_GIT_COMMIT_SHA || null,
    deploymentId:process.env.VERCEL_DEPLOYMENT_ID || null,
    checkedAt:new Date().toISOString(),
  },{headers:{"Cache-Control":"no-store"}});
}
