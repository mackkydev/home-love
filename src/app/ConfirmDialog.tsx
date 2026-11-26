"use client";

import { useEffect, useId, useRef } from "react";
import Icon from "./Icon";

export default function ConfirmDialog({ title, children, confirmLabel, cancelLabel, onConfirm, onCancel, busy = false }: {
  title: string; children: React.ReactNode; confirmLabel: string; cancelLabel: string;
  onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="confirm-dialog" role="alertdialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="confirm-dialog-card">
      <span className="confirm-icon"><Icon name="trash" size={24}/></span>
      <h2 id={titleId}>{title}</h2>
      <div id={descriptionId} className="confirm-dialog-description">{children}</div>
      <div className="modal-actions">
        <button type="button" autoFocus className="secondary-button" disabled={busy} onClick={onCancel}><Icon name="close" size={16}/>{cancelLabel}</button>
        <button type="button" className="danger-button" disabled={busy} onClick={onConfirm}><Icon name="trash" size={16}/>{confirmLabel}</button>
      </div>
    </section>
  </dialog>;
}
