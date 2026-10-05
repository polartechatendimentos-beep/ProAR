export type ManagerReceivable = {
  id?: string;
  company_id: string;
  description?: string;
  amount: number;
  due_date: string;
  status?: "open"|"paid"|"cancelled";
  paid_at?: string|null;
  created_at?: string;
};

export type BillingCompany = {
  billing_auto_block?: boolean;
  billing_grace_days?: number;
};

export function receivableStatus(receivable:ManagerReceivable, now=new Date()) {
  if (receivable.status === "paid") return "paid" as const;
  if (receivable.status === "cancelled") return "cancelled" as const;
  const due = new Date(receivable.due_date);
  if (Number.isNaN(due.getTime())) return "open" as const;
  return due.getTime() < now.getTime() ? "overdue" as const : "open" as const;
}

export function financialAccessState(company:BillingCompany, receivables:ManagerReceivable[], now=new Date()) {
  const autoBlock = company.billing_auto_block !== false;
  const graceDays = Math.max(0, Math.min(Number(company.billing_grace_days ?? 0), 90));
  const overdue = receivables
    .filter(item => item.status !== "paid" && item.status !== "cancelled")
    .map(item => ({...item,due:new Date(item.due_date)}))
    .filter(item => !Number.isNaN(item.due.getTime()) && item.due.getTime() < now.getTime())
    .sort((a,b)=>a.due.getTime()-b.due.getTime());

  const oldest = overdue[0];
  if (!oldest) return { blocked:false, autoBlock, graceDays, overdueCount:0, overdueAmount:0, daysOverdue:0 };
  const daysOverdue = Math.max(0, Math.floor((now.getTime()-oldest.due.getTime())/86400000));
  const overdueAmount = overdue.reduce((sum,item)=>sum+Number(item.amount||0),0);
  return {
    blocked:autoBlock && daysOverdue > graceDays,
    autoBlock,
    graceDays,
    overdueCount:overdue.length,
    overdueAmount,
    daysOverdue,
    oldestDueDate:oldest.due_date,
  };
}
