"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isPlaceRecord, placeGroups, placePhotoMaxBytes, placesCategory, type PlaceGroup, type PlaceRecord } from "@/lib/places";
import { externalWebUrl } from "@/lib/web-url";
import Icon from "./Icon";
import PhotoCropField from "./PhotoCropField";

type Language = "th" | "en";
type PlaceSource = Omit<PlaceRecord, "kind" | "category" | "place"> & { kind: string; category: string; place?: PlaceRecord["place"] };
type PlaceAction = (id: string) => void;

function groupLabel(group: PlaceGroup, language: Language) {
  return placeGroups.find((item) => item.id === group)?.[language] ?? "";
}

function PlacePhoto({ photo, alt }: { photo?: string; alt: string }) {
  // Photos can be local data URLs or private household storage URLs.
  // eslint-disable-next-line @next/next/no-img-element
  return photo && !photo.startsWith("storage:") ? <img src={photo} alt={alt}/> : null;
}

function PlaceStar({ entry, language, onStar }: { entry: PlaceRecord; language: Language; onStar: PlaceAction }) {
  const label = language === "en" ? "Star " + entry.name : "ติดดาว " + entry.name;
  return <button type="button" className="place-star" aria-label={label} aria-pressed={entry.place.starred} onClick={() => onStar(entry.id)}>
    <span aria-hidden="true">{entry.place.starred ? "★" : "☆"}</span>
  </button>;
}

export function PlaceRow({ entry, language, onOpen, onStar }: { entry: PlaceRecord; language: Language; onOpen: PlaceAction; onStar: PlaceAction }) {
  const group = placeGroups.find((item) => item.id === entry.place.group);
  return <article className="feature-card place-row">
    <button type="button" className="place-row-open" onClick={() => onOpen(entry.id)}>
      <span className="place-thumbnail">
        <Icon name={group?.icon ?? "star"} size={22}/>
      </span>
      <span className="place-row-copy"><strong>{entry.name}</strong><small>{groupLabel(entry.place.group, language)}</small></span>
    </button>
    <PlaceStar entry={entry} language={language} onStar={onStar}/>
  </article>;
}

export default function PlacesPage({ entries, language, onAdd, onOpen, onStar }: {
  entries: PlaceSource[]; language: Language; onAdd: (group?: PlaceGroup) => void; onOpen: PlaceAction; onStar: PlaceAction;
}) {
  const [group, setGroup] = useState<PlaceGroup | "all">("all");
  const en = language === "en";
  const places = entries.filter(isPlaceRecord).filter((entry) => group === "all" || entry.place.group === group)
    .sort((a, b) => Number(Boolean(b.place.starred)) - Number(Boolean(a.place.starred)));
  return <section className="feature-page places-page">
    <header className="feature-heading">
      <h1>{en ? "Starred places" : placesCategory}</h1>
      <button type="button" className="primary-button" onClick={() => onAdd(group === "all" ? undefined : group)}>{en ? "＋ Add place" : "＋ เพิ่มสถานที่"}</button>
    </header>
    <nav className="filter-chips place-filters" aria-label={en ? "Place categories" : "หมวดหมู่สถานที่"}>
      <button type="button" className={`filter-chip${group === "all" ? " selected" : ""}`} aria-pressed={group === "all"} onClick={() => setGroup("all")}><Icon name="grid" size={14}/>{en ? "All" : "ทั้งหมด"}</button>
      {placeGroups.map((item) => <button type="button" className={`filter-chip${group === item.id ? " selected" : ""}`} key={item.id}
        aria-pressed={group === item.id} onClick={() => setGroup(item.id)}><Icon name={item.icon} size={14}/>{item[language]}</button>)}
    </nav>
    {places.length ? <div className="place-list">
      {places.map((entry) => <PlaceRow key={entry.id} entry={entry} language={language} onOpen={onOpen} onStar={onStar}/>)}
    </div> : <p className="feature-card">{en ? "No places in this category yet." : "ยังไม่มีสถานที่ในหมวดนี้"}</p>}
  </section>;
}

