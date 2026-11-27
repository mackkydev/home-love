"use client";

import { useEffect, useRef, useState } from "react";
import { STARTUP_DURATION_MS, UPDATE_RESUME_KEY, watchAppUpdates } from "@/lib/app-updates";

export function useAppUpdates() {
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(false);
  const watcher = useRef<ReturnType<typeof watchAppUpdates> | null>(null);
  const startedAt = useRef(0);
  const applyTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const initialTimeout = setTimeout(() => setChecked(true), 5000);
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      clearTimeout(initialTimeout);
      const unsupported = setTimeout(() => setChecked(true), 0);
      return () => clearTimeout(unsupported);
    }
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((items) => Promise.all(items.map((item) => item.unregister()))).catch(() => undefined);
      void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => undefined);
      clearTimeout(initialTimeout);
      const development = setTimeout(() => setChecked(true), 0);
      return () => clearTimeout(development);
    }
    const manager = watchAppUpdates({
      serviceWorker: navigator.serviceWorker,
      onReady: setReady,
      onChecked: () => { clearTimeout(initialTimeout); setChecked(true); },
      beforeReload: () => { try { sessionStorage.setItem(UPDATE_RESUME_KEY, String(Math.max(startedAt.current || Date.now(), Date.now() - STARTUP_DURATION_MS))); } catch { /* Storage can be disabled. */ } },
      reload: () => window.location.reload(),
    });
    watcher.current = manager;
    const check = () => { void manager.check(); };
    const visible = () => { if (document.visibilityState === "visible") check(); };
    const interval = setInterval(check, 5 * 60_000);
    window.addEventListener("focus", check); window.addEventListener("online", check);
    document.addEventListener("visibilitychange", visible);
    return () => {
      manager.dispose(); watcher.current = null;
      clearInterval(interval); clearTimeout(initialTimeout); clearTimeout(applyTimeout.current);
      window.removeEventListener("focus", check); window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  const apply = (cycleStartedAt: number) => {
    if (updating) return;
    startedAt.current = cycleStartedAt;
    setError(false); setUpdating(true);
    if (!watcher.current?.apply()) { setUpdating(false); setError(true); return; }
    applyTimeout.current = setTimeout(() => { watcher.current?.cancelApply(); setUpdating(false); setError(true); }, 15_000);
  };
  return { ready, checked, updating, error, apply };
}
