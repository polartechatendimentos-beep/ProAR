export type OperationalActionTone = "blue" | "amber" | "red";

export type OperationalAction = {
  id: string;
  title: string;
  detail: string;
  module: string;
  tone: OperationalActionTone;
  priority: 1 | 2 | 3;
  category: "OS" | "Financeiro" | "Estoque" | "PMOC" | "Fiscal" | "Compras" | "Comercial" | "Operação";
  dueDate?: string;
  recordId?: string;
};

type GenericRecord = Record<string, unknown>;

function dateOnly(value: unknown) {
  if (!value) return "";
  const raw = String(value).trim();
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(raw)?.[0];
  if (iso) return iso;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : "";
}

function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

function text(record: GenericRecord) {
  return [
    record.status,
    record.description,
    record.name,
    record.category,
    record.reminderStatus,
    record.nfseStatus,
  ].filter(Boolean).join(" ");
}

function outstanding(record: GenericRecord) {
  const value = Number(record.value || 0);
  const settled = Number(record.settledValue || 0);
  return Math.max(0, value - settled);
}

function actionKey(item: OperationalAction) {
  return `${item.category}:${item.recordId || item.id}:${item.module}`;
}

export function deriveOperationalActions(
  serviceOrders: GenericRecord[],
  modules: Record<string, GenericRecord[]>,
  now = new Date(),
): OperationalAction[] {
  const today = now.toISOString().slice(0, 10);
  const actions: OperationalAction[] = [];

  for (const order of serviceOrders || []) {
    const status = String(order.status || "");
    if (/conclu[ií]d|cancelad/i.test(status)) continue;
    const orderDate = dateOnly(order.date);
    if (orderDate && orderDate < today) {
      actions.push({
        id: `os-overdue-${order.id}`,
        title: `OS atrasada • ${order.id}`,
        detail: [order.client, order.service, orderDate].filter(Boolean).join(" • "),
        module: "Ordens de serviço",
        tone: "red",
        priority: 1,
        category: "OS",
        dueDate: orderDate,
        recordId: String(order.id || ""),
      });
      continue;
    }
    if (orderDate === today) {
      actions.push({
        id: `os-today-${order.id}`,
        title: `Atendimento de hoje • ${order.id}`,
        detail: [order.time || "Horário a definir", order.client, order.service].filter(Boolean).join(" • "),
        module: "Agenda",
        tone: "blue",
        priority: 2,
        category: "OS",
        dueDate: orderDate,
        recordId: String(order.id || ""),
      });
    }
    if (/rejeitad|erro/i.test(String(order.nfseStatus || ""))) {
      actions.push({
        id: `fiscal-os-${order.id}`,
        title: `Documento fiscal com erro • ${order.id}`,
        detail: [order.client, order.nfseStatus].filter(Boolean).join(" • "),
        module: "Financeiro",
        tone: "red",
        priority: 1,
        category: "Fiscal",
        recordId: String(order.id || ""),
      });
    } else if (/conting[eê]ncia|pendente|validando|transmitindo|processando/i.test(String(order.nfseStatus || ""))) {
      actions.push({
        id: `fiscal-os-${order.id}`,
        title: `Documento fiscal pendente • ${order.id}`,
        detail: [order.client, order.nfseStatus].filter(Boolean).join(" • "),
        module: "Financeiro",
        tone: "amber",
        priority: 2,
        category: "Fiscal",
        recordId: String(order.id || ""),
      });
    }
  }

  for (const [module, records] of Object.entries(modules || {})) {
    for (const record of records || []) {
      const recordText = text(record);
      const recordId = String(record.id || "");
      const dueDate = dateOnly(record.dueDate || record.date || record.firstDueDate);
      const maintenanceDate = dateOnly(record.nextMaintenanceDate || record.reviewDate);
      const current = Number(record.stockCurrent);
      const minimum = Number(record.stockMin);

      if (module === "Financeiro" && !/Paga|Recebida|Cancelad/i.test(String(record.status || "")) && outstanding(record) > 0) {
        if (dueDate && dueDate < today) {
          actions.push({
            id: `finance-overdue-${recordId}`,
            title: `Título vencido • ${record.name || recordId}`,
            detail: [record.client, dueDate, `Saldo R$ ${outstanding(record).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`].filter(Boolean).join(" • "),
            module: "Financeiro",
            tone: "red",
            priority: 1,
            category: "Financeiro",
            dueDate,
            recordId,
          });
        } else if (dueDate && daysBetween(today, dueDate) >= 0 && daysBetween(today, dueDate) <= 3) {
          actions.push({
            id: `finance-due-${recordId}`,
            title: `Título vence em breve • ${record.name || recordId}`,
            detail: [record.client, dueDate, `Saldo R$ ${outstanding(record).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`].filter(Boolean).join(" • "),
            module: "Financeiro",
            tone: "amber",
            priority: 2,
            category: "Financeiro",
            dueDate,
            recordId,
          });
        }
      }

      if ((module === "Produtos" || module === "Estoque") && Number.isFinite(current) && Number.isFinite(minimum) && minimum >= 0 && current <= minimum) {
        actions.push({
          id: `stock-${recordId}`,
          title: current <= 0 ? `Sem estoque • ${record.name || recordId}` : `Estoque baixo • ${record.name || recordId}`,
          detail: `Atual: ${current} • Mínimo: ${minimum}`,
          module: "Estoque",
          tone: current <= 0 ? "red" : "amber",
          priority: current <= 0 ? 1 : 2,
          category: "Estoque",
          recordId,
        });
      }

      if ((module === "Equipamentos" || module === "PMOC") && maintenanceDate) {
        const days = daysBetween(today, maintenanceDate);
        if (days < 0) {
          actions.push({
            id: `pmoc-overdue-${recordId}`,
            title: `Manutenção vencida • ${record.name || record.serialNumber || recordId}`,
            detail: [record.client, maintenanceDate].filter(Boolean).join(" • "),
            module: "PMOC e conformidade",
            tone: "red",
            priority: 1,
            category: "PMOC",
            dueDate: maintenanceDate,
            recordId,
          });
        } else if (days <= 30) {
          actions.push({
            id: `pmoc-upcoming-${recordId}`,
            title: `Manutenção próxima • ${record.name || record.serialNumber || recordId}`,
            detail: [record.client, maintenanceDate, `${days} dia(s)`].filter(Boolean).join(" • "),
            module: "PMOC e conformidade",
            tone: "amber",
            priority: 2,
            category: "PMOC",
            dueDate: maintenanceDate,
            recordId,
          });
        }
      }

      if (module === "Compras" && /aguardando|pendente|atras|parcial/i.test(recordText)) {
        actions.push({
          id: `purchase-${recordId}`,
          title: record.name ? String(record.name) : `Compra ${recordId}`,
          detail: [record.client, record.status || "Compra pendente"].filter(Boolean).join(" • "),
          module: "Compras",
          tone: /atras|venc/i.test(recordText) ? "red" : "amber",
          priority: /atras|venc/i.test(recordText) ? 1 : 2,
          category: "Compras",
          dueDate: dueDate || undefined,
          recordId,
        });
      }

      if (module === "Orçamentos" && /enviado|aguardando|pendente|retorno/i.test(recordText)) {
        const created = dateOnly(record.createdAt || record.date);
        const age = created ? daysBetween(created, today) : 0;
        if (!created || age >= 2) actions.push({
          id: `commercial-${recordId}`,
          title: `Follow-up de orçamento • ${record.name || recordId}`,
          detail: [record.client, record.status || "Aguardando retorno", created && `${age} dia(s)`].filter(Boolean).join(" • "),
          module: "Orçamentos",
          tone: age >= 7 ? "red" : "amber",
          priority: age >= 7 ? 1 : 3,
          category: "Comercial",
          dueDate: created || undefined,
          recordId,
        });
      }

      if (/rejeitad|erro fiscal/i.test(recordText)) {
        actions.push({
          id: `fiscal-record-${module}-${recordId}`,
          title: `Pendência fiscal • ${record.name || recordId}`,
          detail: [module, record.status || record.description].filter(Boolean).join(" • "),
          module: "Financeiro",
          tone: "red",
          priority: 1,
          category: "Fiscal",
          recordId,
        });
      } else if (/aguardando|pendente|venc|atras|baixo estoque|sem estoque/i.test(recordText) && !["Financeiro", "Compras", "Orçamentos", "Produtos", "Estoque"].includes(module)) {
        actions.push({
          id: `generic-${module}-${recordId}`,
          title: record.name ? String(record.name) : recordId,
          detail: [module, record.status || "Próxima ação necessária"].filter(Boolean).join(" • "),
          module,
          tone: /venc|atras|sem estoque/i.test(recordText) ? "red" : "amber",
          priority: /venc|atras|sem estoque/i.test(recordText) ? 1 : 3,
          category: "Operação",
          dueDate: dueDate || undefined,
          recordId,
        });
      }
    }
  }

  const unique = new Map<string, OperationalAction>();
  for (const item of actions) {
    const key = actionKey(item);
    const previous = unique.get(key);
    if (!previous || item.priority < previous.priority) unique.set(key, item);
  }

  return [...unique.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return a.title.localeCompare(b.title, "pt-BR");
  });
}

export function summarizeOperationalActions(actions: OperationalAction[]) {
  return actions.reduce((summary, item) => {
    summary.total += 1;
    if (item.priority === 1) summary.critical += 1;
    else if (item.priority === 2) summary.attention += 1;
    else summary.followUp += 1;
    summary.byCategory[item.category] = (summary.byCategory[item.category] || 0) + 1;
    return summary;
  }, { total: 0, critical: 0, attention: 0, followUp: 0, byCategory: {} as Record<string, number> });
}
