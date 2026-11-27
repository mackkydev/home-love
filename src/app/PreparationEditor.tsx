"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Icon from "./Icon";
import { optionLabel } from "@/lib/dropdown-options";

export type PreparationDraft = { name: string; note: string; dueDate: string };

export default function PreparationEditor({ mode, editing, initial, language, onSave, onCancel }: {
  mode: "list" | "item"; editing: boolean; initial: PreparationDraft; language: "th" | "en";
  onSave: (draft: PreparationDraft) => void; onCancel: () => void;
}) {
  const en = language === "en";
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  const save = (event: FormEvent) => {
    event.preventDefault();
    const name = optionLabel(draft.name);
    if (!name) { setError(en ? "Enter a name" : "กรุณาระบุชื่อรายการ"); return; }
    const date = Date.parse(`${draft.dueDate}T00:00:00Z`);
    if (mode === "list" && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate) || !Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== draft.dueDate)) { setError(en ? "Choose a valid preparation date" : "กรุณาระบุวันที่ต้องเตรียมให้ถูกต้อง"); return; }
    try { onSave({ ...draft, name, note: draft.note.trim() }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : (en ? "Could not save" : "บันทึกไม่สำเร็จ")); }
  };
  return <dialog ref={dialog} className="feature-dialog preparation-editor" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onCancel(); }} onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <form className="feature-card feature-dialog-form" onSubmit={save}>
      <header className="preparation-editor-head"><h2 id={titleId}>{mode === "list" ? editing ? (en ? "Edit checklist" : "แก้ไขชุดรายการ") : (en ? "Add checklist" : "เพิ่มสิ่งที่ต้องเตรียม") : editing ? (en ? "Edit item" : "แก้ไขของที่ต้องเตรียม") : (en ? "Add item" : "เพิ่มของที่ต้องเตรียม")}</h2><button type="button" className="icon-button" onClick={onCancel} aria-label={en ? "Close" : "ปิด"}><Icon name="close" size={19}/></button></header>
      <label className="form-label">{mode === "list" ? (en ? "Checklist name" : "ชื่อชุดรายการ") : (en ? "Item name" : "ชื่อของที่ต้องเตรียม")}<input autoFocus required maxLength={160} value={draft.name} onChange={(event) => { setDraft({ ...draft, name: event.target.value }); setError(""); }} placeholder={mode === "list" ? (en ? "e.g. birthday preparations" : "เช่น เตรียมงานวันเกิด") : (en ? "e.g. documents, spare batteries" : "เช่น เอกสาร ถ่านสำรอง")}/></label>
      {mode === "list" && <label className="form-label">{en ? "Preparation date" : "วันที่ต้องเตรียม"}<span className="preparation-date-field"><input required type="date" value={draft.dueDate} onChange={(event) => { setDraft({ ...draft, dueDate: event.target.value }); setError(""); }}/><Icon name="calendar" size={18}/></span></label>}
      <label className="form-label">{en ? "Details (optional)" : "รายละเอียด (ไม่บังคับ)"}<textarea rows={3} maxLength={600} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder={mode === "item" ? (en ? "Quantity or a short note" : "จำนวนหรือหมายเหตุสั้น ๆ") : ""}/></label>
      {error && <p className="feature-error" role="alert">{error}</p>}
      <div className="feature-actions feature-dialog-actions"><button type="button" className="secondary-button" onClick={onCancel}><Icon name="close" size={16}/>{en ? "Cancel" : "ยกเลิก"}</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>{en ? "Save" : "บันทึก"}</button></div>
    </form>
  </dialog>;
}
