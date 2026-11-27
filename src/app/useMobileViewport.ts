"use client";

import { useEffect } from "react";
import { mobileViewport } from "@/lib/mobile-viewport";

export function useMobileViewport() {
  useEffect(() => {
    const style = document.documentElement.style;
    const previousHeight = style.getPropertyValue("--app-viewport-height");
    const previousTop = style.getPropertyValue("--app-viewport-top");
    const viewport = window.visualViewport;
    let frame = 0;
    let settling: ReturnType<typeof setTimeout>[] = [];
    const measure = () => {
      const editing = Boolean(document.activeElement?.matches('input:not([type="button"]):not([type="checkbox"]):not([type="radio"]),textarea,select,[contenteditable="true"]'));
      const size = mobileViewport({ innerHeight: window.innerHeight, visualHeight: viewport?.height, offsetTop: viewport?.offsetTop, scale: viewport?.scale, editing });
      if (size) { style.setProperty("--app-viewport-height", `${size.height}px`); style.setProperty("--app-viewport-top", `${size.top}px`); }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const settle = () => { schedule(); for (const timer of settling) clearTimeout(timer); settling = [80, 300, 700].map((delay) => setTimeout(schedule, delay)); };
    const visible = () => { if (document.visibilityState === "visible") settle(); };
    measure();
    window.addEventListener("resize", schedule); window.addEventListener("orientationchange", settle); window.addEventListener("pageshow", settle);
    viewport?.addEventListener("resize", schedule); viewport?.addEventListener("scroll", schedule);
    document.addEventListener("focusin", settle); document.addEventListener("focusout", settle); document.addEventListener("visibilitychange", visible);
    return () => {
      cancelAnimationFrame(frame); for (const timer of settling) clearTimeout(timer);
      window.removeEventListener("resize", schedule); window.removeEventListener("orientationchange", settle); window.removeEventListener("pageshow", settle);
      viewport?.removeEventListener("resize", schedule); viewport?.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", settle); document.removeEventListener("focusout", settle); document.removeEventListener("visibilitychange", visible);
      if (previousHeight) style.setProperty("--app-viewport-height", previousHeight); else style.removeProperty("--app-viewport-height");
      if (previousTop) style.setProperty("--app-viewport-top", previousTop); else style.removeProperty("--app-viewport-top");
    };
  }, []);
}
