"use client";

import { useState } from "react";
import { isInTrip, isTravelRecord, travelSelection, type CalendarInfo, type TravelInfo, type TravelRecord, type TravelSelection } from "@/lib/travel";
import { externalWebUrl } from "@/lib/web-url";

type Language = "th" | "en";
type SourceRecord = Omit<TravelRecord, "kind" | "calendar" | "travel"> & { kind: string; calendar?: CalendarInfo; travel?: TravelInfo; photos?: string[] };
type TripDraft = { name: string; date: string; endDate: string; time: string; photo?: string };
type StopDraft = { name: string; date: string; time: string; endTime: string; details: string; contact: string; map: string; reminder: number; photo?: string };

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

function TravelEditor({ entry, trip, date, relatedDates, language, compressPhoto, onSave, onCancel }: {
  entry?: TravelRecord;
  trip?: TravelRecord;
  date: string;
  relatedDates: string[];
  language: Language;
  compressPhoto: (file: File) => Promise<string>;
  onSave: (entry: TravelRecord) => void;
  onCancel: () => void;
}) {
  const ui = (th: string, en: string) => language === "en" ? en : th;
  const [tripDraft, setTripDraft] = useState<TripDraft>({
    name: entry?.name ?? "", date: entry?.date ?? date, endDate: entry?.calendar.end ?? date,
    time: entry?.calendar.time ?? "09:00", photo: entry?.photo,
  });
  const [stopDraft, setStopDraft] = useState<StopDraft>({
    name: entry?.name ?? "", date: entry?.date ?? date, time: entry?.calendar.time ?? "09:00",
    endTime: entry?.travel.kind === "stop" ? entry.travel.endTime ?? "" : "",
    details: entry?.travel.kind === "stop" ? entry.travel.details ?? "" : "",
    contact: entry?.travel.kind === "stop" ? entry.travel.contact ?? "" : "",
    map: entry?.calendar.locationUrl ?? "", reminder: entry?.calendar.remindMinutes ?? 15, photo: entry?.photo,
  });
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const data = trip ? stopDraft : tripDraft;
  const setPhoto = (photo?: string) => {
    if (trip) setStopDraft((current) => ({ ...current, photo }));
    else setTripDraft((current) => ({ ...current, photo }));
  };
  const choosePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError(ui("เลือกรูปขนาดไม่เกิน 1 MB", "Choose a photo no larger than 1 MB."));
      return;
    }
    setLoadingPhoto(true);
    setError("");
    try {
      setPhoto(await compressPhoto(file));
    } catch {
      setError(ui("เปิดรูปนี้ไม่ได้ กรุณาเลือกรูปอื่น", "Could not open this photo. Choose another image."));
    } finally {
      setLoadingPhoto(false);
    }
  };
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data.name.trim() || !data.date || !data.time || loadingPhoto) return;
    const base = {
      id: entry?.id ?? crypto.randomUUID(),
      name: data.name.trim(),
      date: data.date,
      category: "บันทึกแจ้งเตือน",
      kind: "calendar" as const,
      actor: entry?.actor ?? "คุณ",
      photo: data.photo,
    };
    if (trip) {
      const map = stopDraft.map.trim();
      const locationUrl = externalWebUrl(map);
      if (map && !locationUrl) { setError(ui("ใส่ลิงก์แผนที่ที่ขึ้นต้นด้วย https:// หรือ http://", "Enter a map link starting with https:// or http://.")); return; }
      if (stopDraft.endTime && stopDraft.endTime < data.time) { setError(ui("เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม", "The end time must be at or after the start time.")); return; }
      if (!isInTrip(data.date, trip.calendar)) { setError(ui("เลือกวันที่ในช่วงเดินทาง", "Choose a date within the trip.")); return; }
      onSave({
        ...base,
        calendar: { type: "appointment", start: data.date, time: data.time, remindMinutes: stopDraft.reminder, message: "", locationUrl },
        travel: { kind: "stop", tripId: trip.id, endTime: stopDraft.endTime || undefined, details: stopDraft.details.trim() || undefined, contact: stopDraft.contact.trim() || undefined },
      });
      return;
    }
    if (!tripDraft.endDate || tripDraft.endDate < data.date) { setError(ui("วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น", "The end date must be at or after the start date.")); return; }
    if (relatedDates.some((day) => day < data.date || day > tripDraft.endDate)) {
      setError(ui("ย้ายหรือลบรายการที่อยู่นอกช่วงใหม่ก่อนเปลี่ยนวันเดินทาง", "Move or remove stops outside the new dates before changing the trip."));
      return;
    }
    onSave({
      ...base,
      calendar: {
        type: "appointment", start: data.date, end: tripDraft.endDate, time: data.time, remindMinutes: 0, message: "",
        recurrence: data.date === tripDraft.endDate ? undefined : { frequency: "daily", interval: 1, until: tripDraft.endDate },
      },
      travel: { kind: "trip" },
    });
  };

  return <form className="feature-card travel-form" onSubmit={save}>
    <h2>{trip ? (entry ? ui("แก้ไขสถานที่", "Edit stop") : ui("เพิ่มสถานที่", "Add stop")) : (entry ? ui("แก้ไขการเดินทาง", "Edit trip") : ui("สร้างแผนเดินทาง", "Plan a trip"))}</h2>
    {error && <p className="feature-error" role="alert">{error}</p>}
    {trip ? <>
      <label className="form-label">{ui("ชื่อสถานที่", "Place name")}<input autoFocus required maxLength={160} value={stopDraft.name} onChange={(event) => setStopDraft({ ...stopDraft, name: event.target.value })}/></label>
      <label className="form-label">{ui("วันที่ไป", "Visit date")}<input required type="date" min={trip.date} max={trip.calendar.end ?? trip.date} value={stopDraft.date} onInput={(event) => setStopDraft({ ...stopDraft, date: event.currentTarget.value })}/></label>
      <div className="feature-field-grid">
        <label className="form-label">{ui("เวลาเริ่ม", "Start time")}<input required type="time" value={stopDraft.time} onInput={(event) => setStopDraft({ ...stopDraft, time: event.currentTarget.value })}/></label>
        <label className="form-label">{ui("เวลาสิ้นสุด", "End time")}<input type="time" value={stopDraft.endTime} onInput={(event) => setStopDraft({ ...stopDraft, endTime: event.currentTarget.value })}/></label>
      </div>
      <label className="form-label">{ui("รายละเอียดสถานที่", "Place details")}<textarea rows={3} maxLength={2000} value={stopDraft.details} onChange={(event) => setStopDraft({ ...stopDraft, details: event.target.value })}/></label>
      <label className="form-label">{ui("ข้อมูลติดต่อ", "Contact information")}<textarea rows={2} maxLength={1000} value={stopDraft.contact} onChange={(event) => setStopDraft({ ...stopDraft, contact: event.target.value })}/></label>
      <label className="form-label">{ui("ลิงก์ Google Maps", "Google Maps link")}<input type="url" maxLength={2048} placeholder="https://maps.app.goo.gl/…" value={stopDraft.map} onChange={(event) => setStopDraft({ ...stopDraft, map: event.target.value })}/></label>
      <label className="form-label">{ui("แจ้งเตือนสถานที่", "Stop reminder")}<select value={stopDraft.reminder} onChange={(event) => setStopDraft({ ...stopDraft, reminder: Number(event.target.value) })}>
        <option value={0}>{ui("เมื่อถึงเวลา", "At start time")}</option>
        <option value={15}>{ui("ล่วงหน้า 15 นาที", "15 minutes before")}</option>
        <option value={60}>{ui("ล่วงหน้า 1 ชั่วโมง", "1 hour before")}</option>
      </select></label>
    </> : <>
      <label className="form-label">{ui("หัวข้อการเดินทาง", "Trip title")}<input autoFocus required maxLength={160} value={tripDraft.name} onChange={(event) => setTripDraft({ ...tripDraft, name: event.target.value })}/></label>
      <div className="feature-field-grid">
        <label className="form-label">{ui("วันเริ่มเดินทาง", "First day")}<input required type="date" value={tripDraft.date} onInput={(event) => { const value = event.currentTarget.value; setTripDraft({ ...tripDraft, date: value, endDate: value > tripDraft.endDate ? value : tripDraft.endDate }); }}/></label>
        <label className="form-label">{ui("วันสิ้นสุด", "Last day")}<input required type="date" min={tripDraft.date} value={tripDraft.endDate} onInput={(event) => setTripDraft({ ...tripDraft, endDate: event.currentTarget.value })}/></label>
      </div>
      <label className="form-label">{ui("เวลาแจ้งเตือนแผนแต่ละวัน", "Daily trip reminder time")}<input required type="time" value={tripDraft.time} onInput={(event) => setTripDraft({ ...tripDraft, time: event.currentTarget.value })}/></label>
    </>}
    <div className="travel-photo-field">
      <TravelPhoto source={data.photo} alt={ui("รูปที่เลือก", "Selected photo")}/>
      <div className="feature-actions">
        <label className="secondary-button feature-file-button">{loadingPhoto ? ui("กำลังเปิดรูป…", "Loading photo…") : trip ? ui("เลือกรูปสถานที่ · สูงสุด 1 MB", "Choose place photo · 1 MB max") : ui("เลือกรูปปก · สูงสุด 1 MB", "Choose cover photo · 1 MB max")}
          <input type="file" accept="image/*" disabled={loadingPhoto} onChange={(event) => void choosePhoto(event)}/>
        </label>
        {data.photo && <button type="button" className="secondary-button" disabled={loadingPhoto} onClick={() => setPhoto(undefined)}>{ui("เอารูปออก", "Remove photo")}</button>}
      </div>
    </div>
    <div className="feature-actions">
      <button type="submit" className="primary-button" disabled={loadingPhoto}>{ui("บันทึก", "Save")}</button>
      <button type="button" className="secondary-button" onClick={onCancel}>{ui("ยกเลิก", "Cancel")}</button>
    </div>
  </form>;
}

export default function TravelPage({ entries, language, today, selection, onSelect, onSave, onRemove, onCalendar, compressPhoto }: {
  entries: SourceRecord[];
  language: Language;
  today: string;
  selection: TravelSelection | null;
  onSelect: (selection: TravelSelection | null) => void;
  onSave: (entry: TravelRecord) => void;
  onRemove: (entry: TravelRecord) => void;
  onCalendar: (date: string) => void;
  compressPhoto: (file: File) => Promise<string>;
}) {
  const ui = (th: string, en: string) => language === "en" ? en : th;
  const records = entries.filter(isTravelRecord);
  const trips = records.filter((entry) => entry.travel.kind === "trip").sort((a, b) => b.date.localeCompare(a.date));
  const trip = trips.find((entry) => entry.id === selection?.id);
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
      relatedDates={tripStops.map((stop) => stop.date)} language={language} compressPhoto={compressPhoto} onSave={save} onCancel={() => setEditor(null)}/>}
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
        <div><h2>{trip.name}</h2><p>{dateText(trip.date, language)}{end !== trip.date ? ` – ${dateText(end, language)}` : ""}</p>
          <div className="feature-actions">
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
