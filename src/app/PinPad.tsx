"use client";

import { useId } from "react";
import { appendPinDigit, erasePinDigit, PIN_LENGTH } from "@/lib/pin-input";
import Icon from "./Icon";

export default function PinPad({ value, onChange, label, language, disabled = false, autoFocus = false }: {
  value: string; onChange: (pin: string) => void; label: string; language: "th" | "en"; disabled?: boolean; autoFocus?: boolean;
}) {
  const labelId = useId();
  const en = language === "en";
  return <div className="pin-pad" role="group" aria-labelledby={labelId} onKeyDown={(event) => {
    if (disabled || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^\d$/.test(event.key)) { event.preventDefault(); onChange(appendPinDigit(value, event.key)); }
    else if (event.key === "Backspace") { event.preventDefault(); onChange(erasePinDigit(value)); }
    else if (event.key === "Delete") { event.preventDefault(); onChange(""); }
  }}>
    <span className="pin-pad-label" id={labelId}>{label}</span>
    <div className="pin-dots" role="status" aria-live="polite" aria-label={en ? `${value.length} of ${PIN_LENGTH} digits entered` : `ใส่แล้ว ${value.length} จาก ${PIN_LENGTH} หลัก`}>
      {Array.from({ length: PIN_LENGTH }, (_, index) => <span key={index} className={index < value.length ? "is-filled" : ""} aria-hidden="true"/>)}
    </div>
    <div className="pin-key-grid">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => <button key={digit} type="button" autoFocus={autoFocus && digit === "1"} disabled={disabled} onClick={() => onChange(appendPinDigit(value, digit))} aria-label={digit}>{digit}</button>)}
      <button type="button" className="pin-key-action" disabled={disabled || !value} onClick={() => onChange("")} aria-label={en ? "Clear PIN" : "ล้างรหัส"}>{en ? "Clear" : "ล้าง"}</button>
      <button type="button" disabled={disabled} onClick={() => onChange(appendPinDigit(value, "0"))} aria-label="0">0</button>
      <button type="button" className="pin-key-action" disabled={disabled || !value} onClick={() => onChange(erasePinDigit(value))} aria-label={en ? "Delete last digit" : "ลบตัวเลขล่าสุด"}><Icon name="backspace" size={23}/></button>
    </div>
  </div>;
}
