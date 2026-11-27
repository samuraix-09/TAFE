import { useEffect, useRef, useState } from "react";
import { t } from "./i18n";

const apiKey = import.meta.env.VITE_DESMOS_API_KEY?.trim();

export function DesmosCalculator() {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setStatus("error"), 20000);
    function onMessage(event: MessageEvent) {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== "null"
      )
        return;
      if (event.data !== "desmos-ready" && event.data !== "desmos-error")
        return;
      window.clearTimeout(timer);
      setStatus(event.data === "desmos-ready" ? "ready" : "error");
    }

    window.addEventListener("message", onMessage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [open, attempt]);

  if (!apiKey) return null;
  return (
    <details
      className="sat-desmos"
      onToggle={(event) => {
        if (event.currentTarget.open) setStatus("loading");
        setOpen(event.currentTarget.open);
      }}
    >
      <summary>Desmos</summary>
      {open && status === "loading" && <p role="status">{t("Yuklanmoqda…")}</p>}
      {open && status === "error" && (
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            setAttempt((value) => value + 1);
          }}
        >
          {t("Qayta urinish")}
        </button>
      )}
      {open && (
        <iframe
          key={attempt}
          ref={frame}
          className="sat-desmos-calculator"
          src={`/desmos-calculator.html#${encodeURIComponent(apiKey)}`}
          sandbox="allow-scripts"
          title="Desmos Graphing Calculator"
          hidden={status === "error"}
        />
      )}
    </details>
  );
}
