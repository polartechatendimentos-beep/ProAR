export type HierarchyCustomer = { id: string; name: string; organizationType?: string; address?: string };
export type HierarchyRecord = { id?: unknown; name?: unknown; customerId?: unknown; client?: unknown; parentId?: unknown; parentStructureId?: unknown; hierarchyLevel?: unknown; category?: unknown; type?: unknown; status?: unknown; address?: unknown };
export type HierarchyNode = { id: string; name: string; level: string; kind: "unit" | "sector" | "room" | "other"; record: HierarchyRecord; parentId: string; depth: number; path: string[]; issue: boolean };
export type HierarchySelection = { customerId: string; client: string; unit: string; unitId?: string; sector: string; sectorId?: string; room: string; roomId?: string; structureId?: string; address?: string; path: string[] };
const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
export const isMunicipalCustomer = (customer?: HierarchyCustomer) => normalize(customer?.organizationType) === "prefeitura" || /^(prefeitura|municipio)\b/.test(normalize(customer?.name));
export function hierarchyKind(record: HierarchyRecord): HierarchyNode["kind"] {
  const level = normalize(record.hierarchyLevel || record.category || record.type);
  if (/sala|ambiente/.test(level)) return "room";
  if (/setor|secretaria|diretoria|departamento|orgao/.test(level)) return "sector";
  if (/unidade|filial|matriz|sede/.test(level)) return "unit";
  return "other";
}
export function customerHierarchy(customer: HierarchyCustomer, records: HierarchyRecord[], customers: HierarchyCustomer[] = [customer], includeInactive = false): HierarchyNode[] {
  const uniqueName = customers.filter(item => normalize(item.name) === normalize(customer.name)).length === 1;
  const scoped = records.filter(item => item && (item.customerId ? String(item.customerId) === customer.id : uniqueName && normalize(item.client) === normalize(customer.name)) && (includeInactive || !/inativ|cancelad/.test(normalize(item.status))));
  const byId = new Map<string, HierarchyRecord>();
  for (const item of scoped) if (item.id && !byId.has(String(item.id))) byId.set(String(item.id), item);
  const children = new Map<string, string[]>();
  for (const [id, item] of byId) {
    const parent = String(item.parentId || item.parentStructureId || "");
    const key = byId.has(parent) && parent !== id ? parent : "";
    children.set(key, [...(children.get(key) || []), id]);
  }
  for (const list of children.values()) list.sort((a,b) => String(byId.get(a)?.name || "").localeCompare(String(byId.get(b)?.name || ""), "pt-BR"));
  const result: HierarchyNode[] = [], seen = new Set<string>();
  const visit = (id: string, ancestors: string[], issue = false) => {
    if (seen.has(id)) return;
    seen.add(id);
    const record = byId.get(id)!;
    const parent = String(record.parentId || record.parentStructureId || "");
    const node: HierarchyNode = {id, name:String(record.name || "Estrutura sem nome"), level:String(record.hierarchyLevel || record.category || record.type || "Estrutura"), kind:hierarchyKind(record), record, parentId:ancestors.at(-1) || "", depth:ancestors.length, path:[...ancestors,id], issue:issue || Boolean(parent && (!byId.has(parent) || parent === id))};
    result.push(node);
    for (const child of children.get(id) || []) visit(child, node.path, node.issue);
  };
  for (const id of children.get("") || []) visit(id, []);
  for (const id of byId.keys()) if (!seen.has(id)) visit(id, [], true);
  return result;
}
export function hierarchySelection(customer: HierarchyCustomer, nodes: HierarchyNode[], id = ""): HierarchySelection {
  const selected = nodes.find(item => item.id === id);
  if (id && (!selected || selected.issue)) throw new Error("Estrutura indisponível ou com vínculo inválido. Regularize o cadastro.");
  const path = selected ? selected.path.map(key => nodes.find(item => item.id === key)!).filter(Boolean) : [];
  const nearest = (kind: HierarchyNode["kind"]) => [...path].reverse().find(item => item.kind === kind);
  const unit = nearest("unit"), sector = nearest("sector"), room = nearest("room");
  return {customerId:customer.id, client:customer.name, unit:unit?.name || "", unitId:unit?.id, sector:sector?.name || "", sectorId:sector?.id, room:room?.name || "", roomId:room?.id, structureId:selected?.id, address:String(selected?.record.address || unit?.record.address || customer.address || ""), path:[customer.name,...path.map(item=>item.name)]};
}
export function filterHierarchy(nodes: HierarchyNode[], query: string) {
  const term = normalize(query);
  if (!term) return nodes;
  const included = new Set(nodes.filter(node => normalize(`${node.name} ${node.level}`).includes(term)).flatMap(node => node.path));
  return nodes.filter(node => included.has(node.id));
}
export function matchesHierarchyLocation(record: Record<string,unknown>, nodes: HierarchyNode[], selectedId: string) {
  if (!selectedId) return true;
  const selected = nodes.find(node=>node.id===selectedId && !node.issue);
  if (!selected) return false;
  const id = String(record.roomId || record.structureId || record.sectorId || record.unitId || "");
  if (id) return Boolean(nodes.find(node=>node.id===id)?.path.includes(selectedId));
  const name=String(record.room || record.sector || record.unit || "");
  const matches=nodes.filter(node=>normalize(node.name)===normalize(name));
  return matches.length===1 && matches[0].path.includes(selectedId);
}
export function hierarchyCounts(customer:HierarchyCustomer,nodes:HierarchyNode[],customers:HierarchyCustomer[],orders:Record<string,unknown>[],equipment:Record<string,unknown>[]) {
  const unique=customers.filter(item=>normalize(item.name)===normalize(customer.name)).length===1;
  const belongs=(record:Record<string,unknown>)=>record.customerId?String(record.customerId)===customer.id:unique && normalize(record.client)===normalize(customer.name);
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const byName=new Map<string,HierarchyNode[]>();
  for(const node of nodes) { const name=normalize(node.name);byName.set(name,[...(byName.get(name)||[]),node]); }
  const counts=new Map<string,{orders:number;equipment:number}>();
  for(const id of ["",...byId.keys()])counts.set(id,{orders:0,equipment:0});
  const add=(records:Record<string,unknown>[],kind:"orders"|"equipment")=>{
    for(const record of records) {
      if(!belongs(record))continue;
      counts.get("")![kind]++;
      const id=String(record.roomId||record.structureId||record.sectorId||record.unitId||"");
      const matching=byName.get(normalize(record.room||record.sector||record.unit||""))||[];
      const node=id?byId.get(id):matching.length===1?matching[0]:undefined;
      if(node&&!node.issue)for(const parentId of node.path)counts.get(parentId)![kind]++;
    }
  };
  add(orders,"orders");add(equipment,"equipment");
  return counts;
}

/** Collapse state applies after search filtering and can also close the root. */
export function visibleHierarchyNodes(nodes:HierarchyNode[],collapsed:ReadonlySet<string>,rootCollapsed=false):HierarchyNode[]{
 if(rootCollapsed)return [];
 return nodes.filter(node=>!node.path.slice(0,-1).some(id=>collapsed.has(id)));
}
