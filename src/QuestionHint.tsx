import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { db, tafeAiFunction } from "./db";
import { getLocale, t } from "./i18n";
import { checked, Feedback, useAction } from "./platform";

export function QuestionHint({ prompt }: { prompt: string }) {
  const conversation = useRef<string | undefined>(undefined);
  const [hint, setHint] = useState("");
  const [solution, setSolution] = useState("");
  const action = useAction();
  async function request(full: boolean) {
    if (!conversation.current) {
      const {
        data: { session },
        error,
      } = await db.auth.getSession();
      if (error) throw error;
      if (!session) throw Error("Sessiya tugagan. Qayta kiring.");
      const row = checked(
        await db
          .from("ai_conversations")
          .insert({
            user_id: session.user.id,
            title: t("Savol bo‘yicha yordam"),
          })
          .select("id")
          .single(),
      );
      if (!row) throw Error("Suhbat ochilmadi.");
      conversation.current = row.id;
    }
    const instruction = full
      ? "Endi tasdiqlangan javobgacha bo‘lgan to‘liq yechimni tushuntiring."
      : "Bitta qisqa ishora bering. Yakuniy javobni yoki to‘liq yechimni aytmang.";
    const result = await db.functions.invoke(tafeAiFunction, {
      body: {
        locale: getLocale(),
        conversationId: conversation.current,
        requestId: crypto.randomUUID(),
        mode: "ask",
        message: instruction + "\n" + prompt.slice(0, 3700),
      },
    });
    if (result.error) {
      const detail = await result.error.context?.json?.().catch(() => null);
      throw Error(detail?.error || "AI bilan ulanish xatosi.");
    }
    if (typeof result.data?.answer !== "string")
      throw Error("AI javobi mavjud emas.");
    if (full) setSolution(result.data.answer);
    else setHint(result.data.answer);
  }

  return (
    <div className="question-hint">
      {hint && <p>{hint}</p>}
      {solution && <p>{solution}</p>}
      {!solution && (
        <button
          type="button"
          disabled={action.busy}
          onClick={() => void action.run(() => request(Boolean(hint)), "")}
        >
          <Sparkles size={15} aria-hidden="true" />
          {t(hint ? "To‘liq yechim" : "Ishora ber")}
        </button>
      )}
      <Feedback error={action.error} loading={action.busy} />
    </div>
  );
}
