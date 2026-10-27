export type DatabaseRetryPolicy = {
  attempts?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  retryStatuses?: number[];
};

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];

export function requestMethod(init: RequestInit = {}) {
  return String(init.method || "GET").toUpperCase();
}

export function isReadOnlyRequest(init: RequestInit = {}) {
  return ["GET", "HEAD", "OPTIONS"].includes(requestMethod(init));
}

export function isRetryableDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /timeout|timed out|abort|fetch failed|econnreset|econnrefused|connection.*closed|connection.*terminated|socket hang up/i.test(message);
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function retryDatabaseOperation<T>(
  operation: (attempt: number) => Promise<T>,
  options: DatabaseRetryPolicy & { enabled?: boolean; shouldRetryResult?: (value: T) => boolean } = {},
) {
  const enabled = options.enabled !== false;
  const attempts = enabled ? Math.max(1, Math.min(4, options.attempts ?? 3)) : 1;
  const baseDelayMs = Math.max(25, Math.min(1500, options.baseDelayMs ?? 120));
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const value = await operation(attempt);
      if (!options.shouldRetryResult?.(value) || attempt === attempts) return value;
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isRetryableDatabaseError(error)) throw error;
    }
    await delay(baseDelayMs * attempt);
  }
  throw lastError instanceof Error ? lastError : new Error("Falha de conexão com o banco.");
}

export async function resilientDatabaseFetch(
  input: string | URL,
  init: RequestInit = {},
  policy: DatabaseRetryPolicy = {},
): Promise<Response> {
  const retryStatuses = policy.retryStatuses ?? DEFAULT_RETRY_STATUSES;
  const safe = isReadOnlyRequest(init);
  const timeoutMs = Math.max(1000, Math.min(15000, policy.timeoutMs ?? 6500));

  return retryDatabaseOperation(async () => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal });
  }, {
    ...policy,
    enabled: safe,
    shouldRetryResult: response => safe && retryStatuses.includes(response.status),
  });
}

export type DatabaseProbe = {
  ok: boolean;
  latencyMs: number;
  status?: number;
  attempts: number;
  checkedAt: string;
  detail: string;
};

export async function probeDatabase(operation: () => Promise<Response>): Promise<DatabaseProbe> {
  const started = Date.now();
  let attempts = 0;
  try {
    const response = await retryDatabaseOperation(async attempt => {
      attempts = attempt;
      return operation();
    }, {
      attempts: 3,
      baseDelayMs: 120,
      shouldRetryResult: response => [408, 425, 429, 500, 502, 503, 504].includes(response.status),
    });
    return {
      ok: response.ok,
      latencyMs: Date.now() - started,
      status: response.status,
      attempts,
      checkedAt: new Date().toISOString(),
      detail: response.ok ? "Banco respondeu ao health check." : `Banco respondeu HTTP ${response.status}.`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      attempts: Math.max(attempts, 1),
      checkedAt: new Date().toISOString(),
      detail: error instanceof Error ? error.message : "Falha ao consultar o banco.",
    };
  }
}
