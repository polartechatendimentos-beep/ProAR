export type CustomerStructureCustomer = {
  id: string;
  name: string;
  organizationType?: string;
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

const normalizeLevel = (value?: string) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
const isPublicCustomer = (customer: CustomerStructureCustomer) => /prefeitura|orgao publico|autarquia|fundacao|entidade publica/i.test(normalizeLevel(customer.organizationType));

const canonicalPublicLevel = (record: CustomerStructureRecord | undefined) => {
  const level=normalizeLevel(record?.hierarchyLevel || record?.category);
  if (["secretaria","diretoria","departamento","orgao"].includes(level)) return "Secretaria";
  if (level === "unidade") return "Unidade";
  if (["sala","ambiente","setor"].includes(level)) return "Sala";
  return "";
};

const validatePublicHierarchy = (
  customer: CustomerStructureCustomer,
  draft: CustomerStructureRecord,
  parent: CustomerStructureRecord | undefined,
) => {
  if (!isPublicCustomer(customer)) return;
  const level=canonicalPublicLevel(draft);
  if (!level) throw new Error("Para Prefeitura, use a hierarquia Secretaria → Unidade → Sala/Ambiente.");
  if (level === "Secretaria" && parent) throw new Error("Secretaria deve ficar vinculada diretamente à Prefeitura.");
  if (level === "Unidade" && canonicalPublicLevel(parent) !== "Secretaria") throw new Error("Unidade deve ser vinculada a uma Secretaria.");
  if (level === "Sala" && canonicalPublicLevel(parent) !== "Unidade") throw new Error("Sala/Ambiente deve ser vinculada a uma Unidade.");
};

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
  validatePublicHierarchy(customer, draft, parent);

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
