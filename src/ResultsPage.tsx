import { t, localeTag } from "./i18n";
import { useEffect, useState } from "react";
import { BarChart3, Sparkles } from "lucide-react";
import { db } from "./db";
import { MistakePractice, formatReviewAnswer } from "./MistakePractice";
import { hasExamAnswer } from "./exam-draft";
import {
  checked,
  Empty,
  Feedback,
  Modal,
  rpc,
  useAction,
  useData,
  type Row,
} from "./platform";
export function ResultsPage({
  completedAttemptId,
  onReviewOpened,
  onResume,
  onExplain,
}: {
  completedAttemptId: string | null;
  onReviewOpened: () => void;
  onResume: (id: string, category: string, section: string) => void;
  onExplain: (prompt: string) => void;
}) {
  const results = useData<Row[]>(async () => {
    await rpc("settle_exam_sessions");
    return checked(
      await db
        .from("test_attempts")
        .select(
          "id,test_id,score,total,started_at,submitted_at,paused_at,finish_reason,sat_scores,tests(title,section,exam_categories(name))",
        )
        .order("started_at", { ascending: false }),
    ) as unknown as Row[];
  }, []);
  const [review, setReview] = useState<Row | null>(null);
  const a = useAction();
  const [filter, setFilter] = useState("all");
  const [practicing, setPracticing] = useState(false);
  const entries =
    (review?.questions as Row[] | undefined)?.map((question, index) => ({
      question,
      number: index + 1,
      state: question.correct
        ? "correct"
        : hasExamAnswer(review?.answers[question.id])
          ? "wrong"
          : "missing",
    })) ?? [];
  const mistakes = entries.filter((entry) => entry.state !== "correct");
  const skillsToReview =
    review?.sat_scores && review.sat_scores.total == null
      ? [
          ...new Set<string>(
            review.questions
              .filter((q: Row) => !q.correct && q.group_name)
              .map((q: Row) => q.group_name),
          ),
        ]
      : [];
  async function openReview(id: string, title?: string) {
    await a.run(async () => {
      const result = await rpc("attempt_review", { attempt: id });
      setFilter(
        result.questions.some((question: Row) => !question.correct)
          ? "mistakes"
          : "all",
      );
      setPracticing(false);
      setReview({ ...result, id, title });
    }, "");
  }
  useEffect(() => {
    if (!completedAttemptId) return;
    onReviewOpened();
    void openReview(completedAttemptId);
  }, [completedAttemptId]);
  const finished = results.data?.filter((r) => r.submitted_at) || [],
    average = finished.length
      ? Math.round(
          finished.reduce((sum, r) => sum + (r.score / r.total) * 100, 0) /
            finished.length,
        )
      : null;
  return (
    <>
      <div className="results-summary">
        <section>
          <BarChart3 />
          <h2>{average === null ? "—" : average + "%"}</h2>
          <p>{t("O‘rtacha natija")}</p>
        </section>
        <section>
          <h2>{finished.length}</h2>
          <p>{t("Yakunlangan testlar")}</p>
        </section>
        <section>
          <h2>{(results.data?.length || 0) - finished.length}</h2>
          <p>{t("Davom etayotgan testlar")}</p>
        </section>
      </div>
      <Feedback error={results.error || a.error} loading={results.loading} />
      <section>
        <h2>{t("O‘sish tarixi")}</h2>
        {finished.length ? (
          <div className="results-bars">
            {finished
              .slice(0, 10)
              .reverse()
              .map((r) => (
                <div key={r.id}>
                  <span>
                    {new Date(r.started_at).toLocaleDateString(localeTag())}
                  </span>
                  <progress
                    max={100}
                    value={Math.round((r.score / r.total) * 100)}
                  />
                  <strong>{Math.round((r.score / r.total) * 100)}%</strong>
                </div>
              ))}
          </div>
        ) : (
          <Empty text={t("Natijalar test yakunlangach paydo bo‘ladi.")} />
        )}
      </section>
      <section>
        <h2>{t("Testlar tarixi")}</h2>
        {results.data?.map((r) => (
          <div className="result" key={r.id}>
            <div>
              <strong>{t(r.tests?.title || "Test")}</strong>
              {r.paused_at && !r.submitted_at && (
                <span className="badge result-pause-badge">
                  {t("Test pauzada")}
                </span>
              )}
              <p className="muted">
                {r.tests?.exam_categories?.name} · {r.tests?.section} ·{" "}
                {new Date(r.started_at).toLocaleString(localeTag())}
              </p>
            </div>
            {r.submitted_at ? (
              <div className="button-row">
                <strong>
                  {r.sat_scores?.total != null
                    ? `${r.sat_scores.total} / 1600 · ${t("SAT taxminiy balli")}`
                    : `${r.score} / ${r.total}`}
                </strong>
                <button
                  disabled={a.busy}
                  onClick={() => void openReview(r.id, r.tests?.title)}
                >
                  {t("Tahlil")}
                </button>
              </div>
            ) : (
              <button
                onClick={() =>
                  onResume(
                    r.test_id,
                    r.tests?.exam_categories?.name ?? "",
                    r.tests?.section ?? "",
                  )
                }
              >
                {t("Davom etish")}
              </button>
            )}
          </div>
        ))}
        {!results.data?.length && !results.loading && (
          <Empty text={t("Hali test ishlamagansiz.")} />
        )}
      </section>
      {review && (
        <Modal
          title={t(
            practicing
              ? "Xatolarni qayta ishlash"
              : review.title || "Test tahlili",
          )}
          onClose={() => setReview(null)}
          wide
        >
          {practicing ? (
            <MistakePractice
              attemptId={review.id}
              questions={mistakes}
              onClose={() => setPracticing(false)}
            />
          ) : (
            <>
              {review.sat_scores?.total != null && (
                <div className="sat-result">
                  <h2>{review.sat_scores.total} / 1600</h2>
                  <p>{t("SAT taxminiy balli")}</p>
                  <small>
                    {t(
                      "Bu TAFE mashq bahosi. Rasmiy SAT balli test shakli va savol kalibratsiyasiga bog‘liq.",
                    )}
                  </small>
                </div>
              )}
              <h2>
                {review.score} / {review.total}{" "}
                {review.sat_scores && t("to‘g‘ri javob")}
              </h2>
              {review.finish_reason === "fullscreen" && (
                <p className="muted">
                  {t("To‘liq ekranga qaytish vaqti tugagani uchun yakunlandi.")}
                </p>
              )}
              {review.sat_scores && (
                <div className="sat-section-results">
                  {(["reading_writing", "math"] as const).map((section) => {
                    const score = review.sat_scores[section];
                    if (!score) return null;
                    return (
                      <section key={section}>
                        <h3>
                          {t(
                            section === "math" ? "Math" : "Reading and Writing",
                          )}
                        </h3>
                        <p>
                          {score.correct} / {score.questions}{" "}
                          {t("to‘g‘ri javob")}
                        </p>
                        {review.sat_scores.total != null && (
                          <strong>{score.scaled} / 800</strong>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
              {review.sat_scores && review.sat_scores.total == null && (
                <p className="muted">
                  {t(
                    "Quyidagi izohlar orqali qaysi mavzularni takrorlash kerakligini aniqlang.",
                  )}
                </p>
              )}
              {skillsToReview.length > 0 && (
                <section>
                  <h3>{t("Takrorlash kerak bo‘lgan mavzular")}</h3>
                  <ul>
                    {skillsToReview.map((skill) => (
                      <li key={skill}>{t(skill)}</li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="review-controls">
                <div className="review-filter" aria-label={t("Savollar")}>
                  {[
                    ["all", "Barchasi", entries.length],
                    ["mistakes", "Xatolar va bo‘sh javoblar", mistakes.length],
                    [
                      "wrong",
                      "Xato javob",
                      entries.filter((item) => item.state === "wrong").length,
                    ],
                    [
                      "missing",
                      "Javob berilmagan",
                      entries.filter((item) => item.state === "missing").length,
                    ],
                    [
                      "correct",
                      "To‘g‘ri javob",
                      entries.length - mistakes.length,
                    ],
                  ].map(([key, label, count]) => (
                    <button
                      key={key}
                      aria-pressed={filter === key}
                      onClick={() => setFilter(String(key))}
                    >
                      {t(String(label))} <span>{count}</span>
                    </button>
                  ))}
                </div>
                {mistakes.length > 0 && (
                  <button
                    className="primary"
                    onClick={() => setPracticing(true)}
                  >
                    {t("Xatolarni qayta ishlash")}
                  </button>
                )}
              </div>
              {entries
                .filter(
                  ({ state }) =>
                    filter === "all" ||
                    filter === state ||
                    (filter === "mistakes" && state !== "correct"),
                )
                .map(({ question: q, number, state }) => (
                  <section className="review-question" key={q.id}>
                    <span className="badge">
                      {q.group_name || q.type || "multiple_choice"}
                    </span>
                    <h3>
                      {number}. {q.prompt}
                    </h3>
                    <p className="review-status" data-state={state}>
                      {t(
                        state === "correct"
                          ? "To‘g‘ri javob"
                          : state === "wrong"
                            ? "Xato javob"
                            : "Javob berilmagan",
                      )}
                    </p>
                    <p>
                      {t("Sizning javobingiz —")}{" "}
                      {formatReviewAnswer(review.answers[q.id])}
                    </p>
                    <p>
                      {t("Qabul qilinadigan javob —")}{" "}
                      {formatReviewAnswer(q.accepted ?? q.answer)}
                    </p>
                    {q.explanation && <p>{q.explanation}</p>}
                    {q.evidence ? (
                      <blockquote>{q.evidence}</blockquote>
                    ) : (
                      <p className="muted">{t("Dalil keltirilmagan")}</p>
                    )}
                    <button
                      onClick={() => {
                        onExplain(
                          "Quyidagi test savolini va javobimni tushuntiring. Savol: " +
                            q.prompt +
                            "\nJavobim: " +
                            JSON.stringify(review.answers[q.id]) +
                            "\nTasdiqlangan javob: " +
                            JSON.stringify(q.accepted ?? q.answer) +
                            "\nPassage dalili: " +
                            (q.evidence || "Dalil keltirilmagan"),
                        );
                        setReview(null);
                      }}
                    >
                      <Sparkles size={15} />
                      {t("TAFE AI bilan tushunish")}
                    </button>
                  </section>
                ))}
              {filter !== "all" &&
                !entries.some(
                  ({ state }) =>
                    state === filter ||
                    (filter === "mistakes" && state !== "correct"),
                ) && <Empty text={t("Bu turdagi savollar yo‘q.")} />}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
