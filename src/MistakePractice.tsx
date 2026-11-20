import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { t } from "./i18n";
import { hasExamAnswer } from "./exam-draft";
import { Feedback, QuestionInput, rpc, useAction, type Row } from "./platform";

export function MistakePractice({
  attemptId,
  questions,
  onClose,
}: {
  attemptId: string;
  questions: { question: Row; number: number }[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<unknown>();
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);
  const a = useAction();
  const entry = questions[index];

  if (!entry)
    return (
      <section className="mistake-practice">
        <h3>{t("Takrorlash tugadi")}</h3>
        <p>
          {correct} / {questions.length} {t("to‘g‘ri javob")}
        </p>
        <button className="primary" onClick={onClose}>
          {t("Tahlilga qaytish")}
        </button>
      </section>
    );

  const q = entry.question;
  return (
    <section className="mistake-practice">
      <div className="mistake-practice-top">
        <strong>
          <RotateCcw size={16} aria-hidden="true" /> {index + 1} /{" "}
          {questions.length}
        </strong>
        <button onClick={onClose}>{t("Tahlilga qaytish")}</button>
      </div>
      <progress
        value={index}
        max={questions.length}
        aria-label={t("Takrorlash jarayoni")}
      />
      {q.group_name && <p className="muted">{q.group_name}</p>}
      <h3>
        {entry.number}. {q.prompt}
      </h3>
      <QuestionInput
        question={q}
        value={answer}
        onChange={setAnswer}
        disabled={a.busy || verdict !== null}
      />
      <Feedback error={a.error} />
      {verdict === null ? (
        <button
          className="primary"
          disabled={a.busy || !hasExamAnswer(answer)}
          onClick={() =>
            void a.run(async () => {
              const result = await rpc("practice_attempt_question", {
                attempt: attemptId,
                question: q.id,
                response: answer,
              });
              setVerdict(result.correct);
              if (result.correct) setCorrect((count) => count + 1);
            }, "")
          }
        >
          {t("Javobni tekshirish")}
        </button>
      ) : (
        <>
          <p
            className="review-status"
            data-state={verdict ? "correct" : "wrong"}
            role="status"
          >
            {t(verdict ? "To‘g‘ri javob" : "Xato javob")}
          </p>
          <p>
            {t("Qabul qilinadigan javob —")}{" "}
            {formatReviewAnswer(q.accepted ?? q.answer)}
          </p>
          {q.explanation && <p>{q.explanation}</p>}
          {q.evidence && <blockquote>{q.evidence}</blockquote>}
          <button
            className="primary"
            onClick={() => {
              setIndex(index + 1);
              setAnswer(undefined);
              setVerdict(null);
            }}
          >
            {t(
              index + 1 === questions.length
                ? "Takrorlashni yakunlash"
                : "Keyingi →",
            )}
          </button>
        </>
      )}
    </section>
  );
}

export function formatReviewAnswer(value: unknown): string {
  if (!hasExamAnswer(value)) return t("Javob berilmagan");
  if (Array.isArray(value)) return value.map(formatReviewAnswer).join(", ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(([key, answer]) => key + " — " + formatReviewAnswer(answer))
      .join(" · ");
  return String(value);
}
