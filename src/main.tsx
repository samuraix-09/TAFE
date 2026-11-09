import {
  t,
  LanguagePicker,
  useLocale,
  setLocale,
  isLocale,
  localeTag,
  type Locale,
} from "./i18n";
import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Moon,
  Shield,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { db } from "./db";
import { Brand, Landing, InfoPage, type VisitorPage } from "./Landing";
import { EmailAuth } from "./EmailAuth";
import { Onboarding } from "./Onboarding";
import { LibraryPage } from "./LibraryPage";
import { ProfilePage } from "./ProfilePage";
import { ExamPlayer } from "./ExamPlayer";
import { ResultsPage } from "./ResultsPage";
import {
  checked,
  Empty,
  Feedback,
  rpc,
  useAction,
  useData,
  type Row,
} from "./platform";
import "./style.css";
import "./platform.css";
import "./motion.css";
import { signOutWithMotion, useStartupReady } from "./motion";
const AdminApp = lazy(() =>
  import("./AdminApp").then((m) => ({ default: m.AdminApp })),
);
const ChatPage = lazy(() =>
  import("./ChatPage").then((m) => ({ default: m.ChatPage })),
);
const nav = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["tests", "Testlar", BookOpen],
  ["results", "Natijalarim", ChartNoAxesCombined],
  ["ai", "TAFE AI", Sparkles],
  ["library", "Kutubxona", Library],
  ["profile", "Profil", User],
] as const;
function visitorRoute(): VisitorPage {
  const value = location.hash.replace("#/", "");
  return [
    "login",
    "register",
    "forgot",
    "reset",
    "privacy",
    "terms",
    "contact",
  ].includes(value)
    ? (value as VisitorPage)
    : "home";
}
function studentRoute() {
  const route = location.hash.split("/")[2];
  return nav.some((n) => n[0] === route) ? route : "dashboard";
}
function App() {
  useLocale();
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [authError, setAuthError] = useState(""),
    [visitor, setVisitor] = useState(visitorRoute),
    [page, setPage] = useState(studentRoute),
    [adminRoute, setAdminRoute] = useState(
      location.hash.startsWith("#/admin") ||
        location.pathname.startsWith("/admin"),
    ),
    [dark, setDark] = useState(localStorage.theme === "dark"),
    [attempt, setAttempt] = useState<Row | null>(null),
    [completedAttemptId, setCompletedAttemptId] = useState<string | null>(null),
    [aiPrompt, setAiPrompt] = useState("");
  const go = (v: VisitorPage) => {
    setVisitor(v);
    location.hash = "/" + v;
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    let alive = true;
    db.auth.getSession().then(({ data, error }) => {
      if (alive) {
        if (error) setAuthError(error.message);
        setSession(data.session);
        setReady(true);
      }
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (!next) {
        setAttempt(null);
        setCompletedAttemptId(null);
      }
      if (event === "PASSWORD_RECOVERY") go("reset");
    });
    const route = () => {
      setVisitor(visitorRoute());
      setPage(studentRoute());
      setAdminRoute(location.hash.startsWith("#/admin"));
    };
    window.addEventListener("hashchange", route);
    return () => {
      alive = false;
      subscription.unsubscribe();
      window.removeEventListener("hashchange", route);
    };
  }, []);
  const account = useData(async () => {
    if (!session) return null;
    const [profile, categories, isAdmin] = await Promise.all([
      db.from("profiles").select("*").eq("id", session.user.id).single(),
      db.from("exam_categories").select("*").order("display_order"),
      db.rpc("is_admin"),
    ]);
    return {
      profile: checked(profile),
      categories: checked(categories) || [],
      admin: checked(isAdmin),
    };
  }, [session?.user.id]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon)
      favicon.href = dark ? "/tafe-mark-dark.svg" : "/tafe-mark-light.svg";
    localStorage.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    if (account.data?.profile) {
      const theme = account.data.profile.theme;
      setDark(
        theme === "dark" ||
          (theme === "system" &&
            matchMedia("(prefers-color-scheme: dark)").matches),
      );
    }
  }, [account.data?.profile.id]);
  useEffect(() => {
    const language = account.data?.profile.language;
    if (isLocale(language)) setLocale(language);
  }, [account.data?.profile.id, account.data?.profile.language]);
  const changeLanguage = (language: Locale) => {
    setLocale(language);
    if (session)
      void db.from("profiles").update({ language }).eq("id", session.user.id);
  };
  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (session)
      void db
        .from("profiles")
        .update({ theme: next ? "dark" : "light" })
        .eq("id", session.user.id);
  };
  const done = () => {
    setCompletedAttemptId(attempt?.id ?? null);
    setAttempt(null);
    location.hash = "/student/results";
  };
  const action = useAction();
  async function start(id: string) {
    await action.run(
      async () => setAttempt(await rpc("start_test", { t: id })),
      "",
    );
  }
  const infoPage = ["privacy", "terms", "contact"].includes(visitor);
  useStartupReady(
    ready && (!session || visitor === "reset" || infoPage || !account.loading),
  );
  if (!ready) return <Loading />;
  if (infoPage) return <InfoPage kind={visitor} back={() => go("home")} />;
  if (!session || visitor === "reset") {
    if (visitor === "home" && !adminRoute)
      return <Landing go={go} dark={dark} toggle={toggle} />;
    return (
      <EmailAuth
        mode={adminRoute ? "login" : visitor}
        go={go}
        dark={dark}
        toggle={toggle}
        onAuthenticated={
          adminRoute
            ? () => {
                location.hash = "/admin/overview";
              }
            : undefined
        }
      />
    );
  }
  if (account.loading && !account.data) return <Loading />;
  if (account.error || !account.data)
    return (
      <main className="info-page">
        <Feedback error={account.error || authError} />
        <button className="primary" onClick={account.reload}>
          {t("Qayta urinish")}
        </button>
        <button onClick={() => signOutWithMotion()}>{t("Chiqish")}</button>
      </main>
    );
  const { profile, categories, admin } = account.data;
  if (profile.status !== "active")
    return (
      <main className="info-page">
        <h1>{t("Hisobingiz faol emas.")}</h1>
        <p>
          {t("Hisob holati — ")}
          {t(profile.status)}
          {t(". Administratorga murojaat qiling.")}
        </p>
        <button className="primary" onClick={() => signOutWithMotion()}>
          {t("Chiqish")}
        </button>
      </main>
    );
  if (adminRoute)
    return (
      <Suspense fallback={<Loading />}>
        <AdminApp onLanguageChange={changeLanguage} />
      </Suspense>
    );
  const fullChat = page === "ai" && !!profile.onboarded_at && !attempt;
  return (
    <>
      <aside className="student-sidebar">
        <a className="brand" href="#/student/dashboard">
          <Brand />
        </a>
        <small>{t("LEARNING WORKSPACE")}</small>
        <nav aria-label={t("Bosh menyu")}>
          {nav.map(([key, name, Icon]) => (
            <a
              className={page === key ? "selected" : ""}
              aria-current={page === key ? "page" : undefined}
              key={key}
              href={"#/student/" + key}
              onClick={(e) => {
                if (
                  attempt &&
                  !confirm(
                    t(
                      "Testdan chiqasizmi? Saqlangan javoblar bilan keyin davom etishingiz mumkin.",
                    ),
                  )
                )
                  e.preventDefault();
                else setAttempt(null);
              }}
            >
              <Icon size={19} />
              <span>{t(name)}</span>
            </a>
          ))}
        </nav>
        <div className="sidebottom">
          <div className="mini">
            <Sparkles />
            <p>
              {t("Har kuni bir qadam.")}
              <br />
              <strong>{t("Maqsadingiz sari.")}</strong>
            </p>
          </div>
          <button onClick={toggle}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}{" "}
            {dark ? t("Yorug‘") : t("Tungi")}
            {t(" rejim")}
          </button>
          <button onClick={() => signOutWithMotion()}>
            <LogOut size={18} />
            {t("Chiqish")}
          </button>
        </div>
      </aside>
      <div
        className={
          fullChat
            ? "workspace student-workspace chat-workspace"
            : "workspace student-workspace"
        }
      >
        <header className="student-topbar">
          <span className="student-breadcrumb">
            TAFE / {t(nav.find((n) => n[0] === page)?.[1] || "")}
          </span>
          <div className="student-app-title">
            <Brand caption={t(nav.find((n) => n[0] === page)?.[1] || "")} />
          </div>
          <div>
            <LanguagePicker onChange={changeLanguage} />
            {admin && (
              <a className="admin-portal-link" href="#/admin/overview">
                <Shield size={14} />
                TAFE Admin ↗
              </a>
            )}
            <button
              className="mobile-theme"
              aria-label={t("Rang rejimi")}
              onClick={toggle}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="mobile-logout"
              aria-label={t("Chiqish")}
              onClick={() => signOutWithMotion()}
            >
              <LogOut size={16} />
            </button>
            <div className="avatar">{(profile.display_name || "T")[0]}</div>
          </div>
        </header>
        <main
          className={fullChat ? "chat-workspace-main" : "motion-view"}
          key={attempt?.id || page}
        >
          <Feedback {...action} />
          {!profile.onboarded_at ? (
            <Onboarding
              userId={session.user.id}
              categories={categories}
              profile={profile}
              onComplete={async () => account.reload()}
            />
          ) : attempt ? (
            <ExamPlayer attempt={attempt} onDone={done} />
          ) : (
            <>
              {page === "dashboard" && (
                <Dashboard profile={profile} categories={categories} />
              )}
              {page === "tests" && <TestsList onStart={start} />}
              {page === "results" && (
                <>
                  <PageTitle
                    eyebrow={t("MEASURE YOUR PROGRESS")}
                    title={t("Natijalarim")}
                  />
                  <ResultsPage
                    completedAttemptId={completedAttemptId}
                    onReviewOpened={() => setCompletedAttemptId(null)}
                    onResume={start}
                    onExplain={(prompt) => {
                      setAiPrompt(prompt);
                      location.hash = "/student/ai";
                    }}
                  />
                </>
              )}
              {page === "ai" && (
                <Suspense fallback={<Loading />}>
                  <ChatPage userId={session.user.id} initialPrompt={aiPrompt} />
                </Suspense>
              )}
              {page === "library" && <LibraryPage />}
              {page === "profile" && (
                <>
                  <PageTitle
                    eyebrow={t("YOUR ACCOUNT")}
                    title={t("Profil va sozlamalar")}
                  />
                  <ProfilePage
                    session={session}
                    profile={profile}
                    categories={categories}
                    onSaved={async () => account.reload()}
                    onTheme={setDark}
                    admin={admin}
                  />
                </>
              )}
            </>
          )}
        </main>
        {!fullChat && <footer>© TAFE · Training And Future Excellence</footer>}
      </div>
    </>
  );
}
function Loading() {
  return (
    <main className="loading-state" role="status">
      <span className="spinner" />
      <p>{t("TAFE yuklanmoqda…")}</p>
    </main>
  );
}
function PageTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
    </div>
  );
}
function Dashboard({
  profile,
  categories,
}: {
  profile: Row;
  categories: Row[];
}) {
  const result = useData(
    async () =>
      checked(
        await db
          .from("test_attempts")
          .select("id,submitted_at,score,total")
          .order("started_at", { ascending: false }),
      ),
    [],
  );
  const ent = useData(() => rpc("my_entitlements"), []);
  const completed = result.data?.filter((r) => r.submitted_at) || [],
    average = completed.length
      ? Math.round(
          completed.reduce((s, r) => s + (r.score / r.total) * 100, 0) /
            completed.length,
        )
      : null;
  return (
    <>
      <PageTitle
        eyebrow={t("YOUR NEXT CHAPTER STARTS HERE")}
        title={t("Salom, ") + (profile.display_name || t("o‘quvchi")) + "."}
      />
      <Feedback error={result.error || ent.error} loading={result.loading} />
      <div className="hero">
        <div>
          <span className="badge">TAFE LEARNING</span>
          <h2>
            {t("Bugungi harakatingiz.")}
            <br />
            {t("Ertangi yutug‘ingiz.")}
          </h2>
          <p>
            {t("Bilimingizni sinang, natijangizni kuzating va")}
            <br />
            {t("tayyorgarlikni o‘z rejangiz asosida davom ettiring.")}
          </p>
          <a className="button-link" href="#/student/tests">
            {t("Testlarni ko‘rish ")}
            <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="orbit">
          <GraduationCap size={100} />
          <span>{t("PREPARE · PRACTICE · PROGRESS")}</span>
        </div>
      </div>
      <div className="stats">
        {[
          ["Yakunlangan testlar", completed.length],
          ["O‘rtacha natija", average === null ? "—" : average + "%"],
          ["Davom etayotgan", (result.data?.length || 0) - completed.length],
        ].map(([label, value]) => (
          <section key={label}>
            <span className="muted">{t(String(label))}</span>
            <h2>{value}</h2>
            <small>{t("Shaxsiy natijalaringiz asosida")}</small>
          </section>
        ))}
      </div>
      <div className="dashboard-goal">
        <section>
          <span className="eyebrow">{t("YOUR GOAL")}</span>
          <h3>
            {categories.find((c) => c.id === profile.target_exam)?.name ||
              t("Imtihon maqsadingiz")}
          </h3>
          <p>
            {t("Maqsadli ball — ")}
            {profile.target_score || t("Belgilanmagan")}
          </p>
          <p className="muted">
            {profile.exam_date
              ? t("Imtihon — ") +
                new Date(profile.exam_date).toLocaleDateString(localeTag())
              : t("Imtihon sanasi belgilanmagan")}
          </p>
          <a href="#/student/profile">{t("Maqsadni tahrirlash ↗")}</a>
        </section>
        <section>
          <span className="eyebrow">{t("YOUR PLAN")}</span>
          <h3>{ent.data?.plan?.name || t("Tarif")}</h3>
          <p>
            AI — {ent.data?.daily_ai ?? "—"} / {ent.data?.plan?.ai_daily ?? "—"}{" "}
            {t("kunlik")}
          </p>
          <p>
            Test — {ent.data?.daily_test ?? "—"} /{" "}
            {ent.data?.plan?.tests_daily ?? "—"}
            {t(" kunlik")}
          </p>
          <a href="#/student/profile">{t("Limitlar va obuna ↗")}</a>
        </section>
      </div>
      <h2>{t("Imtihon yo‘nalishlari")}</h2>
      <div className="grid">
        {categories.map((c, i) => (
          <section key={c.id}>
            <div className="categoryicon">
              <BookOpen />
            </div>
            <small>
              0{i + 1}
              {t(" / EXAM PREPARATION")}
            </small>
            <h3>{t(c.name)}</h3>
            <p className="muted">
              {c.description ||
                t("Bosqichma-bosqich tayyorgarlik va amaliy testlar.")}
            </p>
            <a href="#/student/tests">{t("Boshlash ↗")}</a>
          </section>
        ))}
      </div>
    </>
  );
}
function TestsList({ onStart }: { onStart: (id: string) => void }) {
  const data = useData(
    async () =>
      checked(
        await db
          .from("tests")
          .select("*,exam_categories(name)")
          .order("created_at", { ascending: false }),
      ),
    [],
  );
  const [search, setSearch] = useState("");
  const rows = (data.data || []).filter((t) =>
    (t.title + " " + t.exam_categories?.name + " " + t.section)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle eyebrow={t("PRACTICE WITH PURPOSE")} title={t("Testlar")} />
      <Feedback error={data.error} loading={data.loading} />
      <div className="filter-bar">
        <input
          aria-label={t("Test qidirish")}
          placeholder={t("Test, yo‘nalish yoki fan…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="grid">
        {rows.map((test) => (
          <section key={test.id}>
            <span className="badge">
              {t(test.exam_categories?.name || "")} · {t(test.kind)}
            </span>
            <h2>{test.title}</h2>
            <p className="muted">{test.description}</p>
            <p>
              {test.section} · {test.duration}
              {t(" daqiqa · ")}
              {t(test.difficulty)}
            </p>
            <button className="primary" onClick={() => onStart(test.id)}>
              {t("Boshlash / davom etish")}
            </button>
          </section>
        ))}
      </div>
      {!data.loading && !rows.length && (
        <Empty text={t("Tanlovingizga mos e’lon qilingan testlar yo‘q.")} />
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
