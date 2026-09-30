export type CustomerStructureCustomer = {
  id: string;
  name: string;
};

export type CustomerStructureRecord = {
  id: string;
  name: string;
  client?: string;
  customerId?: string;
  category?: string;
  hierarchyLevel?: string;
  parentId?: string;
  parentUnit?: string;
  [key: string]: unknown;
};

const belongsToCustomer = (record: CustomerStructureRecord, customer: CustomerStructureCustomer) =>
  record.customerId ? record.customerId === customer.id : record.client === customer.name;

const descendantsOf = (id: string, structures: CustomerStructureRecord[]) => {
  const descendants = new Set<string>();
  const visit = (parentId: string) => {
    structures.filter(item => item.parentId === parentId).forEach(item => {
      if (descendants.has(item.id)) return;
      descendants.add(item.id);
      visit(item.id);
    });
  };
  visit(id);
  return descendants;
};

export function prepareCustomerStructureSave(
  customer: CustomerStructureCustomer,
  draft: CustomerStructureRecord,
  structures: CustomerStructureRecord[],
) {
  const name = String(draft.name || "").trim();
  if (!customer.id || !customer.name.trim()) throw new Error("Cliente principal inválido.");
  if (!name) throw new Error("Informe o nome da estrutura.");

  const parentId = String(draft.parentId || "").trim();
  const parent = parentId ? structures.find(item => item.id === parentId) : undefined;
  if (parentId && !parent) throw new Error("A estrutura superior selecionada não existe mais.");
  if (parent && !belongsToCustomer(parent, customer)) throw new Error("A estrutura superior pertence a outro cliente.");
  if (parentId === draft.id) throw new Error("Uma estrutura não pode ser vinculada a ela mesma.");
  if (draft.id && descendantsOf(draft.id, structures).has(parentId)) throw new Error("Não é permitido criar um ciclo na hierarquia.");

  const record: CustomerStructureRecord = {
    ...draft,
    name,
    client: customer.name,
    customerId: customer.id,
    parentId: parentId || undefined,
    parentUnit: parent?.name || undefined,
  };

  const exists = structures.some(item => item.id === record.id);
  const nextStructures = exists
    ? structures.map(item => item.id === record.id ? record : item)
    : [record, ...structures];

  const unitCount = nextStructures.filter(item => belongsToCustomer(item, customer)).length;
  return { record, nextStructures, unitCount };
}
