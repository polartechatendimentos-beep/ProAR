export type PublicOrganizationType =
  | "Prefeitura"
  | "Órgão Público"
  | "Autarquia"
  | "Fundação"
  | "Entidade Pública";

export type CertameStatus =
  | "Em vigência"
  | "Próximo do vencimento"
  | "Encerrado"
  | "Suspenso"
  | "Cancelado";

export type CertameMovementType =
  | "Reserva"
  | "Execução"
  | "Liberação"
  | "Estorno"
  | "Ajuste autorizado";

export type Certame = {
  id: string;
  customerId: string;
  departmentId?: string;
  administrativeProcess?: string;
  modality?: string;
  biddingNumber?: string;
  auctionNumber?: string;
  minutesNumber?: string;
  contractNumber?: string;
  object: string;
  startsAt?: string;
  endsAt?: string;
  status: CertameStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type CertameItem = {
  id: string;
  certameId: string;
  code?: string;
  description: string;
  unit: string;
  contractedQuantity: number;
  unitValue: number;
};

export type CertameMovement = {
  id: string;
  certameId: string;
  itemId: string;
  type: CertameMovementType;
  reservedDelta: number;
  executedDelta: number;
  cancelledDelta: number;
  serviceOrderId?: string;
  userId: string;
  createdAt: string;
  origin: string;
  reason?: string;
  correlationId?: string;
};

export type CertameItemBalance = {
  contractedQuantity: number;
  reservedQuantity: number;
  executedQuantity: number;
  cancelledQuantity: number;
  availableQuantity: number;
  contractedValue: number;
  executedValue: number;
  availableValue: number;
};

export type CertameMovementInput = {
  id: string;
  item: CertameItem;
  type: CertameMovementType;
  quantity: number;
  userId: string;
  origin: string;
  serviceOrderId?: string;
  reason?: string;
  correlationId?: string;
  existingMovements: CertameMovement[];
  allowOverConsumption?: boolean;
};

export class CertameBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertameBalanceError";
  }
}

const precision = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

function assertPositiveQuantity(quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(precision(quantity)) || precision(quantity) <= 0) {
    throw new CertameBalanceError("Informe uma quantidade maior que zero.");
  }
}

export function calculateCertameItemBalance(
  item: CertameItem,
  movements: CertameMovement[],
): CertameItemBalance {
  const related = movements.filter(
    movement => movement.certameId === item.certameId && movement.itemId === item.id,
  );
  const reservedQuantity = precision(related.reduce((total, movement) => total + movement.reservedDelta, 0));
  const executedQuantity = precision(related.reduce((total, movement) => total + movement.executedDelta, 0));
  const cancelledQuantity = precision(related.reduce((total, movement) => total + movement.cancelledDelta, 0));
  const availableQuantity = precision(
    item.contractedQuantity - reservedQuantity - executedQuantity - cancelledQuantity,
  );

  return {
    contractedQuantity: precision(item.contractedQuantity),
    reservedQuantity,
    executedQuantity,
    cancelledQuantity,
    availableQuantity,
    contractedValue: precision(item.contractedQuantity * item.unitValue),
    executedValue: precision(executedQuantity * item.unitValue),
    availableValue: precision(availableQuantity * item.unitValue),
  };
}

export function createCertameMovement(input: CertameMovementInput): CertameMovement {
  assertPositiveQuantity(input.quantity);
  if (!Number.isFinite(input.item.contractedQuantity) || input.item.contractedQuantity < 0
    || !Number.isFinite(input.item.unitValue) || input.item.unitValue < 0
    || !Number.isFinite(precision(input.item.contractedQuantity * input.item.unitValue))) {
    throw new CertameBalanceError("O item do Certame possui quantidade ou valor inválido. Regularize o cadastro antes de movimentar.");
  }
  if (input.existingMovements.some(movement => movement.certameId === input.item.certameId && movement.itemId === input.item.id
    && [movement.reservedDelta, movement.executedDelta, movement.cancelledDelta].some(delta => !Number.isFinite(delta)))) {
    throw new CertameBalanceError("O histórico do item contém uma movimentação numérica inválida. Revise o histórico antes de continuar.");
  }
  if (!["Reserva", "Execução", "Liberação", "Estorno", "Ajuste autorizado"].includes(input.type)) {
    throw new CertameBalanceError("Tipo de movimentação do Certame inválido.");
  }
  // A correlação representa uma operação de negócio (reserva, execução ou liberação)
  // e precisa ser única mesmo se a chamada for repetida por reconexão ou retry.
  assertUniqueMovement(input.existingMovements, { id: input.id, correlationId: input.correlationId });
  const quantity = precision(input.quantity);
  const balance = calculateCertameItemBalance(input.item, input.existingMovements);
  const orderBalance = input.serviceOrderId
    ? calculateCertameItemBalance(input.item, input.existingMovements.filter(movement => movement.serviceOrderId === input.serviceOrderId))
    : balance;

  if ([balance, orderBalance].some(current => [current.reservedQuantity, current.executedQuantity, current.cancelledQuantity, current.availableQuantity, current.availableValue].some(value => !Number.isFinite(value))
    || current.reservedQuantity < 0 || current.executedQuantity < 0 || current.cancelledQuantity < 0)) {
    throw new CertameBalanceError("O saldo do item está inconsistente. Revise o histórico antes de continuar.");
  }

  let reservedDelta = 0;
  let executedDelta = 0;
  let cancelledDelta = 0;

  if (input.type === "Reserva") {
    if (input.allowOverConsumption !== true && quantity > balance.availableQuantity) {
      throw new CertameBalanceError(
        `Saldo do Certame insuficiente. Disponível: ${balance.availableQuantity}.`,
      );
    }
    reservedDelta = quantity;
  }

  if (input.type === "Execução") {
    if (quantity > orderBalance.reservedQuantity) {
      throw new CertameBalanceError("A quantidade executada é maior que a quantidade reservada na OS.");
    }
    reservedDelta = -quantity;
    executedDelta = quantity;
  }

  if (input.type === "Liberação") {
    if (quantity > orderBalance.reservedQuantity) {
      throw new CertameBalanceError("A quantidade liberada é maior que a quantidade reservada na OS.");
    }
    reservedDelta = -quantity;
  }

  if (input.type === "Estorno") {
    if (quantity > orderBalance.executedQuantity) {
      throw new CertameBalanceError("A quantidade estornada é maior que a quantidade executada.");
    }
    executedDelta = -quantity;
  }

  if (input.type === "Ajuste autorizado") {
    if (!input.reason?.trim()) {
      throw new CertameBalanceError("Informe o motivo do ajuste autorizado.");
    }
    if (input.allowOverConsumption !== true && quantity > balance.availableQuantity) {
      throw new CertameBalanceError("O ajuste ultrapassa o saldo disponível do Certame.");
    }
    cancelledDelta = quantity;
  }

  return {
    id: input.id,
    certameId: input.item.certameId,
    itemId: input.item.id,
    type: input.type,
    reservedDelta,
    executedDelta,
    cancelledDelta,
    serviceOrderId: input.serviceOrderId,
    userId: input.userId,
    createdAt: new Date().toISOString(),
    origin: input.origin,
    reason: input.reason,
    correlationId: input.correlationId,
  };
}

