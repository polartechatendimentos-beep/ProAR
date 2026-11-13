type Row = Record<string, unknown>;
const value = (item: Row | undefined, ...keys: string[]) => {
  for (const key of keys) if (typeof item?.[key] === "string" && String(item[key]).trim()) return String(item[key]).trim();
  return "";
};
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
/** Resolve only locations belonging to the customer of this order. */
export function orderLocation(order: Row, structures: Row[]) {
  const scoped = structures.filter(item => {
    const customerId = value(item, "customerId", "clientId");
    if (customerId && order.customerId) return customerId === order.customerId;
    const client = value(item, "client", "customer", "customerName");
    return Boolean(client && normalize(client) === normalize(String(order.client || "")));
  });
  const ids = [order.roomId, order.structureId, order.sectorId, order.unitId].filter(Boolean);
  const structure = ids.map(id => scoped.find(item => item.id === id)).find(Boolean)
    || scoped.find(item => value(item, "name", "unit") === order.room)
    || scoped.find(item => value(item, "name", "unit") === order.unit);
  const roomValue = typeof order.environment === "string" ? order.environment : value(order, "room") || value(structure, "room", "environment", "ambiente", "name");
  return { structure, roomValue, roomLabel: roomValue || "Sala/Ambiente não informado" };
}
/** A different customer must not inherit the previous customer's location/contact/equipment. */
export function orderCustomerPatch(order: Row, customerId: string, customer?: Row): Row {
  if (customerId && customerId === order.customerId) return {};
  return { customerId: customerId || undefined, client: value(customer, "name", "legalName", "tradeName"),
    unit: "", unitId: undefined, sector: "", sectorId: undefined, room: "", roomId: undefined, structureId: undefined, environment: "",
    address: value(customer, "address"), whatsappPhone: value(customer, "whatsapp", "phone"),
    equipmentIds: [], equipmentId: undefined, equipmentLabelCode: undefined };
}
