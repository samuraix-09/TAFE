import { t } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { Flag, ShieldCheck } from "lucide-react";
import { Feedback, QuestionInput, rpc, signed, type Row } from "./platform";
function hasAnswer(value: any): boolean {
  if (value == null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value).some(hasAnswer);
  return true;
}
export function ExamPlayer({
  attempt,
  onDone,
}: {
  attempt: Row;
  onDone: () => void;
}) {
  const [answers, setAnswers] = useState<Row>(attempt.answers || {}),
    [index, setIndex] = useState(0),
    [flags, setFlags] = useState<string[]>(() => {
      try {
        return JSON.parse(
          localStorage.getItem("tafe-flags-" + attempt.id) || "[]",
        );
      } catch {
        return [];
      }
    }),
    [seconds, setSeconds] = useState(0),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [finishing, setFinishing] = useState(false),
    [image, setImage] = useState<string | null>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const latest = useRef(answers),
    queue = useRef(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    done = useRef(false),
    finishRequested = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    if (attempt.passage_image)
      void signed("tafe-test-images", attempt.passage_image)
        .then(setImage)
        .catch((e) => setError(e.message));
  }, [attempt.passage_image]);
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((Date.parse(attempt.expires_at) - Date.now()) / 1000),
      );
      setSeconds(remaining);
      if (!remaining && !done.current) finish(false);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      mounted.current = false;
      clearInterval(interval);
      if (timer.current) {
        clearTimeout(timer.current);
        const snapshot = latest.current;
        void rpc("save_attempt", {
          attempt: attempt.id,
          response: snapshot,
          finish: false,
        }).catch(() => {});
      }
    };
  }, []);
  useEffect(() => {
    localStorage.setItem("tafe-flags-" + attempt.id, JSON.stringify(flags));
  }, [flags]);
  function save(snapshot: Row, finish = false) {
    setSaving(true);
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        const result = await rpc("save_attempt", {
          attempt: attempt.id,
          response: snapshot,
          finish,
        });
        if (mounted.current) {
          setError("");
          setSaving(false);
        }
        if (result.submitted && !done.current) {
          done.current = true;
          localStorage.removeItem("tafe-flags-" + attempt.id);
          if (mounted.current) onDone();
        }
      })
      .catch((e) => {
        if (mounted.current) {
          setError(e.message);
          setSaving(false);
          setFinishing(false);
        }
        if (finish) {
          done.current = false;
          finishRequested.current = false;
        }
      });
  }
  function update(value: any) {
    const next = { ...latest.current, [q.id]: value };
    latest.current = next;
    setAnswers(next);
    setSaving(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      save(next);
    }, 350);
  }
  function finish(confirmFirst = true) {
    if (done.current || finishRequested.current) return;
    if (
      confirmFirst &&
      !confirm(
        t("Testni yakunlaysizmi? Javoblarni keyin o‘zgartirib bo‘lmaydi."),
      )
    )
      return;
    finishRequested.current = true;
    setFinishing(true);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    save(latest.current, true);
  }
  function goToQuestion(next: number) {
    if (next === index) return;
    setIndex(next);
    if (matchMedia("(max-width: 700px)").matches) {
      requestAnimationFrame(() => {
        questionHeading.current?.focus({ preventScroll: true });
        questionHeading.current?.scrollIntoView({ block: "start" });
      });
    }
  }
  const q = attempt.questions[index],
    answered = attempt.questions.filter((item: Row) =>
      hasAnswer(answers[item.id]),
    ).length;
  return (
    <div className="exam-view">
      <div className="exam-toolbar">
        <div>
          <p className="eyebrow">{t("EXAM SESSION")}</p>
          <h1>{attempt.title || t("Test topshirish")}</h1>
          <small>
            <ShieldCheck size={13} />{" "}
            {saving ? t("Saqlanmoqda…") : t("Javoblar saqlandi")}
          </small>
        </div>
        <div className={seconds < 60 ? "exam-clock urgent" : "exam-clock"}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </div>
      </div>
      <Feedback error={error} />
      <div className="exam-progress">
        <span>
          {answered} / {attempt.questions.length}
          {t(" javob berildi")}
        </span>
        <progress value={answered} max={attempt.questions.length} />
      </div>
      <p className="muted">{attempt.instructions}</p>
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
                {q.points || 1}
                {t(" ball ·")} {q.required ? t("majburiy") : t("ixtiyoriy")}
              </span>
              <button
                className={
                  flags.includes(q.id) ? "flag-button flagged" : "flag-button"
                }
                onClick={() =>
                  setFlags(
                    flags.includes(q.id)
                      ? flags.filter((x) => x !== q.id)
                      : [...flags, q.id],
                  )
                }
              >
                <Flag size={16} />
                {flags.includes(q.id) ? t("Belgilangan") : t("Belgilash")}
              </button>
            </div>
            {q.group_name && <p className="eyebrow">{q.group_name}</p>}
            <h2
              ref={questionHeading}
              tabIndex={-1}
              className="exam-question-prompt"
            >
              {q.prompt}
            </h2>
            <QuestionInput
              question={q}
              value={answers[q.id]}
              onChange={update}
              disabled={finishing || seconds === 0}
            />
            <div className="exam-pagination">
              <button
                disabled={index === 0}
                onClick={() => goToQuestion(index - 1)}
              >
                {t("← Oldingi")}
              </button>
              <button
                disabled={index === attempt.questions.length - 1}
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
            {attempt.questions.map((item: Row, i: number) => (
              <button
                aria-label={i + 1 + t("-savol")}
                key={item.id}
                className={[
                  index === i ? "current" : "",
                  hasAnswer(answers[item.id]) ? "answered" : "",
                  flags.includes(item.id) ? "flagged" : "",
                ].join(" ")}
                aria-current={index === i ? "step" : undefined}
                onClick={() => goToQuestion(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="muted">
            {t("Ko‘k — javob berilgan")}
            <br />
            {t("Belgi — qayta ko‘rib chiqish uchun")}
          </p>
          <button
            className="primary"
            disabled={finishing}
            onClick={() => finish()}
          >
            {finishing ? t("Yakunlanmoqda…") : t("Testni yakunlash")}
          </button>
          {error && (
            <button onClick={() => save(latest.current)}>
              {t("Qayta saqlash")}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