export function PlaceDetail({ entry, language, onEdit, onDelete, onStar }: {
  entry: PlaceRecord; language: Language; onEdit: () => void; onDelete: () => void; onStar: PlaceAction;
}) {
  const en = language === "en";
  const map = externalWebUrl(entry.place.locationUrl ?? "");
  const phone = entry.place.phone;
  const dial = phone && /^\+?[0-9][0-9 ().-]*$/.test(phone) ? phone.replace(/[^0-9+]/g, "") : undefined;
  return <article className="feature-card place-detail">
    <PlacePhoto photo={entry.photo} alt={entry.name}/>
    <div className="place-detail-copy">
      <header className="place-detail-heading">
        <div><p>{groupLabel(entry.place.group, language)}</p><h2>{entry.name}</h2></div>
        <PlaceStar entry={entry} language={language} onStar={onStar}/>
      </header>
      {entry.place.details && <p className="place-details-text">{entry.place.details}</p>}
      {phone && <p>{en ? "Contact" : "เบอร์ติดต่อ"} <strong>{dial ? <a href={"tel:" + dial}>{phone}</a> : phone}</strong></p>}
      <div className="feature-actions">
        {map && <a className="secondary-button" href={map} target="_blank" rel="noopener noreferrer">{en ? "Open Google Maps ↗" : "เปิด Google Maps ↗"}</a>}
        <button type="button" className="secondary-button" onClick={onEdit}>{en ? "Edit" : "แก้ไข"}</button>
        <button type="button" className="danger-button" onClick={onDelete}>{en ? "Delete" : "ลบ"}</button>
      </div>
    </div>
  </article>;
}

export function PlaceEditor({ entry, initialGroup, language, today, onSave, onCancel }: {
  entry?: PlaceRecord; initialGroup?: PlaceGroup; language: Language; today: string;
  onSave: (entry: PlaceRecord) => void; onCancel: () => void;
}) {
  const ui = (th: string, en: string) => language === "en" ? en : th;
  const [draft, setDraft] = useState({
    name: entry?.name ?? "", group: entry?.place.group ?? initialGroup ?? placeGroups[0].id,
    details: entry?.place.details ?? "", phone: entry?.place.phone ?? "",
    map: entry?.place.locationUrl ?? "", photo: entry?.photo,
  });
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const cancel = () => { dialogRef.current?.close(); onCancel(); };
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    const url = draft.map.trim();
    const locationUrl = externalWebUrl(url);
    if (url && !locationUrl) {
      setError(ui("กรอกลิงก์ Google Maps ที่ขึ้นต้นด้วย https:// หรือ http://", "Enter a Google Maps link beginning with https:// or http://."));
      return;
    }
    dialogRef.current?.close();
    onSave({
      id: entry?.id ?? crypto.randomUUID(), kind: "place", category: placesCategory,
      name, date: entry?.date ?? today, actor: entry?.actor ?? "คุณ", photo: draft.photo,
      place: { group: draft.group, details: draft.details.trim() || undefined, phone: draft.phone.trim() || undefined, locationUrl, starred: entry?.place.starred ?? false },
    });
  };

  return <dialog ref={dialogRef} className="feature-dialog" aria-labelledby={title}
    onCancel={(event) => { event.preventDefault(); cancel(); }} onClick={(event) => { if (event.target === event.currentTarget) cancel(); }}>
    <form className="feature-card feature-dialog-form" onSubmit={save}>
      <h2 id={title}>{entry ? ui("แก้ไขสถานที่", "Edit place") : ui("เพิ่มสถานที่ติดดาว", "Add a place")}</h2>
      {error && <p className="feature-error" role="alert">{error}</p>}
      <label className="form-label">{ui("ชื่อสถานที่", "Place name")}<input autoFocus required maxLength={160} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label>
      <label className="form-label">{ui("หมวดหมู่ย่อย", "Category")}<select value={draft.group} onChange={(event) => setDraft({ ...draft, group: event.target.value as PlaceGroup })}>
        {placeGroups.map((item) => <option key={item.id} value={item.id}>{item[language]}</option>)}
      </select></label>
      <label className="form-label">{ui("รายละเอียดสถานที่", "Place details")}<textarea rows={4} maxLength={2000} value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })}/></label>
      <label className="form-label">{ui("เบอร์ติดต่อ", "Phone number")}<input type="tel" maxLength={80} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })}/></label>
      <label className="form-label">{ui("ลิงก์ Google Maps", "Google Maps link")}<input type="url" maxLength={2048} placeholder="https://maps.app.goo.gl/…" value={draft.map} onChange={(event) => setDraft({ ...draft, map: event.target.value })}/></label>
      <PhotoCropField value={draft.photo} onChange={(photo) => setDraft((current) => ({ ...current, photo }))} language={language}
        label={ui("เลือกรูปสถานที่", "Choose a photo")} maxBytes={placePhotoMaxBytes}
        hint={ui("ระบบย่อรูปให้ไม่เกิน 500 KB", "Photos are resized to 500 KB or less.")}/>
      <div className="feature-actions feature-dialog-actions">
        <button type="button" className="secondary-button" onClick={cancel}>{ui("ยกเลิก", "Cancel")}</button>
        <button type="submit" className="primary-button">{ui("บันทึก", "Save")}</button>
      </div>
    </form>
  </dialog>;
}
