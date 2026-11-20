import { Clock3 } from "lucide-react";
import { t, localeTag } from "./i18n";
import "./sat-score-report.css";

export const satSections = ["reading_writing", "math"] as const;
export type SatSection = (typeof satSections)[number];

export function satSectionLabel(section: SatSection) {
  return t(section === "math" ? "Math" : "Reading and Writing");
}

type Counts = {
  questions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
};

type SkillCounts = Counts & {
  section: SatSection;
  topic: string | null;
  skill: string | null;
};

export type SatScores = Partial<Counts> & {
  total: number;
  reading_writing: Counts & { scaled: number };
  math: Counts & { scaled: number };
  model_name?: string;
  model_revision?: number;
  duration_seconds?: number;
  breakdown?: SkillCounts[];
};

function elapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} ${t("daq.")} ${remainder} ${t("son.")}`;
}

function level(score: number) {
  if (score >= 1400) return t("Juda yuqori");
  if (score >= 1200) return t("Yuqori");
  if (score >= 1000) return t("Rivojlanayotgan");
  return t("Boshlang‘ich");
}

export function SatScoreReport({
  scores,
  counts,
  startedAt,
  submittedAt,
}: {
  scores: SatScores;
  counts: Counts;
  startedAt?: string;
  submittedAt?: string;
}) {
  const time =
    scores.duration_seconds ??
    (startedAt && submittedAt
      ? Math.max(
          0,
          Math.floor((Date.parse(submittedAt) - Date.parse(startedAt)) / 1000),
        )
      : null);
  const format = new Intl.NumberFormat(localeTag(), {
    maximumFractionDigits: 1,
  });
  const percent = (value: number) => format.format(value) + "%";

  return (
    <div className="sat-score-report">
      <header className="sat-score-overall">
        <div className="sat-score-overall-main">
          <p className="sat-score-label">{t("SAT taxminiy balli")}</p>
          <div className="sat-score-number">
            <strong>{scores.total}</strong>
            <span>/ 1600</span>
          </div>
          <p className="sat-score-level">{level(scores.total)}</p>
        </div>
        <div className="sat-score-overall-meta">
          <div className="sat-score-scale">
            <meter
              aria-label={t("SAT taxminiy balli")}
              min={400}
              max={1600}
              value={scores.total}
            />
            <span>400</span>
            <span>1600</span>
          </div>
          <p>
            {t(
              "Bu TAFE mashq balli. College Board rasmiy natijasi sifatida ishlatilmaydi.",
            )}
          </p>
          <small>
            {scores.model_name
              ? `${scores.model_name} · v${scores.model_revision}`
              : t("TAFE avvalgi ball modeli")}
            {submittedAt
              ? ` · ${new Date(submittedAt).toLocaleDateString(localeTag())}`
              : ""}
          </small>
        </div>
      </header>

      <div className="sat-score-sections">
        {satSections.map((section) => {
          const score = scores[section];
          return (
            <div
              className="sat-score-card sat-section-score"
              key={section}
              data-section={section}
            >
              <h3>{satSectionLabel(section)}</h3>
              <p>
                <strong>{score.scaled}</strong> <span>/ 800</span>
              </p>
              <div className="sat-score-scale">
                <meter
                  aria-label={satSectionLabel(section)}
                  min={200}
                  max={800}
                  value={score.scaled}
                />
                <span>200</span>
                <span>800</span>
              </div>
              <small>
                {score.correct} / {score.questions} {t("to‘g‘ri javob")}
              </small>
            </div>
          );
        })}
      </div>

      <div className="sat-score-card">
        <h3>{t("Test statistikasi")}</h3>
        <dl className="sat-score-stats">
          <div data-stat="correct">
            <dt>{t("To‘g‘ri javob")}</dt>
            <dd>{counts.correct}</dd>
          </div>
          <div data-stat="wrong">
            <dt>{t("Xato javob")}</dt>
            <dd>{counts.incorrect}</dd>
          </div>
          <div data-stat="missing">
            <dt>{t("Javob berilmagan")}</dt>
            <dd>{counts.unanswered}</dd>
          </div>
          <div>
            <dt>{t("Aniqlik")}</dt>
            <dd>{percent(counts.accuracy)}</dd>
          </div>
          <div>
            <dt>{t("Jami savollar")}</dt>
            <dd>{counts.questions}</dd>
          </div>
          <div>
            <dt>
              <Clock3 size={14} />
              {t("Sarflangan vaqt")}
            </dt>
            <dd>{time === null ? "—" : elapsed(time)}</dd>
          </div>
        </dl>
      </div>

      {Boolean(scores.breakdown?.length) && (
        <div className="sat-score-card sat-skills">
          <h3>{t("Mavzu va ko‘nikmalar bo‘yicha natijalar")}</h3>
          <div className="sat-skill-columns">
            {satSections.map((section) => (
              <div key={section} data-section={section}>
                <h4>{satSectionLabel(section)}</h4>
                <TopicBreakdown
                  items={
                    scores.breakdown?.filter(
                      (item) => item.section === section,
                    ) ?? []
                  }
                  percent={percent}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TopicBreakdown({
  items,
  percent,
}: {
  items: SkillCounts[];
  percent: (value: number) => string;
}) {
  const topics = new Map<string | null, SkillCounts[]>();
  for (const entry of items) {
    const topic = topics.get(entry.topic);
    if (topic) topic.push(entry);
    else topics.set(entry.topic, [entry]);
  }
  return [...topics].map(([topic, skills]) => {
    const name = t(topic ?? "Mavzu ko‘rsatilmagan");
    const total = skills.reduce((sum, item) => sum + item.questions, 0);
    const correct = skills.reduce((sum, item) => sum + item.correct, 0);
    const showSkills =
      skills.length > 1 ||
      skills.some((item) => item.skill && item.skill !== topic);
    return (
      <div className="sat-topic" key={topic ?? ""}>
        <CountBar
          name={name}
          correct={correct}
          total={total}
          percent={percent}
        />
        {showSkills && (
          <details>
            <summary>{t("Ko‘nikmalarni ko‘rish")}</summary>
            {skills.map((skill) => (
              <CountBar
                key={skill.skill ?? ""}
                name={t(skill.skill ?? "Ko‘nikma ko‘rsatilmagan")}
                correct={skill.correct}
                total={skill.questions}
                percent={percent}
              />
            ))}
          </details>
        )}
      </div>
    );
  });
}

function CountBar({
  name,
  correct,
  total,
  percent,
}: {
  name: string;
  correct: number;
  total: number;
  percent: (value: number) => string;
}) {
  return (
    <div className="sat-skill">
      <div>
        <strong>{name}</strong>
        <span>
          {correct}/{total} · {percent((correct * 100) / total)}
        </span>
      </div>
      <progress aria-label={name} max={total} value={correct} />
    </div>
  );
}
