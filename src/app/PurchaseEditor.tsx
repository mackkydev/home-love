"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Purchase } from "@/lib/purchases";
import Icon from "./Icon";

export default function PurchaseEditor({ purchase, name, stores, language, onSave, onCancel }: {
  purchase: Purchase; name: string; stores: string[]; language: "th" | "en";
  onSave: (store: string, price: number) => void; onCancel: () => void;
}) {
  const en = language === "en";
  const [store, setStore] = useState(purchase.store);
  const [price, setPrice] = useState(String(purchase.price));
  const [error, setError] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const storesId = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="purchase-edit-dialog" aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onCancel(); }} onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <form className="purchase-edit-form" onSubmit={(event) => {
      event.preventDefault();
      if (!store.trim()) { setError(en ? "Choose or enter a store" : "กรุณาเลือกหรือระบุร้านที่ซื้อ"); return; }
      if (!price.trim() || !Number.isFinite(Number(price)) || Number(price) < 0) { setError(en ? "Enter a valid price" : "กรุณาระบุราคาให้ถูกต้อง"); return; }
      onSave(store.trim(), Number(price));
    }}>
      <div className="modal-top"><div><span className="modal-kicker">{name}</span><h2 id={titleId}>{en ? "Edit purchase" : "แก้ไขประวัติการซื้อ"}</h2></div><button type="button" className="icon-button" aria-label={en ? "Close" : "ปิด"} onClick={onCancel}><Icon name="close"/></button></div>
      <p className="purchase-edit-date"><Icon name="calendar" size={16}/>{new Date(purchase.date + "T00:00:00").toLocaleDateString(en ? "en-GB" : "th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>
      <label className="form-label">{en ? "Store *" : "ร้านที่ซื้อ *"}<input autoFocus required maxLength={160} list={storesId} value={store} onChange={(event) => { setStore(event.target.value); setError(""); }}/></label>
      <datalist id={storesId}>{stores.map((name) => <option value={name} key={name}/>)}</datalist>
      <label className="form-label">{en ? "Total purchase price (THB)" : "ราคารวมครั้งนี้ (บาท)"}<input type="number" min="0" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)}/></label>
      <p className="purchase-edit-hint">{en ? "Changes apply to this purchase. Stock remains the same." : "แก้ไขร้านและราคาเฉพาะครั้งนี้ จำนวนคงเหลือเท่าเดิม"}</p>
      {error && <p className="form-field-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onCancel}><Icon name="close" size={16}/>{en ? "Cancel" : "ยกเลิก"}</button><button type="submit" className="primary-button"><Icon name="check" size={16}/>{en ? "Save changes" : "บันทึกการแก้ไข"}</button></div>
    </form>
  </dialog>;
}
