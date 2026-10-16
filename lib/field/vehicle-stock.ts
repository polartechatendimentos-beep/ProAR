/** Vehicle stock domain: balances are derived from persisted movements, never from mutable counters. */
export type VehicleStockMovement = {
  id: string; companyId: number; vehicleId: string; sku: string; quantityDelta: number;
  orderId?: string; referenceId: string; createdAt: string; userId: string;
  reason: "LOAD" | "TRANSFER" | "OS_CONSUMPTION" | "RETURN" | "ADJUSTMENT";
};
export function calculateVehicleStock(movements: VehicleStockMovement[], companyId: number, vehicleId: string, sku: string) {
  if (!Number.isInteger(companyId) || companyId <= 0 || !vehicleId || !sku) throw new Error("STOCK_SCOPE_INVALID");
  const seen = new Set<string>();
  let balance = 0;
  for (const movement of movements) {
    if (movement.companyId !== companyId || movement.vehicleId !== vehicleId || movement.sku !== sku) continue;
    if (!movement.referenceId || !movement.id || !movement.userId || !Number.isFinite(movement.quantityDelta)) throw new Error("STOCK_MOVEMENT_INVALID");
    if (seen.has(movement.referenceId)) continue;
    seen.add(movement.referenceId);
    balance += movement.quantityDelta;
  }
  return balance;
}
export function validateVehicleStockConsumption(movements: VehicleStockMovement[], movement: VehicleStockMovement) {
  if (movement.reason !== "OS_CONSUMPTION" || !movement.orderId || movement.quantityDelta >= 0) throw new Error("OS_CONSUMPTION_INVALID");
  if (movements.some(row => row.companyId === movement.companyId && row.referenceId === movement.referenceId)) throw new Error("DUPLICATE_REFERENCE");
  const available = calculateVehicleStock(movements, movement.companyId, movement.vehicleId, movement.sku);
  if (available + movement.quantityDelta < -1e-9) throw new Error("INSUFFICIENT_VEHICLE_STOCK");
  return { available, remaining: available + movement.quantityDelta };
}
