"use client";

import { useEffect, useState } from "react";
import StartupSplash from "./StartupSplash";

export const STARTUP_DURATION_MS = 3000;

export default function AppStartupGate({ children }: { children: React.ReactNode }) {
  const [showIntro, setShowIntro] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), STARTUP_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);
  return <>
    <div className="app-runtime" aria-hidden={showIntro || undefined} inert={showIntro || undefined}>{children}</div>
    {showIntro && <StartupSplash durationMs={STARTUP_DURATION_MS}/>}
  </>;
}