export function assertUniqueMovement(
  movements: CertameMovement[],
  candidate: Pick<CertameMovement, "id" | "correlationId">,
) {
  if (typeof candidate.id !== "string" || !candidate.id.trim()) {
    throw new CertameBalanceError("Informe um identificador válido para a movimentação.");
  }
  if (candidate.correlationId !== undefined && (typeof candidate.correlationId !== "string" || !candidate.correlationId.trim())) {
    throw new CertameBalanceError("Informe uma correlação válida para a movimentação.");
  }
  const duplicate = movements.some(movement =>
    movement.id === candidate.id
      || (candidate.correlationId && movement.correlationId === candidate.correlationId),
  );
  if (duplicate) {
    throw new CertameBalanceError("Esta movimentação do Certame já foi registrada.");
  }
}

export type EmpenhoAllocation = {
  id: string;
  empenhoId: string;
  serviceOrderId: string;
  certameItemId?: string;
  quantity?: number;
  unitValue?: number;
  amount: number;
};

export function calculateEmpenhoAllocatedAmount(allocations: EmpenhoAllocation[]) {
  return precision(allocations.reduce((total, allocation) => total + allocation.amount, 0));
}

export function validateEmpenhoAllocations(
  empenhoValue: number,
  allocations: EmpenhoAllocation[],
) {
  if (!Number.isFinite(empenhoValue) || empenhoValue < 0) {
    throw new CertameBalanceError("O valor do Empenho deve ser um número válido e não negativo.");
  }
  if (allocations.some(allocation => !Number.isFinite(allocation.amount) || allocation.amount <= 0)) {
    throw new CertameBalanceError("Todos os vínculos do Empenho devem possuir valor maior que zero.");
  }
  if (allocations.some(allocation => allocation.quantity !== undefined && (!Number.isFinite(allocation.quantity) || allocation.quantity <= 0))) {
    throw new CertameBalanceError("A quantidade vinculada ao item do Certame deve ser maior que zero.");
  }
  if (allocations.some(allocation => allocation.unitValue !== undefined && (!Number.isFinite(allocation.unitValue) || allocation.unitValue < 0))) {
    throw new CertameBalanceError("O valor unitário vinculado ao Empenho deve ser um número válido e não negativo.");
  }
  if (new Set(allocations.map(allocation => allocation.id)).size !== allocations.length) {
    throw new CertameBalanceError("Existem vínculos duplicados neste Empenho.");
  }
  const allocated = calculateEmpenhoAllocatedAmount(allocations);
  if (!Number.isFinite(allocated) || !Number.isFinite(precision(empenhoValue))) {
    throw new CertameBalanceError("Os valores do Empenho excedem a faixa numérica suportada.");
  }
  if (allocated > precision(empenhoValue)) {
    throw new CertameBalanceError("O total vinculado às OS ultrapassa o valor do Empenho.");
  }
  return { allocated, remaining: precision(empenhoValue - allocated) };
}

export function financialOutstandingValue(record: { value?: number; settledValue?: number; status?: string }) {
  if (/^(Paga|Recebida|Cancelada)$/i.test(record.status ?? "")) return 0;
  return Math.max(0, precision((record.value ?? 0) - (record.settledValue ?? 0)));
}

export function financialRealizedValue(record: { value?: number; settledValue?: number; status?: string }) {
  if (record.settledValue !== undefined) return Math.max(0, precision(record.settledValue));
  return /^(Paga|Recebida)$/i.test(record.status ?? "") ? Math.max(0, precision(record.value ?? 0)) : 0;
}
