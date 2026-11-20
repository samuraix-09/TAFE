import { t } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { Check, Circle, Flag, Maximize, ShieldCheck } from "lucide-react";
import { supabaseUrl, supabasePublicKey } from "./db";
import { Feedback, QuestionInput, rpc, signed, type Row } from "./platform";
import "./exam-session.css";

type Action = "save" | "finish" | "advance" | "leave" | "return" | "status";

export function fullScreenEnabled() {
  return (
    !!document.fullscreenEnabled &&
    typeof document.documentElement.requestFullscreen === "function"
  );
}

function hasAnswer(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.some(hasAnswer);
  if (typeof value === "object") return Object.values(value).some(hasAnswer);
  return true;
}

export function ExamPlayer({
  attempt,
  onDone,
  accessToken,
}: {
  attempt: Row;
  onDone: (id: string) => void;
  accessToken: string;
}) {
  const [current, setCurrent] = useState(attempt);
  const [answers, setAnswers] = useState<Row>(attempt.answers || {});
  const [index, setIndex] = useState(0);
  const retryAfter = useRef(0);
  const [flags, setFlags] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("tafe-flags-" + attempt.id) || "[]",
      );
      return Array.isArray(saved)
        ? saved.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [clock, setClock] = useState(Date.now);
  const [outside, setOutside] = useState(
    () => fullScreenEnabled() && !document.fullscreenElement,
  );
  const [leaveAt, setLeaveAt] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const qHeading = useRef<HTMLHeadingElement>(null);
  const latest = useRef(answers);
  const session = useRef(current);
  const queue = useRef(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenLeftAt = useRef<number | null>(null);
  const retryScreenAction = useRef<"leave" | "return" | null>(null);
  const lastOutside = useRef(outside);
  const done = useRef(false);
  const pending = useRef(0);
  const transition = useRef(false);
  const active = useRef(true);
  const offset = useRef(
    attempt.server_time ? Date.parse(attempt.server_time) - Date.now() : 0,
  );
  const stage: number | null = current.stage ?? null;
  const nextModule = stage !== null && stage + 1 < (current.stage_count ?? 0);
  const deadline = current.fullscreen_deadline
    ? Date.parse(current.fullscreen_deadline)
    : null;
  const now = clock + offset.current;
  const grace =
    leaveAt !== null
      ? Math.min(10, Math.max(0, Math.ceil((leaveAt + 10000 - clock) / 1000)))
      : deadline !== null
        ? Math.max(0, Math.ceil((deadline - now) / 1000))
        : 10;
  const seconds = Math.max(
    0,
    Math.ceil(
      (Date.parse(current.module_expires_at || current.expires_at) - now) /
        1000,
    ),
  );
  const waitingToReturn = outside || deadline !== null || leaveAt !== null;
  const blocked = waitingToReturn || confirming;

  function send(action: Action, snapshot = latest.current) {
    const expectedStage = session.current.stage ?? null;
    pending.current++;
    setSaving(true);
    queue.current = queue.current
      .then(async () => {
        if (done.current) return;
        const stage = session.current.stage ?? null;
        const screenAction =
          action === "leave" || action === "return" || action === "status";
        if (stage !== expectedStage && !screenAction) return;
        const result = await rpc("exam_session_action", {
          attempt: attempt.id,
          response: stage === expectedStage ? snapshot : latest.current,
          action,
          stage,
        });
        if (result.submitted) {
          done.current = true;
          localStorage.removeItem("tafe-flags-" + attempt.id);
          if (active.current) onDone(attempt.id);
          return;
        }
        if (!active.current) return;
        offset.current = Date.parse(result.server_time) - Date.now();
        setClock(Date.now());
        session.current = result;
        setCurrent(result);
        setError("");
        if (action === "leave" || action === "return")
          retryScreenAction.current = null;
        if (
          action === "return" &&
          !result.fullscreen_deadline &&
          !lastOutside.current
        ) {
          screenLeftAt.current = null;
          setLeaveAt(null);
        }
        if ((result.stage ?? null) !== stage) {
          latest.current = result.answers;
          setAnswers(result.answers);
          setIndex(0);
        }
      })
      .catch((e) => {
        retryAfter.current = Date.now() + 1500;
        if (action === "leave" || action === "return")
          retryScreenAction.current = action;
        if (active.current) setError(e.message);
      })
      .finally(() => {
        pending.current--;
        if (action === "advance" || action === "finish") {
          transition.current = false;
          if (active.current) setFinishing(false);
        }
        if (active.current) setSaving(pending.current > 0);
      });
  }

  function flushTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function changeScreen() {
    const nextOutside =
      document.hidden || (fullScreenEnabled() && !document.fullscreenElement);
    if (nextOutside === lastOutside.current) return;
    lastOutside.current = nextOutside;
    setOutside(nextOutside);
    flushTimer();
    if (nextOutside) {
      setConfirming(false);
      screenLeftAt.current ??= Date.now();
      setLeaveAt(screenLeftAt.current);
      send("leave");
    } else if (
      screenLeftAt.current === null ||
      Date.now() < screenLeftAt.current + 10000
    ) {
      send("return");
    }
  }

  useEffect(() => {
    active.current = true;
    const interval = setInterval(() => setClock(Date.now()), 250);
    document.addEventListener("fullscreenchange", changeScreen);
    document.addEventListener("visibilitychange", changeScreen);
    const leavePage = () => {
      if (done.current) return;
      const payload = JSON.stringify({
        attempt: attempt.id,
        response: latest.current,
        action: "leave",
        stage: session.current.stage ?? null,
      });
      // Keepalive allows this last save to continue during reload or tab close.
      const response =
        new TextEncoder().encode(payload).byteLength < 60000
          ? payload
          : JSON.stringify({
              attempt: attempt.id,
              response: {},
              action: "leave",
              stage: session.current.stage ?? null,
            });
      void fetch(supabaseUrl + "/rest/v1/rpc/exam_session_action", {
        method: "POST",
        keepalive: true,
        body: response,
        headers: {
          apikey: supabasePublicKey,
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
      }).catch(() => {});
    };
    window.addEventListener("pagehide", leavePage);
    if (attempt.fullscreen_deadline && !lastOutside.current) send("return");
    return () => {
      active.current = false;
      clearInterval(interval);
      flushTimer();
      document.removeEventListener("fullscreenchange", changeScreen);
      document.removeEventListener("visibilitychange", changeScreen);
      window.removeEventListener("pagehide", leavePage);
    };
  }, [attempt.id, accessToken]);

  useEffect(() => {
    if (
      done.current ||
      pending.current ||
      transition.current ||
      Date.now() < retryAfter.current
    )
      return;
    if (retryScreenAction.current) {
      const action = retryScreenAction.current;
      const elapsed =
        deadline !== null
          ? now >= deadline
          : screenLeftAt.current !== null &&
            Date.now() >= screenLeftAt.current + 10000;
      retryScreenAction.current = null;
      send(action === "return" && elapsed ? "status" : action);
      return;
    }
    if (deadline && now >= deadline) {
      send("status", {});
      return;
    }
    if (!seconds && !waitingToReturn) finish();
  }, [clock, deadline, seconds, waitingToReturn]);

  useEffect(() => {
    let live = true;
    if (attempt.passage_image)
      void signed("tafe-test-images", attempt.passage_image)
        .then((src) => {
          if (live) setImage(src);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [attempt.passage_image]);

  useEffect(() => {
    localStorage.setItem("tafe-flags-" + attempt.id, JSON.stringify(flags));
  }, [flags, attempt.id]);

  function enterFullscreen() {
    if (document.fullscreenElement) {
      changeScreen();
      return;
    }
    void document.documentElement
      .requestFullscreen()
      .then(changeScreen)
      .catch(() =>
        setError(t("Brauzer to‘liq ekranga o‘tishga ruxsat bermadi.")),
      );
  }

  function finish() {
    if (done.current || transition.current || waitingToReturn) return;
    setConfirming(false);
    transition.current = true;
    flushTimer();
    setFinishing(true);
    send(stage === null ? "finish" : "advance");
  }

  function goToQuestion(next: number) {
    if (blocked || next === index) return;
    setIndex(next);
    if (matchMedia("(max-width: 700px)").matches) {
      requestAnimationFrame(() => {
        qHeading.current?.focus({ preventScroll: true });
        qHeading.current?.scrollIntoView({ block: "start" });
      });
    }
  }

  const attemptQuestions: Row[] = current.questions;
  const q = attemptQuestions[index] ?? attemptQuestions[0];
  const answered = attemptQuestions.filter((item) =>
    hasAnswer(answers[item.id]),
  ).length;

  function update(value: unknown) {
    if (blocked || done.current || transition.current) return;
    const next = { ...latest.current, [q.id]: value };
    latest.current = next;
    setAnswers(next);
    setSaving(true);
    flushTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      send("save", next);
    }, 250);
  }

  return (
    <main className="exam-view">
      <div className="exam-content" inert={blocked}>
        <div className="exam-toolbar">
          <div>
            <p className="eyebrow">
              {stage === null
                ? t("Test sessiyasi")
                : `${stage < 2 ? t("Reading and Writing") : t("Math")} · ${t("Modul")} ${(stage % 2) + 1}/2`}
            </p>
            <h1>{attempt.title || t("Test topshirish")}</h1>
            <small>
              <ShieldCheck size={13} />{" "}
              {saving
                ? t("Saqlanmoqda…")
                : error
                  ? t("Qayta saqlash")
                  : t("Javoblar saqlandi")}
            </small>
          </div>
          <div className={seconds < 60 ? "exam-clock urgent" : "exam-clock"}>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </div>
        </div>
        <Feedback error={error} />
        <div className="exam-progress">
          <span>
            {answered} / {attemptQuestions.length}
            {t(" javob berildi")}
          </span>
          <progress value={answered} max={attemptQuestions.length} />
        </div>
        <p className="muted">{t(attempt.instructions || "")}</p>
        {!fullScreenEnabled() && (
          <p className="muted">
            {t(
              "Bu brauzerda to‘liq ekran mavjud emas. Test vaqtida sahifada qoling.",
            )}
          </p>
        )}
        <div className="exam-layout">
          <div className="exam-question-area">
            {attempt.passage_text && (
              <section className="exam-passage">
                <h2>{attempt.passage_title || t("Test materiali")}</h2>
                <p>{attempt.passage_text}</p>
                {image && (
                  <img
                    className="exam-passage-image"
                    src={image}
                    alt={t("Passage rasmi")}
                  />
                )}
              </section>
            )}
            <section>
              <div className="question-heading">
                <span className="badge">
                  {index + 1}
                  {t("-savol · ")}
                  {stage === null && (
                    <>
                      {q.points || 1}
                      {t(" ball ·")}
                    </>
                  )}{" "}
                  {q.required ? t("majburiy") : t("ixtiyoriy")}
                </span>
                <button
                  className="flag-button"
                  aria-pressed={flags.includes(q.id)}
                  onClick={() =>
                    setFlags((previous) =>
                      previous.includes(q.id)
                        ? previous.filter((id) => id !== q.id)
                        : [...previous, q.id],
                    )
                  }
                >
                  <Flag size={16} aria-hidden="true" />
                  {flags.includes(q.id) ? t("Belgilangan") : t("Belgilash")}
                </button>
              </div>
              {q.group_name && <p className="eyebrow">{q.group_name}</p>}
              <h2 ref={qHeading} tabIndex={-1} className="exam-question-prompt">
                {q.prompt}
              </h2>
              <QuestionInput
                question={q}
                value={answers[q.id]}
                onChange={update}
                disabled={blocked || finishing || seconds === 0}
              />
              <div className="exam-pagination">
                <button
                  disabled={index === 0}
                  onClick={() => goToQuestion(index - 1)}
                >
                  {t("← Oldingi")}
                </button>
                <button
                  disabled={index === attemptQuestions.length - 1}
                  onClick={() => goToQuestion(index + 1)}
                >
                  {t("Keyingi →")}
                </button>
              </div>
            </section>
          </div>
          <section className="exam-navigation">
            <h3>{t("Savollar")}</h3>
            <div className="question-numbers">
              {attemptQuestions.map((item, i) => {
                const isAnswered = hasAnswer(answers[item.id]);
                const isFlagged = flags.includes(item.id);
                const state = isAnswered ? "answered" : "unanswered";
                const status = t(
                  isAnswered ? "Javob berilgan" : "Javob berilmagan",
                );
                return (
                  <button
                    aria-label={`${i + 1}${t("-savol").trimEnd()} · ${status}${isFlagged ? ` · ${t("Belgilangan")}` : ""}`}
                    key={item.id}
                    data-answer={state}
                    data-flagged={isFlagged}
                    aria-current={index === i ? "step" : undefined}
                    onClick={() => goToQuestion(i)}
                  >
                    {i + 1}
                    {isAnswered && (
                      <Check
                        className="exam-number-check"
                        size={11}
                        aria-hidden="true"
                      />
                    )}
                    {isFlagged && (
                      <Flag
                        className="exam-number-flag"
                        size={11}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <ul className="exam-legend">
              <li data-state="answered">
                <Check size={14} aria-hidden="true" />
                {t("Javob berilgan")}
              </li>
              <li data-state="unanswered">
                <Circle size={14} aria-hidden="true" />
                {t("Javob berilmagan")}
              </li>
              <li data-state="flagged">
                <Flag size={14} aria-hidden="true" />
                {t("Belgilangan")}
              </li>
              <li data-state="current">
                <span aria-hidden="true" />
                {t("Joriy savol")}
              </li>
            </ul>
            <button
              className="primary"
              disabled={finishing}
              onClick={() => setConfirming(true)}
            >
              {finishing
                ? t("Yakunlanmoqda…")
                : nextModule
                  ? t("Keyingi modulga o‘tish")
                  : t("Testni yakunlash")}
            </button>
            {error && (
              <button onClick={() => send("save")}>{t("Qayta saqlash")}</button>
            )}
          </section>
        </div>
      </div>
      {confirming && !waitingToReturn && (
        <div className="exam-screen-overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="exam-finish-title"
          >
            <h2 id="exam-finish-title">
              {t(nextModule ? "Keyingi modulga o‘tish" : "Testni yakunlash")}
            </h2>
            <p>
              {t(
                nextModule
                  ? "Keyingi modulga o‘tasizmi? Bu modulga qaytib bo‘lmaydi."
                  : "Testni yakunlaysizmi? Javoblarni keyin o‘zgartirib bo‘lmaydi.",
              )}
            </p>
            <div className="button-row">
              <button autoFocus onClick={() => setConfirming(false)}>
                {t("Bekor qilish")}
              </button>
              <button className="primary" onClick={finish}>
                {t("Tasdiqlash")}
              </button>
            </div>
          </section>
        </div>
      )}
      {waitingToReturn && (
        <div className="exam-screen-overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="exam-screen-title"
          >
            <Maximize size={28} aria-hidden="true" />
            <h2 id="exam-screen-title">{t("To‘liq ekran rejimi")}</h2>
            <p>
              {leaveAt !== null || deadline !== null
                ? t(
                    "Vaqt tugasa, saqlangan javoblar bilan test avtomatik yakunlanadi.",
                  )
                : t("Testni davom ettirish uchun to‘liq ekranga o‘ting.")}
            </p>
            {(leaveAt !== null || deadline !== null) && (
              <strong className="exam-grace" role="timer">
                {grace} {t("soniya")}
              </strong>
            )}
            <Feedback error={error} />
            {grace === 0 ? (
              <button
                className="primary"
                onClick={() =>
                  send(
                    retryScreenAction.current === "leave" ? "leave" : "status",
                    retryScreenAction.current === "leave" ? latest.current : {},
                  )
                }
                disabled={saving}
              >
                {t("Natijani tekshirish")}
              </button>
            ) : fullScreenEnabled() ? (
              <button autoFocus className="primary" onClick={enterFullscreen}>
                {t("To‘liq ekranga qaytish")}
              </button>
            ) : (
              <p>{t("Testni davom ettirish uchun ushbu sahifaga qayting.")}</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
