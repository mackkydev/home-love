"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isInTrip, isTravelRecord, travelSelection, type CalendarInfo, type TravelInfo, type TravelRecord, type TravelSelection } from "@/lib/travel";
import { externalWebUrl } from "@/lib/web-url";
import PhotoCropField from "./PhotoCropField";

type Language = "th" | "en";
type SourceRecord = Omit<TravelRecord, "kind" | "calendar" | "travel"> & { kind: string; calendar?: CalendarInfo; travel?: TravelInfo; photos?: string[] };
function dateText(date: string, language: Language) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(language === "en" ? "en-GB" : "th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function changeDay(date: string, step: number) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + step);
  return day.toISOString().slice(0, 10);
}

function TravelPhoto({ source, alt }: { source?: string; alt: string }) {
  // Household photos use private signed URLs or local data URLs.
  // eslint-disable-next-line @next/next/no-img-element
  return source && !source.startsWith("storage:") ? <img src={source} alt={alt}/> : null;
}

function TravelEditor({ entry, trip, date, relatedDates, language, onSave, onCancel }: {
  entry?: TravelRecord;
  trip?: TravelRecord;
  date: string;
  relatedDates: string[];
  language: Language;
  onSave: (entry: TravelRecord) => void;
  onCancel: () => void;
}) {
  const ui = (th: string, en: string) => language === "en" ? en : th;
  const [draft, setDraft] = useState({
    name: entry?.name ?? "", date: entry?.date ?? date, endDate: entry?.calendar.end ?? date,
    time: (entry?.travel.kind === "trip" ? entry.travel.startTime : undefined) ?? entry?.calendar.time ?? "09:00",
    endTime: entry?.travel.endTime ?? "",
    details: entry?.travel.details ?? "",
    contact: entry?.travel.kind === "stop" ? entry.travel.contact ?? "" : "",
    map: entry?.calendar.locationUrl ?? "", remindMinutes: entry?.calendar.remindMinutes ?? 15,
    reminderTime: entry?.calendar.time ?? "09:00", photo: entry?.photo,
  });
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const cancel = () => { dialogRef.current?.close(); onCancel(); };
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.date || !draft.time) return;
    const map = draft.map.trim();
    const locationUrl = externalWebUrl(map);
    if (map && !locationUrl) {
      setError(ui("ใส่ลิงก์แผนที่ที่ขึ้นต้นด้วย https:// หรือ http://", "Enter a map link starting with https:// or http://."));
      return;
    }
    if ((trip || draft.endDate === draft.date) && draft.endTime && draft.endTime < draft.time) {
      setError(ui("เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม", "The end time must be at or after the start time."));
      return;
    }
    const base = {
      id: entry?.id ?? crypto.randomUUID(),
      name: draft.name.trim(),
      date: draft.date,
      category: "บันทึกแจ้งเตือน",
      kind: "calendar" as const,
      actor: entry?.actor ?? "คุณ",
      photo: draft.photo,
    };
    const travelDetails = { endTime: draft.endTime || undefined, details: draft.details.trim() || undefined };
    if (trip) {
      if (!isInTrip(draft.date, trip.calendar)) { setError(ui("เลือกวันที่ในช่วงเดินทาง", "Choose a date within the trip.")); return; }
      dialogRef.current?.close();
      onSave({
        ...base,
        calendar: { type: "appointment", start: draft.date, time: draft.time, remindMinutes: draft.remindMinutes, message: "", locationUrl },
        travel: { kind: "stop", tripId: trip.id, ...travelDetails, contact: draft.contact.trim() || undefined },
      });
      return;
    }
    if (!draft.endDate || draft.endDate < draft.date || !draft.reminderTime) { setError(ui("ตรวจสอบช่วงวันเดินทางและเวลาแจ้งเตือน", "Check the trip dates and reminder time.")); return; }
    if (relatedDates.some((day) => day < draft.date || day > draft.endDate)) {
      setError(ui("ย้ายหรือลบรายการที่อยู่นอกช่วงใหม่ก่อนเปลี่ยนวันเดินทาง", "Move or remove stops outside the new dates before changing the trip."));
      return;
    }
    dialogRef.current?.close();
    onSave({
      ...base,
      calendar: {
        type: "appointment", start: draft.date, end: draft.endDate, time: draft.reminderTime, remindMinutes: 0, message: "", locationUrl,
        recurrence: draft.date === draft.endDate ? undefined : { frequency: "daily", interval: 1, until: draft.endDate },
      },
      travel: { kind: "trip", startTime: draft.time, ...travelDetails },
    });
  };

  return <dialog ref={dialogRef} className="feature-dialog" aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); cancel(); }} onClick={(event) => { if (event.target === event.currentTarget) cancel(); }}>
    <form className="feature-card feature-dialog-form" onSubmit={save}>
    <h2 id={titleId}>{trip ? (entry ? ui("แก้ไขสถานที่", "Edit stop") : ui("เพิ่มสถานที่", "Add stop")) : (entry ? ui("แก้ไขการเดินทาง", "Edit trip") : ui("สร้างแผนเดินทาง", "Plan a trip"))}</h2>
    {error && <p className="feature-error" role="alert">{error}</p>}
    <label className="form-label">{trip ? ui("ชื่อสถานที่", "Place name") : ui("หัวข้อการเดินทาง", "Trip title")}<input autoFocus required maxLength={160} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label>
    {trip ? <label className="form-label">{ui("วันที่ไป", "Visit date")}<input required type="date" min={trip.date} max={trip.calendar.end ?? trip.date} value={draft.date} onInput={(event) => setDraft({ ...draft, date: event.currentTarget.value })}/></label>
      : <div className="feature-field-grid">
        <label className="form-label">{ui("วันเริ่มเดินทาง", "First day")}<input required type="date" value={draft.date} onInput={(event) => { const value = event.currentTarget.value; setDraft({ ...draft, date: value, endDate: value > draft.endDate ? value : draft.endDate }); }}/></label>
        <label className="form-label">{ui("วันสิ้นสุด", "Last day")}<input required type="date" min={draft.date} value={draft.endDate} onInput={(event) => setDraft({ ...draft, endDate: event.currentTarget.value })}/></label>
      </div>}
    <div className="feature-field-grid">
      <label className="form-label">{ui("เวลาเริ่ม", "Start time")}<input required type="time" value={draft.time} onInput={(event) => setDraft({ ...draft, time: event.currentTarget.value })}/></label>
      <label className="form-label">{ui("เวลาสิ้นสุด", "End time")}<input type="time" value={draft.endTime} onInput={(event) => setDraft({ ...draft, endTime: event.currentTarget.value })}/></label>
    </div>
    <label className="form-label">{trip ? ui("รายละเอียดสถานที่", "Place details") : ui("รายละเอียดการเดินทาง", "Trip details")}<textarea rows={3} maxLength={2000} value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })}/></label>
    {trip && <label className="form-label">{ui("ข้อมูลติดต่อ", "Contact information")}<textarea rows={2} maxLength={1000} value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })}/></label>}
    <label className="form-label">{ui("ลิงก์ Google Maps", "Google Maps link")}<input type="url" maxLength={2048} placeholder="https://maps.app.goo.gl/…" value={draft.map} onChange={(event) => setDraft({ ...draft, map: event.target.value })}/></label>
    {trip ? <label className="form-label">{ui("แจ้งเตือนสถานที่", "Stop reminder")}<select value={draft.remindMinutes} onChange={(event) => setDraft({ ...draft, remindMinutes: Number(event.target.value) })}>
        <option value={0}>{ui("เมื่อถึงเวลา", "At start time")}</option>
        <option value={15}>{ui("ล่วงหน้า 15 นาที", "15 minutes before")}</option>
        <option value={60}>{ui("ล่วงหน้า 1 ชั่วโมง", "1 hour before")}</option>
      </select></label>
      : <label className="form-label">{ui("เวลาแจ้งเตือนแผนแต่ละวัน", "Daily trip reminder time")}<input required type="time" value={draft.reminderTime} onInput={(event) => setDraft({ ...draft, reminderTime: event.currentTarget.value })}/></label>}
    <PhotoCropField value={draft.photo} onChange={(photo) => setDraft((current) => ({ ...current, photo }))} language={language}
      label={trip ? ui("เลือกรูปสถานที่", "Choose place photo") : ui("เลือกรูปปก", "Choose cover photo")} maxBytes={1024 * 1024}
      hint={ui("ระบบย่อรูปให้ไม่เกิน 1 MB", "Photos are resized to 1 MB or less.")}/>
    <div className="feature-actions feature-dialog-actions">
      <button type="submit" className="primary-button">{ui("บันทึก", "Save")}</button>
      <button type="button" className="secondary-button" onClick={cancel}>{ui("ยกเลิก", "Cancel")}</button>
    </div>
    </form>
  </dialog>;
}

