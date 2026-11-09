import { t, LanguagePicker } from "./i18n";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { db, authErrorMessage } from "./db";
import { Brand, type VisitorPage } from "./Landing";
type Props = {
  mode: VisitorPage;
  go: (p: VisitorPage) => void;
  dark: boolean;
  toggle: () => void;
  onAuthenticated?: () => void;
};
export function EmailAuth({ mode, go, dark, toggle, onAuthenticated }: Props) {
  const [requestId, setRequestId] = useState(""),
    [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [code, setCode] = useState(""),
    [codeLength, setCodeLength] = useState(8),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false),
    [now, setNow] = useState(Date.now()),
    [resendAt, setResendAt] = useState(0),
    [expiresAt, setExpiresAt] = useState(0),
    [accepted, setAccepted] = useState(false);
  const lock = useRef(false);
  const signup = mode === "register",
    recovery = mode === "forgot",
    reset = mode === "reset";
  useEffect(() => {
    setRequestId("");
    setPassword("");
    setConfirmPassword("");
    setCode("");
    setNote("");
    setError("");
    setAccepted(false);
    setVisible(false);
    setResendAt(0);
    setExpiresAt(0);
  }, [mode]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000)),
    cooldown = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const strength = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function invoke(body: Record<string, string>) {
    const { data, error } = await db.functions.invoke("emailjs-registration", {
      body,
    });
    if (error) {
      let detail;
      try {
        detail = await error.context?.json?.();
      } catch {}
      throw Error(
        detail?.error || "Tasdiqlash xizmati bilan bog‘lanib bo‘lmadi.",
      );
    }
    return data;
  }
  async function send() {
    if (requestId && Date.now() < resendAt) throw Error("Bir daqiqa kuting.");
    const result = await invoke({
      action: "send",
      flow: recovery ? "recovery" : "signup",
      email,
      name,
    });
    setNow(Date.now());
    setRequestId(result.requestId);
    setCodeLength(result.codeLength === 6 ? 6 : 8);
    setCode("");
    setResendAt(Date.now() + 60000);
    setExpiresAt(Date.now() + result.expiresIn * 1000);
    setNote(
      recovery
        ? "Agar bu email tasdiqlangan hisobga tegishli bo‘lsa, tiklash kodi yuboriladi. Spam papkasini ham tekshiring."
        : "EmailJS orqali tasdiqlash kodi yuborildi. Spam papkasini ham tekshiring.",
    );
  }
  async function submit() {
    if (reset) {
      if (password !== confirmPassword) throw Error("Parollar mos kelmadi.");
      const { data } = await db.auth.getSession();
      if (!data.session)
        throw Error("Avval emailingizni kod orqali tasdiqlang.");
      const { error } = await db.auth.updateUser({ password });
      if (error) throw error;
      const signedOut = await db.auth.signOut({ scope: "local" });
      if (signedOut.error) throw signedOut.error;
      setPassword("");
      go("login");
      return;
    }
    if (requestId) {
      if (remaining === 0)
        throw Error("Kod muddati tugadi. Yangi kod so‘rang.");
      const result = await invoke({
        action: "verify",
        requestId,
        email,
        code,
        password,
        name,
      });
      if (
        result.flow !== (recovery ? "recovery" : "signup") ||
        !result.session?.access_token ||
        !result.session?.refresh_token
      )
        throw Error("Tasdiqlash xizmati bilan bog‘lanib bo‘lmadi.");
      const { data, error } = await db.auth.setSession(result.session);
      if (error) throw error;
      if (!data.session)
        throw Error("Tasdiqlash xizmati bilan bog‘lanib bo‘lmadi.");
      setPassword("");
      go(recovery ? "reset" : "home");
      return;
    }
    if (signup) {
      if (password !== confirmPassword) throw Error("Parollar mos kelmadi.");
      if (!accepted) throw Error("Foydalanish shartlarini qabul qiling.");
      await send();
      return;
    }
    if (recovery) {
      await send();
      return;
    }
    const { error } = await db.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    if (onAuthenticated) onAuthenticated();
    else go("home");
  }
  return (
    <div className="auth-shell">
      <div className="auth-story">
        <a href="#/home" onClick={() => go("home")}>
          <Brand />
        </a>
        <div>
          <span className="tiny-label">{t("A CLEARER PATH FORWARD")}</span>
          <h1>
            {t("Your ambition.")}
            <br />
            {t("Our shared")}
            <br />
            <em>{t("starting point.")}</em>
          </h1>
          <p>
            {t(
              "Bilimingizni mustahkamlang. Natijalaringizni kuzating. Har kuni maqsadingiz sari bir qadam tashlang.",
            )}
          </p>
          <div className="story-line" />
          <p className="story-foot">TRAINING AND FUTURE EXCELLENCE</p>
        </div>
        <small>{t("Prepare Smarter. Achieve More.")}</small>
      </div>
      <main className="auth-content">
        <div className="auth-top">
          <LanguagePicker />
          <button onClick={() => go("home")}>
            <ArrowLeft size={16} />
            {t("Bosh sahifa")}
          </button>
          <button
            className="icon-button"
            aria-label={t("Rang rejimini almashtirish")}
            onClick={toggle}
          >
            {dark ? <Sun /> : <Moon />}
          </button>
        </div>
        <div className="auth-form-wrap">
          <span className="auth-symbol">
            {requestId ? <ShieldCheck /> : <Mail />}
          </span>
          <p className="eyebrow">{t("WELCOME TO TAFE")}</p>
          <h1>
            {requestId
              ? t("Verify your email address")
              : reset
                ? t("Yangi parol yarating")
                : signup
                  ? t("Kelajagingizga birinchi qadam.")
                  : recovery
                    ? t("Parolni tiklash")
                    : t("Yana xush kelibsiz.")}
          </h1>
          <p className="muted">
            {requestId ? (
              <>
                {recovery
                  ? t("Yangi kodni emailingizdan tekshiring.")
                  : t(
                      "We have sent a verification code to your email address.",
                    )}
                <br />
                <strong>{email}</strong>
              </>
            ) : reset ? (
              t("Hisobingiz uchun yangi parol kiriting.")
            ) : signup ? (
              t("Hisob yarating va tayyorgarligingizni boshlang.")
            ) : recovery ? (
              t("Hisob emailingizga tasdiqlash kodi yuboramiz.")
            ) : (
              t("Hisobingizga kiring va o‘rganishni davom ettiring.")
            )}
          </p>
          {error && (
            <div role="alert" className="error">
              {t(error)}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(submit);
            }}
          >
            {signup && !requestId && (
              <label>
                {t("To‘liq ism")}
                <input
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  required
                  disabled={busy}
                />
              </label>
            )}
            {!reset && !requestId && (
              <label>
                {t("Email manzil")}
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  required
                  disabled={busy}
                />
              </label>
            )}
            {!requestId && !recovery && (
              <>
                <label>
                  {t("Parol")}
                  <div className="password-field">
                    <input
                      type={visible ? "text" : "password"}
                      autoComplete={
                        signup || reset ? "new-password" : "current-password"
                      }
                      minLength={signup || reset ? 8 : undefined}
                      maxLength={signup || reset ? 128 : undefined}
                      name="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={busy}
                    />
                    <button
                      type="button"
                      aria-label={
                        visible
                          ? t("Parolni yashirish")
                          : t("Parolni ko‘rsatish")
                      }
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                {(signup || reset) && (
                  <>
                    <div className="strength" aria-label={t("Parol kuchi")}>
                      {[1, 2, 3, 4].map((n) => (
                        <span
                          key={n}
                          className={strength >= n ? "filled" : ""}
                        />
                      ))}
                    </div>
                    <small className="muted">
                      {t(
                        "Kamida 8 belgi. Katta harf, son va belgilar parolni kuchaytiradi.",
                      )}
                    </small>
                    <label>
                      {t("Parolni tasdiqlash")}
                      <input
                        type={visible ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={busy}
                      />
                    </label>
                  </>
                )}
              </>
            )}
            {signup && !requestId && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  required
                  disabled={busy}
                />
                <span>
                  <a href="#/terms" target="_blank">
                    {t("Foydalanish shartlari")}
                  </a>{" "}
                  {t("va")}{" "}
                  <a href="#/privacy" target="_blank">
                    {t("maxfiylik siyosati")}
                  </a>{" "}
                  {t("bilan tanishdim va qabul qilaman.")}
                </span>
              </label>
            )}
            {requestId && (
              <>
                <label>
                  {recovery ? (
                    t("Tasdiqlash kodi")
                  ) : (
                    <>
                      {t("Tasdiqlash kodi (")}
                      {codeLength}
                      {t(" xonali)")}
                    </>
                  )}
                  <input
                    className="otp-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern={
                      recovery
                        ? "[0-9]{6}|[0-9]{8}"
                        : "[0-9]{" + codeLength + "}"
                    }
                    minLength={recovery ? 6 : codeLength}
                    maxLength={codeLength}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                    disabled={busy}
                    autoFocus
                  />
                </label>
                <span className="countdown" role="timer">
                  {remaining
                    ? Math.floor(remaining / 60) +
                      ":" +
                      String(remaining % 60).padStart(2, "0") +
                      t(" vaqt qoldi")
                    : t("Kod muddati tugadi")}
                </span>
              </>
            )}
            {!signup && !requestId && !recovery && !reset && (
              <button
                className="forgot-link"
                type="button"
                onClick={() => go("forgot")}
              >
                {t("Parolni unutdingizmi?")}
              </button>
            )}
            <button
              className="primary full-width"
              disabled={busy || (!!requestId && remaining === 0)}
            >
              {busy
                ? t("Kutilmoqda…")
                : requestId
                  ? t("Kodni tasdiqlash")
                  : reset
                    ? t("Parolni saqlash")
                    : signup
                      ? t("Emailga kod yuborish")
                      : recovery
                        ? t("Tiklash kodini yuborish")
                        : t("Hisobga kirish")}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-note" role="status">
            {t(note)}
          </p>
          {requestId ? (
            <div className="resend-controls">
              <button
                disabled={busy || cooldown > 0}
                onClick={() => void run(send)}
              >
                {cooldown
                  ? t("Qayta yuborish (") + cooldown + "s)"
                  : t("Kodni qayta yuborish")}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setRequestId("");
                  setCode("");
                  setNote("");
                }}
              >
                {t("Emailni o‘zgartirish")}
              </button>
            </div>
          ) : (
            !reset && (
              <p className="auth-switch">
                {signup ? t("Hisobingiz bormi?") : t("TAFE’da yangimisiz?")}{" "}
                <button
                  disabled={busy}
                  onClick={() => go(signup ? "login" : "register")}
                >
                  {signup ? t("Kirish") : t("Hisob yaratish")}
                </button>
              </p>
            )
          )}
          <p className="auth-security">
            <ShieldCheck size={14} />
            {t("Supabase Auth bilan himoyalangan")}
          </p>
        </div>
        <small className="auth-copyright">
          © TAFE · Training And Future Excellence
        </small>
      </main>
    </div>
  );
}
