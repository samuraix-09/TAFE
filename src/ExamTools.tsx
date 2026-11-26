import { useState } from "react";
import { BookOpen, Calculator } from "lucide-react";
import { t } from "./i18n";

export type ExamPresentation = "sat" | "ielts" | "cefr" | "standard";

export function examPresentation(
  category: string,
  title: string,
  stage: number | null,
): ExamPresentation {
  const name = category.trim().toLowerCase();
  if (stage !== null || name === "sat") return "sat";
  if (name === "ielts") return "ielts";
  if (name === "cefr" || name === "multilevel") return "cefr";
  if (name) return "standard";
  const prefix = title
    .match(/^(SAT|IELTS|CEFR|Multilevel)\b/i)?.[0]
    .toLowerCase();
  return prefix === "multilevel"
    ? "cefr"
    : prefix === "sat" || prefix === "ielts" || prefix === "cefr"
      ? prefix
      : "standard";
}

export function splitSatPrompt(prompt: string): [string, string] {
  const blocks = prompt.trim().split(/\n\s*\n/);
  const last = (blocks.at(-1) || "").trim();
  if (blocks.length < 2 || !last.endsWith("?")) return ["", prompt];
  return [blocks.slice(0, -1).join("\n\n"), last];
}

export function SatMathTools() {
  const [result, setResult] = useState("");
  return (
    <div className="exam-tools">
      <details>
        <summary>
          <Calculator size={16} aria-hidden="true" />
          {t("Kalkulyator")}
        </summary>
        <form
          className="exam-calculator"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const a = Number(data.get("first")),
              b = Number(data.get("second"));
            const operation = data.get("operation");
            if (
              ["add", "subtract", "multiply", "divide", "power"].includes(
                String(operation),
              ) &&
              data.get("second") === ""
            ) {
              setResult(t("Ikkinchi son"));
              return;
            }
            const radians =
              data.get("angle") === "deg" ? (a * Math.PI) / 180 : a;
            const operations: Record<string, () => number> = {
              add: () => a + b,
              subtract: () => a - b,
              multiply: () => a * b,
              divide: () => a / b,
              power: () => a ** b,
              root: () => Math.sqrt(a),
              log: () => Math.log10(a),
              ln: () => Math.log(a),
              sin: () => Math.sin(radians),
              cos: () => Math.cos(radians),
              tan: () => Math.tan(radians),
              abs: () => Math.abs(a),
            };
            const value = operations[String(operation)]?.();
            setResult(
              Number.isFinite(value)
                ? String(Number(value.toPrecision(12)))
                : t("Hisoblab bo‘lmadi"),
            );
          }}
        >
          <input
            type="number"
            step="any"
            name="first"
            required
            aria-label={t("Birinchi son")}
          />
          <select name="operation" aria-label={t("Amal")}>
            <option value="add">+</option>
            <option value="subtract">−</option>
            <option value="multiply">×</option>
            <option value="divide">÷</option>
            <option value="power">xʸ</option>
            <option value="root">√x</option>
            <option value="log">log₁₀ x</option>
            <option value="ln">ln x</option>
            <option value="sin">sin x</option>
            <option value="cos">cos x</option>
            <option value="tan">tan x</option>
            <option value="abs">|x|</option>
          </select>
          <input
            type="number"
            step="any"
            name="second"
            aria-label={t("Ikkinchi son")}
          />
          <select name="angle" aria-label="Burchak birligi">
            <option value="deg">DEG</option>
            <option value="rad">RAD</option>
          </select>
          <button aria-label={t("Hisoblash")}>=</button>
          <output aria-live="polite">{result}</output>
        </form>
      </details>
      <details>
        <summary>
          <BookOpen size={16} aria-hidden="true" />
          {t("Formulalar")}
        </summary>
        <dl>
          <div>
            <dt>{t("Doira yuzi")}</dt>
            <dd>A = πr²</dd>
          </div>
          <div>
            <dt>{t("Uchburchak yuzi")}</dt>
            <dd>A = bh / 2</dd>
          </div>
          <div>
            <dt>{t("Pifagor teoremasi")}</dt>
            <dd>a² + b² = c²</dd>
          </div>
          <div>
            <dt>{t("Silindr hajmi")}</dt>
            <dd>V = πr²h</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
