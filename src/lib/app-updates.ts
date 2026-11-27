export const STARTUP_DURATION_MS = 3000;
export const UPDATE_RESUME_KEY = "home-love-update-started-at";

export function startupRemaining(startedAt: number, now: number): number {
  return Math.max(0, STARTUP_DURATION_MS - Math.max(0, now - startedAt));
}

export function resumeStartup(value: string | null, now: number): number | null {
  const startedAt = Number(value);
  return value && Number.isFinite(startedAt) && startedAt > 0 && startedAt <= now && now - startedAt < 60_000 ? startedAt : null;
}

export function watchAppUpdates({ serviceWorker, onReady, onChecked, beforeReload, reload }: {
  serviceWorker: ServiceWorkerContainer;
  onReady: (ready: boolean) => void;
  onChecked: () => void;
  beforeReload: () => void;
  reload: () => void;
}) {
  let registration: ServiceWorkerRegistration | undefined;
  let offered: ServiceWorker | null = null;
  let disposed = false, applying = false, reloaded = false;
  let checking: Promise<void> | undefined;
  const cleanups: (() => void)[] = [];
  const watched = new Set<ServiceWorker>();
  const inspect = (worker: ServiceWorker | null) => {
    if (!worker || disposed) return;
    if (worker.state === "installed" && serviceWorker.controller) { offered = worker; onReady(true); }
    if (worker.state === "redundant" && offered === worker) { offered = null; onReady(false); }
  };
  const watch = (worker: ServiceWorker | null) => {
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    const change = () => { if (disposed) return; inspect(worker); if (worker.state === "installed" || worker.state === "redundant") onChecked(); };
    worker.addEventListener("statechange", change);
    cleanups.push(() => worker.removeEventListener("statechange", change));
    inspect(worker);
  };
  const controllerChanged = () => {
    if (!applying || reloaded || disposed) return;
    reloaded = true;
    beforeReload(); reload();
  };
  serviceWorker.addEventListener("controllerchange", controllerChanged);
  const check = () => {
    if (disposed || !registration) return Promise.resolve();
    if (checking) return checking;
    checking = registration.update().then(() => {
      if (disposed) return;
      watch(registration?.installing ?? null); inspect(registration?.waiting ?? null);
      if (!registration?.installing) onChecked();
    }).catch(() => { if (!disposed) onChecked(); }).finally(() => { checking = undefined; });
    return checking;
  };
  void serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((result) => {
    if (disposed) return;
    registration = result;
    const found = () => watch(result.installing);
    result.addEventListener("updatefound", found);
    cleanups.push(() => result.removeEventListener("updatefound", found));
    watch(result.installing); inspect(result.waiting);
    return check();
  }).catch(() => { if (!disposed) onChecked(); });
  return {
    check,
    apply: () => {
      const worker = registration?.waiting ?? offered;
      if (disposed || applying || !worker) return false;
      if (worker.state === "activated" && serviceWorker.controller === worker) {
        applying = true; controllerChanged(); return true;
      }
      if (worker.state !== "installed") return false;
      applying = true;
      try { worker.postMessage({ type: "SKIP_WAITING" }); return true; }
      catch { applying = false; return false; }
    },
    cancelApply: () => { applying = false; },
    dispose: () => {
      disposed = true;
      serviceWorker.removeEventListener("controllerchange", controllerChanged);
      for (const cleanup of cleanups) cleanup();
    },
  };
}
