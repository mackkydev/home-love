"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Icon from "./Icon";

type ToastKind = "success" | "error" | "info";
type Notify = (message: string, kind?: ToastKind) => void;
const ToastContext = createContext<Notify>(() => {});
export const useToast = () => useContext(ToastContext);

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; kind: ToastKind } | null>(null);
  const sequence = useRef(0);
  const popover = useRef<HTMLDivElement>(null);
  const notify = useCallback<Notify>((message, kind = "info") => {
    setToast(message ? { id: ++sequence.current, message, kind } : null);
  }, []);
  useEffect(() => {
    if (!toast) return;
    // The top layer keeps feedback visible above native dialogs on Safari too.
    const element = popover.current;
    try { if (element?.showPopover && !element.matches(":popover-open")) element.showPopover(); } catch { /* Fixed positioning is the fallback. */ }
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  return <ToastContext.Provider value={notify}>{children}
    {toast && <div key={toast.id} ref={popover} popover="manual" className={`app-toast app-toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"} aria-live={toast.kind === "error" ? "assertive" : "polite"} aria-atomic="true">
      <span className="app-toast-icon"><Icon name={toast.kind === "success" ? "check" : toast.kind === "error" ? "close" : "bell"} size={19}/></span>
      <span className="app-toast-message">{toast.message}</span>
      <button type="button" onClick={() => setToast(null)} aria-label="ปิด / Dismiss"><Icon name="close" size={16}/></button>
    </div>}
  </ToastContext.Provider>;
}
