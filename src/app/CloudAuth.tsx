"use client";

import { useState, type FormEvent } from "react";
import { cloud } from "@/lib/cloud";

type AuthMode = "login" | "signup" | "forgot";

export default function CloudAuth({
  checking,
  recoveryMode,
  language,
  cloudError,
  onRecoveryComplete,
}: {
  checking: boolean;
  recoveryMode: boolean;
  language: "th" | "en";
  cloudError: string;
  onRecoveryComplete: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const en = language === "en";

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setPassword("");
    setConfirmPassword("");
    setError("");
    setMessage("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cloud) return;
    if ((mode === "signup" || recoveryMode) && password !== confirmPassword) {
      setError(en ? "Passwords do not match." : "รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (recoveryMode) {
        const { error: authError } = await cloud.auth.updateUser({ password });
        if (authError) throw authError;
        setPassword("");
        setConfirmPassword("");
        onRecoveryComplete();
      } else if (mode === "login") {
        const { error: authError } = await cloud.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      } else if (mode === "signup") {
        const { data, error: authError } = await cloud.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        if (!data.session) setMessage(en ? "Check your email to confirm your account, then sign in." : "ตรวจอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ");
      } else {
        const { error: authError } = await cloud.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (authError) throw authError;
        setMessage(en ? "If this email has an account, a password reset link has been sent." : "หากอีเมลนี้มีบัญชี ระบบจะส่งลิงก์ตั้งรหัสผ่านให้");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (en ? "Please try again." : "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง"));
    } finally {
      setBusy(false);
    }
  };

  return <main className="cloud-auth-page"><section className="cloud-auth-card">
    <span className="brand-mark" aria-hidden="true">⌂</span>
    <h1>{en ? "Home Love" : "บ้านใจ"}</h1>
    <p>{en ? "Keep your household records together, privately." : "บันทึกเรื่องในบ้านร่วมกันอย่างเป็นส่วนตัว"}</p>
    {checking && !recoveryMode ? <><p>{en ? "Connecting to your household..." : "กำลังเชื่อมต่อข้อมูลของบ้าน..."}</p>{cloudError && <p className="cloud-error" role="alert">{cloudError}</p>}{cloudError && <button type="button" className="secondary-button" onClick={() => void cloud?.auth.signOut()}>{en ? "Sign out" : "ออกจากระบบ"}</button>}</> : <>
      <h2>{recoveryMode ? (en ? "Set a new password" : "ตั้งรหัสผ่านใหม่") : mode === "signup" ? (en ? "Create an account" : "สมัครสมาชิก") : mode === "forgot" ? (en ? "Reset your password" : "ตั้งรหัสผ่านใหม่") : (en ? "Sign in" : "เข้าสู่ระบบ")}</h2>
      <form onSubmit={submit}>
        {!recoveryMode && <label className="form-label">{en ? "Email" : "อีเมล"}<input type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)}/></label>}
        {(recoveryMode || mode !== "forgot") && <label className="form-label">{recoveryMode ? (en ? "New password" : "รหัสผ่านใหม่") : (en ? "Password" : "รหัสผ่าน")}<input type="password" autoComplete={mode === "login" && !recoveryMode ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)}/></label>}
        {(recoveryMode || mode === "signup") && <label className="form-label">{en ? "Confirm password" : "ยืนยันรหัสผ่าน"}<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/></label>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? (en ? "Please wait..." : "กรุณารอสักครู่...") : recoveryMode ? (en ? "Save new password" : "บันทึกรหัสผ่านใหม่") : mode === "signup" ? (en ? "Create account" : "สร้างบัญชี") : mode === "forgot" ? (en ? "Send reset link" : "ส่งลิงก์ตั้งรหัสผ่าน") : (en ? "Sign in" : "เข้าสู่ระบบ")}</button>
      </form>
      {message && <p className="cloud-auth-success" role="status">{message}</p>}
      {(error || cloudError) && <p className="cloud-error" role="alert">{error || cloudError}</p>}
      {!recoveryMode && <div className="cloud-auth-links">
        {mode !== "login" && <button type="button" onClick={() => changeMode("login")}>{en ? "Back to sign in" : "กลับไปเข้าสู่ระบบ"}</button>}
        {mode === "login" && <><button type="button" onClick={() => changeMode("signup")}>{en ? "Create an account" : "สมัครสมาชิก"}</button><button type="button" onClick={() => changeMode("forgot")}>{en ? "Forgot password?" : "ลืมรหัสผ่าน / เคยเข้าด้วยลิงก์"}</button></>}
      </div>}
    </>}
    <small>{en ? "Your household data is protected by your account." : "ข้อมูลของบ้านจะเปิดให้เฉพาะบัญชีที่เป็นสมาชิก"}</small>
  </section></main>;
}
