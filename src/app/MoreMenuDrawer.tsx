"use client";

import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";

export default function MoreMenuDrawer({ items, activeId, language, onNavigate, onClose }: {
  items: { id: string; label: string; icon: string }[]; activeId: string; language: "th" | "en";
  onNavigate: (id: string) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  const titleId = useId();
  const en = language === "en";
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { clearTimeout(timer.current); element?.close(); };
  }, []);
  const close = (action = onClose) => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(action, 200);
  };
  return <dialog id="mobile-more-menu" ref={dialog} tabIndex={-1} autoFocus className={`more-menu-popover ${closing ? "is-closing" : ""}`} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <h2 id={titleId} className="visually-hidden">{en ? "More menus" : "เมนูเพิ่มเติม"}</h2>
    <nav className="mobile-more-menu" aria-label={en ? "More menus" : "เมนูเพิ่มเติม"}>
      {items.map((item) => <button key={item.id} type="button" aria-current={activeId === item.id ? "page" : undefined} onClick={() => close(() => onNavigate(item.id))}><Icon name={item.icon} size={20}/><span>{item.label}</span></button>)}
    </nav>
  </dialog>;
}
