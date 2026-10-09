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
  const equipment = new Map<string, Item>();
  const orders = new Map<string, Item>();
  let found = false;
  for (const key of keys) {
    const response = await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(key)}&select=payload`, {
      headers: tenantHeaders(db.key), cache: "no-store",
    });
    if (!response.ok) throw new Error("TENANT_STATE_READ_FAILED");
    const rows = await response.json() as Array<{ payload?: OperationalState }>;
    for (const row of rows) {
      if (!row.payload) continue;
      found = true;
      // The canonical record is read first; legacy copies only fill missing IDs.
      for (const item of row.payload.moduleRecords?.["Equipamentos"] ?? []) {
        const id = String(item.id ?? "");
        if (id && !equipment.has(id)) equipment.set(id, item);
      }
      for (const item of row.payload.serviceOrders ?? []) {
        const id = String(item.id ?? "");
        if (id && !orders.has(id)) orders.set(id, item);
      }
    }
  }
  return found ? { equipment: [...equipment.values()], orders: [...orders.values()] } : null;
}
