export type ExamAnswers = Record<string, unknown>;

export function hasExamAnswer(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "object")
    return Object.values(value).some(hasExamAnswer);
  return true;
}

export function sameExamAnswer(a: unknown, b: unknown): boolean {
  if (a === b || (a == null && b == null)) return true;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => sameExamAnswer(value, b[index]))
    );
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        sameExamAnswer((a as ExamAnswers)[key], (b as ExamAnswers)[key]),
    )
  );
}

type PendingAnswer = { before: unknown; value: unknown };
type ExamDraft = {
  stage: number | null;
  answers: Record<string, PendingAnswer>;
};

function draftKey(id: string) {
  return "tafe-exam-draft-" + id;
}

export function readExamDraft(
  id: string,
  stage: number | null,
  saved: ExamAnswers,
  questionIds: string[],
): ExamAnswers {
  try {
    const draft = JSON.parse(
      sessionStorage.getItem(draftKey(id)) || "null",
    ) as ExamDraft | null;
    if (!draft || draft.stage !== stage) return {};
    return Object.fromEntries(
      questionIds
        .filter((key) => {
          const entry = draft.answers[key];
          return (
            entry &&
            JSON.stringify(entry.before ?? null) ===
              JSON.stringify(saved[key] ?? null)
          );
        })
        .map((key) => [key, draft.answers[key].value]),
    );
  } catch {
    return {};
  }
}

export function storeExamDraft(
  id: string,
  stage: number | null,
  saved: ExamAnswers,
  answers: ExamAnswers,
) {
  try {
    const changes = Object.entries(answers).filter(
      ([key, value]) => !sameExamAnswer(value, saved[key]),
    );
    if (!changes.length) {
      sessionStorage.removeItem(draftKey(id));
      return;
    }
    sessionStorage.setItem(
      draftKey(id),
      JSON.stringify({
        stage,
        answers: Object.fromEntries(
          changes.map(([key, value]) => [
            key,
            { before: saved[key] ?? null, value },
          ]),
        ),
      }),
    );
  } catch {
    // Live answers can still be submitted when browser storage is unavailable.
  }
}
