"use client";

import { useState } from "react";
import Icon from "./Icon";
import ConfirmDialog from "./ConfirmDialog";
import { isPreparationRecord, preparationCategory, preparationCounts, preparationItems, preparationLists, preparationTitle, togglePreparation, withoutLegacyPreparationItem, type PreparationInfo, type PreparationRecord } from "@/lib/preparations";
import { optionKey } from "@/lib/dropdown-options";
import PreparationEditor, { type PreparationDraft } from "./PreparationEditor";

export default function PreparationsPage({ entries, language, today, onSave, onRemove, onRemoveList }: {
  entries: { kind: string; preparation?: PreparationInfo }[];
  language: "th" | "en"; today: string;
  onSave: (entry: PreparationRecord) => void; onRemove: (entry: PreparationRecord) => void;
  onRemoveList: (entry: PreparationRecord) => void;
}) {
  const en = language === "en";
  const records = entries.filter(isPreparationRecord);
  const lists = preparationLists(records).sort((a, b) => (a.preparation.dueDate || "9999").localeCompare(b.preparation.dueDate || "9999"));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = lists.find((entry) => entry.id === selectedId);
  const items = list ? preparationItems(records, list) : [];
  const counts = preparationCounts(items);
  const [filter, setFilter] = useState<"pending" | "completed" | "all">("pending");
  const [editor, setEditor] = useState<{ mode: "list" | "item"; entry?: PreparationRecord } | null>(null);
  const [removing, setRemoving] = useState<{ mode: "list" | "item"; entry: PreparationRecord } | null>(null);
  const dateText = (date?: string) => date ? new Date(`${date}T00:00:00`).toLocaleDateString(en ? "en-GB" : "th-TH", { day: "numeric", month: "short", year: "numeric" }) : (en ? "No date set" : "ยังไม่ระบุวันที่");
  const save = (draft: PreparationDraft) => {
    if (!editor) return;
    const original = editor.entry ? records.find((entry) => entry.id === editor.entry?.id) : undefined;
    if (editor.entry && !original) throw new Error(en ? "This record was removed. Close and reopen the list." : "รายการนี้ถูกลบแล้ว กรุณาปิดและเปิดรายการใหม่");
    if (editor.mode === "list") {
      if (lists.some((entry) => entry.id !== original?.id && optionKey(preparationTitle(entry)) === optionKey(draft.name) && entry.preparation.dueDate === draft.dueDate)) throw new Error(en ? "This checklist and date already exist" : "มีชุดชื่อนี้และวันที่นี้แล้ว");
      const updated: PreparationRecord = original ? { ...original, name: original.preparation.type === "list" ? draft.name : original.name, preparation: { ...original.preparation, title: original.preparation.type === "list" ? undefined : draft.name, dueDate: draft.dueDate, description: draft.note || undefined } }
        : { id: crypto.randomUUID(), name: draft.name, category: preparationCategory, kind: "preparation", date: today, actor: "คุณ", preparation: { type: "list", dueDate: draft.dueDate, description: draft.note || undefined } };
      onSave(updated); if (!original) { setSelectedId(updated.id); setFilter("pending"); }
    } else {
      if (!list) throw new Error(en ? "This checklist was removed" : "ชุดรายการนี้ถูกลบแล้ว");
      if (original && !items.some((entry) => entry.id === original.id)) throw new Error(en ? "This item is no longer in this checklist" : "ของรายการนี้ไม่ได้อยู่ในชุดนี้แล้ว กรุณาปิดและเปิดรายการใหม่");
      if (items.some((entry) => entry.id !== original?.id && optionKey(entry.name) === optionKey(draft.name))) throw new Error(en ? "This item is already in this checklist" : "มีของชื่อนี้อยู่ในชุดรายการแล้ว");
      const updated: PreparationRecord = original ? { ...original, name: draft.name, preparation: { ...original.preparation, note: draft.note || undefined, ...(original.id === list.id ? { title: preparationTitle(list) } : {}) } }
        : { id: crypto.randomUUID(), name: draft.name, category: preparationCategory, kind: "preparation", date: today, actor: "คุณ", preparation: { listId: list.id, note: draft.note || undefined } };
      onSave(updated); if (!original) setFilter("pending");
    }
    setEditor(null);
  };
  const remove = () => {
    if (!removing) return;
    if (removing.mode === "list") { onRemoveList(removing.entry); if (selectedId === removing.entry.id) setSelectedId(null); }
    else if (list && removing.entry.id === list.id) {
      // Remove the item in a legacy flat list while retaining its list and newer children.
      onSave(withoutLegacyPreparationItem(list));
    } else onRemove(removing.entry);
    setRemoving(null);
  };
  const visible = items.filter((entry) => filter === "all" || (filter === "completed") === Boolean(entry.preparation.completedAt));
  const initial: PreparationDraft = { name: editor?.entry ? editor.mode === "list" ? preparationTitle(editor.entry) : editor.entry.name : "", note: editor?.entry ? editor.mode === "list" ? editor.entry.preparation.description ?? "" : editor.entry.preparation.note ?? "" : "", dueDate: editor?.entry?.preparation.dueDate ?? today };
  return <section className="feature-page preparations-page">
    {list && <button type="button" className="secondary-button preparation-back" onClick={() => { setSelectedId(null); setEditor(null); }}><Icon name="back" size={17}/>{en ? "All checklists" : "ชุดรายการทั้งหมด"}</button>}
    <header className="feature-heading"><div><h1>{list ? preparationTitle(list) : en ? "Things to prepare" : preparationCategory}</h1><p>{list ? <><Icon name="calendar" size={15}/>{dateText(list.preparation.dueDate)}</> : en ? "Checklists and preparation dates for your household" : "ชุดรายการและวันที่ต้องเตรียมของบ้าน"}</p></div><button type="button" className="primary-button" onClick={() => setEditor({ mode: list ? "item" : "list" })}><Icon name="plus" size={17}/>{list ? (en ? "Add item" : "เพิ่มของ") : (en ? "Add checklist" : "เพิ่มรายการ")}</button></header>
    {editor && <PreparationEditor key={`${editor.mode}:${editor.entry?.id ?? "new"}`} mode={editor.mode} editing={Boolean(editor.entry)} initial={initial} language={language} onSave={save} onCancel={() => setEditor(null)}/>}
    {!list ? lists.length ? <ol className="preparation-group-list">{lists.map((group, index) => {
      const progress = preparationCounts(preparationItems(records, group));
      return <li className="feature-card preparation-group-row" key={group.id}>
        <span className="preparation-number">{index + 1}</span><button type="button" className="preparation-group-open" onClick={() => { setSelectedId(group.id); setFilter("pending"); }}><span><strong>{preparationTitle(group)}</strong><small><Icon name="calendar" size={14}/>{dateText(group.preparation.dueDate)}</small><small>{progress.completed}/{progress.total} {en ? "ready" : "พร้อมแล้ว"}</small></span><Icon name="chevron" size={18}/></button>
        <div className="preparation-row-actions"><button type="button" className="icon-button" aria-label={`${en ? "Edit" : "แก้ไข"} ${preparationTitle(group)}`} onClick={() => setEditor({ mode: "list", entry: group })}><Icon name="edit" size={17}/></button><button type="button" className="icon-button" aria-label={`${en ? "Delete checklist" : "ลบชุดรายการ"} ${preparationTitle(group)}`} onClick={() => setRemoving({ mode: "list", entry: group })}><Icon name="trash" size={17}/></button></div>
      </li>;
    })}</ol> : <p className="feature-card preparation-empty"><Icon name="checklist" size={28}/>{en ? "Add a checklist to get started" : "เพิ่มชุดรายการและวันที่ต้องเตรียมได้เลย"}</p> : <>
    <div className="preparation-detail-tools"><span className="preparation-summary">{counts.completed}/{counts.total} {en ? "ready" : "พร้อมแล้ว"}</span><button type="button" className="secondary-button" onClick={() => setEditor({ mode: "list", entry: list })}><Icon name="edit" size={16}/>{en ? "Edit checklist" : "แก้ไขชุดรายการ"}</button></div>
    {list.preparation.description && <p className="preparation-description">{list.preparation.description}</p>}
    <div className="preparation-tabs" role="group" aria-label={en ? "Checklist status" : "สถานะเช็กลิสต์"}>{(["pending", "completed", "all"] as const).map((value) => <button type="button" aria-pressed={filter === value} key={value} onClick={() => setFilter(value)}>{value === "pending" ? (en ? "To prepare" : "ยังไม่พร้อม") : value === "completed" ? (en ? "Ready" : "พร้อมแล้ว") : (en ? "All" : "ทั้งหมด")}<span>{counts[value === "all" ? "total" : value]}</span></button>)}</div>
    {visible.length ? <ul className="preparation-list">{visible.map((entry) => <li className={`feature-card preparation-row preparation-item-row ${entry.preparation.completedAt ? "is-complete" : ""}`} key={entry.id}>
      {entry.preparation.completedAt ? <span className="preparation-ready"><Icon name="check-circle" size={16}/>{en ? "Packed" : "จัดแล้ว"}</span> : <button type="button" className="preparation-mark-ready" aria-label={`${en ? "Mark ready" : "เตรียมแล้ว"}: ${entry.name}`} onClick={() => onSave(togglePreparation(entry, new Date().toISOString()))}><Icon name="check" size={16}/>{en ? "Ready" : "เตรียมแล้ว"}</button>}
      <div><strong>{entry.name}</strong>{entry.preparation.note && <p>{entry.preparation.note}</p>}</div>
      <div className="preparation-row-actions">{entry.preparation.completedAt && <button type="button" className="icon-button" aria-label={`${en ? "Mark not ready" : "ย้ายกลับยังไม่พร้อม"}: ${entry.name}`} onClick={() => onSave(togglePreparation(entry, new Date().toISOString()))}><Icon name="undo" size={17}/></button>}<button type="button" className="icon-button" aria-label={`${en ? "Edit" : "แก้ไข"} ${entry.name}`} onClick={() => setEditor({ mode: "item", entry })}><Icon name="edit" size={17}/></button><button type="button" className="icon-button" aria-label={`${en ? "Delete" : "ลบ"} ${entry.name}`} onClick={() => setRemoving({ mode: "item", entry })}><Icon name="trash" size={17}/></button></div>
    </li>)}</ul> : <p className="feature-card preparation-empty"><Icon name="checklist" size={28}/>{en ? "No items in this list" : "ยังไม่มีรายการในหมวดนี้"}</p>}
    </>}
    {removing && <ConfirmDialog title={removing.mode === "list" ? (en ? "Delete this checklist?" : "ลบชุดรายการนี้?") : (en ? "Delete this item?" : "ลบของที่ต้องเตรียม?")} confirmLabel={en ? "Delete" : "ลบรายการ"} cancelLabel={en ? "Cancel" : "ยกเลิก"} onCancel={() => setRemoving(null)} onConfirm={remove}><p>{removing.mode === "list" ? preparationTitle(removing.entry) : removing.entry.name}</p>{removing.mode === "list" && <p>{en ? "All items in this checklist will also be removed." : "รายการของที่ต้องเตรียมทั้งหมดภายในชุดนี้จะถูกลบด้วย"}</p>}</ConfirmDialog>}
  </section>;
}
