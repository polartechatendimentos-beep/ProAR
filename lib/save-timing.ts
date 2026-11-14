export type SaveTiming = {
  startPhase(): number;
  endPhase(name: string, startedAt: number): void;
  finish<T extends Response>(response: T): T;
};

export function createSaveTiming(route: string): SaveTiming {
  const startedAt = performance.now();
  const phases: Record<string, number> = {};
  const round = (value: number) => Math.round(value * 100) / 100;

  return {
    startPhase: () => performance.now(),
    endPhase(name, phaseStartedAt) {
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
      phases[safeName] = round((phases[safeName] || 0) + performance.now() - phaseStartedAt);
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
        status: response.status,
        duration_ms: durationMs,
        phases_ms: phases,
      }));
      return response;
    },
  };
}
