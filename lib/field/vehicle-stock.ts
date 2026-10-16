/** Vehicle stock domain: balances are derived from persisted movements, never from mutable counters. */
export type VehicleStockMovement = {
  id: string; companyId: string | number; vehicleId: string; sku: string; quantityDelta: number;
  orderId?: string; referenceId: string; createdAt: string; userId: string;
  reason: "LOAD" | "TRANSFER" | "OS_CONSUMPTION" | "RETURN" | "ADJUSTMENT";
};
export function calculateVehicleStock(movements: VehicleStockMovement[], companyId: string | number, vehicleId: string, sku: string) {
  if (!["string","number"].includes(typeof companyId) || !String(companyId).trim() || (typeof companyId === "number" && (!Number.isInteger(companyId) || companyId <= 0)) || !vehicleId || !sku) throw new Error("STOCK_SCOPE_INVALID");
  const seen = new Map<string,string>();
  let balance = 0;
  for (const movement of movements) {
    if (movement.companyId !== companyId || movement.vehicleId !== vehicleId || movement.sku !== sku) continue;
    if (!movement.referenceId || !movement.id || !movement.userId || !Number.isFinite(movement.quantityDelta)) throw new Error("STOCK_MOVEMENT_INVALID");
    const fingerprint=JSON.stringify([movement.id,movement.quantityDelta,movement.reason,movement.orderId||""]);
    if (seen.has(movement.referenceId)) {if(seen.get(movement.referenceId)!==fingerprint)throw new Error("DUPLICATE_REFERENCE_CONFLICT");continue;}
    seen.set(movement.referenceId,fingerprint);
    balance += movement.quantityDelta;
  }
  return balance;
}
export function validateVehicleStockConsumption(movements: VehicleStockMovement[], movement: VehicleStockMovement) {
  if (!movement.id || !movement.referenceId || !movement.userId || !Number.isFinite(movement.quantityDelta)) throw new Error("STOCK_MOVEMENT_INVALID");
  if (movement.reason !== "OS_CONSUMPTION" || !movement.orderId || movement.quantityDelta >= 0) throw new Error("OS_CONSUMPTION_INVALID");
  if (movements.some(row => row.companyId === movement.companyId && row.referenceId === movement.referenceId)) throw new Error("DUPLICATE_REFERENCE");
  const available = calculateVehicleStock(movements, movement.companyId, movement.vehicleId, movement.sku);
  if (available + movement.quantityDelta < -1e-9) throw new Error("INSUFFICIENT_VEHICLE_STOCK");
  return { available, remaining: available + movement.quantityDelta };
}

