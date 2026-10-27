import { databaseFetch } from "./supabase-rest";
import { resolveTenantDb, tenantHeaders } from "./tenant-rest";

type Item = Record<string, unknown>;
type OperationalState = { moduleRecords?: Record<string, Item[]>; serviceOrders?: Item[] };
const PRIMARY_COMPANY = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";

/** Read-only tenant lookup. Never writes to a tenant or the master database. */
export async function readEquipmentMaintenanceState(companyId: string): Promise<{ equipment: Item[]; orders: Item[] } | null> {
  const db = await resolveTenantDb(companyId);
  if (!db.url || !db.key) throw new Error("TENANT_DATABASE_UNAVAILABLE");
  const keys = db.dedicated ? ["main"] : companyId === PRIMARY_COMPANY ? [companyId, "main", "polartech"] : [companyId];
  // Read one canonical tenant snapshot. Never combine records from unrelated
  // fallback state keys: merging could accidentally expose another customer's OS.
  for (const key of keys) {
    const response = await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(key)}&select=payload`, {
      headers: tenantHeaders(db.key), cache: "no-store",
    });
    if (!response.ok) throw new Error("TENANT_STATE_READ_FAILED");
    const rows = await response.json() as Array<{ payload?: OperationalState & { companyId?: string } }>;
    for (const row of rows) {
      const payload = row.payload;
      if (!payload || (payload.companyId && payload.companyId !== companyId)) continue;
      const equipment = Array.isArray(payload.moduleRecords?.["Equipamentos"]) ? payload.moduleRecords["Equipamentos"] : [];
      const orders = Array.isArray(payload.serviceOrders) ? payload.serviceOrders : [];
      if (equipment.length || orders.length) return { equipment, orders };
    }
  }
  return null;
}
