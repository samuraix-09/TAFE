import { t } from "./i18n";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Download,
  ImagePlus,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { db } from "./db";
import {
  checked,
  Empty,
  Feedback,
  Modal,
  signed,
  upload,
  useAction,
  useData,
  type Row,
} from "./platform";
export function LibraryPage({ admin = false }: { admin?: boolean }) {
  const books = useData(async () => {
    const rows = checked(
      await db
        .from("library_resources")
        .select("*,exam_categories(name)")
        .order("created_at", { ascending: false }),
    );
    return await Promise.all(
      (rows || []).map(async (b) => ({
        ...b,
        cover: await signed("tafe-covers", b.cover_path),
      })),
    );
  }, [admin]);
  const preference = useData(async () => {
    if (admin) return null;
    const { data } = await db.auth.getUser();
    if (!data.user) return null;
    return (
      checked(
        await db
          .from("profiles")
          .select("target_exam")
          .eq("id", data.user.id)
          .single(),
      )?.target_exam || null
    );
  }, [admin]);
  const cats = useData(
    async () =>
      checked(
        await db
          .from("exam_categories")
          .select("id,name")
          .order("display_order"),
      ),
    [],
  );
  const [search, setSearch] = useState(""),
    [language, setLanguage] = useState(""),
    [subject, setSubject] = useState(""),
    [category, setCategory] = useState(""),
    [edit, setEdit] = useState<Row | null>(null),
    [selected, setSelected] = useState<Row | null>(null),
    [preview, setPreview] = useState("");
  const action = useAction();
  const rows = [...(books.data || [])]
    .sort(
      (a, b) =>
        Number(b.category_id === preference.data) -
        Number(a.category_id === preference.data),
    )
    .filter(
      (b) =>
        (!search ||
          (b.title + " " + b.author)
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (!language || b.language === language) &&
        (!subject || b.subject === subject) &&
        (!category || b.category_id === category),
    );
  async function open(book: Row) {
    if (book.file_path) {
      const url = await signed("tafe-documents", book.file_path);
      if (url) setPreview(url);
    } else if (book.url) {
      const url = new URL(book.url, location.origin);
      if (url.protocol !== "https:")
        throw Error("Kitob havolasi xavfsiz emas.");
      window.open(url.href, "_blank", "noopener,noreferrer");
    } else throw Error("Kitob fayli mavjud emas.");
  }
  return (
    <div>
      <div className="section-toolbar">
        <div>
          <p className="eyebrow">{t("THE LEARNING COLLECTION")}</p>
          <h2>
            {admin
              ? t("Kutubxona boshqaruvi")
              : t("O‘rganish uchun yangi sahifa.")}
          </h2>
          <p className="muted">
            {t(
              "Kitoblar va materiallar joriy tarifingiz ruxsatiga ko‘ra ko‘rsatiladi.",
            )}
          </p>
        </div>
        {admin && (
          <button className="primary" onClick={() => setEdit({})}>
            <Plus size={16} />
            {t("Kitob qo‘shish")}
          </button>
        )}
      </div>
      <Feedback
        error={books.error || action.error}
        notice={action.notice}
        loading={books.loading}
      />
      <div className="filter-bar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label={t("Kitob qidirish")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Kitob yoki muallif…")}
          />
        </label>
        <select
          aria-label={t("Kategoriya")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{t("Barcha yo‘nalishlar")}</option>
          {cats.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t("Til")}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="">{t("Barcha tillar")}</option>
          {[...new Set((books.data || []).map((b) => b.language))].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select
          aria-label={t("Fan")}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="">{t("Barcha fanlar")}</option>
          {[
            ...new Set(
              (books.data || []).map((b) => b.subject).filter(Boolean),
            ),
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="book-grid">
        {rows.map((b) => (
          <section className="book-card" key={b.id}>
            <button
              className="book-cover"
              onClick={() => setSelected(b)}
              aria-label={b.title + t(" tafsilotlari")}
            >
              {b.cover ? (
                <img
                  src={b.cover}
                  alt={b.title + t(" muqovasi")}
                  loading="lazy"
                />
              ) : (
                <span className="no-cover">
                  <BookOpen />
                  <span>{t("Muqova yuklanmagan")}</span>
                </span>
              )}
            </button>
            <div className="book-body">
              <span className="badge">
                {b.exam_categories?.name || b.subject || t("O‘quv materiali")}
              </span>
              <h3>{b.title}</h3>
              {!admin && preference.data === b.category_id && (
                <span className="recommendation-label">
                  {t("Maqsadingizga mos")}
                </span>
              )}
              <p>{b.author || t("Muallif ko‘rsatilmagan")}</p>
              <small>
                {b.language.toUpperCase()} · {t(b.difficulty)}
              </small>
              {admin && (
                <span className="status-label">
                  {b.published ? t("E’lon qilingan") : t("Qoralama")}
                </span>
              )}
              <div className="button-row">
                <button onClick={() => setSelected(b)}>
                  {t("Tafsilotlar")}
                </button>
                {admin ? (
                  <button onClick={() => setEdit(b)}>{t("Tahrirlash")}</button>
                ) : (
                  <button
                    className="primary"
                    disabled={action.busy}
                    onClick={() => void action.run(() => open(b), "")}
                  >
                    <BookOpen size={14} />
                    {t("O‘qish")}
                  </button>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
      {!books.loading && !rows.length && (
        <Empty
          text={t(
            "Hozircha tanlangan filtrlar va tarifingizga mos materiallar yo‘q.",
          )}
        />
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <p className="muted">
            {selected.author} · {selected.language} · {selected.publication}
          </p>
          <p className="passage-text">{selected.description}</p>
          <p>
            {selected.subject} · {t(selected.difficulty)}
          </p>
          <button
            className="primary"
            onClick={() => void action.run(() => open(selected), "")}
          >
            <Download size={16} />
            {t("O‘qish / yuklab olish")}
          </button>
          <Feedback error={action.error} />
        </Modal>
      )}
      {preview && (
        <Modal title={t("Kitobni o‘qish")} onClose={() => setPreview("")} wide>
          <a
            className="download-link"
            href={preview}
            target="_blank"
            rel="noreferrer"
          >
            {t("Alohida oynada ochish / yuklab olish ↗")}
          </a>
          <iframe
            title={t("Kitob hujjati")}
            className="reader-frame"
            src={preview}
          />
        </Modal>
      )}
      {edit && (
        <BookEditor
          book={edit}
          categories={cats.data || []}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            books.reload();
          }}
        />
      )}
    </div>
  );
}
function BookEditor({
  book,
  categories,
  onClose,
  onSaved,
}: {
  book: Row;
  categories: Row[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cover, setCover] = useState<File | null>(null),
    [document, setDocument] = useState<File | null>(null),
    [removeCover, setRemoveCover] = useState(false),
    [image, setImage] = useState<string | null>(book.cover || null);
  const action = useAction();
  useEffect(() => {
    if (!cover) {
      setImage(removeCover ? null : book.cover || null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setImage(url);
    return () => URL.revokeObjectURL(url);
  }, [cover, removeCover]);
  async function save(form: FormData) {
    let filePath = book.file_path || null,
      coverPath = removeCover ? null : book.cover_path || null;
    const created: { bucket: string; path: string }[] = [];
    try {
      if (document) {
        filePath = await upload("tafe-documents", document);
        created.push({ bucket: "tafe-documents", path: filePath });
      }
      if (cover) {
        coverPath = await upload("tafe-covers", cover);
        created.push({ bucket: "tafe-covers", path: coverPath });
      }
      if (!filePath && !book.url) throw Error("PDF yoki hujjat yuklang.");
      const payload = {
        title: String(form.get("title")).trim(),
        author: form.get("author"),
        description: form.get("description"),
        subject: form.get("subject"),
        category_id: form.get("category") || null,
        language: form.get("language"),
        difficulty: form.get("difficulty"),
        publication: form.get("publication"),
        published: form.get("published") === "on",
        access_rank: Number(form.get("rank")),
        file_path: filePath,
        cover_path: coverPath,
      };
      const result = book.id
        ? await db.from("library_resources").update(payload).eq("id", book.id)
        : await db.from("library_resources").insert(payload);
      checked(result);
    } catch (error) {
      for (const f of created) await db.storage.from(f.bucket).remove([f.path]);
      throw error;
    }
    onSaved();
  }
  return (
    <Modal
      title={book.id ? t("Kitobni tahrirlash") : t("Kitob qo‘shish")}
      onClose={onClose}
      wide
    >
      <Feedback {...action} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void action.run(() => save(f));
        }}
      >
        <div className="book-upload-layout">
          <div>
            <div className="cover-preview">
              {image ? (
                <img src={image} alt={t("Muqova ko‘rinishi")} />
              ) : (
                <div>
                  <ImagePlus />
                  <p>{t("Muqova rasmi")}</p>
                </div>
              )}
            </div>
            <label>
              {t("Muqova yuklash (JPG, PNG, WEBP · 3 MB)")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  setCover(e.target.files?.[0] || null);
                  setRemoveCover(false);
                }}
              />
            </label>
            <button
              type="button"
              className="danger"
              onClick={() => {
                setCover(null);
                setRemoveCover(true);
              }}
            >
              <Trash2 size={14} />
              {t("Muqovani olib tashlash")}
            </button>
          </div>
          <div className="form-grid">
            <label>
              {t("Kitob nomi")}
              <input
                name="title"
                maxLength={200}
                required
                defaultValue={book.title}
              />
            </label>
            <label>
              {t("Muallif")}
              <input name="author" defaultValue={book.author} />
            </label>
            <label>
              {t("Fan")}
              <input name="subject" defaultValue={book.subject} />
            </label>
            <label>
              {t("Kategoriya")}
              <select name="category" defaultValue={book.category_id || ""}>
                <option value="">{t("Umumiy")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Til")}
              <select name="language" defaultValue={book.language || "uz"}>
                <option value="uz">O‘zbekcha</option>
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </select>
            </label>
            <label>
              {t("Daraja")}
              <select
                name="difficulty"
                defaultValue={book.difficulty || "intermediate"}
              >
                <option value="beginner">{t("Boshlang‘ich")}</option>
                <option value="intermediate">{t("O‘rta")}</option>
                <option value="advanced">{t("Yuqori")}</option>
              </select>
            </label>
            <label>
              {t("Nashr ma’lumoti")}
              <input name="publication" defaultValue={book.publication} />
            </label>
            <label>
              {t("Minimal kirish darajasi")}
              <input
                name="rank"
                type="number"
                min={0}
                max={100}
                defaultValue={book.access_rank || 0}
              />
            </label>
          </div>
        </div>
        <label>
          {t("Tavsif")}
          <textarea name="description" defaultValue={book.description} />
        </label>
        <label>
          PDF / DOC / DOCX (25 MB)
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setDocument(e.target.files?.[0] || null)}
          />
        </label>
        {book.file_path && (
          <small>
            {t(
              "Mavjud hujjat saqlanadi. Almashtirish uchun yangi fayl tanlang.",
            )}
          </small>
        )}
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="published"
            defaultChecked={book.published ?? false}
          />
          {t("E’lon qilish")}
        </label>
        <button disabled={action.busy} className="primary">
          {t("Kitobni saqlash")}
        </button>
      </form>
    </Modal>
  );
}
