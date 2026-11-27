"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { resumeStartup, startupRemaining, STARTUP_DURATION_MS, UPDATE_RESUME_KEY } from "@/lib/app-updates";
import StartupSplash from "./StartupSplash";
import { useAppUpdates } from "./useAppUpdates";

type StartupContext = { setPending: (id: string, pending: boolean) => void; setLanguage: (language: "th" | "en") => void; updateReady: boolean; openUpdate: () => void };
const Context = createContext<StartupContext | null>(null);
export { STARTUP_DURATION_MS };

export function useAppStartup() { return useContext(Context); }

export function useStartupLoading(pending: boolean, language?: "th" | "en") {
  const id = useId();
  const startup = useAppStartup();
  const setPending = startup?.setPending;
  const setLanguage = startup?.setLanguage;
  useEffect(() => { setPending?.(id, pending); return () => setPending?.(id, false); }, [id, pending, setPending]);
  useEffect(() => { if (language) setLanguage?.(language); }, [language, setLanguage]);
}

export default function AppStartupGate({ children }: { children: React.ReactNode }) {
  const [minimumDone, setMinimumDone] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [language, setLanguage] = useState<"th" | "en">("th");
  const [blockers, setBlockers] = useState<Set<string>>(() => new Set());
  const [entered, setEntered] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const cycle = useRef<number | null>(null);
  const updates = useAppUpdates();
  const setPending = useCallback((id: string, pending: boolean) => {
    setBlockers((previous) => {
      if (previous.has(id) === pending) return previous;
      const next = new Set(previous); if (pending) next.add(id); else next.delete(id); return next;
    });
  }, []);
  useEffect(() => {
    if (cycle.current === null) {
      let resumed: number | null = null;
      try { resumed = resumeStartup(sessionStorage.getItem(UPDATE_RESUME_KEY), Date.now()); sessionStorage.removeItem(UPDATE_RESUME_KEY); } catch { /* Continue normally without session storage. */ }
      cycle.current = resumed ?? Date.now();
    }
    const start = cycle.current;
    const init = setTimeout(() => setStartedAt(start), 0);
    const timer = setTimeout(() => setMinimumDone(true), startupRemaining(start, Date.now()));
    return () => { clearTimeout(init); clearTimeout(timer); };
  }, []);
  const initialUpdate = !entered && updates.ready && !deferred;
  const loading = !minimumDone || !updates.checked || blockers.size > 0;
  const visible = (!entered && loading) || blockers.size > 0 || initialUpdate || showUpdate || updates.updating;
  useEffect(() => {
    if (visible || entered) return;
    const timer = setTimeout(() => setEntered(true), 0);
    return () => clearTimeout(timer);
  }, [visible, entered]);
  const openUpdate = useCallback(() => setShowUpdate(true), []);
  const context = useMemo(() => ({ setPending, setLanguage, updateReady: updates.ready, openUpdate }), [setPending, updates.ready, openUpdate]);
  const closeUpdate = () => { setDeferred(true); setShowUpdate(false); };
  return <Context.Provider value={context}>
    <div className="app-runtime" aria-hidden={visible || undefined} inert={visible || undefined}>{children}</div>
    {visible && <StartupSplash language={language} durationMs={STARTUP_DURATION_MS} startedAt={startedAt}
      updating={updates.updating} updateReady={initialUpdate || showUpdate} updateError={(initialUpdate || showUpdate) && updates.error}
      onUpdate={() => updates.apply(startedAt || Date.now())} onContinue={closeUpdate}/>}
  </Context.Provider>;
}
