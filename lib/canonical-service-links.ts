import { customerHierarchy, hierarchySelection, type HierarchyCustomer, type HierarchyRecord, type HierarchySelection } from "./customer-hierarchy.ts";

type RecordValue = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const linkedIds = (value: unknown) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
const active = (record: RecordValue) => !/inativ|cancelad/i.test(text(record.status));

export function inspectCanonicalServiceLinks(
  record: RecordValue, customers: HierarchyCustomer[], structures: HierarchyRecord[], equipment: RecordValue[],
) {
  const issues: string[] = [];
  const customerId = text(record.customerId);
  const customerMatches = customers.filter(row => row.id === customerId);
  const customer = customerMatches.length === 1 ? customerMatches[0] : undefined;
  if (!customer) return {issues:[customerId ? "Cliente inexistente ou ID duplicado." : "Cadastro legado sem ID do cliente. Selecione o cliente no cadastro principal."], equipmentOptions:[] as RecordValue[]};
  // The hierarchy's legacy-name fallback is for display; never feed it to a writer.
  const scoped = structures.filter(row => text(row.customerId) === customerId);
  const locations = customerHierarchy(customer, scoped, customers);
  const structureIds = ["structureId","unitId","sectorId","roomId"].map(field=>text(record[field])).filter(Boolean);
  const selectedId = text(record.structureId)||text(record.roomId)||text(record.sectorId)||text(record.unitId);
  let selection: HierarchySelection | undefined;
  try {
    if (structureIds.some(id => structures.filter(row => row.id===id).length!==1)) throw new Error();
    const selected = hierarchySelection(customer, locations, selectedId);
    selection = selected;
    if (structureIds.some(id=> ![selected.structureId,selected.unitId,selected.sectorId,selected.roomId].includes(id))
      || (text(record.unitId) && record.unitId!==selection.unitId)
      || (text(record.sectorId) && record.sectorId!==selection.sectorId)
      || (text(record.roomId) && record.roomId!==selection.roomId)) {
      issues.push("Unidade, setor e sala não pertencem ao mesmo caminho cadastral.");
    }
  } catch { issues.push("Local inexistente, inativo, duplicado ou pertencente a outro cliente."); }
  if ((!selection?.unitId && text(record.unit)) || (!selection?.sectorId && text(record.sector)) || (!selection?.roomId && text(record.room))) {
    issues.push("Local legado em texto, sem vínculo confirmado no cadastro.");
  }
  const equipmentCounts=new Map<string,number>();
  for (const row of equipment) {
    const id=text(row.id);
    if (id) equipmentCounts.set(id,(equipmentCounts.get(id)||0)+1);
  }
  const locationsById=new Map(locations.filter(node=>!node.issue).map(node=>[node.id,node]));
  const structureCounts=new Map<string,number>();
  for (const row of structures) {
    const id=text(row.id);
    if (id) structureCounts.set(id,(structureCounts.get(id)||0)+1);
  }
  const equipmentOptions = equipment.filter(row => {
    const id = text(row.id);
    if (!id || equipmentCounts.get(id)!==1 || text(row.customerId)!==customerId || !active(row)) return false;
    const itemId = text(row.structureId)||text(row.roomId)||text(row.sectorId)||text(row.unitId);
    const itemLocation=locationsById.get(itemId);
    if (itemId && (structureCounts.get(itemId)!==1 || !itemLocation)) return false;
    if (["unit","sector","room"].some(kind=>{
      const ref=text(row[kind+"Id"]);
      return Boolean(ref && (locationsById.get(ref)?.kind!==kind || !itemLocation?.path.includes(ref) || structureCounts.get(ref)!==1));
    })) return false;
    if (["unit","sector","room"].some(key=>text(row[key])&&!text(row[key+"Id"])&&!itemId)) return false;
    if (!selectedId) return true;
    return Boolean(itemId && itemLocation?.path.includes(selectedId));
  });
  const ids = [...new Set([...linkedIds(record.equipmentIds),...([text(record.equipmentId)].filter(Boolean))])];
  if (ids.some(id=>!equipmentOptions.some(row=>row.id===id))) issues.push("Há equipamentos inexistentes, ambíguos ou fora do cliente/local selecionado.");
  return {issues,equipmentOptions,selection};
}

export function canonicalServiceLinkFingerprint(record: RecordValue) {
  return JSON.stringify([
    ...["customerId","client","structureId","unitId","unit","sectorId","sector","roomId","room","equipmentId"].map(key=>text(record[key])),
    [...linkedIds(record.equipmentIds)].sort(),
  ]);
}
