import { QuestionHint } from "./QuestionHint";
import { t, localeTag } from "./i18n";
import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { db } from "./db";
import { MistakePractice, formatReviewAnswer } from "./MistakePractice";
import { hasExamAnswer } from "./exam-draft";
import { retiredDiagnosticId } from "./exam-catalog";
import {
  SatScoreReport,
  satSectionLabel,
  type SatScores,
} from "./SatScoreReport";
import {
  checked,
  Empty,
  Feedback,
  Modal,
  rpc,
  useData,
  type Row,
} from "./platform";
const resultsRoute = "/student/results";
function selectedAttempt() {
  const id = location.hash.split("/")[3];
  return location.hash.startsWith("#" + resultsRoute + "/") &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

export function ResultsPage({
  onResume,
}: {
  onResume: (id: string, category: string, section: string) => void;
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
  const [attemptId, setAttemptId] = useState(selectedAttempt);
  useEffect(() => {
    const update = () => {
      const next = selectedAttempt();
      setAttemptId(next);
      if (next) window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const report = useData<Row | null>(
    async () =>
      attemptId ? rpc("attempt_review", { attempt: attemptId }) : null,
    [attemptId],
  );
  const review = report.data;
  const closeReview = () => {
    location.hash = resultsRoute;
  };
  if (
    attemptId &&
    (report.loading || review?.sat_scores?.total != null || report.error)
  )
    return (
      <div className="sat-result-page">
        <button className="sat-report-back" onClick={closeReview}>
          <ArrowLeft size={17} /> {t("Testlar tarixiga qaytish")}
        </button>
        <Feedback error={report.error} loading={report.loading} />
        {review?.sat_scores?.total != null && (
          <AttemptReview
            key={attemptId}
            review={review}
            attemptId={attemptId}
          />
        )}
      </div>
    );
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
      <Feedback error={results.error} loading={results.loading} />
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
                  onClick={() => {
                    location.hash = resultsRoute + "/" + r.id;
                  }}
                >
                  {t("Tahlil")}
                </button>
              </div>
            ) : r.test_id !== retiredDiagnosticId ? (
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
            ) : null}
          </div>
        ))}
        {!results.data?.length && !results.loading && (
          <Empty text={t("Hali test ishlamagansiz.")} />
        )}
      </section>
      {attemptId && review && (
        <Modal
          title={t(review.title || "Test tahlili")}
          onClose={closeReview}
          wide
        >
          <AttemptReview
            key={attemptId}
            review={review}
            attemptId={attemptId}
          />
        </Modal>
      )}
    </>
  );
}