export default function TravelPage({ entries, language, today, selection, onSelect, onSave, onRemove, onCalendar }: {
  entries: SourceRecord[];
  language: Language;
  today: string;
  selection: TravelSelection | null;
  onSelect: (selection: TravelSelection | null) => void;
  onSave: (entry: TravelRecord) => void;
  onRemove: (entry: TravelRecord) => void;
  onCalendar: (date: string) => void;
}) {
  const ui = (th: string, en: string) => language === "en" ? en : th;
  const records = entries.filter(isTravelRecord);
  const trips = records.filter((entry) => entry.travel.kind === "trip").sort((a, b) => b.date.localeCompare(a.date));
  const trip = trips.find((entry) => entry.id === selection?.id);
  const tripInfo = trip?.travel.kind === "trip" ? trip.travel : undefined;
  const tripMap = externalWebUrl(trip?.calendar.locationUrl ?? "");
  const end = trip?.calendar.end ?? trip?.date ?? today;
  const selectedDate = selection?.date ?? trip?.date ?? today;
  const date = isInTrip(selectedDate, trip?.calendar) ? selectedDate : trip?.date ?? today;
  const tripStops = records.filter((entry) => entry.travel.kind === "stop" && entry.travel.tripId === trip?.id);
  const dayStops = tripStops.filter((entry) => entry.date === date).sort((a, b) => a.calendar.time.localeCompare(b.calendar.time));
  const [editor, setEditor] = useState<{ kind: "trip" | "stop"; entry?: TravelRecord } | null>(null);
  const [removing, setRemoving] = useState<TravelRecord | null>(null);
  const navigate = (next: TravelSelection | null) => { setEditor(null); setRemoving(null); onSelect(next); };
  const addTrip = () => { navigate(null); setEditor({ kind: "trip" }); };
  const save = (entry: TravelRecord) => { onSave(entry); navigate(travelSelection(entry)); };

  return <section className="feature-page travel-page">
    <header className="feature-heading">
      <div><h1>{ui("วางแผนเดินทาง", "Travel planner")}</h1>{!trip && <p>{ui("จัดแผนรายวันและดูเวลาเดินทางในปฏิทินของบ้าน", "Plan each day and see your itinerary on the household calendar.")}</p>}</div>
      {trip ? <button type="button" className="secondary-button" onClick={() => navigate(null)}>{ui("ดูทุกการเดินทาง", "All trips")}</button>
        : <button type="button" className="primary-button" onClick={addTrip}>{ui("＋ สร้างแผนเดินทาง", "＋ Plan a trip")}</button>}
    </header>
    {removing && <section className="feature-card feature-warning" role="alert">
      <p>{removing.travel.kind === "trip" ? ui("ลบทริปพร้อมสถานที่และการแจ้งเตือนทั้งหมดในทริปนี้?", "Delete this trip and all of its stops and reminders?") : ui("ลบสถานที่นี้ออกจากแผนและปฏิทิน?", "Remove this stop from the trip and calendar?")}</p>
      <div className="feature-actions"><button type="button" className="danger-button" onClick={() => { onRemove(removing); navigate(removing.travel.kind === "trip" ? null : { id: removing.travel.tripId, date }); }}>{ui("ยืนยันลบ", "Confirm deletion")}</button><button type="button" className="secondary-button" onClick={() => setRemoving(null)}>{ui("ยกเลิก", "Cancel")}</button></div>
    </section>}
    {editor && (editor.kind === "trip" || trip) && <TravelEditor key={editor.entry?.id ?? editor.kind} entry={editor.entry} trip={editor.kind === "stop" ? trip : undefined} date={date}
      relatedDates={tripStops.map((stop) => stop.date)} language={language} onSave={save} onCancel={() => setEditor(null)}/>}
    {!trip ? trips.length ? <ul className="travel-trips">
      {trips.map((item) => <li className="feature-card travel-trip" key={item.id}>
        <button type="button" onClick={() => navigate({ id: item.id })}>
          <TravelPhoto source={item.photo} alt=""/>
          <span><strong>{item.name}</strong><small>{dateText(item.date, language)}{item.calendar.end && item.calendar.end !== item.date ? ` – ${dateText(item.calendar.end, language)}` : ""}</small></span>
        </button>
      </li>)}
    </ul> : !editor && <p className="feature-card">{ui("ยังไม่มีแผนเดินทาง", "No trips planned yet.")}</p> : <>
      <article className="feature-card travel-overview">
        <TravelPhoto source={trip.photo} alt={ui("รูปปกการเดินทาง", "Trip cover")}/>
        <div><h2>{trip.name}</h2><p>{dateText(trip.date, language)}{tripInfo?.startTime && " " + tripInfo.startTime}
          {(end !== trip.date || tripInfo?.endTime) && <> – {end !== trip.date && dateText(end, language)}{tripInfo?.endTime && " " + tripInfo.endTime}</>}</p>
          {tripInfo?.details && <p className="travel-overview-details">{tripInfo.details}</p>}
          <div className="feature-actions">
            {tripMap && <a className="secondary-button" href={tripMap} target="_blank" rel="noopener noreferrer">{ui("เปิด Google Maps ↗", "Open Google Maps ↗")}</a>}
            <button type="button" className="secondary-button" onClick={() => onCalendar(date)}>{ui("ดูในปฏิทิน", "View calendar")}</button>
            <button type="button" className="secondary-button" onClick={() => setEditor({ kind: "trip", entry: trip })}>{ui("แก้ไขทริป", "Edit trip")}</button>
            <button type="button" className="secondary-button" onClick={() => { setEditor(null); setRemoving(trip); }}>{ui("ลบทริป", "Delete trip")}</button>
          </div>
        </div>
      </article>
      <section className="travel-day">
        <div className="travel-day-bar">
          <button type="button" className="secondary-button" aria-label={ui("วันก่อนหน้า", "Previous day")} disabled={date === trip.date} onClick={() => navigate({ id: trip.id, date: changeDay(date, -1) })}>‹</button>
          <label className="form-label">{ui("แผนวันที่", "Itinerary date")}<input type="date" min={trip.date} max={end} value={date} onInput={(event) => { const value = event.currentTarget.value; if (value >= trip.date && value <= end) navigate({ id: trip.id, date: value }); }}/></label>
          <button type="button" className="secondary-button" aria-label={ui("วันถัดไป", "Next day")} disabled={date === end} onClick={() => navigate({ id: trip.id, date: changeDay(date, 1) })}>›</button>
          <button type="button" className="primary-button" onClick={() => { setRemoving(null); setEditor({ kind: "stop" }); }}>{ui("＋ เพิ่มสถานที่", "＋ Add stop")}</button>
        </div>
        {dayStops.length ? <ol className="travel-stops">
          {dayStops.map((stop) => {
            if (stop.travel.kind !== "stop") return null;
            const location = externalWebUrl(stop.calendar.locationUrl ?? "");
            return <li className={`feature-card travel-stop${selection?.stopId === stop.id ? " selected" : ""}`} key={stop.id}>
              <div className="travel-time">{stop.calendar.time}{stop.travel.endTime ? ` – ${stop.travel.endTime}` : ""}</div>
              <div className="travel-stop-content">
                <TravelPhoto source={stop.photo} alt={stop.name}/>
                <h3>{stop.name}</h3>
                {stop.travel.details && <p>{stop.travel.details}</p>}
                {stop.travel.contact && <p><strong>{ui("ติดต่อ", "Contact")}</strong> {stop.travel.contact}</p>}
                <div className="feature-actions">
                  {location && <a className="secondary-button" href={location} target="_blank" rel="noopener noreferrer">{ui("เปิดแผนที่ ↗", "Open map ↗")}</a>}
                  <button type="button" className="secondary-button" onClick={() => { setRemoving(null); setEditor({ kind: "stop", entry: stop }); }}>{ui("แก้ไข", "Edit")}</button>
                  <button type="button" className="secondary-button" onClick={() => { setEditor(null); setRemoving(stop); }}>{ui("ลบ", "Delete")}</button>
                </div>
              </div>
            </li>;
          })}
        </ol> : <p className="feature-card">{ui("ยังไม่มีสถานที่ในวันนี้", "No stops planned for this day.")}</p>}
      </section>
    </>}
  </section>;
}
