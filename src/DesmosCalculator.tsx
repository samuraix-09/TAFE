import { useEffect, useRef, useState } from "react";
import { t } from "./i18n";

type Calculator = { destroy(): void };
type DesmosApi = {
  GraphingCalculator(
    element: HTMLElement,
    options: { settingsMenu: boolean },
  ): Calculator;
};

const apiKey = import.meta.env.VITE_DESMOS_API_KEY?.trim();
let loading: Promise<DesmosApi> | undefined;

function loadDesmos() {
  if (!loading) {
    loading = new Promise<DesmosApi>((resolve, reject) => {
      const script = document.createElement("script");
      const url = new URL("https://www.desmos.com/api/v1.11/calculator.js");
      url.searchParams.set("apiKey", apiKey);
      script.src = url.href;
      const fail = () => {
        script.remove();
        reject(new Error("Desmos API failed to load"));
      };
      script.onerror = fail;
      script.onload = () => {
        const api = (window as Window & { Desmos?: DesmosApi }).Desmos;
        if (api?.GraphingCalculator) resolve(api);
        else fail();
      };
      document.head.append(script);
    }).catch((error) => {
      loading = undefined;
      throw error;
    });
  }
  return loading;
}

export function DesmosCalculator() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !apiKey) return;
    let active = true;
    let calculator: Calculator | undefined;
    loadDesmos()
      .then((api) => {
        if (!active || !host.current) return;
        calculator = api.GraphingCalculator(host.current, {
          settingsMenu: false,
        });
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
      calculator?.destroy();
    };
  }, [open]);

  if (!apiKey) return null;
  return (
    <details
      className="sat-desmos"
      onToggle={(event) => {
        const expanded = event.currentTarget.open;
        if (expanded) setStatus("loading");
        setOpen(expanded);
      }}
    >
      <summary>Desmos</summary>
      {open && status === "loading" && <p role="status">{t("Yuklanmoqda…")}</p>}
      {open && status === "error" && (
        <p role="alert">Desmos · {t("Qayta urinish")}</p>
      )}
      {open && <div className="sat-desmos-calculator" ref={host} />}
    </details>
  );
}
