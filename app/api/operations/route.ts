import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";
import { hasPermission, type Permission } from "../../../lib/permissions";
import { resolveTenantDb, tenantHeaders } from "../../../lib/tenant-rest";
import { databaseFetch, commitNeonOperationalState, PRIMARY_DATABASE_URL } from "../../../lib/supabase-rest";
import { applyOperationalCommand, independentOperationalRows, OperationError, type ErpState, type OperationalCommand } from "../../../lib/operational-ledger";
import {CommandGuardError,guardOperationalCommand,inferRuleContext} from "../../../lib/command-guard";

export async function POST(request: NextRequest) {
  const session = readSession(request.cookies.get("proar_session")?.value);
  if (!session) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const contentLength=Number(request.headers.get("content-length")||0);
    if(contentLength>262144)return NextResponse.json({error:"Operação muito grande. Divida a alteração em etapas menores."},{status:413});
    const command = await request.json() as OperationalCommand;
    guardOperationalCommand(inferRuleContext(command as unknown as Record<string,unknown>));
    const company = session.companyId || process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
    const db = await resolveTenantDb(session.companyId);
    if (!db.url || !db.key) throw new Error("Banco indisponível");
    const stateId = db.dedicated ? "main" : company;
    const baseUrl = `${db.url}/rest/v1/proar_state`;
    const headers = tenantHeaders(db.key);
    const actor = { username: session.username, displayName: session.displayName, can: (permission: string) => hasPermission(session, permission as Permission) };
    // Retry disjoint commands against the latest snapshot. The expected target record
    // still prevents silently replaying an operation over somebody else's edit.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await databaseFetch(`${baseUrl}?id=eq.${encodeURIComponent(stateId)}&select=payload`, { headers, cache: "no-store" });
      if (!response.ok) throw new Error("Falha ao ler a base");
      const rows = await response.json() as { payload: ErpState }[];
      const state = rows[0]?.payload;
      if (!state) return NextResponse.json({ error: "Carregue a base da empresa antes de operar." }, { status: 409 });
      const result = applyOperationalCommand(state, command, actor);
      if (result.replay) return NextResponse.json({ saved: true, replay: true, state });
      const revision = Number(state._revision || 0);
      const payload = { ...result.state, _revision: revision + 1, _updatedAt: new Date().toISOString(), _companyId: company };
      if (db.url === PRIMARY_DATABASE_URL) {
        const confirmed = await commitNeonOperationalState(stateId, revision, payload, independentOperationalRows(company, payload, state));
        if (confirmed) return NextResponse.json({ saved: true, state: confirmed, transactionalRecords: true });
      } else {
        const filter = state._revision === undefined ? "payload->>_revision=is.null" : `payload->>_revision=eq.${revision}`;
        const saved = await databaseFetch(`${baseUrl}?id=eq.${encodeURIComponent(stateId)}&${filter}&select=payload`, { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ payload, updated_at: payload._updatedAt }) });
        if (!saved.ok) throw new Error("Falha ao gravar a base");
        const confirmed = await saved.json() as { payload: ErpState }[];
        if (confirmed[0]?.payload) return NextResponse.json({ saved: true, state: confirmed[0].payload });
      }
    }
    return NextResponse.json({ error: "Outro usuário alterou a base. Atualize e tente novamente." }, { status: 409 });
  } catch (error) {
    if (error instanceof OperationError || error instanceof CommandGuardError) return NextResponse.json({ error: error.message, code: "code" in error ? error.code : "OPERATION_REJECTED" }, { status: error.status });
    return NextResponse.json({ error: "Não foi possível confirmar a operação no banco." }, { status: 503 });
  }
}
