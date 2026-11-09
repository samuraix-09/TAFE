import { Brand } from "./Landing";
import { t, LanguagePicker, localeTag, type Locale } from "./i18n";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChartNoAxesCombined,
  FileQuestion,
  LayoutDashboard,
  Library,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  ScrollText,
  Layers,
  LogOut,
  X,
} from "lucide-react";
import { db } from "./db";
import { signOutWithMotion } from "./motion";
import {
  checked,
  Empty,
  Feedback,
  Modal,
  rpc,
  useAction,
  useData,
  type Row,
} from "./platform";
import { LibraryPage } from "./LibraryPage";
import { TestBuilder } from "./TestBuilder";
const links = [
  ["overview", "Overview", LayoutDashboard],
  ["users", "User Management", Users],
  ["categories", "Exam Categories", Layers],
  ["tests", "Test Management", BookOpen],
  ["questions", "Question Management", FileQuestion],
  ["library", "Library Management", Library],
  ["ai", "TAFE AI Management", Sparkles],
  ["plans", "Subscription Management", ShieldCheck],
  ["payments", "Payment Management", Wallet],
  ["analytics", "Analytics", ChartNoAxesCombined],
  ["settings", "Platform Settings", Settings],
  ["audit", "Audit Logs", ScrollText],
] as const;
export function AdminApp({
  onLanguageChange,
}: {
  onLanguageChange: (language: Locale) => void;
}) {
  const route = () => location.hash.split("/")[2] || "overview";
  const [page, setPage] = useState(route),
    [open, setOpen] = useState(false);
  useEffect(() => {
    const f = () => {
      setPage(route());
      setOpen(false);
    };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const access = useData(() => rpc("is_admin"), []);
  if (access.loading)
    return (
      <main className="loading-state">
        <span className="spinner" />
        {t("Admin huquqi tekshirilmoqda…")}
      </main>
    );
  if (access.error || !access.data)
    return (
      <main className="info-page">
        <h1>{t("Kirish cheklangan")}</h1>
        <p>{t("Bu bo‘lim faqat vakolatli administratorlar uchun.")}</p>
        <a href="#/home">{t("Platformaga qaytish")}</a>
      </main>
    );
  return (
    <div className="admin-shell">
      <aside className={open ? "admin-sidebar open" : "admin-sidebar"}>
        <a className="admin-brand" href="#/admin/overview">
          <Brand caption={t("ADMINISTRATION")} />
        </a>
        <button
          className="admin-close"
          onClick={() => setOpen(false)}
          aria-label={t("Menyuni yopish")}
        >
          <X />
        </button>
        <span className="admin-caption">{t("PLATFORM CONTROL")}</span>
        <nav>
          {links.map(([key, label, Icon]) => (
            <a
              href={"#/admin/" + key}
              key={key}
              className={page === key ? "active" : ""}
              aria-current={page === key ? "page" : undefined}
            >
              <Icon size={17} />
              {t(label)}
            </a>
          ))}
        </nav>
        <a className="student-return" href="#/home">
          <ArrowLeft size={16} />
          {t("Talaba platformasi")}
        </a>
      </aside>
      <div className="admin-workspace">
        <header className="admin-header">
          <button
            className="admin-menu"
            aria-expanded={open}
            aria-label={t("Admin menyusini ochish")}
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <span>
            TAFE Admin /{" "}
            <strong>
              {t(links.find((l) => l[0] === page)?.[1] || "Overview")}
            </strong>
          </span>
          <div>
            <LanguagePicker onChange={onLanguageChange} />
            <span className="secure-badge">
              <ShieldCheck size={14} />
              {t("Authorized administrator")}
            </span>
            <button
              onClick={() => signOutWithMotion()}
              aria-label={t("Chiqish")}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="admin-main motion-view" key={page}>
          {page === "users" ? (
            <UserManagement />
          ) : page === "categories" ? (
            <Categories />
          ) : page === "tests" || page === "questions" ? (
            <TestsManager />
          ) : page === "library" ? (
            <LibraryPage admin />
          ) : page === "plans" ? (
            <PlansManager />
          ) : page === "payments" ? (
            <Payments />
          ) : page === "settings" ? (
            <SettingsPage />
          ) : page === "audit" ? (
            <Audit />
          ) : page === "ai" ? (
            <AIManagement />
          ) : (
            <Overview analytics={page === "analytics"} />
          )}
        </main>
      </div>
    </div>
  );
}
function Overview({ analytics = false }: { analytics?: boolean }) {
  const metrics = useData(() => rpc("admin_overview"), []);
  const audit = useData(
    async () =>
      checked(
        await db
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(8),
      ),
    [],
  );
  return (
    <>
      <p className="eyebrow">{t("TAFE CONTROL CENTER")}</p>
      <h1>
        {analytics ? t("Platforma tahlili") : t("Platforma umumiy ko‘rinishi")}
      </h1>
      <p className="muted">
        {t("Haqiqiy foydalanuvchilar, natijalar va platforma faoliyati.")}
      </p>
      <Feedback error={metrics.error} loading={metrics.loading} />
      <div className="admin-stats">
        {[
          ["users", "Foydalanuvchilar"],
          ["subscribers", "Faol obunachilar"],
          ["tests", "E’lon qilingan testlar"],
          ["attempts", "Test urinishlari"],
          ["ai", "AI so‘rovlari"],
          ["revenue", "Tasdiqlangan tushum (UZS)"],
          ["ai_errors", "AI xatolari"],
        ].map(([key, label]) => (
          <section key={key}>
            <span>{t(label)}</span>
            <strong>{metrics.data?.[key] ?? "—"}</strong>
          </section>
        ))}
      </div>
      <section>
        <h2>{t("So‘nggi boshqaruv amallari")}</h2>
        <Feedback error={audit.error} />
        {audit.data?.length ? (
          <DataTable
            rows={audit.data}
            columns={["action", "entity", "created_at"]}
          />
        ) : (
          <Empty text={t("Hozircha audit yozuvlari yo‘q.")} />
        )}
      </section>
    </>
  );
}
export function DataTable({
  rows,
  columns,
}: {
  rows: Row[];
  columns: string[];
}) {
  function displayCell(column: string, value: unknown) {
    if (value == null) return "—";
    if (typeof value === "boolean") return t(value ? "Ha" : "Yo‘q");
    if (typeof value === "number")
      return new Intl.NumberFormat(localeTag()).format(value);
    if (typeof value === "object") return JSON.stringify(value);
    if (typeof value !== "string") return String(value);
    if (column.endsWith("_at") && Number.isFinite(Date.parse(value)))
      return new Date(value).toLocaleString(localeTag());
    return ["status", "mode", "action", "entity", "error"].includes(column)
      ? t(value)
      : value;
  }
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{t(c.replaceAll("_", " "))}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i}>
              {columns.map((c) => (
                <td key={c}>{displayCell(c, r[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function UserManagement() {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(0),
    [sort, setSort] = useState("registered_desc"),
    [selected, setSelected] = useState<Row | null>(null);
  const users = useData(
    () =>
      rpc("admin_users", {
        search_text: query,
        page_number: page,
        page_size: 20,
        status_filter: status,
        sort_key: sort,
      }),
    [query, page, status, sort],
  );
  return (
    <>
      <p className="eyebrow">{t("PEOPLE & ACCESS")}</p>
      <h1>{t("Foydalanuvchilar")}</h1>
      <div className="filter-bar">
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
            setPage(0);
          }}
        >
          <input
            aria-label={t("Ism yoki email")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Ism yoki email bo‘yicha qidirish")}
          />
          <button className="primary">
            <Search size={17} />
            {t("Qidirish")}
          </button>
        </form>
        <select
          aria-label={t("Holat filtri")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">{t("Barcha holatlar")}</option>
          <option value="active">{t("Faol")}</option>
          <option value="suspended">{t("Bloklangan")}</option>
          <option value="deleted">{t("O‘chirilgan")}</option>
        </select>
      </div>
      <select
        aria-label={t("Saralash")}
        value={sort}
        onChange={(e) => {
          setSort(e.target.value);
          setPage(0);
        }}
      >
        <option value="registered_desc">{t("Yangi foydalanuvchilar")}</option>
        <option value="registered_asc">
          {t("Avval ro‘yxatdan o‘tganlar")}
        </option>
        <option value="name_asc">{t("Ism A–Z")}</option>
        <option value="name_desc">{t("Ism Z–A")}</option>
        <option value="activity_desc">{t("So‘nggi faollik")}</option>
      </select>
      <Feedback error={users.error} loading={users.loading} />
      <section className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Foydalanuvchi",
                  "Holat",
                  "Tarif",
                  "Obuna muddati",
                  "Tasdiqlash",
                  "Ro‘yxat sanasi",
                  "So‘nggi kirish",
                  "Testlar",
                  "",
                ].map((x, i) => (
                  <th key={i}>{t(x)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.data?.users.map((u: Row) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.display_name || t("Ism kiritilmagan")}</strong>
                    <small>{u.email}</small>
                  </td>
                  <td>
                    <span className={"status-label " + u.status}>
                      {t(u.status)}
                    </span>
                    {u.deletion_requested_at && (
                      <small>{t("O‘chirish so‘rovi bor")}</small>
                    )}
                  </td>
                  <td>{u.plan}</td>
                  <td>
                    {u.expires_at
                      ? new Date(u.expires_at).toLocaleDateString(localeTag())
                      : t("Asosiy tarif")}
                  </td>
                  <td>
                    {u.email_confirmed_at ? t("Tasdiqlangan") : t("Kutilmoqda")}
                  </td>
                  <td>
                    {new Date(u.created_at).toLocaleDateString(localeTag())}
                  </td>
                  <td>
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleString(localeTag())
                      : "—"}
                  </td>
                  <td>{u.attempts}</td>
                  <td>
                    <button onClick={() => setSelected(u)}>
                      {t("Boshqarish ↗")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.data && !users.data.users.length && (
          <Empty text={t("Foydalanuvchi topilmadi.")} />
        )}
        <div className="pagination">
          <span>
            {t("Jami ")}
            {users.data?.total || 0}
            {t(" ta")}
          </span>
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>
            {t("Oldingi")}
          </button>
          <span>{page + 1}</span>
          <button
            disabled={(page + 1) * 20 >= (users.data?.total || 0)}
            onClick={() => setPage(page + 1)}
          >
            {t("Keyingi")}
          </button>
        </div>
      </section>
      {selected && (
        <UserDetail
          user={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            users.reload();
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
function UserDetail({
  user,
  onClose,
  onChanged,
}: {
  user: Row;
  onClose: () => void;
  onChanged: () => void;
}) {
  const detail = useData(
    () => rpc("admin_user_detail", { target: user.id }),
    [user.id],
  );
  const plans = useData(
    async () =>
      checked(
        await db
          .from("plans")
          .select("*")
          .eq("active", true)
          .order("display_order"),
      ),
    [],
  );
  const action = useAction();
  async function account(operation: string, new_name?: string) {
    if (
      operation === "delete" &&
      prompt(
        t(
          "Bu hisobni qaytarish mumkin bo‘lgan o‘chirishga o‘tkazish uchun DELETE yozing",
        ),
      ) !== "DELETE"
    )
      return;
    if (
      operation === "suspend" &&
      !confirm(t("Foydalanuvchi kirishini bloklaysizmi?"))
    )
      return;
    await rpc("admin_account_action", {
      target: user.id,
      operation,
      new_name: new_name || null,
    });
    onChanged();
  }
  return (
    <Modal title={user.display_name || user.email} onClose={onClose} wide>
      <p>{user.email}</p>
      <Feedback
        error={detail.error || action.error}
        notice={action.notice}
        loading={detail.loading}
      />
      <div className="detail-grid">
        <section>
          <h3>{t("Hisob ma’lumotlari")}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name"));
              void action.run(() => account("rename", name));
            }}
          >
            <label>
              {t("To‘liq ism")}
              <input
                name="name"
                defaultValue={user.display_name}
                required
                maxLength={120}
              />
            </label>
            <button disabled={action.busy}>{t("Ismni saqlash")}</button>
          </form>
          <p>
            {t("Holat — ")}
            {t(detail.data?.profile.status || user.status)}
          </p>
          <div className="button-row">
            <button
              disabled={action.busy}
              onClick={() =>
                void action.run(() =>
                  account(user.status === "active" ? "suspend" : "reactivate"),
                )
              }
            >
              {user.status === "active"
                ? t("Bloklash")
                : t("Qayta faollashtirish")}
            </button>
            <button
              className="danger"
              disabled={action.busy}
              onClick={() => void action.run(() => account("delete"))}
            >
              {t("Hisobni yumshoq o‘chirish")}
            </button>
          </div>
          <p className="muted">
            {t(
              "Yumshoq o‘chirilgan hisob saqlanadi va qayta faollashtirilishi mumkin. Barcha amallar auditga yoziladi.",
            )}
          </p>
        </section>
        <section>
          <h3>{t("Obuna tayinlash / uzaytirish")}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action.run(async () => {
                const days = Number(f.get("days")),
                  now = new Date();
                const active = detail.data?.subscriptions.find(
                  (s: Row) =>
                    s.status === "active" &&
                    Date.parse(s.expires_at) > Date.now() &&
                    s.plan_id === f.get("plan"),
                );
                const base = active
                  ? Math.max(Date.parse(active.expires_at), Date.now())
                  : Date.now();
                if (active) {
                  checked(
                    await db
                      .from("subscriptions")
                      .update({
                        expires_at: new Date(
                          base + days * 86400000,
                        ).toISOString(),
                      })
                      .eq("id", active.id),
                  );
                } else {
                  const me = await db.auth.getUser();
                  checked(
                    await db.from("subscriptions").insert({
                      user_id: user.id,
                      plan_id: f.get("plan"),
                      starts_at: now.toISOString(),
                      expires_at: new Date(
                        base + days * 86400000,
                      ).toISOString(),
                      granted_by: me.data.user?.id,
                    }),
                  );
                }
                detail.reload();
              });
            }}
          >
            <label>
              {t("Tarif")}
              <select name="plan" required>
                {plans.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Kunlar soni")}
              <input
                name="days"
                type="number"
                min={1}
                max={3650}
                defaultValue={30}
                required
              />
            </label>
            <button className="primary" disabled={action.busy}>
              {t("Tayinlash / uzaytirish")}
            </button>
          </form>
        </section>
      </div>
      {detail.data && (
        <>
          <h3>{t("Obuna tarixi")}</h3>
          <DataTable
            rows={detail.data.subscriptions}
            columns={["plan_id", "starts_at", "expires_at", "status"]}
          />
          {detail.data.subscriptions
            .filter((s: Row) => s.status === "active")
            .map((s: Row) => (
              <button
                key={s.id}
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    checked(
                      await db
                        .from("subscriptions")
                        .update({ status: "cancelled" })
                        .eq("id", s.id),
                    );
                    detail.reload();
                  })
                }
              >
                {t("Obunani bekor qilish · ")}
                {s.id.slice(0, 8)}
              </button>
            ))}
          <h3>{t("Test tarixi")}</h3>
          <DataTable
            rows={detail.data.attempts}
            columns={[
              "test_id",
              "score",
              "total",
              "started_at",
              "submitted_at",
            ]}
          />
          <h3>{t("Joriy oydagi foydalanish")}</h3>
          <DataTable
            rows={detail.data.usage}
            columns={["feature", "requests", "tokens"]}
          />
          <h3>{t("To‘lovlar tarixi")}</h3>
          <DataTable
            rows={detail.data.payments}
            columns={["amount", "currency", "status", "provider", "created_at"]}
          />
        </>
      )}
    </Modal>
  );
}
function Categories() {
  const rows = useData(
    async () =>
      checked(
        await db.from("exam_categories").select("*").order("display_order"),
      ),
    [],
  );
  const [edit, setEdit] = useState<Row | null>(null);
  const a = useAction();
  return (
    <>
      <div className="section-toolbar">
        <h1>{t("Imtihon kategoriyalari")}</h1>
        <button className="primary" onClick={() => setEdit({})}>
          <Plus size={16} />
          {t("Qo‘shish")}
        </button>
      </div>
      <Feedback error={rows.error} loading={rows.loading} />
      <div className="management-grid">
        {rows.data?.map((c) => (
          <section key={c.id}>
            <span className="status-label">
              {c.active ? t("Faol") : t("Arxiv")}
            </span>
            <h2>{c.name}</h2>
            <p>{c.description}</p>
            <button onClick={() => setEdit(c)}>{t("Tahrirlash")}</button>
          </section>
        ))}
      </div>
      {edit && (
        <Modal title={t("Kategoriya")} onClose={() => setEdit(null)}>
          <Feedback {...a} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void a.run(async () => {
                const payload = {
                  name: f.get("name"),
                  slug: f.get("slug"),
                  description: f.get("description"),
                  display_order: Number(f.get("order")),
                  active: f.get("active") === "on",
                };
                checked(
                  edit.id
                    ? await db
                        .from("exam_categories")
                        .update(payload)
                        .eq("id", edit.id)
                    : await db.from("exam_categories").insert(payload),
                );
                rows.reload();
                setEdit(null);
              });
            }}
          >
            <label>
              {t("Nomi")}
              <input name="name" required defaultValue={edit.name} />
            </label>
            <label>
              {t("Slug")}
              <input
                name="slug"
                pattern="[a-z0-9-]+"
                required
                defaultValue={edit.slug}
              />
            </label>
            <label>
              {t("Tavsif")}
              <textarea name="description" defaultValue={edit.description} />
            </label>
            <label>
              {t("Tartib")}
              <input
                name="order"
                type="number"
                defaultValue={edit.display_order || 0}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="active"
                defaultChecked={edit.active ?? true}
              />
              {t("Faol")}
            </label>
            <button className="primary" disabled={a.busy}>
              {t("Saqlash")}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function TestsManager() {
  const tests = useData(
    async () =>
      checked(
        await db
          .from("tests")
          .select("*,exam_categories(name)")
          .order("created_at", { ascending: false }),
      ),
    [],
  );
  const [edit, setEdit] = useState<string | null>(null);
  const a = useAction();
  if (edit !== null)
    return (
      <TestBuilder
        id={edit || undefined}
        onCancel={() => setEdit(null)}
        onSaved={() => {
          setEdit(null);
          tests.reload();
        }}
      />
    );
  return (
    <>
      <div className="section-toolbar">
        <div>
          <p className="eyebrow">{t("EXAM AUTHORING")}</p>
          <h1>{t("Test va savollar")}</h1>
        </div>
        <button className="primary" onClick={() => setEdit("")}>
          <Plus size={16} />
          {t("Vizual test yaratish")}
        </button>
      </div>
      <Feedback error={tests.error || a.error} loading={tests.loading} />
      <div className="management-grid">
        {tests.data?.map((test) => (
          <section key={test.id}>
            <span className="badge">{test.exam_categories?.name}</span>
            <h2>{test.title}</h2>
            <p>
              {test.section} · {test.duration}
              {t(" daqiqa ·")}{" "}
              {test.published ? t("E’lon qilingan") : t("Qoralama")}
            </p>
            <div className="button-row">
              <button onClick={() => setEdit(test.id)}>
                {t("Savollarni tahrirlash")}
              </button>
              {test.published && (
                <button
                  disabled={a.busy}
                  onClick={() =>
                    void a.run(async () => {
                      const updated = checked(
                        await db
                          .from("tests")
                          .update({ published: false })
                          .eq("id", test.id)
                          .eq("version", test.version)
                          .select("id")
                          .maybeSingle(),
                      );
                      tests.reload();
                      if (!updated)
                        throw Error(
                          "Another administrator changed this test. Reload it.",
                        );
                    })
                  }
                >
                  {t("Qoralamaga olish")}
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
      {!tests.loading && !tests.data?.length && (
        <Empty text={t("Birinchi testni vizual muharrirda yarating.")} />
      )}
    </>
  );
}
function PlansManager() {
  const plans = useData(
    async () =>
      checked(await db.from("plans").select("*").order("display_order")),
    [],
  );
  const [edit, setEdit] = useState<Row | null>(null);
  const a = useAction();
  return (
    <>
      <div className="section-toolbar">
        <div>
          <p className="eyebrow">{t("ENTITLEMENTS & LIMITS")}</p>
          <h1>{t("Tariflar va ruxsatlar")}</h1>
        </div>
        <button className="primary" onClick={() => setEdit({})}>
          <Plus size={16} />
          {t("Tarif qo‘shish")}
        </button>
      </div>
      <Feedback error={plans.error} loading={plans.loading} />
      <div className="management-grid">
        {plans.data?.map((p) => (
          <section key={p.id}>
            <span className="status-label">
              {p.is_default
                ? t("Asosiy tarif")
                : p.active
                  ? t("Faol")
                  : t("Faol emas")}
            </span>
            <h2>{p.name}</h2>
            <p>{p.description}</p>
            <p>
              AI — {p.ai_daily}
              {t("/kun · ")}
              {p.ai_monthly}
              {t("/oy")}
            </p>
            <p>
              Test — {p.tests_daily}
              {t("/kun · ")}
              {p.tests_monthly}
              {t("/oy")}
            </p>
            <p>
              {t("Kutubxona darajasi — ")}
              {p.library_rank}
            </p>
            <button onClick={() => setEdit(p)}>
              {t("Tarifni boshqarish")}
            </button>
          </section>
        ))}
      </div>
      {edit && (
        <Modal
          title={t("Tarif sozlamalari")}
          onClose={() => setEdit(null)}
          wide
        >
          <Feedback {...a} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void a.run(async () => {
                const payload: Row = {
                  name: f.get("name"),
                  description: f.get("description"),
                  currency: f.get("currency"),
                  active: f.get("active") === "on",
                  monthly_price:
                    f.get("monthly") === "" ? null : Number(f.get("monthly")),
                  annual_price:
                    f.get("annual") === "" ? null : Number(f.get("annual")),
                  features: String(f.get("features"))
                    .split("\n")
                    .filter(Boolean),
                  permissions: Object.fromEntries(
                    [
                      "ask",
                      "explain",
                      "practice",
                      "plan",
                      "analysis",
                      "full_mock",
                    ].map((k) => [k, f.get(k) === "on"]),
                  ),
                };
                for (const key of [
                  "ai_daily",
                  "ai_monthly",
                  "tests_daily",
                  "tests_monthly",
                  "library_rank",
                  "display_order",
                ])
                  payload[key] = Number(f.get(key));
                if (edit.is_default && !payload.active)
                  throw Error("Asosiy tarifni o‘chirib bo‘lmaydi.");
                checked(
                  edit.id
                    ? await db.from("plans").update(payload).eq("id", edit.id)
                    : await db.from("plans").insert(payload),
                );
                plans.reload();
                setEdit(null);
              });
            }}
          >
            <div className="form-grid">
              <label>
                {t("Tarif nomi")}
                <input name="name" required defaultValue={edit.name} />
              </label>
              <label>
                {t("Valyuta")}
                <input
                  name="currency"
                  defaultValue={edit.currency || "UZS"}
                  required
                  pattern="[A-Z]{3}"
                />
              </label>
              <label>
                {t("Oylik narx")}
                <input
                  name="monthly"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={edit.monthly_price ?? ""}
                />
              </label>
              <label>
                {t("Yillik narx")}
                <input
                  name="annual"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={edit.annual_price ?? ""}
                />
              </label>
              {[
                ["ai_daily", "Kunlik AI"],
                ["ai_monthly", "Oylik AI"],
                ["tests_daily", "Kunlik test"],
                ["tests_monthly", "Oylik test"],
                ["library_rank", "Kutubxona darajasi"],
                ["display_order", "Tartib"],
              ].map(([key, label]) => (
                <label key={key}>
                  {t(label)}
                  <input
                    type="number"
                    name={key}
                    min={0}
                    max={key === "library_rank" ? 100 : 100000}
                    defaultValue={edit[key] || 0}
                    required
                  />
                </label>
              ))}
            </div>
            <label>
              {t("Tavsif")}
              <textarea name="description" defaultValue={edit.description} />
            </label>
            <label>
              {t("Imkoniyatlar (har biri yangi qatorda)")}
              <textarea
                name="features"
                defaultValue={(edit.features || []).join("\n")}
              />
            </label>
            <div className="permission-grid">
              {[
                ["ask", "Savol berish"],
                ["explain", "Xatolarni tushuntirish"],
                ["practice", "Mashq yaratish"],
                ["plan", "O‘quv reja"],
                ["analysis", "Tahlil"],
                ["full_mock", "Full mock testlar"],
              ].map(([key, label]) => (
                <label className="checkbox-label" key={key}>
                  <input
                    type="checkbox"
                    name={key}
                    defaultChecked={edit.permissions?.[key] ?? false}
                  />
                  {t(label)}
                </label>
              ))}
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="active"
                defaultChecked={edit.active ?? false}
              />
              {t("Faol")}
            </label>
            <button disabled={a.busy} className="primary">
              {t("Saqlash")}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function SettingsPage() {
  const settings = useData(
    async () =>
      checked(await db.from("platform_settings").select("*").single()),
    [],
  );
  const a = useAction();
  return (
    <>
      <h1>{t("Platforma sozlamalari")}</h1>
      <Feedback
        error={settings.error || a.error}
        notice={a.notice}
        loading={settings.loading}
      />
      {settings.data && (
        <section>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void a.run(async () => {
                checked(
                  await db
                    .from("platform_settings")
                    .update({
                      platform_name: f.get("name"),
                      contact_email: f.get("email") || null,
                      ai_model: f.get("model"),
                      ai_enabled: f.get("enabled") === "on",
                      ai_prompt: f.get("prompt"),
                    })
                    .eq("id", true),
                );
                settings.reload();
              });
            }}
          >
            <label>
              {t("Platforma nomi")}
              <input
                name="name"
                required
                defaultValue={settings.data.platform_name}
              />
            </label>
            <label>
              {t("Aloqa emaili")}
              <input
                name="email"
                type="email"
                defaultValue={settings.data.contact_email || ""}
              />
            </label>
            <label>
              {t("Gemini modeli")}
              <input
                name="model"
                required
                pattern="[a-zA-Z0-9._-]+"
                defaultValue={settings.data.ai_model}
              />
            </label>
            <label>
              {t("TAFE AI ko‘rsatmasi")}
              <textarea
                name="prompt"
                defaultValue={settings.data.ai_prompt}
                required
              />
            </label>
            <label className="checkbox-label">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={settings.data.ai_enabled}
              />
              {t("TAFE AI faol")}
            </label>
            <p className="muted">
              {t("API sirlari server muhitida saqlanadi.")}
            </p>
            <button disabled={a.busy} className="primary">
              {t("Saqlash")}
            </button>
          </form>
        </section>
      )}
    </>
  );
}
function Payments() {
  const data = useData(
    async () =>
      checked(
        await db
          .from("payments")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
      ),
    [],
  );
  return (
    <>
      <h1>{t("To‘lovlar")}</h1>
      <p className="muted">
        {t(
          "Jonli to‘lov provayderi hali ulanmagan. To‘lov faqat provayder tasdig‘idan keyin tasdiqlangan deb yozilishi kerak.",
        )}
      </p>
      <Feedback error={data.error} loading={data.loading} />
      <section>
        {data.data?.length ? (
          <DataTable
            rows={data.data}
            columns={[
              "user_id",
              "amount",
              "currency",
              "status",
              "provider",
              "created_at",
            ]}
          />
        ) : (
          <Empty text={t("To‘lovlar mavjud emas.")} />
        )}
      </section>
    </>
  );
}
function Audit() {
  const [page, setPage] = useState(0);
  const data = useData(
    async () =>
      checked(
        await db
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .range(page * 30, page * 30 + 29),
      ),
    [page],
  );
  return (
    <>
      <h1>{t("Audit jurnali")}</h1>
      <Feedback error={data.error} loading={data.loading} />
      <section>
        <DataTable
          rows={data.data || []}
          columns={["action", "entity", "entity_id", "actor_id", "created_at"]}
        />
        <div className="pagination">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            {t("Oldingi")}
          </button>
          <span>{page + 1}</span>
          <button
            disabled={(data.data?.length || 0) < 30}
            onClick={() => setPage(page + 1)}
          >
            {t("Keyingi")}
          </button>
        </div>
      </section>
    </>
  );
}
function AIManagement() {
  const usage = useData(
    async () =>
      checked(
        await db
          .from("usage_events")
          .select("*")
          .eq("feature", "ai")
          .order("created_at", { ascending: false })
          .limit(100),
      ),
    [],
  );
  return (
    <>
      <h1>{t("TAFE AI boshqaruvi")}</h1>
      <div className="button-row">
        <a className="button-link primary" href="#/admin/plans">
          {t("Tariflar bo‘yicha limitlar")}
        </a>
        <a className="button-link" href="#/admin/settings">
          {t("Model va ko‘rsatmalar")}
        </a>
      </div>
      <Feedback error={usage.error} loading={usage.loading} />
      <section>
        <DataTable
          rows={usage.data || []}
          columns={["user_id", "mode", "tokens", "error", "created_at"]}
        />
        {!usage.data?.length && (
          <Empty text={t("AI foydalanish yozuvlari hali yo‘q.")} />
        )}
      </section>
    </>
  );
}
