"use client";

import { useRef, useState } from "react";
import Icon from "./Icon";
import ConfirmDialog from "./ConfirmDialog";
import { isPreparationRecord, preparationCategory, preparationCounts, togglePreparation, type PreparationInfo, type PreparationRecord } from "@/lib/preparations";
import { optionKey, optionLabel } from "@/lib/dropdown-options";

export default function PreparationsPage({ entries, language, today, onSave, onRemove }: {
  entries: { kind: string; preparation?: PreparationInfo }[];
  language: "th" | "en"; today: string;
  onSave: (entry: PreparationRecord) => void; onRemove: (entry: PreparationRecord) => void;
}) {
  const en = language === "en";
  const records = entries.filter(isPreparationRecord);
  const counts = preparationCounts(records);
  const [filter, setFilter] = useState<"pending" | "completed" | "all">("pending");
  const [editing, setEditing] = useState<PreparationRecord | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<PreparationRecord | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const reset = () => { setEditing(null); setName(""); setNote(""); setError(""); };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const label = optionLabel(name);
    if (!label) { setError(en ? "Enter an item name" : "กรุณาใส่ชื่อสิ่งที่ต้องเตรียม"); return; }
    if (records.some((entry) => entry.id !== editing?.id && optionKey(entry.name) === optionKey(label))) { setError(en ? "This item is already on the checklist" : "มีชื่อนี้อยู่ในเช็กลิสต์แล้ว"); return; }
    onSave({ id: editing?.id ?? crypto.randomUUID(), name: label, category: preparationCategory, kind: "preparation", date: editing?.date ?? today, actor: editing?.actor ?? "คุณ", preparation: { ...editing?.preparation, note: note.trim() || undefined } });
    reset(); if (!editing) setFilter("pending");
  };
  const visible = records.filter((entry) => filter === "all" || (filter === "completed") === Boolean(entry.preparation.completedAt));
  return <section className="feature-page preparations-page">
    <header className="feature-heading"><div><h1>{en ? "Things to prepare" : preparationCategory}</h1><p>{en ? "A shared checklist for your household" : "เช็กลิสต์ของบ้าน ติ๊กเมื่อเตรียมพร้อมแล้ว"}</p></div><span className="preparation-summary">{counts.completed}/{counts.total} {en ? "ready" : "พร้อมแล้ว"}</span></header>
    <form className="feature-card preparation-form" onSubmit={save}>
      <label className="form-label">{editing ? (en ? "Edit item" : "แก้ไขรายการ") : (en ? "Add to your checklist" : "เพิ่มสิ่งที่ต้องเตรียม")}<input ref={nameInput} value={name} onChange={(event) => { setName(event.target.value); setError(""); }} required maxLength={160} placeholder={en ? "e.g. documents, spare batteries" : "เช่น เอกสาร ถ่านสำรอง"}/></label>
      <label className="form-label">{en ? "Details (optional)" : "รายละเอียด (ไม่บังคับ)"}<input value={note} onChange={(event) => setNote(event.target.value)} maxLength={600} placeholder={en ? "Quantity or a short note" : "จำนวนหรือหมายเหตุสั้น ๆ"}/></label>
      {error && <p className="feature-error" role="alert">{error}</p>}
      <div className="feature-actions"><button type="submit" className="primary-button"><Icon name={editing ? "check" : "plus"} size={17}/>{editing ? (en ? "Save changes" : "บันทึกการแก้ไข") : (en ? "Add item" : "เพิ่มรายการ")}</button>{editing && <button type="button" className="secondary-button" onClick={reset}><Icon name="close" size={17}/>{en ? "Cancel" : "ยกเลิก"}</button>}</div>
    </form>
    <div className="preparation-tabs" role="group" aria-label={en ? "Checklist status" : "สถานะเช็กลิสต์"}>{(["pending", "completed", "all"] as const).map((value) => <button type="button" aria-pressed={filter === value} key={value} onClick={() => setFilter(value)}>{value === "pending" ? (en ? "To prepare" : "ยังไม่พร้อม") : value === "completed" ? (en ? "Ready" : "พร้อมแล้ว") : (en ? "All" : "ทั้งหมด")}<span>{counts[value === "all" ? "total" : value]}</span></button>)}</div>
    {visible.length ? <ul className="preparation-list">{visible.map((entry) => <li className={`feature-card preparation-row ${entry.preparation.completedAt ? "is-complete" : ""}`} key={entry.id}>
      <button type="button" className="preparation-check" role="checkbox" aria-checked={Boolean(entry.preparation.completedAt)} aria-label={`${en ? "Ready" : "เตรียมพร้อม"}: ${entry.name}`} onClick={() => onSave(togglePreparation(entry, new Date().toISOString()))}><Icon name={entry.preparation.completedAt ? "check-circle" : "circle"} size={25}/></button>
      <div><strong>{entry.name}</strong>{entry.preparation.note && <p>{entry.preparation.note}</p>}</div>
      <div className="preparation-row-actions"><button type="button" className="icon-button" aria-label={`${en ? "Edit" : "แก้ไข"} ${entry.name}`} onClick={() => { setEditing(entry); setName(entry.name); setNote(entry.preparation.note ?? ""); setError(""); nameInput.current?.focus(); }}><Icon name="edit" size={18}/></button><button type="button" className="icon-button" aria-label={`${en ? "Delete" : "ลบ"} ${entry.name}`} onClick={() => setRemoving(entry)}><Icon name="trash" size={18}/></button></div>
    </li>)}</ul> : <p className="feature-card preparation-empty"><Icon name="checklist" size={28}/>{en ? "No items in this list" : "ยังไม่มีรายการในหมวดนี้"}</p>}
    {removing && <ConfirmDialog title={en ? "Delete checklist item?" : "ลบสิ่งที่ต้องเตรียม?"} confirmLabel={en ? "Delete" : "ลบรายการ"} cancelLabel={en ? "Cancel" : "ยกเลิก"} onCancel={() => setRemoving(null)} onConfirm={() => { onRemove(removing); if (editing?.id === removing.id) reset(); setRemoving(null); }}><p>{removing.name}</p></ConfirmDialog>}
  </section>;
}
