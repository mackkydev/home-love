"use client";

import { useEffect, useMemo, useRef } from "react";
import { travelDays } from "@/lib/travel-days";

export default function TripDateTabs({ start, end, value, language, id, onChange }: {
  start: string; end: string; value: string; language: "th" | "en"; id: string; onChange: (date: string) => void;
}) {
  const dates = useMemo(() => travelDays(start, end), [start, end]);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scroller.current;
    const selected = container?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    if (!container || !selected) return;
    const left = selected.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft - (container.clientWidth - selected.offsetWidth) / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }, [value, start, end]);
  return <div ref={scroller} className="travel-date-tabs" role="tablist" aria-label={language === "en" ? "Trip dates" : "วันเดินทาง"}>
    {dates.map((date, index) => <button key={date} id={`${id}-${date}`} type="button" role="tab" aria-selected={value === date} aria-controls={`${id}-panel`} tabIndex={value === date ? 0 : -1} onClick={() => onChange(date)} onKeyDown={(event) => {
      const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? dates.length - 1 : -1;
      if (next < 0 || next >= dates.length) return;
      event.preventDefault(); onChange(dates[next]); scroller.current?.querySelector<HTMLButtonElement>(`[id="${id}-${dates[next]}"]`)?.focus({ preventScroll: true });
    }}><small>{new Date(`${date}T00:00:00`).toLocaleDateString(language === "en" ? "en-GB" : "th-TH", { weekday: "short" })}</small><strong>{new Date(`${date}T00:00:00`).toLocaleDateString(language === "en" ? "en-GB" : "th-TH", { day: "numeric", month: "short", year: "numeric" })}</strong></button>)}
  </div>;
}
