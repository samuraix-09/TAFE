import { t, localeTag } from "./i18n";
import { useEffect, useState } from "react";
import { BarChart3, Sparkles } from "lucide-react";
import { db } from "./db";
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
  onResume: (id: string) => void;
  onExplain: (prompt: string) => void;
}) {
  const results = useData<Row[]>(
    async () =>
      checked(
        await db
          .from("test_attempts")
          .select(
            "id,test_id,score,total,started_at,submitted_at,tests(title,section,exam_categories(name))",
          )
          .order("started_at", { ascending: false }),
      ) as unknown as Row[],
    [],
  );
  const [review, setReview] = useState<Row | null>(null);
  const a = useAction();
  async function openReview(id: string, title?: string) {
    await a.run(async () => {
      setReview({ ...(await rpc("attempt_review", { attempt: id })), title });
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
              <strong>{r.tests?.title || "Test"}</strong>
              <p className="muted">
                {r.tests?.exam_categories?.name} · {r.tests?.section} ·{" "}
                {new Date(r.started_at).toLocaleString(localeTag())}
              </p>
            </div>
            {r.submitted_at ? (
              <div className="button-row">
                <strong>
                  {r.score} / {r.total}
                </strong>
                <button
                  disabled={a.busy}
                  onClick={() => void openReview(r.id, r.tests?.title)}
                >
                  {t("Tahlil")}
                </button>
              </div>
            ) : (
              <button onClick={() => onResume(r.test_id)}>
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
          title={review.title || t("Test tahlili")}
          onClose={() => setReview(null)}
          wide
        >
          <h2>
            {review.score} / {review.total}
          </h2>
          {review.questions.map((q: Row, i: number) => (
            <section key={q.id}>
              <span className="badge">{q.type || "multiple_choice"}</span>
              <h3>
                {i + 1}. {q.prompt}
              </h3>
              <p>
                {t("Sizning javobingiz —")}{" "}
                {JSON.stringify(review.answers[q.id] ?? "Javob berilmagan")}
              </p>
              <p>
                {t("Qabul qilinadigan javob —")}{" "}
                {JSON.stringify(q.accepted ?? q.answer)}
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
        </Modal>
      )}
    </>
  );
}
