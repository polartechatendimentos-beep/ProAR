export const fieldOrderSteps = [
  { id: "chegada", label: "Chegada" },
  { id: "execucao", label: "Execução" },
  { id: "conclusao", label: "Conclusão" },
] as const;
export type FieldOrderStep = typeof fieldOrderSteps[number]["id"];
export function fieldOrderStepFor(requirement: string): FieldOrderStep {
  if (requirement === "checkin") return "chegada";
  if (requirement === "afterPhoto" || requirement === "signature") return "conclusao";
  return "execucao";
}
export const automaticFieldEvidence = new Set(["equipment", "equipmentLabel", "checkin", "beforePhoto", "afterPhoto", "signature", "executedService", "diagnosis"]);

export const fieldOrderFunctions = [
  { id: "relatorio", label: "Relatório" },
  { id: "fotos", label: "Fotos" },
  { id: "checklist", label: "Checklist" },
] as const;
export type FieldOrderFunction = typeof fieldOrderFunctions[number]["id"];

export function fieldOrderFunctionFor(requirement: string): FieldOrderFunction {
  if (["equipment", "equipmentLabel", "beforePhoto"].includes(requirement)) return "fotos";
  if (["diagnosis", "executedService", "equipmentResults"].includes(requirement)) return "relatorio";
  return "checklist";
}
