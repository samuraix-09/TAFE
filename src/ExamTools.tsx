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
