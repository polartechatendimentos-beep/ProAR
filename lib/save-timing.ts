export type SaveTiming = {
  startPhase(): number;
  endPhase(name: string, startedAt: number): void;
  setCategory(category: string): void;
  setAttempts(attempts: number): void;
  finish<T extends Response>(response: T): T;
};

export function createSaveTiming(route: string): SaveTiming {
  const startedAt = performance.now();
  const phases: Record<string, number> = {};
  let category = "unspecified";
  let attempts = 0;
  const round = (value: number) => Math.round(value * 100) / 100;

  return {
    startPhase: () => performance.now(),
    endPhase(name, phaseStartedAt) {
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
      phases[safeName] = round((phases[safeName] || 0) + performance.now() - phaseStartedAt);
    },
    setCategory(value) {
      const allowed = new Set(["state_snapshot", "financial", "purchases", "accounts", "inventory", "reconciliation", "approvals", "other"]);
      category = allowed.has(value) ? value : "other";
    },
    setAttempts(value) {
      attempts = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    },
    finish<T extends Response>(response: T): T {
      const durationMs = round(performance.now() - startedAt);
      const timingHeader = [
        ...Object.entries(phases).map(([name, duration]) => `${name};dur=${duration}`),
        `total;dur=${durationMs}`,
      ].join(", ");
      response.headers.set("Server-Timing", timingHeader);
      console.info(JSON.stringify({
        event: "proar.save_timing",
        route,
        category,
        attempts,
        status: response.status,
        duration_ms: durationMs,
        phases_ms: phases,
      }));
      return response;
    },
  };
}
