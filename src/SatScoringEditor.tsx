import { useState } from "react";
import { t } from "./i18n";
import { Feedback, Modal, rpc, useAction, useData } from "./platform";
import {
  satSectionLabel,
  satSections,
  type SatSection,
} from "./SatScoreReport";

type Model = Record<SatSection, number[]> & {
  name: string;
  revision: number;
};

type Settings = { model: Model | null; counts: Record<SatSection, number> };

export function SatScoringEditor({
  testId,
  title,
  onClose,
}: {
  testId: string;
  title: string;
  onClose: () => void;
}) {
  const settings = useData<Settings>(
    () => rpc("admin_sat_scoring", { t: testId }),
    [testId],
  );
  return (
    <Modal title={t("SAT ball jadvali")} onClose={onClose} wide>
      <p>
        <strong>{t(title)}</strong>
      </p>
      <Feedback error={settings.error} loading={settings.loading} />
      {settings.data && (
        <ScoringForm testId={testId} settings={settings.data} />
      )}
    </Modal>
  );
}

function parseCurve(value: string, count: number) {
  const fields = value.trim().split(/[\s,]+/);
  if (fields.some((field) => !/^\d{3}$/.test(field))) return null;
  const scores = fields.map(Number);
  return scores.length === count + 1 &&
    scores[0] === 200 &&
    scores[count] === 800 &&
    scores.every(
      (score, i) => score % 10 === 0 && (i === 0 || score >= scores[i - 1]),
    )
    ? scores
    : null;
}

function ScoringForm({
  testId,
  settings,
}: {
  testId: string;
  settings: Settings;
}) {
  const action = useAction();
  const [model, setModel] = useState(settings.model);
  const [name, setName] = useState(model?.name ?? "");
  const [curves, setCurves] = useState({
    reading_writing: model?.reading_writing.join(", ") ?? "",
    math: model?.math.join(", ") ?? "",
  });
  const [submitted, setSubmitted] = useState(false);
  const reading = parseCurve(
    curves.reading_writing,
    settings.counts.reading_writing,
  );
  const math = parseCurve(curves.math, settings.counts.math);
  const valid = Boolean(name.trim() && reading && math);
  return (
    <form
      className="sat-curve-table"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (!valid) return;
        void action.run(async () => {
          const saved: Settings = await rpc("admin_save_sat_scoring", {
            t: testId,
            expected_revision: model?.revision ?? 0,
            model_name: name.trim(),
            reading_curve: reading,
            math_curve: math,
          });
          setModel(saved.model);
          setSubmitted(false);
        }, "Ball jadvalining yangi versiyasi saqlandi.");
      }}
    >
      <p className="muted">
        {t(
          "0 ta to‘g‘ri javobdan boshlab har bir javob soni uchun vergul bilan ajratilgan ball kiriting. Ballar 200 dan 800 gacha, 10 ga karrali va kamaymaydigan bo‘lishi kerak.",
        )}
      </p>
      <p className="muted">
        {model
          ? `v${model.revision} · ${model.name}`
          : t("Hozircha ball jadvali biriktirilmagan.")}
        {" · "}
        {t("Yangi jadval keyingi urinishlarga qo‘llanadi.")}
      </p>
      <label>
        {t("Ball modeli nomi")}
        <input
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {satSections.map((section) => (
        <label key={section}>
          {satSectionLabel(section)} · {settings.counts[section] + 1}{" "}
          {t("ta qiymat")}
          <textarea
            required
            aria-invalid={submitted && !(section === "math" ? math : reading)}
            value={curves[section]}
            onChange={(event) =>
              setCurves({ ...curves, [section]: event.target.value })
            }
          />
        </label>
      ))}
      <Feedback
        error={
          action.error ||
          (submitted && !valid ? "Ball jadvali talabga mos kelmadi." : "")
        }
        notice={action.notice}
      />
      <div className="button-row">
        <button type="submit" className="primary" disabled={action.busy}>
          {t("Yangi versiyani saqlash")}
        </button>
      </div>
    </form>
  );
}
