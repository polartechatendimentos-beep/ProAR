type RecordItem = Record<string, unknown>;

/** Safe to import in client and server components (no Node crypto dependency). */
export function normalizeEquipmentLabelCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function isEquipmentLabelCode(value: string) {
  return /^PT-[A-Z0-9]{6,12}$/.test(value);
}

export function isCompletedMaintenanceStatus(value: unknown) {
  const normalized = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return /^(concluid[ao]s?|finalizad[ao]s?|encerrad[ao]s?)$/.test(normalized);
}

export function canLinkHistoricalServiceOrder(equipment: RecordItem, order: RecordItem, allEquipment: RecordItem[]) {
  const equipmentId = String(equipment.id ?? "");
  const orderId = String(order.id ?? "");
  const customerId = String(equipment.customerId ?? "");
  const validId = (id: string) => /^[A-Za-z0-9_-]{1,120}$/.test(id);
  if (!validId(equipmentId) || !validId(orderId) || !customerId || String(order.customerId ?? "") !== customerId) return false;
  if (!isCompletedMaintenanceStatus(order.status)) return false;
  const assignedToOtherLabel = allEquipment.some(other => {
    if (String(other.id) === equipmentId) return false;
    const historical = Array.isArray(other.historicalServiceOrderIds) ? other.historicalServiceOrderIds.map(String) : [];
    if (historical.includes(orderId)) return true;
    const orderEquipmentIds = Array.isArray(order.equipmentIds) ? order.equipmentIds.map(String) : [];
    if (order.equipmentId != null) orderEquipmentIds.push(String(order.equipmentId));
    return other.publicMaintenanceHistoryEnabled === true && orderEquipmentIds.includes(String(other.id));
  });
  return !assignedToOtherLabel;
}
