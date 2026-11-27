import { useEffect, useState } from "react";
import { t } from "./i18n";

export function StudyTimer({ userId }: { userId: string }) {
  const key = "tafe-study-timer:" + userId;
  const [end, setEnd] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(key));
      return Number.isFinite(stored) && stored > Date.now() ? stored : 0;
    } catch {
      return 0;
    }
  });
  const [now, setNow] = useState(Date.now);
  const [finished, setFinished] = useState(false);
  const seconds = Math.max(0, Math.ceil((end - now) / 1000));

  function setTimer(deadline: number) {
    setEnd(deadline);
    try {
      if (deadline) localStorage.setItem(key, String(deadline));
      else localStorage.removeItem(key);
    } catch {
      /* In-memory timing remains available. */
    }
  }

  useEffect(() => {
    if (!end) return;
    function tick() {
      const current = Date.now();
      setNow(current);
      if (current >= end) {
        setFinished(true);
        setEnd(0);
        try {
          localStorage.removeItem(key);
        } catch {
          /* Storage is optional. */
        }
      }
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [end, key]);

  return (
    <section className="coin-study-timer">
      <h2>{t("O‘qish taymeri")}</h2>
      {end ? (
        <>
          <output role="timer">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </output>
          <button onClick={() => setTimer(0)}>{t("To‘xtatish")}</button>
        </>
      ) : (
        <div className="button-row">
          {[15, 25, 45].map((minutes) => (
            <button
              key={minutes}
              onClick={() => {
                const current = Date.now();
                setNow(current);
                setFinished(false);
                setTimer(current + minutes * 60_000);
              }}
            >
              {minutes} {t("daqiqa")}
            </button>
          ))}
        </div>
      )}
      {finished && <p role="status">{t("O‘qish vaqti tugadi.")}</p>}
    </section>
  );
}
