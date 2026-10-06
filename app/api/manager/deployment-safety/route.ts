import { NextRequest, NextResponse } from "next/server";
import { readManagerSession } from "../../../../../lib/manager-auth";
import { recordSystemIncident } from "../../../../../lib/system-observability";

export const runtime = "nodejs";

function config() {
  return {
    token: String(process.env.VERCEL_TOKEN || "").trim(),
    projectId: String(process.env.VERCEL_PROJECT_ID || "").trim(),
    teamId: String(process.env.VERCEL_TEAM_ID || "").trim(),
    currentDeploymentId: String(process.env.VERCEL_DEPLOYMENT_ID || "").trim(),
    currentCommit: String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim(),
    environment: String(process.env.VERCEL_ENV || process.env.NODE_ENV || "").trim(),
  };
}

function requireManager(request: NextRequest) {
  return readManagerSession(request);
}

export async function GET(request: NextRequest) {
  if (!requireManager(request)) return NextResponse.json({ error: "Acesso restrito ao ProAR Manager." }, { status: 403 });
  const cfg = config();
  return NextResponse.json({
    environment: cfg.environment,
    currentCommit: cfg.currentCommit || null,
    currentDeploymentId: cfg.currentDeploymentId || null,
    rollbackConfigured: Boolean(cfg.token && cfg.projectId),
    canaryRequired: true,
    productionGate: "CI + build + runtime smoke + health check",
  });
}

export async function POST(request: NextRequest) {
  const manager = requireManager(request);
  if (!manager) return NextResponse.json({ error: "Acesso restrito ao ProAR Manager." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const deploymentId = String(body.deploymentId || "").trim();
  const reason = String(body.reason || "Rollback manual pelo ProAR Manager").trim().slice(0, 180);
  const cfg = config();

  if (!deploymentId || !/^dpl_[A-Za-z0-9]+$/.test(deploymentId)) {
    return NextResponse.json({ error: "Informe um deployment válido para rollback." }, { status: 400 });
  }
  if (!cfg.token || !cfg.projectId) {
    return NextResponse.json({ error: "Rollback não configurado. Defina VERCEL_TOKEN e VERCEL_PROJECT_ID no ambiente do Manager." }, { status: 503 });
  }
  if (deploymentId === cfg.currentDeploymentId) {
    return NextResponse.json({ error: "O deployment informado já é o deployment atual." }, { status: 409 });
  }

  const query = new URLSearchParams();
  if (cfg.teamId) query.set("teamId", cfg.teamId);
  query.set("description", reason);
  const response = await fetch(`https://api.vercel.com/v1/projects/${encodeURIComponent(cfg.projectId)}/rollback/${encodeURIComponent(deploymentId)}?${query}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    await recordSystemIncident({
      module: "ProAR Manager",
      operation: "Rollback de deployment",
      error: `Vercel HTTP ${response.status}: ${detail.slice(0, 300)}`,
      route: "/api/manager/deployment-safety",
      metadata: { deploymentId, actor: manager.username },
    });
    return NextResponse.json({ error: "A Vercel recusou o rollback. Consulte a Central de Erros." }, { status: 502 });
  }

  await recordSystemIncident({
    module: "ProAR Manager",
    operation: "Rollback de deployment",
    severity: "warning",
    route: "/api/manager/deployment-safety",
    metadata: { deploymentId, reason, actor: manager.username, result: "requested" },
  });

  return NextResponse.json({ requested: true, deploymentId, reason });
}
