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
