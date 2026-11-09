import { t } from "./i18n";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type DependencyList,
  type ReactNode,
} from "react";
import { X, Inbox, LoaderCircle } from "lucide-react";
import { db } from "./db";
export type Row = Record<string, any>;
export function checked<T>(result: { data: T; error: any }): T {
  if (result.error) throw Error(result.error.message || "So‘rov bajarilmadi.");
  return result.data;
}
export async function rpc(name: string, args: Row = {}) {
  return checked(await db.rpc(name, args));
}
export function useData<T>(
  loader: () => Promise<T>,
  deps: DependencyList = [],
) {
  const identity = JSON.stringify(deps);
  const [snapshot, setSnapshot] = useState<{ key: string; value: T | null }>({
      key: identity,
      value: null,
    }),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void loader()
      .then((v) => {
        if (alive) setSnapshot({ key: identity, value: v });
      })
      .catch((e) => {
        if (alive) {
          setSnapshot({ key: identity, value: null });
          setError(e.message || "Ulanish xatosi.");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [...deps, revision]);
  return {
    data: snapshot.key === identity ? snapshot.value : null,
    error: snapshot.key === identity ? error : "",
    loading: loading || snapshot.key !== identity,
    reload: () => setRevision((v) => v + 1),
  };
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function run(work: () => Promise<void>, message = "Saqlandi.") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "So‘rov bajarilmadi.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return {
    busy,
    error,
    notice,
    run,
    clear: () => {
      setError("");
      setNotice("");
    },
  };
}
export function Feedback({
  error,
  notice,
  loading,
}: {
  error?: string;
  notice?: string;
  loading?: boolean;
}) {
  return (
    <>
      {error && (
        <div className="error" role="alert">
          {t(error)}
        </div>
      )}
      {notice && (
        <div className="success-note" role="status">
          {t(notice)}
        </div>
      )}
      {loading && (
        <div className="inline-loading" role="status">
          <LoaderCircle size={17} />
          {t("Yuklanmoqda…")}
        </div>
      )}
    </>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="platform-empty">
      <Inbox size={30} />
      <p>{t(text)}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  function dismiss() {
    const dialog = ref.current;
    if (!dialog || dialog.hasAttribute("data-closing")) return;
    dialog.setAttribute("data-closing", "");
    const exit = dialog
      .getAnimations?.()
      .find(
        (animation) =>
          "animationName" in animation &&
          animation.animationName === "motion-modal-out",
      );
    const finish = () => {
      if (!dialog.isConnected || !dialog.open) return;
      dialog.close();
      onCloseRef.current();
    };
    if (exit) void exit.finished.then(finish, finish);
    else finish();
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      className={wide ? "platform-modal wide" : "platform-modal"}
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
    >
      <div className="modal-header">
        <h2 id={headingId}>{t(title)}</h2>
        <button type="button" aria-label={t("Yopish")} onClick={dismiss}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export async function signed(bucket: string, path: string | null | undefined) {
  if (!path) return null;
  return checked(await db.storage.from(bucket).createSignedUrl(path, 120))!
    .signedUrl;
}
export async function upload(bucket: string, file: File, userId?: string) {
  const images = bucket !== "tafe-documents";
  const allowed = images
    ? ["image/jpeg", "image/png", "image/webp"]
    : [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
  const max =
    bucket === "tafe-documents" ? 25 : bucket === "tafe-covers" ? 3 : 2;
  if (!allowed.includes(file.type))
    throw Error("Qo‘llab-quvvatlanmagan fayl turi.");
  if (file.size > max * 1024 * 1024)
    throw Error("Fayl hajmi " + max + " MB dan oshmasin.");
  const suffix =
    file.name
      .split(".")
      .pop()
      ?.replace(/[^a-zA-Z0-9]/g, "") || "file";
  const path =
    (userId ? userId + "/" : "") + crypto.randomUUID() + "." + suffix;
  checked(
    await db.storage
      .from(bucket)
      .upload(path, file, { upsert: false, contentType: file.type }),
  );
  return path;
}
export const questionTypes = [
  ["multiple_choice", "Multiple Choice"],
  ["multiple_select", "Multiple Select"],
  ["true_false_not_given", "True / False / Not Given"],
  ["yes_no_not_given", "Yes / No / Not Given"],
  ["matching_headings", "Matching Headings"],
  ["matching_information", "Matching Information"],
  ["matching_features", "Matching Features"],
  ["matching_sentence_endings", "Matching Sentence Endings"],
  ["sentence_completion", "Sentence Completion"],
  ["summary_completion", "Summary Completion"],
  ["table_completion", "Table Completion"],
  ["short_answer", "Short Answer"],
  ["written_answer", "Written Answer"],
  ["numeric_answer", "Numeric Answer"],
  ["fill_blanks", "Fill in the Blanks"],
] as const;
export type Question = {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  accepted: any;
  config: Row;
  points: number;
  required: boolean;
  group_name: string;
  explanation: string;
  evidence: string;
};
export function newQuestion(): Question {
  return {
    id: crypto.randomUUID(),
    type: "multiple_choice",
    prompt: "",
    options: ["", ""],
    accepted: "",
    config: {},
    points: 1,
    required: true,
    group_name: "",
    explanation: "",
    evidence: "",
  };
}
export function QuestionInput({
  question: q,
  value,
  onChange,
  disabled = false,
}: {
  question: Row;
  value: any;
  onChange: (v: any) => void;
  disabled?: boolean;
}) {
  if (
    ["multiple_choice", "true_false_not_given", "yes_no_not_given"].includes(
      q.type || "multiple_choice",
    )
  )
    return (
      <div>
        {q.options.map((o: string, i: number) => (
          <label className="answer-option" key={i}>
            <input
              type="radio"
              name={"q-" + q.id}
              disabled={disabled}
              checked={value === o}
              onChange={() => onChange(o)}
            />
            {["true_false_not_given", "yes_no_not_given"].includes(q.type)
              ? t(o)
              : o}
          </label>
        ))}
      </div>
    );
  if (q.type === "multiple_select")
    return (
      <div>
        {q.options.map((o: string, i: number) => (
          <label className="answer-option" key={i}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={Array.isArray(value) && value.includes(o)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...(value || []), o]
                    : (value || []).filter((v: string) => v !== o),
                )
              }
            />
            {["true_false_not_given", "yes_no_not_given"].includes(q.type)
              ? t(o)
              : o}
          </label>
        ))}
      </div>
    );
  if (q.type.startsWith("matching_"))
    return (
      <div className="matching-inputs">
        {(q.config.rows || []).map((r: Row) => (
          <label key={r.id}>
            {r.label}
            <select
              disabled={disabled}
              value={value?.[r.id] || ""}
              onChange={(e) => onChange({ ...value, [r.id]: e.target.value })}
            >
              <option value="">{t("Tanlang")}</option>
              {q.options.map((o: string, i: number) => (
                <option value={o} key={i}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    );
  if (
    ["summary_completion", "table_completion", "fill_blanks"].includes(q.type)
  )
    return (
      <div className="matching-inputs">
        {(q.config.rows || []).map((r: Row) => (
          <label key={r.id}>
            {r.label}
            <input
              disabled={disabled}
              value={value?.[r.id] || ""}
              onChange={(e) => onChange({ ...value, [r.id]: e.target.value })}
            />
          </label>
        ))}
      </div>
    );
  if (q.type === "written_answer")
    return (
      <textarea
        disabled={disabled}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        maxLength={10000}
        placeholder={t("Javobingizni yozing")}
      />
    );
  return (
    <input
      aria-label={t("Javob")}
      disabled={disabled}
      inputMode={q.type === "numeric_answer" ? "decimal" : "text"}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      maxLength={1000}
      placeholder={t("Javobingiz")}
    />
  );
}
