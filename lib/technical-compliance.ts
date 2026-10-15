export type PmocPlan = {
  id: string; client: string; name?: string; unit?: string; sector?: string; technicalResponsible?: string;
  professionalRegistration?: string; responsibilityDocument?: string; startsAt?: string;
  expiresAt?: string; lastServiceAt?: string; periodicity: "Mensal"|"Bimestral"|"Trimestral"|"Semestral"|"Anual"|"Personalizada";
  customDays?: number; equipmentIds: string[]; notes?: string; documents?: TechnicalDocument[];
};
export type TechnicalDocument = { id:string; category:string; name:string; issuedAt?:string; expiresAt?:string; responsible?:string; fileName?:string; notes?:string };
export type RefrigerantMovement = { id:string; refrigerantId:string; type:"Entrada"|"Carga"|"Complemento"|"Recuperação"|"Retirada"|"Perda"|"Descarte"|"Ajuste"; quantity:number; occurredAt:string; technician?:string; serviceOrderId?:string; equipmentId?:string; reason?:string };
export type Refrigerant = { id:string; name:string; manufacturer?:string; unit:"kg"|"g"; lot?:string; purchasedAt?:string; supplier?:string; acquiredQuantity:number; notes?:string; movements?:RefrigerantMovement[] };

/** Next scheduled intervention after the start/last completed service; never moves forward just because the screen is reopened. */
export function nextPmocDate(plan: PmocPlan, from?: Date): string | undefined {
  if (from && !Number.isFinite(from.getTime())) return undefined;
  const reference = from?.toISOString().slice(0,10) || plan.lastServiceAt || plan.startsAt;
  if (!reference || !/^\d{4}-\d{2}-\d{2}$/.test(reference)) return undefined;
  const date = new Date(`${reference}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== reference) return undefined;
  const months: number | undefined = ({ Mensal: 1, Bimestral: 2, Trimestral: 3, Semestral: 6, Anual: 12 } as Record<string,number>)[plan.periodicity];
  if (months) {
    const originalDay = date.getUTCDate();
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
    date.setUTCDate(Math.min(originalDay,lastDay));
  } else {
    if (plan.periodicity !== "Personalizada" || !Number.isInteger(plan.customDays) || Number(plan.customDays) < 1 || Number(plan.customDays) > 3660) return undefined;
    date.setUTCDate(date.getUTCDate() + Number(plan.customDays));
  }
  return date.toISOString().slice(0,10);
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
