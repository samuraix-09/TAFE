import { useState } from "react";
import { db } from "./db";
import { ieltsFormId, ieltsSkills } from "./IeltsTools";
import {
  checked,
  Feedback,
  Modal,
  rpc,
  signed,
  useAction,
  useData,
  type Row,
} from "./platform";

export function IeltsAdmin({
  tests,
  onClose,
  onChange,
}: {
  tests: Row[];
  onClose: () => void;
  onChange: () => void;
}) {
  const config = useData(() => rpc("admin_ielts_sections"), []);
  const attempts = useData<Row[]>(() => rpc("admin_ielts_attempts"), []);
  const [id, setId] = useState("");
  return (
    <Modal wide title="IELTS Academic boshqaruvi" onClose={onClose}>
      <Feedback
        error={config.error || attempts.error}
        loading={config.loading}
      />
      {config.data && (
        <Content config={config.data} tests={tests} onChange={onChange} />
      )}
      <ObjectiveRules />
      <label>
        Baholash uchun urinish
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Urinishni tanlang</option>
          {attempts.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {new Date(a.submitted_at).toLocaleString()} · {a.user_id}
            </option>
          ))}
        </select>
      </label>
      {id && <Grade key={id} attempt={id} />}
    </Modal>
  );
}

function Content({
  config,
  tests,
  onChange,
}: {
  config: Row;
  tests: Row[];
  onChange: () => void;
}) {
  const a = useAction();
  const [audio, setAudio] = useState(
    config.sections.find((x: Row) => x.stage === 0)?.audio_path ?? "",
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const f = new FormData(event.currentTarget);
        void a.run(async () => {
          const file = f.get("audio");
          let path = audio;
          if (file instanceof File && file.size) {
            path = "listening/" + crypto.randomUUID();
            checked(
              await db.storage
                .from("tafe-ielts-audio")
                .upload(path, file, { contentType: file.type }),
            );
            setAudio(path);
          }
          await rpc("admin_ielts_sections", {
            sources: ieltsSkills.map((_, i) => f.get("s" + i) || null),
            timings: ieltsSkills.map((_, i) => Number(f.get("m" + i))),
            audio: path || null,
            activate: f.has("publish"),
          });
          onChange();
        });
      }}
    >
      <p>
        Vizual test muharririda bo‘lim manbalarini tayyorlang. Listening va
        Reading uchun 40 tadan savol, Writing uchun ikki topshiriq, Speaking
        uchun uchta prompt kerak.
      </p>
      {ieltsSkills.map((name, i) => {
        const section = config.sections.find((x: Row) => x.stage === i);
        return (
          <fieldset key={name}>
            <legend>{name}</legend>
            <label>
              Manba
              <select name={"s" + i} defaultValue={section?.source_id ?? ""}>
                <option value="">Tanlanmagan</option>
                {tests
                  .filter(
                    (t) =>
                      t.id !== ieltsFormId &&
                      t.exam_categories?.name?.toLowerCase() === "ielts",
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Daqiqa
              <input
                type="number"
                name={"m" + i}
                min={1}
                max={120}
                required
                defaultValue={section?.minutes ?? [30, 60, 60, 14][i]}
              />
            </label>
          </fieldset>
        );
      })}
      <label>
        Listening audiosi
        <input
          type="file"
          name="audio"
          accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm"
        />
      </label>
      {audio && <p>Audio biriktirilgan.</p>}
      <label>
        <input
          type="checkbox"
          name="publish"
          defaultChecked={config.published}
        />{" "}
        To‘liq IELTS’ni e’lon qilish
      </label>
      <Feedback error={a.error} notice={a.notice} />
      <button className="primary" disabled={a.busy}>
        IELTS sozlamalarini saqlash
      </button>
    </form>
  );
}

function Grade({ attempt }: { attempt: string }) {
  const r = useData(() => rpc("ielts_report", { attempt }), [attempt]);
  const a = useAction();
  const [urls, setUrls] = useState<Record<number, string>>({});
  if (!r.data) return <Feedback error={r.error} loading={r.loading} />;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const band = (key: string) =>
          f.get(key) === "" ? null : Number(f.get(key));
        void a.run(async () => {
          await rpc("admin_grade_ielts", {
            attempt,
            w: band("w"),
            s: band("s"),
            notes: f.get("notes"),
          });
        });
      }}
    >
      <p>
        Listening {r.data.listening} · Reading {r.data.reading}
      </p>
      {r.data.review?.map((row: Row, i: number) => (
        <section key={i}>
          <strong>{row.prompt}</strong>
          {row.stage === 2 ? (
            <p style={{ whiteSpace: "pre-wrap" }}>
              {row.response || "Javob berilmagan"}
            </p>
          ) : row.response ? (
            urls[i] ? (
              <audio controls src={urls[i]} />
            ) : (
              <button
                type="button"
                onClick={() =>
                  void a.run(async () => {
                    const url = await signed(
                      "tafe-ielts-recordings",
                      row.response,
                    );
                    if (url) setUrls((prev) => ({ ...prev, [i]: url }));
                  }, "")
                }
              >
                Yozuvni ochish
              </button>
            )
          ) : (
            <p>Yozuv yo‘q</p>
          )}
        </section>
      ))}
      <label>
        Writing band
        <input
          name="w"
          type="number"
          min={0}
          max={9}
          step={0.5}
          defaultValue={r.data.writing ?? ""}
        />
      </label>
      <label>
        Speaking band
        <input
          name="s"
          type="number"
          min={0}
          max={9}
          step={0.5}
          defaultValue={r.data.speaking ?? ""}
        />
      </label>
      <label>
        Sharh
        <textarea
          name="notes"
          maxLength={5000}
          defaultValue={r.data.feedback ?? ""}
        />
      </label>
      <Feedback error={a.error} notice={a.notice} />
      <button className="primary" disabled={a.busy}>
        Natijani saqlash
      </button>
    </form>
  );
}

function ObjectiveRules() {
  const rules = useData(() => rpc("admin_ielts_scoring"), []);
  const action = useAction();
  return (
    <section>
      <h3>Listening va Reading band jadvallari</h3>
      <Feedback
        error={rules.error || action.error}
        notice={action.notice}
        loading={rules.loading}
      />
      {rules.data && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const f = new FormData(event.currentTarget);
            const values = (key: string) =>
              String(f.get(key))
                .trim()
                .split(/[\s,]+/)
                .map(Number);
            void action.run(async () => {
              await rpc("admin_ielts_scoring", {
                l: values("l"),
                r: values("r"),
              });
            });
          }}
        >
          <p>
            1.0 dan 9.0 gacha har yarim band uchun minimal to‘g‘ri javob sonini
            yozing. Yangi jadval keyingi urinishlarga qo‘llanadi.
          </p>
          <label>
            Listening
            <input
              name="l"
              required
              defaultValue={rules.data.listening.join(", ")}
            />
          </label>
          <label>
            Reading
            <input
              name="r"
              required
              defaultValue={rules.data.reading.join(", ")}
            />
          </label>
          <button type="submit" disabled={action.busy}>
            Band jadvallarini saqlash
          </button>
        </form>
      )}
    </section>
  );
}
