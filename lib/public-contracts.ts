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
  if (!Number.isFinite(quantity) || quantity <= 0) {
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
  const quantity = precision(input.quantity);
  const balance = calculateCertameItemBalance(input.item, input.existingMovements);

  let reservedDelta = 0;
  let executedDelta = 0;
  let cancelledDelta = 0;

  if (input.type === "Reserva") {
    if (!input.allowOverConsumption && quantity > balance.availableQuantity) {
      throw new CertameBalanceError(
        `Saldo do Certame insuficiente. Disponível: ${balance.availableQuantity}.`,
      );
    }
    reservedDelta = quantity;
  }

  if (input.type === "Execução") {
    if (quantity > balance.reservedQuantity) {
      throw new CertameBalanceError("A quantidade executada é maior que a quantidade reservada na OS.");
    }
    reservedDelta = -quantity;
    executedDelta = quantity;
  }

  if (input.type === "Liberação") {
    if (quantity > balance.reservedQuantity) {
      throw new CertameBalanceError("A quantidade liberada é maior que a quantidade reservada na OS.");
    }
    reservedDelta = -quantity;
  }

  if (input.type === "Estorno") {
    if (quantity > balance.executedQuantity) {
      throw new CertameBalanceError("A quantidade estornada é maior que a quantidade executada.");
    }
    executedDelta = -quantity;
  }

  if (input.type === "Ajuste autorizado") {
    if (!input.reason?.trim()) {
      throw new CertameBalanceError("Informe o motivo do ajuste autorizado.");
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
  amount: number;
};

export function calculateEmpenhoAllocatedAmount(allocations: EmpenhoAllocation[]) {
  return precision(allocations.reduce((total, allocation) => total + allocation.amount, 0));
}

export function validateEmpenhoAllocations(
  empenhoValue: number,
  allocations: EmpenhoAllocation[],
) {
  if (allocations.some(allocation => !Number.isFinite(allocation.amount) || allocation.amount <= 0)) {
    throw new CertameBalanceError("Todos os vínculos do Empenho devem possuir valor maior que zero.");
  }
  const allocated = calculateEmpenhoAllocatedAmount(allocations);
  if (allocated > precision(empenhoValue)) {
    throw new CertameBalanceError("O total vinculado às OS ultrapassa o valor do Empenho.");
  }
  return { allocated, remaining: precision(empenhoValue - allocated) };
}
