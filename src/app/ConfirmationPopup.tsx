"use client";

import { useEffect, useRef } from "react";

export default function ConfirmationPopup({ children, onCancel, labelledBy }: {
  children: React.ReactNode; onCancel: () => void; labelledBy: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="confirmation-popup" aria-labelledby={labelledBy}
    onCancel={(event) => { event.preventDefault(); onCancel(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>{children}</dialog>;
}
