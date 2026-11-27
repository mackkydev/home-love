"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dropdownStorageKey, emptyDropdownOptions, parseDropdownOptions, uniqueOptions, type DropdownGroup, type DropdownOptions } from "@/lib/dropdown-options";

type Value = { options: DropdownOptions; remember: (group: DropdownGroup, value: string) => void };
const Context = createContext<Value | null>(null);

// Saved records sync through the household as usual; draft additions stay on this device.
export default function DropdownOptionsProvider({ scope, saved, children }: { scope: string; saved: DropdownOptions; children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<DropdownOptions>(() => {
    if (typeof window === "undefined") return emptyDropdownOptions();
    try { return parseDropdownOptions(localStorage.getItem(dropdownStorageKey(scope))); } catch { return emptyDropdownOptions(); }
  });
  useEffect(() => { try { localStorage.setItem(dropdownStorageKey(scope), JSON.stringify(drafts)); } catch { /* Selection still works when storage is full or disabled. */ } }, [scope, drafts]);
  const remember = useCallback((group: DropdownGroup, value: string) => {
    setDrafts((current) => ({ ...current, [group]: uniqueOptions([...current[group], value]).slice(-200) }));
  }, []);
  const options = useMemo(() => ({
    people: uniqueOptions([...saved.people, ...drafts.people]), stores: uniqueOptions([...saved.stores, ...drafts.stores]),
    units: uniqueOptions([...saved.units, ...drafts.units]), products: uniqueOptions([...saved.products, ...drafts.products]),
  }), [saved, drafts]);
  const context = useMemo(() => ({ options, remember }), [options, remember]);
  return <Context.Provider value={context}>{children}</Context.Provider>;
}

export function useDropdownOptions(group?: DropdownGroup) {
  const context = useContext(Context);
  return { options: group ? context?.options[group] ?? [] : [], remember: (value: string) => { if (group) context?.remember(group, value); } };
}
