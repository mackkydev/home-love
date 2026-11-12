"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Language = "th" | "en";
type Position = { x: number; y: number };
const center = { x: 0.5, y: 0.5 };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function PhotoCropDialog({ source, aspect, maxWidth, maxBytes, language, onSave, onClose }: {
  source: string; aspect: number; maxWidth: number; maxBytes: number; language: Language;
  onSave: (photo: string) => void; onClose: () => void;
}) {
  const en = language === "en";
  const title = useId();
  const instructions = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; position: Position } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [position, setPosition] = useState(center);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => {
    const current = dialog.current;
    current?.showModal();
    return () => current?.close();
  }, []);

  const ratio = size ? size.width / size.height / aspect : 1;
  const imageWidth = Math.max(1, ratio) * zoom;
  const imageHeight = Math.max(1, 1 / ratio) * zoom;
  const close = () => { dialog.current?.close(); onClose(); };
  const save = () => {
    if (!image.current || !size) return;
    try {
      const cropWidth = size.width / imageWidth;
      const cropHeight = size.height / imageHeight;
      const cropX = (size.width - cropWidth) * position.x;
      const cropY = (size.height - cropHeight) * position.y;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      let width = Math.min(maxWidth, cropWidth);
      for (let attempt = 0; attempt < 8; attempt += 1) {
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(width / aspect));
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image.current, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
        const photo = canvas.toDataURL("image/jpeg", Math.max(0.48, 0.9 - attempt * 0.06));
        if (photo.startsWith("data:image/jpeg;base64,") && photo.length * 0.75 <= maxBytes) {
          dialog.current?.close();
          onSave(photo);
          return;
        }
        width *= 0.78;
      }
    } catch {
      // Keep the crop open so the user can cancel or try a different position.
    }
    setError(en ? "Could not save this crop. Try another photo." : "บันทึกรูปนี้ไม่ได้ กรุณาลองเลือกรูปอื่น");
  };

  return <dialog ref={dialog} className="feature-dialog photo-crop-dialog" aria-labelledby={title}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); close(); }}
    onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) close(); }}>
    <section className="feature-card photo-crop-card">
      <h2 id={title}>{en ? "Position the photo" : "จัดตำแหน่งรูป"}</h2>
      <p id={instructions}>{en ? "Drag the photo inside the frame, or use the arrow keys." : "ลากรูปในกรอบให้ได้ตำแหน่งที่ต้องการ หรือใช้ปุ่มลูกศร"}</p>
      {error && <p role="alert" className="feature-error">{error}</p>}
      <div className="photo-crop-frame" style={{ aspectRatio: aspect }} role="group" tabIndex={0}
        aria-label={en ? "Photo crop area" : "กรอบจัดตำแหน่งรูป"} aria-describedby={instructions}
        onKeyDown={(event) => {
          const offsets: Record<string, Position> = { ArrowLeft: { x: 0.05, y: 0 }, ArrowRight: { x: -0.05, y: 0 }, ArrowUp: { x: 0, y: 0.05 }, ArrowDown: { x: 0, y: -0.05 } };
          const offset = offsets[event.key];
          if (!offset) return;
          event.preventDefault();
          setPosition((current) => ({ x: clamp(current.x + offset.x), y: clamp(current.y + offset.y) }));
        }}
        onPointerDown={(event) => {
          if (!size || !event.isPrimary || event.button !== 0) return;
          drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, position };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const initial = drag.current;
          if (!initial || initial.id !== event.pointerId) return;
          const frame = event.currentTarget.getBoundingClientRect();
          setPosition({
            x: imageWidth > 1 ? clamp(initial.position.x - (event.clientX - initial.startX) / (frame.width * (imageWidth - 1))) : initial.position.x,
            y: imageHeight > 1 ? clamp(initial.position.y - (event.clientY - initial.startY) / (frame.height * (imageHeight - 1))) : initial.position.y,
          });
        }}
        onLostPointerCapture={() => { drag.current = null; }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Preview uses a local object URL. */}
        <img ref={image} src={source} alt="" draggable={false}
          style={{ width: `${imageWidth * 100}%`, height: `${imageHeight * 100}%`, left: `${-position.x * (imageWidth - 1) * 100}%`, top: `${-position.y * (imageHeight - 1) * 100}%` }}
          onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          onError={() => setError(en ? "Could not open this photo." : "เปิดรูปนี้ไม่ได้ กรุณาเลือกรูปอื่น")}/>
      </div>
      <label className="photo-crop-zoom">{en ? "Zoom" : "ขยายรูป"}<input type="range" min="1" max="3" step="0.05" value={zoom} disabled={!size} onChange={(event) => setZoom(Number(event.target.value))}/></label>
      <div className="feature-actions">
        <button type="button" className="secondary-button" onClick={close}>{en ? "Cancel" : "ยกเลิก"}</button>
        <button type="button" className="primary-button" disabled={!size} onClick={save}>{en ? "Use this photo" : "ใช้รูปนี้"}</button>
      </div>
    </section>
  </dialog>;
}

export default function PhotoCropField({ value, onChange, label, hint, language, maxBytes, aspect = 16 / 9, maxWidth = 1200 }: {
  value?: string; onChange: (value?: string) => void; label: string; hint?: string; language: Language;
  maxBytes: number; aspect?: number; maxWidth?: number;
}) {
  const [source, setSource] = useState<string | null>(null);
  const en = language === "en";
  useEffect(() => () => { if (source) URL.revokeObjectURL(source); }, [source]);
  return <div className="photo-crop-field">
    {value && !value.startsWith("storage:") &&
      // eslint-disable-next-line @next/next/no-img-element -- Preview uses a local or private household image.
      <img className={aspect === 1 ? "photo-crop-preview square" : "photo-crop-preview"} src={value} alt={en ? "Selected photo" : "รูปที่เลือก"} style={{ aspectRatio: aspect }}/>}
    <div className="feature-actions">
      <label className="secondary-button feature-file-button">{label}<input type="file" accept="image/*" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) setSource(URL.createObjectURL(file));
      }}/></label>
      {value && <button type="button" className="secondary-button" onClick={() => onChange(undefined)}>{en ? "Remove photo" : "เอารูปออก"}</button>}
    </div>
    {hint && <small>{hint}</small>}
    {source && createPortal(<PhotoCropDialog source={source} language={language} aspect={aspect} maxWidth={maxWidth} maxBytes={maxBytes}
      onClose={() => setSource(null)} onSave={(photo) => { onChange(photo); setSource(null); }}/>, document.body)}
  </div>;
}
