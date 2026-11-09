import { t, LanguagePicker } from "./i18n";
import { useState } from "react";
import { ArrowRight, CheckCircle, Target } from "lucide-react";
import { db } from "./db";
export function Onboarding({
  userId,
  categories,
  profile,
  onComplete,
}: {
  userId: string;
  categories: { id: string; name: string }[];
  profile: Record<string, any>;
  onComplete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="onboarding">
      <LanguagePicker />
      <span className="auth-symbol">
        <Target />
      </span>
      <p className="eyebrow">{t("LET’S MAKE IT PERSONAL")}</p>
      <h1>
        {t("Tayyorgarligingizni")}
        <br />
        {t("sizga moslaymiz.")}
      </h1>
      <p className="muted">
        {t(
          "Maqsadingizni belgilang. Bu ma’lumotlarni keyin profilingizda o‘zgartirish mumkin.",
        )}
      </p>
      <section>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            void (async () => {
              try {
                const { error } = await db
                  .from("profiles")
                  .update({
                    language: f.get("language"),
                    target_exam: f.get("exam"),
                    preparation_level: f.get("level"),
                    target_score: f.get("score"),
                    exam_date: f.get("date") || null,
                    onboarded_at: new Date().toISOString(),
                  })
                  .eq("id", userId);
                if (error) throw error;
                await onComplete();
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Saqlanmadi. Qayta urinib ko‘ring.",
                );
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <label>
            {t("Afzal til")}
            <select name="language" defaultValue={profile.language || "uz"}>
              <option value="uz">O‘zbekcha</option>
              <option value="en">English</option>
              <option value="ru">Русский</option>
            </select>
          </label>
          <label>
            {t("Maqsadli imtihon")}
            <select
              name="exam"
              defaultValue={profile.target_exam || ""}
              required
            >
              <option value="" disabled>
                {t("Yo‘nalishni tanlang")}
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Hozirgi darajangiz")}
            <select
              name="level"
              defaultValue={profile.preparation_level || ""}
              required
            >
              <option value="" disabled>
                {t("Darajani tanlang")}
              </option>
              <option value="beginner">{t("Boshlang‘ich")}</option>
              <option value="intermediate">{t("O‘rta")}</option>
              <option value="advanced">{t("Yuqori")}</option>
            </select>
          </label>
          <label>
            {t("Maqsadli ball")}
            <input
              name="score"
              maxLength={40}
              defaultValue={profile.target_score || ""}
              placeholder={t("Masalan, IELTS 7.0 yoki SAT 1400")}
              required
            />
          </label>
          <label>
            {t("Imtihon sanasi (ixtiyoriy)")}
            <input
              type="date"
              name="date"
              defaultValue={profile.exam_date || ""}
            />
          </label>
          {error && (
            <div className="error" role="alert">
              {t(error)}
            </div>
          )}
          <button disabled={busy || !categories.length} className="primary">
            {busy ? (
              t("Saqlanmoqda…")
            ) : (
              <>
                {t("Tayyorgarlikni boshlash ")}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="muted">
            <CheckCircle size={14} />
            {t(" Maqsadlaringiz shaxsiy profilingizda saqlanadi.")}
          </p>
        </form>
      </section>
    </div>
  );
}
