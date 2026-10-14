"use client";

import { useEffect, useState, type FormEvent } from "react";
import { cloud, getSignupMethods, getSignupOpen, type SignupMethods } from "@/lib/cloud";

type AuthMode = "login" | "signup" | "magic" | "forgot";

export default function CloudAuth({
  checking,
  recoveryMode,
  language,
  cloudError,
  onRetry,
  onRecoveryComplete,
}: {
  checking: boolean;
  recoveryMode: boolean;
  language: "th" | "en";
  cloudError: string;
  onRetry: () => void;
  onRecoveryComplete: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [signupOpen, setSignupOpenState] = useState<boolean | null>(null);
  const [signupMethods, setSignupMethodsState] = useState<SignupMethods>("both");
  const en = language === "en";

  useEffect(() => {
    let active = true;
    void getSignupOpen().then((open) => { if (active) setSignupOpenState(open); }).catch(() => { if (active) setSignupOpenState(true); });
    void getSignupMethods().then((methods) => { if (active) setSignupMethodsState(methods); }).catch(() => { /* Keep the previous default until the migration is applied. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (signupOpen === false && mode === "signup") setMode("login"); }, [signupOpen, mode]);

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
        if (signupOpen !== true || signupMethods === "email_link") throw new Error(en ? "Password registration is unavailable." : "ขณะนี้ไม่เปิดรับสมัครด้วยรหัสผ่าน");
        const { data, error: authError } = await cloud.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        if (!data.session) setMessage(en ? "Check your email to confirm your account, then sign in." : "ตรวจอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ");
      } else if (mode === "magic") {
        const { error: authError } = await cloud.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: signupOpen === true && signupMethods !== "password", emailRedirectTo: window.location.origin } });
        if (authError) throw authError;
        setMessage(en ? "Check your email for a sign-in link." : "ตรวจอีเมลเพื่อเปิดลิงก์เข้าสู่ระบบ");
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

  if (checking && !recoveryMode && !cloudError) return <main className="cloud-loading-page" role="status" aria-live="polite"><section className="cloud-loading-panel"><span className="cloud-loading-orbit" aria-hidden="true"/><strong>{en ? "Opening your home" : "กำลังเปิดบ้านของเรา"}</strong><p>{en ? "Loading your household records..." : "กำลังเตรียมข้อมูลของบ้าน..."}</p></section></main>;
  return <main className="cloud-auth-page"><section className="cloud-auth-card">
    <span className="brand-mark" aria-hidden="true">⌂</span>
    <h1>{en ? "Our Home" : "บ้านของเรา"}</h1>
    <p>{en ? "Keep your household records together, privately." : "บันทึกเรื่องในบ้านร่วมกันอย่างเป็นส่วนตัว"}</p>
    {checking && !recoveryMode ? <><p>{cloudError ? (en ? "Could not load your household." : "โหลดข้อมูลของบ้านไม่สำเร็จ") : (en ? "Connecting to your household..." : "กำลังเชื่อมต่อข้อมูลของบ้าน...")}</p>{cloudError && <p className="cloud-error" role="alert">{cloudError}</p>}{cloudError && <div className="cloud-auth-retry"><button type="button" className="primary-button" onClick={onRetry}>{en ? "Try again" : "ลองอีกครั้ง"}</button><button type="button" className="secondary-button" onClick={() => void cloud?.auth.signOut()}>{en ? "Sign out" : "ออกจากระบบ"}</button></div>}</> : <>
      <h2>{recoveryMode ? (en ? "Set a new password" : "ตั้งรหัสผ่านใหม่") : mode === "signup" ? (en ? "Register with password" : "สมัครด้วยรหัสผ่าน") : mode === "magic" ? signupOpen ? (en ? "Continue with email link" : "เข้าใช้ด้วยลิงก์อีเมล") : (en ? "Sign in with email link" : "เข้าสู่ระบบด้วยลิงก์อีเมล") : mode === "forgot" ? (en ? "Reset your password" : "ตั้งรหัสผ่านใหม่") : (en ? "Sign in" : "เข้าสู่ระบบ")}</h2>
      <form onSubmit={submit}>
        {!recoveryMode && <label className="form-label">{en ? "Email" : "อีเมล"}<input type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)}/></label>}
        {(recoveryMode || (mode !== "forgot" && mode !== "magic")) && <label className="form-label">{recoveryMode ? (en ? "New password" : "รหัสผ่านใหม่") : (en ? "Password" : "รหัสผ่าน")}<input type="password" autoComplete={mode === "login" && !recoveryMode ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)}/></label>}
        {(recoveryMode || mode === "signup") && <label className="form-label">{en ? "Confirm password" : "ยืนยันรหัสผ่าน"}<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/></label>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? (en ? "Please wait..." : "กรุณารอสักครู่...") : recoveryMode ? (en ? "Save new password" : "บันทึกรหัสผ่านใหม่") : mode === "signup" ? (en ? "Create account" : "สร้างบัญชี") : mode === "magic" ? (en ? "Send email link" : "ส่งลิงก์ทางอีเมล") : mode === "forgot" ? (en ? "Send reset link" : "ส่งลิงก์ตั้งรหัสผ่าน") : (en ? "Sign in" : "เข้าสู่ระบบ")}</button>
      </form>
      {message && <p className="cloud-auth-success" role="status">{message}</p>}
      {(error || cloudError) && <p className="cloud-error" role="alert">{error || cloudError}</p>}
      {!recoveryMode && <div className="cloud-auth-links">
        {mode !== "login" && <button type="button" onClick={() => changeMode("login")}>{en ? "Back to sign in" : "กลับไปเข้าสู่ระบบ"}</button>}
        {mode === "login" && <><button type="button" onClick={() => changeMode("magic")}>{en ? "Email sign-in link" : "เข้าด้วยลิงก์อีเมล"}</button><button type="button" onClick={() => changeMode("forgot")}>{en ? "Forgot password?" : "ลืมรหัสผ่าน"}</button></>}
      </div>}
      {!recoveryMode && mode === "login" && signupOpen === true && <div className="cloud-auth-signup-options"><span>{en ? "New here? Choose how to register" : "ยังไม่มีบัญชี? เลือกวิธีสมัคร"}</span>{signupMethods !== "email_link" && <button type="button" onClick={() => changeMode("signup")}>{en ? "With password" : "สมัครด้วยรหัสผ่าน"}</button>}{signupMethods !== "password" && <button type="button" onClick={() => changeMode("magic")}>{en ? "With email link" : "รับลิงก์ทางอีเมล"}</button>}</div>}
      {!recoveryMode && signupOpen === false && <p className="cloud-signup-closed" role="status">{en ? "New registrations are currently closed. Existing members can still sign in." : "ขณะนี้ปิดรับสมัครสมาชิก สมาชิกเดิมยังเข้าสู่ระบบได้"}</p>}
    </>}
    <small>{en ? "Your household data is protected by your account." : "ข้อมูลของบ้านจะเปิดให้เฉพาะบัญชีที่เป็นสมาชิก"}</small>
  </section></main>;
}
