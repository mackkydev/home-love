"use client";

import { useId, useState, type ComponentPropsWithRef } from "react";

type PasswordInputProps = Omit<ComponentPropsWithRef<"input">, "type"> & {
  language: "th" | "en";
};

export default function PasswordInput({ language, id, ...props }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  if (props.value === "" && visible) setVisible(false);
  const label = language === "en"
    ? (visible ? "Hide password" : "Show password")
    : (visible ? "ซ่อนรหัส" : "แสดงรหัส");
  const fieldLabel = props["aria-label"] ?? props.placeholder;

  return <span className="password-input">
    <input autoCapitalize="none" autoCorrect="off" spellCheck={false} {...props}
      aria-label={fieldLabel} id={inputId} type={visible ? "text" : "password"}/>
    <button type="button" className="password-input-toggle" disabled={props.disabled || props.value === ""}
      aria-label={fieldLabel ? `${label} (${fieldLabel})` : label}
      aria-controls={inputId} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/>
        <circle cx="12" cy="12" r="2.5"/>
        {visible && <path d="m3 3 18 18"/>}
      </svg>
    </button>
  </span>;
}
