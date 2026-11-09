import { t } from "./i18n";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { db } from "./db";
import {
  checked,
  Feedback,
  Modal,
  newQuestion,
  QuestionInput,
  questionTypes,
  rpc,
  upload,
  useAction,
  useData,
  type Row,
  type Question,
} from "./platform";
const choice = (t: string) =>
  [
    "multiple_choice",
    "multiple_select",
    "true_false_not_given",
    "yes_no_not_given",
  ].includes(t);
const slots = (t: string) =>
  t.startsWith("matching_") ||
  ["summary_completion", "table_completion", "fill_blanks"].includes(t);
export function TestBuilder({
  id,
  onSaved,
  onCancel,
}: {
  id?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const info = useData(async () => {
    const cats = checked(
      await db.from("exam_categories").select("*").order("display_order"),
    );
    if (!id) return { cats, test: null, questions: [] };
    const t = checked(await db.from("tests").select("*").eq("id", id).single());
    const qs = checked(
      await db
        .from("questions")
        .select("*,answer_keys(*)")
        .eq("test_id", id)
        .order("position"),
    );
    return { cats, test: t, questions: qs };
  }, [id]);
  if (info.loading) return <Feedback loading />;
  if (info.error) return <Feedback error={info.error} />;
  return (
    <Builder
      key={id || "new"}
      initial={info.data!}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}
function Builder({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Row;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [test, setTest] = useState<Row>(
    initial.test || {
      title: "",
      description: "",
      category_id: initial.cats[0]?.id || "",
      section: "",
      difficulty: "intermediate",
      duration: 30,
      instructions: "",
      passage_title: "",
      passage_text: "",
      access_rank: 0,
      kind: "practice",
      published: false,
    },
  );
  const [questions, setQuestions] = useState<Question[]>(
    !initial.test
      ? [newQuestion()]
      : initial.questions.map((q: Row) => {
          const key = Array.isArray(q.answer_keys)
            ? q.answer_keys[0]
            : q.answer_keys;
          return {
            ...q,
            accepted: key?.accepted ?? key?.answer ?? "",
            explanation: key?.explanation || "",
            evidence: key?.evidence || "",
          };
        }),
  );
  const [current, setCurrent] = useState(0),
    [step, setStep] = useState(0),
    [preview, setPreview] = useState(false),
    [passageImage, setPassageImage] = useState<File | null>(null);
  const action = useAction();
  const q = questions[current];
  function change(patch: Partial<Question>) {
    setQuestions((qs) =>
      qs.map((item, i) => (i === current ? { ...item, ...patch } : item)),
    );
  }
  function reorder(from: number, to: number) {
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      from >= questions.length ||
      to < 0 ||
      to >= questions.length
    )
      return;
    setQuestions((qs) => {
      const next = [...qs];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setCurrent(to);
  }
  function setType(type: string) {
    const options =
      type === "true_false_not_given"
        ? ["True", "False", "Not Given"]
        : type === "yes_no_not_given"
          ? ["Yes", "No", "Not Given"]
          : ["", ""];
    change({
      type,
      options,
      accepted: type === "multiple_select" ? [] : slots(type) ? {} : "",
      config: slots(type)
        ? { rows: [{ id: crypto.randomUUID(), label: "" }] }
        : {},
    });
  }
  function validateDetails() {
    if (!test.title.trim() || !test.category_id)
      throw Error("Test nomi va kategoriyasini kiriting.");
    if (
      !Number.isInteger(test.duration) ||
      test.duration < 1 ||
      test.duration > 240
    )
      throw Error("Test vaqti 1–240 daqiqa bo‘lishi kerak.");
  }
  async function save(published: boolean) {
    validateDetails();
    const savedQuestions =
      !published &&
      questions.length === 1 &&
      !q?.prompt.trim() &&
      q?.type === "multiple_choice" &&
      q.options.every((option) => !option.trim())
        ? []
        : questions;
    if (published && savedQuestions.length === 0)
      throw Error("Kamida bitta savol qo‘shing.");
    function questionError(index: number, message: string): never {
      setStep(1);
      setCurrent(index);
      throw Error(message.replace("{number}", String(index + 1)));
    }
    for (const [i, item] of savedQuestions.entries()) {
      if (!item.prompt.trim())
        questionError(i, "Savol {number}: matnni kiriting.");
      if (choice(item.type) && item.options.some((o) => !o.trim()))
        questionError(i, "Savol {number}: variantlarni to‘ldiring.");
      if (
        choice(item.type) &&
        new Set(item.options).size !== item.options.length
      )
        questionError(i, "Savol {number}: variantlar takrorlanmasin.");
      if (published) {
        if (
          !item.accepted ||
          JSON.stringify(item.accepted) === "[]" ||
          JSON.stringify(item.accepted) === "{}"
        )
          questionError(i, "Savol {number}: javobni belgilang.");
        if (
          slots(item.type) &&
          (item.config.rows || []).some(
            (r: Row) =>
              !r.label.trim() ||
              !item.accepted[r.id] ||
              JSON.stringify(item.accepted[r.id]) === "[]",
          )
        )
          questionError(i, "Savol {number}: barcha qatorlarga javob kiriting.");
      }
    }
    let path = test.passage_image || null;
    if (passageImage) path = await upload("tafe-test-images", passageImage);
    try {
      await rpc("admin_save_test", {
        payload: {
          ...test,
          passage_image: path,
          published,
          questions: savedQuestions,
        },
      });
    } catch (error) {
      if (passageImage && path)
        await db.storage.from("tafe-test-images").remove([path]);
      throw error;
    }
    onSaved();
  }
  return (
    <div className="test-builder">
      <div className="builder-toolbar">
        <div>
          <p className="eyebrow">{t("VISUAL TEST STUDIO")}</p>
          <h2>{test.id ? t("Testni tahrirlash") : t("Yangi test")}</h2>
        </div>
        <button onClick={onCancel}>{t("Bekor qilish")}</button>
      </div>
      <ol className="builder-steps">
        {["Test haqida", "Savollar"].map((label, index) => (
          <li key={label} aria-current={step === index ? "step" : undefined}>
            <button
              type="button"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  if (index === 1) validateDetails();
                  setStep(index);
                }, "")
              }
            >
              {index + 1}. {t(label)}
            </button>
          </li>
        ))}
      </ol>
      <Feedback {...action} />
      <section hidden={step !== 0}>
        <h3>{t("Test haqida")}</h3>
        <div className="form-grid">
          <label>
            {t("Test nomi")}
            <input
              maxLength={200}
              value={test.title}
              onChange={(e) => setTest({ ...test, title: e.target.value })}
            />
          </label>
          <label>
            {t("Kategoriya")}
            <select
              value={test.category_id}
              onChange={(e) =>
                setTest({ ...test, category_id: e.target.value })
              }
            >
              {initial.cats.map((c: Row) => (
                <option key={c.id} value={c.id}>
                  {t(c.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Vaqt (daqiqa)")}
            <input
              type="number"
              min={1}
              max={240}
              value={test.duration}
              onChange={(e) =>
                setTest({ ...test, duration: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <details className="builder-advanced">
          <summary>{t("Qo‘shimcha sozlamalar")}</summary>
          <div className="form-grid">
            <label>
              {t("Bo‘lim / fan")}
              <input
                value={test.section}
                onChange={(e) => setTest({ ...test, section: e.target.value })}
              />
            </label>
            <label>
              {t("Qiyinlik")}
              <select
                value={test.difficulty}
                onChange={(e) =>
                  setTest({ ...test, difficulty: e.target.value })
                }
              >
                <option value="beginner">{t("Oson")}</option>
                <option value="intermediate">{t("O‘rta")}</option>
                <option value="advanced">{t("Qiyin")}</option>
              </select>
            </label>
            <label>
              {t("Turi")}
              <select
                value={test.kind}
                onChange={(e) => setTest({ ...test, kind: e.target.value })}
              >
                <option value="practice">{t("Practice")}</option>
                <option value="mock">{t("Full mock")}</option>
              </select>
            </label>
            <label>
              {t("Kirish darajasi")}
              <input
                type="number"
                min={0}
                max={100}
                value={test.access_rank}
                onChange={(e) =>
                  setTest({ ...test, access_rank: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <label>
            {t("Tavsif")}
            <textarea
              value={test.description}
              onChange={(e) =>
                setTest({ ...test, description: e.target.value })
              }
            />
          </label>
          <label>
            {t("Ko‘rsatmalar")}
            <textarea
              value={test.instructions}
              onChange={(e) =>
                setTest({ ...test, instructions: e.target.value })
              }
            />
          </label>
          <h4>{t("Passage va material")}</h4>
          <label>
            {t("Passage nomi")}
            <input
              value={test.passage_title}
              onChange={(e) =>
                setTest({ ...test, passage_title: e.target.value })
              }
            />
          </label>
          <label>
            {t("Passage rasmi (ixtiyoriy · 3 MB)")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPassageImage(e.target.files?.[0] || null)}
            />
          </label>
          {initial.test?.passage_image && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={!test.passage_image}
                onChange={(e) =>
                  setTest({
                    ...test,
                    passage_image: e.target.checked
                      ? null
                      : initial.test?.passage_image,
                  })
                }
              />
              {t("Mavjud rasmni olib tashlash")}
            </label>
          )}
          <label>
            {t("Passage matni")}
            <textarea
              className="passage-editor"
              value={test.passage_text}
              onChange={(e) =>
                setTest({ ...test, passage_text: e.target.value })
              }
            />
          </label>
        </details>
      </section>
      <div className="builder-grid" hidden={step !== 1}>
        <section className="question-sidebar">
          <h3>{t("Savollar")}</h3>
          {questions.map((item, i) => (
            <div
              className={current === i ? "question-row active" : "question-row"}
              key={item.id}
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData("text/plain", String(i))
              }
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                reorder(Number(e.dataTransfer.getData("text/plain")), i);
              }}
            >
              <button onClick={() => setCurrent(i)}>
                {i + 1}. {item.prompt.slice(0, 35) || t("Yangi savol")}
              </button>
            </div>
          ))}
          <button
            className="primary"
            onClick={() => {
              setQuestions([...questions, newQuestion()]);
              setCurrent(questions.length);
            }}
          >
            <Plus size={16} />
            {t("Savol qo‘shish")}
          </button>
        </section>
        <section className="question-editor">
          {q ? (
            <>
              <div className="button-row">
                <h3>
                  {current + 1}
                  {t("-savol")}
                </h3>
                <button
                  aria-label={t("Savolni yuqoriga")}
                  onClick={() => reorder(current, current - 1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  aria-label={t("Savolni pastga")}
                  onClick={() => reorder(current, current + 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  onClick={() => {
                    setQuestions([
                      ...questions,
                      { ...structuredClone(q), id: crypto.randomUUID() },
                    ]);
                    setCurrent(questions.length);
                  }}
                >
                  <Copy size={16} />
                  {t("Nusxa")}
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    setQuestions(questions.filter((_, i) => i !== current));
                    setCurrent(Math.max(0, current - 1));
                  }}
                >
                  <Trash2 size={16} />
                  {t("O‘chirish")}
                </button>
              </div>
              <div className="form-grid">
                <label>
                  {t("Savol turi")}
                  <select
                    value={q.type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {questionTypes.map(([v, l]) => (
                      <option key={v} value={v}>
                        {t(l)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                {t("Savol matni")}
                <textarea
                  placeholder={t("Savolni kiriting")}
                  value={q.prompt}
                  onChange={(e) => change({ prompt: e.target.value })}
                />
              </label>
              {(choice(q.type) || q.type.startsWith("matching_")) && (
                <div>
                  <h4>{t("Variantlar")}</h4>
                  {choice(q.type) && (
                    <p className="muted">
                      {t("To‘g‘ri javobni chapdagi belgi orqali tanlang.")}
                    </p>
                  )}
                  {q.options.map((o, i) => (
                    <div className="option-editor" key={i}>
                      {choice(q.type) && (
                        <input
                          aria-label={t("To‘g‘ri javob")}
                          type={
                            q.type === "multiple_select" ? "checkbox" : "radio"
                          }
                          name={"key-" + q.id}
                          checked={
                            q.type === "multiple_select"
                              ? q.accepted.includes(o)
                              : q.accepted === o && !!o
                          }
                          onChange={(e) =>
                            change({
                              accepted:
                                q.type === "multiple_select"
                                  ? e.target.checked
                                    ? [...q.accepted, o]
                                    : q.accepted.filter((x: string) => x !== o)
                                  : o,
                            })
                          }
                        />
                      )}
                      <input
                        aria-label={t("Variant ") + (i + 1)}
                        placeholder={t("Variant matni")}
                        value={
                          ["true_false_not_given", "yes_no_not_given"].includes(
                            q.type,
                          )
                            ? t(o)
                            : o
                        }
                        readOnly={
                          q.type === "true_false_not_given" ||
                          q.type === "yes_no_not_given"
                        }
                        onChange={(e) => {
                          const opts = [...q.options];
                          opts[i] = e.target.value;
                          const accepted =
                            q.type === "multiple_select"
                              ? q.accepted.map((a: string) =>
                                  a === o ? e.target.value : a,
                                )
                              : q.accepted === o
                                ? e.target.value
                                : q.accepted;
                          change({ options: opts, accepted });
                        }}
                      />
                      <button
                        aria-label={t("Variantni o‘chirish")}
                        disabled={
                          q.type === "true_false_not_given" ||
                          q.type === "yes_no_not_given"
                        }
                        onClick={() =>
                          change({
                            options: q.options.filter((_, n) => n !== i),
                            accepted:
                              q.type === "multiple_select"
                                ? q.accepted.filter((x: string) => x !== o)
                                : q.accepted === o
                                  ? ""
                                  : q.accepted,
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {!["true_false_not_given", "yes_no_not_given"].includes(
                    q.type,
                  ) && (
                    <button
                      onClick={() => change({ options: [...q.options, ""] })}
                    >
                      <Plus size={14} />
                      {t("Variant qo‘shish")}
                    </button>
                  )}
                </div>
              )}
              {slots(q.type) && (
                <div>
                  <h4>
                    {q.type.startsWith("matching_")
                      ? t("Moslashtirish qatorlari")
                      : t("Bo‘shliqlar / jadval qatorlari")}
                  </h4>
                  {(q.config.rows || []).map((r: Row, i: number) => (
                    <div className="slot-editor" key={r.id}>
                      <label>
                        {t("Qator / bo‘shliq matni")}
                        <input
                          value={r.label}
                          onChange={(e) =>
                            change({
                              config: {
                                ...q.config,
                                rows: q.config.rows.map((x: Row, n: number) =>
                                  n === i ? { ...x, label: e.target.value } : x,
                                ),
                              },
                            })
                          }
                        />
                      </label>
                      {q.type.startsWith("matching_") ? (
                        <label>
                          {t("To‘g‘ri moslik")}
                          <select
                            value={q.accepted[r.id] || ""}
                            onChange={(e) =>
                              change({
                                accepted: {
                                  ...q.accepted,
                                  [r.id]: e.target.value,
                                },
                              })
                            }
                          >
                            <option value="">{t("Tanlang")}</option>
                            {q.options.filter(Boolean).map((o, n) => (
                              <option key={n}>{o}</option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <label>
                          {t(
                            "Qabul qilinadigan javoblar (har biri yangi qatorda)",
                          )}
                          <textarea
                            value={(q.accepted[r.id] || []).join("\n")}
                            onChange={(e) =>
                              change({
                                accepted: {
                                  ...q.accepted,
                                  [r.id]: e.target.value.split("\n"),
                                },
                              })
                            }
                          />
                        </label>
                      )}
                      <button
                        className="danger"
                        onClick={() => {
                          const a = { ...q.accepted };
                          delete a[r.id];
                          change({
                            config: {
                              ...q.config,
                              rows: q.config.rows.filter(
                                (_: Row, n: number) => i !== n,
                              ),
                            },
                            accepted: a,
                          });
                        }}
                      >
                        {t("Qatorni olib tashlash")}
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      change({
                        config: {
                          ...q.config,
                          rows: [
                            ...(q.config.rows || []),
                            { id: crypto.randomUUID(), label: "" },
                          ],
                        },
                      })
                    }
                  >
                    <Plus size={14} />
                    {t("Qator qo‘shish")}
                  </button>
                </div>
              )}
              {!choice(q.type) && !slots(q.type) && (
                <>
                  <label>
                    {t("Qabul qilinadigan javoblar (har biri yangi qatorda)")}
                    <textarea
                      value={
                        Array.isArray(q.accepted)
                          ? q.accepted.join("\n")
                          : q.accepted
                      }
                      onChange={(e) =>
                        change({ accepted: e.target.value.split("\n") })
                      }
                    />
                  </label>
                  <small>
                    {t(
                      "Matn javoblari tasdiqlangan variantlar bilan serverda solishtiriladi.",
                    )}
                  </small>
                </>
              )}
              <details className="builder-advanced" key={q.id}>
                <summary>{t("Qo‘shimcha sozlamalar")}</summary>
                <div className="form-grid">
                  <label>
                    {t("Ball")}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={q.points}
                      onChange={(e) =>
                        change({ points: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    {t("Guruh")}
                    <input
                      value={q.group_name}
                      onChange={(e) => change({ group_name: e.target.value })}
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => change({ required: e.target.checked })}
                    />
                    {t("Majburiy savol")}
                  </label>
                </div>
                <label>
                  {t("Izoh")}
                  <textarea
                    value={q.explanation}
                    onChange={(e) => change({ explanation: e.target.value })}
                  />
                </label>
                <label>
                  {t("Passage dalili")}
                  <textarea
                    value={q.evidence}
                    onChange={(e) => change({ evidence: e.target.value })}
                  />
                </label>
              </details>
            </>
          ) : (
            <p>{t("Savol qo‘shish tugmasini bosing.")}</p>
          )}
        </section>
      </div>
      <div className="button-row builder-footer">
        {step === 1 && (
          <button disabled={action.busy} onClick={() => setStep(0)}>
            {t("Ortga")}
          </button>
        )}
        {(!test.published || step === 1) && (
          <button
            disabled={action.busy}
            onClick={() => void action.run(() => save(false))}
          >
            <Save size={16} />
            {t("Qoralama saqlash")}
          </button>
        )}
        {step === 0 ? (
          <button
            className="primary"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                validateDetails();
                setStep(1);
              }, "")
            }
          >
            {t("Savollar")}
          </button>
        ) : (
          <>
            <button disabled={action.busy} onClick={() => setPreview(true)}>
              <Eye size={16} />
              {t("Talaba ko‘rinishi")}
            </button>
            <button
              className="primary"
              disabled={action.busy}
              onClick={() => void action.run(() => save(true))}
            >
              {test.published ? t("O‘zgarishlarni saqlash") : t("E’lon qilish")}
            </button>
          </>
        )}
      </div>
      {preview && (
        <Modal
          title={t("Talaba ko‘rinishi")}
          onClose={() => setPreview(false)}
          wide
        >
          <h2>{test.title}</h2>
          <p>
            {test.duration}
            {t(" daqiqa · ")}
            {questions.length}
            {t(" savol")}
          </p>
          <p>{test.instructions}</p>
          {test.passage_text && (
            <section>
              <h3>{test.passage_title}</h3>
              <p className="passage-text">{test.passage_text}</p>
            </section>
          )}
          {questions.map((q, i) => (
            <PreviewQuestion key={q.id} q={q} index={i} />
          ))}
        </Modal>
      )}
    </div>
  );
}
function PreviewQuestion({ q, index }: { q: Question; index: number }) {
  const [value, setValue] = useState<any>();
  return (
    <section>
      <h3>
        {index + 1}. {q.prompt}
      </h3>
      <QuestionInput question={q} value={value} onChange={setValue} />
    </section>
  );
}