function AttemptReview({
  review,
  attemptId,
}: {
  review: Row;
  attemptId: string;
}) {
  const scaled = review.sat_scores?.total != null;
  const entries = ((review.questions ?? []) as Row[]).map(
    (question, index) => ({
      question,
      number: index + 1,
      state:
        question.status ??
        (question.correct
          ? "correct"
          : hasExamAnswer(review.answers[question.id])
            ? "wrong"
            : "missing"),
    }),
  );
  const adaptive = entries.some(({ question }) => question.config?.opensat);
  const modules = [0, 1, 2, 3].map((stage) => {
    const items = entries.filter(({ question }) => question.stage === stage);
    return {
      answered: items.filter((item) => item.state === "correct").length,
      total: items.length,
      difficulty: items[0]?.question.difficulty,
    };
  });
  const topicFor = (question: Row) =>
    String(question.group_name || question.config?.sat_topic || "").trim();
  const topics = new Map<string, { correct: number; total: number }>();
  for (const { question, state } of entries) {
    const topic = topicFor(question);
    if (!topic) continue;
    const item = topics.get(topic) ?? { correct: 0, total: 0 };
    item.total++;
    if (state === "correct") item.correct++;
    topics.set(topic, item);
  }
  const ranked = [...topics]
    .filter(([, item]) => item.correct < item.total)
    .sort(
      ([, a], [, b]) =>
        a.correct / a.total - b.correct / b.total ||
        b.total - b.correct - (a.total - a.correct),
    )
    .slice(0, 3);
  const mistakes = entries.filter((entry) => entry.state !== "correct");
  const [filter, setFilter] = useState(
    scaled || !mistakes.length ? "all" : "mistakes",
  );
  const [practicing, setPracticing] = useState<string | null>(null);
  const missing = entries.filter((entry) => entry.state === "missing").length;
  const counts = {
    correct: review.sat_scores?.correct ?? entries.length - mistakes.length,
    incorrect: review.sat_scores?.incorrect ?? mistakes.length - missing,
    unanswered: review.sat_scores?.unanswered ?? missing,
    questions: review.sat_scores?.questions ?? entries.length,
    accuracy:
      review.sat_scores?.accuracy ??
      (entries.length
        ? ((entries.length - mistakes.length) * 100) / entries.length
        : 0),
  };
  return (
    <>
      {scaled && review.title && <h2>{t(review.title)}</h2>}
      {practicing !== null ? (
        <MistakePractice
          attemptId={attemptId}
          questions={
            practicing
              ? mistakes
                  .filter(({ question }) => topicFor(question) === practicing)
                  .concat(
                    entries.filter(
                      ({ question, state }) =>
                        state === "correct" &&
                        topicFor(question) === practicing,
                    ),
                  )
                  .slice(0, 10)
              : mistakes
          }
          onClose={() => setPracticing(null)}
        />
      ) : (
        <>
          {scaled ? (
            <SatScoreReport
              scores={review.sat_scores as SatScores}
              counts={counts}
              startedAt={review.started_at}
              submittedAt={review.submitted_at}
            />
          ) : (
            <h2>
              {review.score} / {review.total}{" "}
              {review.sat_scores && t("to‘g‘ri javob")}
            </h2>
          )}
          {review.finish_reason === "fullscreen" && (
            <p className="muted">
              {t("To‘liq ekranga qaytish vaqti tugagani uchun yakunlandi.")}
            </p>
          )}
          {review.sat_scores && !scaled && (
            <div className="sat-section-results">
              {(["reading_writing", "math"] as const).map((section) => {
                const score = review.sat_scores[section];
                if (!score) return null;
                return (
                  <section key={section}>
                    <h3>
                      {t(section === "math" ? "Math" : "Reading and Writing")}
                    </h3>
                    <p>
                      {score.correct} / {score.questions} {t("to‘g‘ri javob")}
                    </p>
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
          <section className="review-question">
            <h3>{t("Qisqa xulosa")}</h3>
            <p>
              {counts.correct}/{counts.questions} {t("to‘g‘ri javob")} ·{" "}
              {counts.incorrect} {t("Xato javob")} · {counts.unanswered}{" "}
              {t("Javob berilmagan")}
            </p>
            {ranked[0] && (
              <p>
                {t("Avval takrorlang")} · <strong>{t(ranked[0][0])}</strong>
              </p>
            )}
            {mistakes.length > 0 && (
              <button
                onClick={() => {
                  setFilter("mistakes");
                  document
                    .getElementById("review-questions")
                    ?.scrollIntoView({ block: "start" });
                }}
              >
                {t("Xatolarni ko‘rish")}
              </button>
            )}
            {ranked[0] && (
              <button
                className="primary"
                onClick={() => setPracticing(ranked[0][0])}
              >
                {t("Shu mavzuni mashq qilish")}
              </button>
            )}
          </section>
          {topics.size > 0 && (
            <section aria-label={t("Mavzular xaritasi")}>
              <h3>{t("Mavzular xaritasi")}</h3>
              <div className="sat-section-results">
                {[...topics].map(([topic, item]) => (
                  <button
                    className="topic-practice"
                    key={topic}
                    onClick={() => setPracticing(topic)}
                  >
                    <strong>{t(topic)}</strong>
                    <span>
                      {item.correct} / {item.total} {t("to‘g‘ri javob")}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {adaptive && (
            <section className="sat-score-card">
              <h3>Modullar natijasi</h3>
              <ul>
                {modules.map((m, i) => (
                  <li key={i}>
                    {satSectionLabel(i < 2 ? "reading_writing" : "math")} ·{" "}
                    {(i % 2) + 1}-modul · {m.answered}/{m.total}{" "}
                    {t("to‘g‘ri javob")} · {m.difficulty}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {scaled && <h3>{t("Savollar tahlili")}</h3>}
          <div className="review-controls" id="review-questions">
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
                ["correct", "To‘g‘ri javob", entries.length - mistakes.length],
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
              <button className="primary" onClick={() => setPracticing("")}>
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
                  {q.sat_section ? (
                    <>
                      {satSectionLabel(q.sat_section)} ·{" "}
                      {t(
                        q.config?.sat_topic ||
                          q.group_name ||
                          "Mavzu ko‘rsatilmagan",
                      )}
                      {q.config?.sat_topic &&
                        q.group_name &&
                        ` · ${t(q.group_name)}`}
                    </>
                  ) : (
                    q.group_name || q.type || "multiple_choice"
                  )}
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
                <details>
                  <summary>{t("To‘g‘ri javob")}</summary>
                  <p>{formatReviewAnswer(q.accepted ?? q.answer)}</p>
                  {q.explanation && <p>{q.explanation}</p>}
                  {q.evidence && <blockquote>{q.evidence}</blockquote>}
                </details>
                <QuestionHint
                  prompt={JSON.stringify({
                    question: q.prompt,
                    options: q.options,
                    response: review.answers[q.id],
                    accepted: q.accepted ?? q.answer,
                    evidence: q.evidence,
                  })}
                />
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
    </>
  );
}
