type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
};

export function writeLocalSnapshot(entries: Array<[string, unknown]>, immediate = false) {
  const write = () => {
    for (const [key, value] of entries) {
      try {
        localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      } catch (error) {
        console.warn("ProAR local snapshot write failed", key, error);
      }
    }
  };

  if (immediate || typeof window === "undefined") {
    write();
    return;
  }

  const idleWindow = window as IdleWindow;
  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(write, { timeout: 1200 });
  } else {
    window.setTimeout(write, 0);
  }
}
