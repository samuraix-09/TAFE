import { t, localeTag, getLocale, isLocale, setLocale } from "./i18n";
import { useEffect, useState } from "react";
import {
  Bell,
  Camera,
  CreditCard,
  Download,
  Eye,
  Lock,
  Palette,
  ShieldCheck,
  User,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { db, authErrorMessage } from "./db";
import { signOutWithMotion } from "./motion";
import {
  checked,
  Empty,
  Feedback,
  rpc,
  signed,
  upload,
  useAction,
  useData,
  type Row,
} from "./platform";
const tabs = [
  ["personal", "Shaxsiy ma’lumotlar", User],
  ["account", "Hisob va xavfsizlik", Lock],
  ["appearance", "Ko‘rinish", Palette],
  ["notifications", "Bildirishnomalar", Bell],
  ["billing", "Obuna va to‘lovlar", CreditCard],
  ["privacy", "Maxfiylik", Eye],
] as const;
export function ProfilePage({
  session,
  profile,
  categories,
  onSaved,
  onTheme,
  admin,
}: {
  session: Session;
  profile: Row;
  categories: Row[];
  onSaved: () => Promise<void>;
  onTheme: (dark: boolean) => void;
  admin: boolean;
}) {
  const [tab, setTab] = useState("personal"),
    [photo, setPhoto] = useState<string | null>(null);
  const a = useAction();
  useEffect(() => {
    void signed("tafe-avatars", profile.avatar_path)
      .then(setPhoto)
      .catch(() => setPhoto(null));
  }, [profile.avatar_path]);
  const billing = useData(() => rpc("my_entitlements"), [tab]);
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
  const payments = useData(
    async () =>
      checked(
        await db
          .from("payments")
          .select("*")
          .order("created_at", { ascending: false }),
      ),
    [tab],
  );
  async function update(values: Row) {
    checked(await db.from("profiles").update(values).eq("id", session.user.id));
    if (isLocale(values.language)) setLocale(values.language);
    await onSaved();
  }
  return (
    <div className="profile-layout">
      <div className="profile-navigation">
        <section className="profile-summary">
          <div className="profile-photo">
            {photo ? (
              <img src={photo} alt={t("Profil rasmi")} />
            ) : (
              <User size={38} />
            )}
          </div>
          <h2>{profile.display_name || t("TAFE o‘quvchisi")}</h2>
          <p>{session.user.email}</p>
          <span className="badge">
            <ShieldCheck size={12} />{" "}
            {billing.data?.plan?.name || t("Hisobingiz")}
          </span>
        </section>
        <nav>
          {tabs.map(([key, label, Icon]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key);
                a.clear();
              }}
            >
              <Icon size={17} />
              {t(label)}
            </button>
          ))}
        </nav>
        {admin && (
          <a className="admin-access-link" href="#/admin/overview">
            <ShieldCheck size={16} />
            {t("TAFE Admin’ni ochish ↗")}
          </a>
        )}
      </div>
      <section className="profile-content">
        <Feedback {...a} />
        {tab === "personal" && (
          <>
            <p className="eyebrow">{t("YOUR PERSONAL DETAILS")}</p>
            <h2>{t("Shaxsiy ma’lumotlar")}</h2>
            <label className="photo-upload">
              <Camera size={18} />
              {t("Profil rasmini yuklash (2 MB)")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void a.run(async () => {
                      const path = await upload(
                        "tafe-avatars",
                        file,
                        session.user.id,
                      );
                      try {
                        await update({ avatar_path: path });
                      } catch (error) {
                        await db.storage.from("tafe-avatars").remove([path]);
                        throw error;
                      }
                    });
                }}
              />
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void a.run(() =>
                  update({
                    display_name: f.get("name"),
                    phone: f.get("phone"),
                    language: f.get("language"),
                    target_exam: f.get("exam") || null,
                    preparation_level: f.get("level"),
                    target_score: f.get("score"),
                    exam_date: f.get("date") || null,
                  }),
                );
              }}
            >
              <div className="form-grid">
                <label>
                  {t("To‘liq ism")}
                  <input
                    name="name"
                    required
                    maxLength={120}
                    defaultValue={profile.display_name}
                  />
                </label>
                <label>
                  {t("Email")}
                  <input readOnly value={session.user.email || ""} />
                </label>
                <label>
                  {t("Telefon")}
                  <input
                    type="tel"
                    name="phone"
                    maxLength={30}
                    defaultValue={profile.phone || ""}
                  />
                </label>
                <label>
                  {t("Afzal til")}
                  <select
                    key={getLocale()}
                    name="language"
                    defaultValue={getLocale()}
                  >
                    <option value="uz">O‘zbekcha</option>
                    <option value="en">English</option>
                    <option value="ru">Русский</option>
                  </select>
                </label>
                <label>
                  {t("Maqsadli imtihon")}
                  <select name="exam" defaultValue={profile.target_exam || ""}>
                    <option value="">{t("Tanlang")}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Hozirgi daraja")}
                  <select
                    name="level"
                    defaultValue={profile.preparation_level || "beginner"}
                  >
                    <option value="beginner">{t("Boshlang‘ich")}</option>
                    <option value="intermediate">{t("O‘rta")}</option>
                    <option value="advanced">{t("Yuqori")}</option>
                  </select>
                </label>
                <label>
                  {t("Maqsadli ball")}
                  <input
                    name="score"
                    maxLength={40}
                    defaultValue={profile.target_score}
                  />
                </label>
                <label>
                  {t("Imtihon sanasi")}
                  <input
                    type="date"
                    name="date"
                    defaultValue={profile.exam_date || ""}
                  />
                </label>
              </div>
              <button className="primary" disabled={a.busy}>
                {t("O‘zgarishlarni saqlash")}
              </button>
            </form>
          </>
        )}
        {tab === "account" && (
          <>
            <p className="eyebrow">{t("ACCOUNT SECURITY")}</p>
            <h2>{t("Parol va hisob sozlamalari")}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  f = new FormData(form);
                void a.run(async () => {
                  if (f.get("password") !== f.get("confirm"))
                    throw Error("Parollar mos emas.");
                  const { error } = await db.auth.updateUser({
                    password: String(f.get("password")),
                  });
                  if (error) throw Error(authErrorMessage(error));
                  form.reset();
                });
              }}
            >
              <label>
                {t("Yangi parol")}
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
              </label>
              <label>
                {t("Parolni tasdiqlash")}
                <input
                  type="password"
                  name="confirm"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              <button disabled={a.busy} className="primary">
                {t("Parolni yangilash")}
              </button>
            </form>
            <hr />
            <h3>{t("Email manzilni o‘zgartirish")}</h3>
            <p className="muted">
              {t("Bu amal Supabase Auth xavfsizlik tasdig‘ini talab qiladi.")}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void a.run(async () => {
                  const { error } = await db.auth.updateUser(
                    { email: String(f.get("email")) },
                    { emailRedirectTo: location.origin },
                  );
                  if (error) throw error;
                }, "Email o‘zgartirish so‘rovi yuborildi. Tasdiqlash xatini tekshiring.");
              }}
            >
              <label>
                {t("Yangi email")}
                <input type="email" name="email" required />
              </label>
              <button disabled={a.busy}>
                {t("Tasdiqlash so‘rovini yuborish")}
              </button>
            </form>
            <hr />
            <h3>{t("Sessiya")}</h3>
            <p className="muted">
              {t("So‘nggi kirish —")}{" "}
              {session.user.last_sign_in_at
                ? new Date(session.user.last_sign_in_at).toLocaleString(
                    localeTag(),
                  )
                : "—"}
            </p>
            <button
              disabled={a.busy}
              onClick={() =>
                void a.run(async () => {
                  const { error } = await signOutWithMotion({
                    scope: "global",
                  });
                  if (error) throw error;
                }, "")
              }
            >
              {t("Barcha sessiyalardan chiqish")}
            </button>
          </>
        )}
        {tab === "appearance" && (
          <>
            <p className="eyebrow">{t("MAKE IT YOURS")}</p>
            <h2>{t("Ko‘rinish sozlamalari")}</h2>
            <p className="muted">
              {t("Tanlovingiz hisobingiz bilan birga saqlanadi.")}
            </p>
            <div className="theme-choices">
              {[
                ["light", "Yorug‘"],
                ["dark", "Tungi"],
                ["system", "Tizimga mos"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  disabled={a.busy}
                  className={profile.theme === value ? "active" : ""}
                  onClick={() =>
                    void a.run(async () => {
                      await update({ theme: value });
                      onTheme(
                        value === "dark" ||
                          (value === "system" &&
                            matchMedia("(prefers-color-scheme: dark)").matches),
                      );
                    })
                  }
                >
                  <span className={"theme-preview " + value} />
                  {t(label)}
                </button>
              ))}
            </div>
          </>
        )}
        {tab === "notifications" && (
          <>
            <p className="eyebrow">{t("STAY IN THE LOOP")}</p>
            <h2>{t("Bildirishnoma tanlovlari")}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void a.run(() =>
                  update({
                    notifications: Object.fromEntries(
                      ["learning", "tests", "subscriptions", "updates"].map(
                        (k) => [k, f.get(k) === "on"],
                      ),
                    ),
                  }),
                );
              }}
            >
              {[
                ["learning", "O‘qish eslatmalari"],
                ["tests", "Test bildirishnomalari"],
                ["subscriptions", "Obuna bildirishnomalari"],
                ["updates", "Muhim platforma yangiliklari"],
              ].map(([key, label]) => (
                <label className="preference-row" key={key}>
                  <span>{t(label)}</span>
                  <input
                    type="checkbox"
                    name={key}
                    defaultChecked={profile.notifications?.[key] ?? true}
                  />
                </label>
              ))}
              <p className="muted">
                {t(
                  "Bu tanlovlar xabarnoma ruxsatlarini saqlaydi. Rejalashtirilgan eslatmalar xizmati hali yoqilmagan.",
                )}
              </p>
              <button className="primary" disabled={a.busy}>
                {t("Saqlash")}
              </button>
            </form>
          </>
        )}
        {tab === "billing" && (
          <>
            <p className="eyebrow">{t("YOUR PLAN & USAGE")}</p>
            <h2>{t("Obuna va foydalanish")}</h2>
            <Feedback
              error={billing.error || payments.error}
              loading={billing.loading}
            />
            {billing.data && (
              <>
                <div className="current-plan">
                  <span className="badge">{t("Joriy tarif")}</span>
                  <h2>{billing.data.plan?.name}</h2>
                  <p>
                    {billing.data.subscription
                      ? t("Muddat — ") +
                        new Date(
                          billing.data.subscription.expires_at,
                        ).toLocaleDateString(localeTag())
                      : t("Asosiy tarif · muddatsiz")}
                  </p>
                  <p className="muted">
                    {t("Avtomatik yangilanish yoqilmagan.")}
                  </p>
                </div>
                <div className="usage-cards">
                  {[
                    [
                      "AI / kun",
                      billing.data.daily_ai,
                      billing.data.plan?.ai_daily,
                    ],
                    [
                      "AI / oy",
                      billing.data.monthly_ai,
                      billing.data.plan?.ai_monthly,
                    ],
                    [
                      "Test / kun",
                      billing.data.daily_test,
                      billing.data.plan?.tests_daily,
                    ],
                    [
                      "Test / oy",
                      billing.data.monthly_test,
                      billing.data.plan?.tests_monthly,
                    ],
                  ].map(([label, used, limit]) => (
                    <div key={String(label)}>
                      <span>{t(label)}</span>
                      <strong>
                        {used} / {limit}
                      </strong>
                      <progress value={Number(used)} max={Number(limit) || 1} />
                      <small>
                        {Math.max(0, Number(limit) - Number(used))}
                        {t(" ta qoldi")}
                      </small>
                    </div>
                  ))}
                </div>
              </>
            )}
            <h3>{t("Mavjud tariflar")}</h3>
            <div className="profile-plans">
              {plans.data?.map((p) => (
                <div key={p.id}>
                  <h4>{p.name}</h4>
                  <p>
                    {p.monthly_price === null
                      ? t("Narx e’lon qilinmagan")
                      : p.monthly_price + " " + p.currency + t(" / oy")}
                  </p>
                  <ul>
                    {p.features.map((f: string, i: number) => (
                      <li key={i}>{t(f)}</li>
                    ))}
                  </ul>
                  <small>
                    {t(
                      "Tarifni o‘zgartirish uchun administratorga murojaat qiling. Jonli to‘lov hali ulanmagan.",
                    )}
                  </small>
                </div>
              ))}
            </div>
            <h3>{t("To‘lovlar tarixi")}</h3>
            {payments.data?.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Sana")}</th>
                      <th>{t("Summa")}</th>
                      <th>{t("Holat")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.data.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {new Date(p.created_at).toLocaleDateString(
                            localeTag(),
                          )}
                        </td>
                        <td>
                          {p.amount} {p.currency}
                        </td>
                        <td>{t(p.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text={t("To‘lovlar hali yo‘q.")} />
            )}
          </>
        )}
        {tab === "privacy" && (
          <>
            <p className="eyebrow">{t("YOUR DATA, YOUR CHOICES")}</p>
            <h2>{t("Maxfiylik va ma’lumotlar")}</h2>
            <p className="muted">
              {t(
                "TAFE AI faqat suhbatda rozilik bergan ma’lumotlaringizni Gemini’ga yuboradi.",
              )}
            </p>
            <button
              disabled={a.busy}
              onClick={() =>
                void a.run(async () => {
                  const results = checked(
                    await db
                      .from("test_attempts")
                      .select(
                        "id,test_id,score,total,started_at,submitted_at,answers",
                      ),
                  );
                  const data = {
                    profile,
                    results,
                    exported_at: new Date().toISOString(),
                  };
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(data, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "tafe-my-data.json";
                  link.click();
                  URL.revokeObjectURL(url);
                }, "Ma’lumotlaringiz tayyorlandi.")
              }
            >
              <Download size={16} />
              {t("Ma’lumotlarimni yuklab olish")}
            </button>
            <hr />
            <h3>{t("Hisobni o‘chirish so‘rovi")}</h3>
            <p className="muted">
              {t(
                "So‘rov administrator ko‘rib chiqishi uchun saqlanadi. Hisob administrator orqali qaytarish mumkin bo‘lgan holatda o‘chiriladi.",
              )}
            </p>
            <button
              className="danger"
              disabled={a.busy}
              onClick={() => {
                if (
                  profile.deletion_requested_at ||
                  confirm(t("Hisobingizni o‘chirish uchun so‘rov yuborasizmi?"))
                )
                  void a.run(() =>
                    update({
                      deletion_requested_at: profile.deletion_requested_at
                        ? null
                        : new Date().toISOString(),
                    }),
                  );
              }}
            >
              {profile.deletion_requested_at
                ? t("O‘chirish so‘rovini bekor qilish")
                : t("Hisobni o‘chirishni so‘rash")}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
