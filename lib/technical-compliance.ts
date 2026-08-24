export type PmocPlan = {
  id: string; client: string; unit?: string; sector?: string; technicalResponsible?: string;
  professionalRegistration?: string; responsibilityDocument?: string; startsAt?: string;
  expiresAt?: string; periodicity: "Mensal"|"Bimestral"|"Trimestral"|"Semestral"|"Anual"|"Personalizada";
  customDays?: number; equipmentIds: string[]; notes?: string; documents?: TechnicalDocument[];
};
export type TechnicalDocument = { id:string; category:string; name:string; issuedAt?:string; expiresAt?:string; responsible?:string; fileName?:string; notes?:string };
export type RefrigerantMovement = { id:string; refrigerantId:string; type:"Entrada"|"Carga"|"Complemento"|"Recuperação"|"Retirada"|"Perda"|"Descarte"|"Ajuste"; quantity:number; occurredAt:string; technician?:string; serviceOrderId?:string; equipmentId?:string; reason?:string };
export type Refrigerant = { id:string; name:string; manufacturer?:string; unit:"kg"|"g"; lot?:string; purchasedAt?:string; supplier?:string; acquiredQuantity:number; notes?:string; movements?:RefrigerantMovement[] };

export function nextPmocDate(plan: PmocPlan, from = new Date()): string | undefined {
  if (!plan.startsAt) return undefined;
  const days = plan.periodicity === "Mensal" ? 30 : plan.periodicity === "Bimestral" ? 60 : plan.periodicity === "Trimestral" ? 90 : plan.periodicity === "Semestral" ? 180 : plan.periodicity === "Anual" ? 365 : plan.customDays;
  if (!days || days < 1) return undefined;
  const date = new Date(from); date.setDate(date.getDate() + days); return date.toISOString().slice(0,10);
}
export function refrigerantAvailable(fluid: Refrigerant): number {
  return (fluid.acquiredQuantity || 0) + (fluid.movements || []).reduce((sum, item) => sum + (["Entrada","Recuperação","Ajuste"].includes(item.type) ? item.quantity : -item.quantity), 0);
}
export function retrofitEstimate(input: { investment:number; currentKw:number; proposedKw:number; hoursPerMonth:number; tariff:number }) {
  const current = Math.max(0,input.currentKw)*Math.max(0,input.hoursPerMonth)*Math.max(0,input.tariff);
  const proposed = Math.max(0,input.proposedKw)*Math.max(0,input.hoursPerMonth)*Math.max(0,input.tariff);
  const monthly = Math.max(0,current-proposed);
  return { current, proposed, monthly, annual:monthly*12, paybackMonths:monthly ? input.investment/monthly : undefined };
}
