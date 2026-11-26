import { SatNotation } from "./SatNotation";
import { t } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { Check, Circle, Flag, Maximize, ShieldCheck } from "lucide-react";
import { supabaseUrl, supabasePublicKey } from "./db";
import { Feedback, QuestionInput, rpc, signed, type Row } from "./platform";
import { examPresentation, SatMathTools, splitSatPrompt } from "./ExamTools";
import {
  hasExamAnswer,
  readExamDraft,
  storeExamDraft,
  sameExamAnswer,
} from "./exam-draft";
import { ReadingPassage } from "./ReadingPassage";
import { fullScreenEnabled } from "./exam-fullscreen";
import "./exam-session.css";
import "./sat-exam.css";

type Action =
  | "save"
  | "finish"
  | "advance"
  | "leave"
  | "return"
  | "resume"
  | "status";

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
  const [restored] = useState(() =>
    readExamDraft(
      attempt.id,
      attempt.stage ?? null,
      attempt.answers ?? {},
      attempt.questions.map((q: Row) => q.id),
    ),
  );
  const [answers, setAnswers] = useState<Row>(() => ({
    ...attempt.answers,
    ...restored,
  }));
  const [online, setOnline] = useState(navigator.onLine);
  const approvedAnswers = useRef<Row>(attempt.answers ?? {});
  const needsSave = useRef(Object.keys(restored).length > 0);
  const [index, setIndex] = useState(0);
  const [hideClock, setHideClock] = useState(false);
  const [eliminated, setEliminated] = useState<Record<string, number[]>>({});
  const [largePassage, setLargePassage] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [moduleNotice, setModuleNotice] = useState(false);
  const [questionMenu, setQuestionMenu] = useState(false);
  const retryAfter = useRef(0);
  const [flags, setFlags] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("tafe-flags-" + attempt.id) || "[]",
      );
      return [
        ...new Set<string>([
          ...(attempt.review_flags ?? []),
          ...(Array.isArray(saved)
            ? saved.filter((id): id is string => typeof id === "string")
            : []),
        ]),
      ];
    } catch {
      return [];
    }
  });
  const [clock, setClock] = useState(Date.now);
  const [outside, setOutside] = useState(
    () =>
      document.hidden || (fullScreenEnabled() && !document.fullscreenElement),
  );
  const [leaveAt, setLeaveAt] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const qHeading = useRef<HTMLHeadingElement>(null);
  const passagePanel = useRef<HTMLElement>(null);
  const questionPanel = useRef<HTMLElement>(null);
  const questionRail = useRef<HTMLDivElement>(null);
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
  const presentation = examPresentation(
    attempt.category ?? "",
    attempt.title ?? "",
    stage,
  );
  const sat = presentation === "sat";
  const ielts = presentation === "ielts";
  const ieltsReading =
    ielts && !/listening|writing|speaking/i.test(attempt.section ?? "");
  const cefr = presentation === "cefr";
  const satMath =
    sat &&
    (stage !== null
      ? stage >= 2
      : /math/i.test(attempt.section ?? attempt.title ?? ""));
  const nextModule = stage !== null && stage + 1 < (current.stage_count ?? 0);
  const deadline = current.fullscreen_deadline
    ? Date.parse(current.fullscreen_deadline)
    : null;
  const now = clock + offset.current;
  const pausedAt = current.paused_at ? Date.parse(current.paused_at) : null;
  const grace =
    leaveAt !== null
      ? Math.min(10, Math.max(0, Math.ceil((leaveAt + 10000 - clock) / 1000)))
      : deadline !== null
        ? Math.max(0, Math.ceil((deadline - now) / 1000))
        : 10;
  const seconds = Math.max(
    0,
    Math.ceil(
      (Date.parse(current.module_expires_at || current.expires_at) -
        (pausedAt ?? now)) /
        1000,
    ),
  );
  const waitingToReturn =
    outside || deadline !== null || leaveAt !== null || pausedAt !== null;
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
          action === "leave" ||
          action === "return" ||
          action === "resume" ||
          action === "status";
        if (stage !== expectedStage && !screenAction) return;
        const result = await rpc("exam_session_action", {
          attempt: attempt.id,
          response: stage === expectedStage ? snapshot : latest.current,
          action,
          stage,
        });
        if (result.submitted) {
          done.current = true;
          storeExamDraft(attempt.id, stage, {}, {});
          try {
            localStorage.removeItem("tafe-flags-" + attempt.id);
          } catch {
            /* Browser storage is optional. */
          }
          if (active.current) onDone(attempt.id);
          return;
        }
        if (!active.current) return;
        offset.current = Date.parse(result.server_time) - Date.now();
        setClock(Date.now());
        session.current = result;
        setCurrent(result);
        approvedAnswers.current = result.answers ?? {};
        if (action === "save" || action === "leave")
          needsSave.current = Object.entries(latest.current).some(
            ([key, value]) =>
              !sameExamAnswer(value, approvedAnswers.current[key]),
          );
        setError("");
        if (
          action === "leave" ||
          action === "return" ||
          action === "resume" ||
          result.paused_at
        )
          retryScreenAction.current = null;
        if (
          (action === "return" || action === "resume") &&
          !result.fullscreen_deadline &&
          !result.paused_at &&
          !lastOutside.current
        ) {
          screenLeftAt.current = null;
          setLeaveAt(null);
        }
        if (action === "resume" && !result.paused_at && lastOutside.current) {
          screenLeftAt.current = Date.now();
          setLeaveAt(screenLeftAt.current);
          send("leave");
        }
        if ((result.stage ?? null) !== stage) {
          latest.current = approvedAnswers.current;
          setAnswers(approvedAnswers.current);
          needsSave.current = false;
          if (result.adaptive && result.route) setModuleNotice(true);
          setIndex(0);
          setQuestionMenu(false);
          setHideClock(false);
        }
        storeExamDraft(
          attempt.id,
          result.stage ?? null,
          approvedAnswers.current,
          latest.current,
        );
      })
      .catch((e) => {
        retryAfter.current = Date.now() + 1500;
        if (action === "leave" || action === "return")
          retryScreenAction.current = action;
        if (action === "save") {
          needsSave.current =
            !navigator.onLine ||
            /fetch|network|timeout|connection|offline/i.test(e.message);
          if (needsSave.current) retryAfter.current = Date.now() + 2500;
        }
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
    if (session.current.paused_at) return;
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
    const updateConnection = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    document.addEventListener("fullscreenchange", changeScreen);
    document.addEventListener("visibilitychange", changeScreen);
    const leavePage = () => {
      if (done.current || session.current.paused_at) return;
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
    if (!attempt.paused_at) {
      if (lastOutside.current && !attempt.fullscreen_deadline) {
        screenLeftAt.current = Date.now();
        setLeaveAt(screenLeftAt.current);
        send("leave");
      } else if (attempt.fullscreen_deadline && !lastOutside.current) {
        send("return");
      }
    }
    return () => {
      active.current = false;
      clearInterval(interval);
      flushTimer();
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      document.removeEventListener("fullscreenchange", changeScreen);
      document.removeEventListener("visibilitychange", changeScreen);
      window.removeEventListener("pagehide", leavePage);
    };
  }, [attempt.id, accessToken]);

  useEffect(() => {
    if (
      done.current ||
      !online ||
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
    if (!seconds && !waitingToReturn) {
      finish();
      return;
    }
    if (needsSave.current && !waitingToReturn && !timer.current) {
      needsSave.current = false;
      send("save");
    }
  }, [clock, deadline, seconds, waitingToReturn, online]);

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
    try {
      localStorage.setItem("tafe-flags-" + attempt.id, JSON.stringify(flags));
    } catch {
      /* Browser storage is optional. */
    }
  }, [flags, attempt.id]);

  useEffect(() => {
    const rail = questionRail.current;
    const button = rail?.querySelector('[aria-current="step"]');
    if (!ielts || !rail || !button) return;
    const bounds = rail.getBoundingClientRect();
    const activeButton = button.getBoundingClientRect();
    if (activeButton.right > bounds.right)
      rail.scrollLeft += activeButton.right - bounds.right + 6;
    else if (activeButton.left < bounds.left)
      rail.scrollLeft -= bounds.left - activeButton.left + 6;
  }, [ielts, index]);

  function enterFullscreen(resume = false) {
    const enter =
      fullScreenEnabled() && !document.fullscreenElement
        ? document.documentElement.requestFullscreen()
        : Promise.resolve();
    void enter
      .then(() => {
        changeScreen();
        if (resume && !document.hidden) send("resume", {});
      })
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
    if (blocked) return;
    setQuestionMenu(false);
    if (next === index) return;
    setIndex(next);
    requestAnimationFrame(() => {
      qHeading.current?.focus({ preventScroll: true });
      if (ielts && questionPanel.current) questionPanel.current.scrollTop = 0;
      else qHeading.current?.scrollIntoView({ block: "nearest" });
    });
  }

  const attemptQuestions: Row[] = current.questions;
  const q = attemptQuestions[index] ?? attemptQuestions[0];
  const [stimulus, prompt] = sat ? splitSatPrompt(q.prompt) : ["", q.prompt];
  const passageText = q.config?.passage || attempt.passage_text || stimulus;
  const svg =
    q.config?.opensat && q.config.svg
      ? "data:image/svg+xml," + encodeURIComponent(q.config.svg)
      : null;
  const passageTitle =
    attempt.passage_title || t(sat ? "Savol matni" : "Test materiali");
  const sectionTitle =
    stage !== null
      ? `${t(satMath ? "Math" : "Reading and Writing")} · ${t("Modul")} ${(stage % 2) + 1}/2`
      : attempt.section || t("Test sessiyasi");
  const examTitle = t(attempt.title || "Test topshirish");
  const answered = attemptQuestions.filter((item) =>
    hasExamAnswer(answers[item.id]),
  ).length;

  function update(value: unknown) {
    if (blocked || done.current || transition.current) return;
    const next = { ...latest.current, [q.id]: value };
    latest.current = next;
    needsSave.current = true;
    storeExamDraft(attempt.id, stage, approvedAnswers.current, next);
    setAnswers(next);
    setSaving(true);
    flushTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      send("save", next);
    }, 250);
  }

  const questionHeading = (
    <div className="question-heading">
      <span className="badge">
        {index + 1}
        {t(sat ? "-savol" : "-savol · ")}
        {!sat && stage === null && (
          <>
            {q.points || 1}
            {t(" ball ·")}
          </>
        )}
        {!sat && <> {q.required ? t("majburiy") : t("ixtiyoriy")}</>}
      </span>
      <button
        className="flag-button"
        aria-pressed={flags.includes(q.id)}
        onClick={() => {
          const next = flags.includes(q.id)
            ? flags.filter((id) => id !== q.id)
            : [...flags, q.id];
          setFlags(next);
          if (current.adaptive)
            queue.current = queue.current
              .then(async () => {
                await rpc("opensat_review_flags", {
                  attempt: attempt.id,
                  flags: next,
                });
              })
              .catch((e) => setError(e.message));
        }}
      >
        <Flag size={16} aria-hidden="true" />
        {flags.includes(q.id) ? t("Belgilangan") : t("Belgilash")}
      </button>
    </div>
  );
  const pagination = (
    <div className="exam-pagination">
      <button disabled={index === 0} onClick={() => goToQuestion(index - 1)}>
        {t("← Oldingi")}
      </button>
      <button
        disabled={index === attemptQuestions.length - 1}
        onClick={() => goToQuestion(index + 1)}
      >
        {t("Keyingi →")}
      </button>
    </div>
  );
  const saveStatus = (
    <small role="status">
      <ShieldCheck size={13} aria-hidden="true" />{" "}
      {!online
        ? t("Aloqa uzildi. Javoblar ushbu oynada saqlanmoqda.")
        : saving
          ? t("Saqlanmoqda…")
          : error
            ? t("Qayta saqlash")
            : t("Javoblar saqlandi")}
    </small>
  );

  return (
    <main className="exam-view" data-exam={presentation}>
      {sat && (
        <header className="sat-exam-header">
          <div className="tafe-brand">
            <img
              className="tafe-logo-light"
              src="/tafe-logo-light.svg"
              alt="TAFE"
              width={150}
              height={42}
            />
            <img
              className="tafe-logo-dark"
              src="/tafe-logo-dark.svg"
              alt="TAFE"
              width={150}
              height={42}
            />
          </div>
          <h1>{t("Digital SAT mashq testi")}</h1>
          {saveStatus}
        </header>
      )}
      <div
        className="exam-content"
        inert={blocked || moduleNotice}
        onKeyDown={(event) => {
          if (
            !current.adaptive ||
            blocked ||
            moduleNotice ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            (event.target as HTMLElement).closest(
              "input,textarea,select,button,[contenteditable]",
            )
          )
            return;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            goToQuestion(
              Math.max(
                0,
                Math.min(
                  attemptQuestions.length - 1,
                  index + (event.key === "ArrowRight" ? 1 : -1),
                ),
              ),
            );
          }
        }}
      >
        <div className="exam-toolbar">
          <div>
            {sat ? (
              <div className="sat-exam-details">
                <span className="sat-module-label">{sectionTitle}</span>
                <strong>
                  {t("Savollar")} {index + 1} / {attemptQuestions.length}
                </strong>
                {attempt.title && (
                  <span className="sat-exam-name">{examTitle}</span>
                )}
              </div>
            ) : (
              <>
                <p className="eyebrow exam-kind">
                  {presentation === "standard"
                    ? sectionTitle
                    : `${presentation.toUpperCase()} · ${sectionTitle}`}
                </p>
                <h1>{examTitle}</h1>
                {saveStatus}
              </>
            )}
          </div>
          <div className="exam-timer-group">
            {(!sat || !hideClock || seconds <= 300) && (
              <div
                className={seconds < 60 ? "exam-clock urgent" : "exam-clock"}
                aria-label={t("Qolgan vaqt")}
              >
                {sat && (
                  <span className="sat-clock-label" aria-hidden="true">
                    {t("Qolgan vaqt")}
                  </span>
                )}
                {Math.floor(seconds / 60)}:
                {String(seconds % 60).padStart(2, "0")}
              </div>
            )}
            {sat && seconds > 300 && (
              <button
                type="button"
                onClick={() => setHideClock((value) => !value)}
              >
                {t(hideClock ? "Taymerni ko‘rsatish" : "Taymerni yashirish")}
              </button>
            )}
          </div>
        </div>
        <Feedback error={error} />
        <div className="exam-progress">
          <span>
            {answered} / {attemptQuestions.length}
            {t(" javob berildi")}
          </span>
          <progress
            aria-label={t("Javob berilgan")}
            value={answered}
            max={attemptQuestions.length}
          />
        </div>
        {sat && stage !== null && (
          <ol className="exam-module-track" aria-label={t("Modullar")}>
            {Array.from({ length: current.stage_count ?? 4 }, (_, i) => (
              <li
                key={i}
                data-complete={i < stage}
                aria-current={i === stage ? "step" : undefined}
              >
                {t(i < 2 ? "Reading and Writing" : "Math")} {(i % 2) + 1}
              </li>
            ))}
          </ol>
        )}
        {!sat && attempt.instructions && (
          <p className="muted exam-instructions">{t(attempt.instructions)}</p>
        )}
        {current.adaptive && (
          <div className="opensat-tools">
            <small>OpenSAT · TAFE moslashuvchan simulyatsiyasi</small>
            <button
              disabled={zoom <= 1}
              onClick={() => setZoom(zoom - 0.15)}
              aria-label="Kichraytirish"
            >
              A−
            </button>
            <button
              disabled={zoom >= 1.45}
              onClick={() => setZoom(zoom + 0.15)}
              aria-label="Kattalashtirish"
            >
              A+
            </button>
          </div>
        )}
        {!fullScreenEnabled() && (
          <p className="muted">
            {t(
              "Bu brauzerda to‘liq ekran mavjud emas. Test vaqtida sahifada qoling.",
            )}
          </p>
        )}
        <div
          className="exam-layout"
          style={current.adaptive ? { zoom } : undefined}
        >
          <div
            className="exam-question-area"
            data-split={Boolean(ielts && (passageText || image))}
          >
            {sat && questionHeading}
            {(passageText || image) && (
              <section
                className="exam-passage"
                data-large={largePassage}
                aria-label={passageTitle}
                ref={passagePanel}
                tabIndex={-1}
              >
                <div className="exam-passage-toolbar">
                  <h2>{passageTitle}</h2>
                  {ielts && (
                    <button
                      type="button"
                      aria-pressed={largePassage}
                      onClick={() => setLargePassage((value) => !value)}
                    >
                      {t("Katta matn")}
                    </button>
                  )}
                </div>
                {(ieltsReading || current.adaptive) && passageText ? (
                  <ReadingPassage
                    key={current.adaptive ? q.id : attempt.id}
                    attemptId={
                      current.adaptive ? attempt.id + "-" + q.id : attempt.id
                    }
                    text={passageText}
                    activePart={/\bPassage\s+([A-Z])\b/i
                      .exec(q.group_name || q.prompt)?.[1]
                      ?.toUpperCase()}
                  />
                ) : (
                  <p>{passageText}</p>
                )}
                {image && (
                  <img
                    className="exam-passage-image"
                    src={image}
                    alt={t("Passage rasmi")}
                  />
                )}
              </section>
            )}
            <section
              className="exam-question-panel"
              ref={questionPanel}
              aria-label={t("Savol va javob")}
            >
              {!sat && questionHeading}
              {q.group_name && <p className="eyebrow">{q.group_name}</p>}
              {(ielts || cefr) && passageText && (
                <button
                  className="exam-show-passage"
                  type="button"
                  onClick={() => {
                    passagePanel.current?.focus({ preventScroll: true });
                    passagePanel.current?.scrollIntoView({ block: "start" });
                  }}
                >
                  {t("Test materiali")}
                </button>
              )}
              <h2 ref={qHeading} tabIndex={-1} className="exam-question-prompt">
                {current.adaptive ? <SatNotation text={q.prompt} /> : prompt}
              </h2>
              {svg && (
                <img
                  className="exam-passage-image"
                  src={svg}
                  alt="Savol diagrammasi"
                />
              )}
              <QuestionInput
                question={q}
                value={answers[q.id]}
                onChange={update}
                disabled={blocked || finishing || seconds === 0}
                eliminatedOptions={sat ? eliminated[q.id] || [] : undefined}
                onEliminate={
                  sat
                    ? (option) =>
                        setEliminated((previous) => {
                          const list = previous[q.id] || [];
                          return {
                            ...previous,
                            [q.id]: list.includes(option)
                              ? list.filter((i) => i !== option)
                              : [...list, option],
                          };
                        })
                    : undefined
                }
              />
              {(ielts || cefr) && q.type === "written_answer" && (
                <p className="exam-word-count">
                  {typeof answers[q.id] === "string"
                    ? answers[q.id].trim().split(/\s+/).filter(Boolean).length
                    : 0}{" "}
                  {t("so‘z")}
                </p>
              )}
              {!sat && pagination}
            </section>
            {sat && pagination}
          </div>
          <section className="exam-navigation" data-menu-open={questionMenu}>
            {sat && (
              <div className="sat-exam-directions">
                <h2>{t("Test ko‘rsatmalari")}</h2>
                <p>
                  {t(
                    attempt.instructions ||
                      "Joriy modul ichida oldingi va keyingi savollarga o‘tishingiz mumkin.",
                  )}
                </p>
              </div>
            )}
            <div className="exam-navigation-heading">
              {sat ? (
                <button
                  type="button"
                  aria-expanded={questionMenu}
                  aria-controls="exam-question-list"
                  onClick={() => setQuestionMenu((value) => !value)}
                >
                  {t("Savollar")} · {index + 1}/{attemptQuestions.length}
                </button>
              ) : (
                <h3>{t(cefr ? "Javoblar varaqasi" : "Savollar")}</h3>
              )}
            </div>
            <div
              className="question-numbers"
              id="exam-question-list"
              ref={questionRail}
            >
              {attemptQuestions.map((item, i) => {
                const isAnswered = hasExamAnswer(answers[item.id]);
                const isFlagged = flags.includes(item.id);
                const state = isAnswered ? "answered" : "unanswered";
                const optionIndex =
                  cefr && Array.isArray(item.options)
                    ? item.options.indexOf(answers[item.id])
                    : -1;
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
                    {optionIndex >= 0 && (
                      <span className="exam-sheet-letter" aria-hidden="true">
                        {String.fromCharCode(65 + optionIndex)}
                      </span>
                    )}
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
            {answered < attemptQuestions.length && (!sat || questionMenu) && (
              <button
                className="exam-next-empty"
                onClick={() => {
                  const next = attemptQuestions.findIndex(
                    (item, i) => i > index && !hasExamAnswer(answers[item.id]),
                  );
                  goToQuestion(
                    next >= 0
                      ? next
                      : attemptQuestions.findIndex(
                          (item) => !hasExamAnswer(answers[item.id]),
                        ),
                  );
                }}
              >
                {t("Javobsiz savolga o‘tish")}
              </button>
            )}
            <button
              className="primary exam-finish-button"
              disabled={finishing}
              onClick={() => setConfirming(true)}
            >
              {finishing
                ? t("Yakunlanmoqda…")
                : nextModule
                  ? t("Keyingi modulga o‘tish")
                  : t("Testni yakunlash")}
            </button>
            {satMath && <SatMathTools />}
            {error && (
              <button onClick={() => send("save")}>{t("Qayta saqlash")}</button>
            )}
          </section>
        </div>
      </div>
      {moduleNotice && !waitingToReturn && (
        <div className="exam-screen-overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="route-title"
          >
            <h2 id="route-title">1-modul yakunlandi</h2>
            <p>
              2-modul yo‘nalishi:{" "}
              {current.route === "Hard" ? "murakkab" : "yengil"}. Bu TAFE mashq
              simulyatsiyasi.
            </p>
            <p>2-modul majburiy va uning taymeri ishga tushgan.</p>
            <button
              autoFocus
              className="primary"
              onClick={() => setModuleNotice(false)}
            >
              2-modulni ochish
            </button>
          </section>
        </div>
      )}
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
            {answered < attemptQuestions.length && (
              <p className="exam-unanswered-summary">
                <strong>{attemptQuestions.length - answered}</strong>{" "}
                {t("ta savol javobsiz qoldi.")}
              </p>
            )}
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
            <h2 id="exam-screen-title">
              {t(pausedAt !== null ? "Test pauzada" : "To‘liq ekran rejimi")}
            </h2>
            <p>
              {t(
                pausedAt !== null
                  ? "Qolgan vaqt va saqlangan javoblar bilan testni davom ettiring."
                  : leaveAt !== null || deadline !== null
                    ? "10 soniyada qaytmasangiz, test pauzaga o‘tadi."
                    : "Testni davom ettirish uchun to‘liq ekranga o‘ting.",
              )}
            </p>
            {pausedAt === null &&
              grace > 0 &&
              (leaveAt !== null || deadline !== null) && (
                <strong className="exam-grace" role="timer">
                  {grace} {t("soniya")}
                </strong>
              )}
            <Feedback error={error} />
            {pausedAt !== null ? (
              <button
                autoFocus
                className="primary"
                disabled={saving || !online}
                onClick={() => enterFullscreen(true)}
              >
                {t("Testni davom ettirish")}
              </button>
            ) : grace === 0 ? (
              <button
                className="primary"
                disabled={saving || !online}
                onClick={() =>
                  send(
                    retryScreenAction.current === "leave" ? "leave" : "status",
                    retryScreenAction.current === "leave" ? latest.current : {},
                  )
                }
              >
                {t("Pauza holatini tekshirish")}
              </button>
            ) : fullScreenEnabled() ? (
              <button
                autoFocus
                className="primary"
                onClick={() => enterFullscreen()}
              >
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
