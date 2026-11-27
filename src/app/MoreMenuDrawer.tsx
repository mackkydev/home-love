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
  return <dialog id="mobile-more-menu" ref={dialog} className={`more-drawer ${closing ? "is-closing" : ""}`} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="more-drawer-content">
      <header className="more-drawer-header"><span className="more-drawer-brand"><Icon name="home" size={24}/></span><div><small>{en ? "Our Home" : "บ้านของเรา"}</small><h2 id={titleId}>{en ? "More menus" : "เมนูเพิ่มเติม"}</h2></div><button type="button" autoFocus className="icon-button" onClick={() => close()} aria-label={en ? "Close menu" : "ปิดเมนู"}><Icon name="close" size={20}/></button></header>
      <nav className="more-drawer-nav" aria-label={en ? "More menus" : "เมนูเพิ่มเติม"}>
        {items.map((item) => <button key={item.id} type="button" aria-current={activeId === item.id ? "page" : undefined} onClick={() => close(() => onNavigate(item.id))}><span className="more-drawer-icon"><Icon name={item.icon} size={22}/></span><span>{item.label}</span><Icon name="chevron" size={17}/></button>)}
      </nav>
    </div>
  </dialog>;
}
