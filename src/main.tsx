import { readReadingProgress } from "./reading-progress";
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
  LayoutDashboard,
  Library,
  LogOut,
  Moon,
  Shield,
  Sparkles,
  Sun,
  Trophy,
  User,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { db } from "./db";
import { Brand, Landing, InfoPage, type VisitorPage } from "./Landing";
import { EmailAuth } from "./EmailAuth";
import { fullScreenEnabled } from "./exam-fullscreen";
import { readActiveExam, rememberActiveExam } from "./exam-draft";
import { retiredDiagnosticId } from "./exam-catalog";
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
import "./glass.css";
import { signOutWithMotion, useStartupReady } from "./motion";
const AdminApp = lazy(() =>
  import("./AdminApp").then((m) => ({ default: m.AdminApp })),
);
const ChatPage = lazy(() =>
  import("./ChatPage").then((m) => ({ default: m.ChatPage })),
);
const ExamPlayer = lazy(() =>
  import("./ExamPlayer").then((module) => ({ default: module.ExamPlayer })),
);
const LibraryPage = lazy(() =>
  import("./LibraryPage").then((module) => ({ default: module.LibraryPage })),
);
const ProfilePage = lazy(() =>
  import("./ProfilePage").then((module) => ({ default: module.ProfilePage })),
);
const ResultsPage = lazy(() =>
  import("./ResultsPage").then((module) => ({ default: module.ResultsPage })),
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
    [completedExam, setCompletedExam] = useState<{
      id: string;
      userId: string;
    } | null>(null),
    [recoveringExam, setRecoveringExam] = useState(false),
    [recoveryError, setRecoveryError] = useState("");
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
        setCompletedExam(null);
        setRecoveryError("");
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
  const done = (id: string) => {
    setAttempt(null);
    if (session) {
      rememberActiveExam(session.user.id, null);
      setCompletedExam({ id, userId: session.user.id });
    }
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
  };
  const learnerId = session?.user.id;
  const canRecover =
    account.data?.profile.status === "active" &&
    account.data?.profile.id === learnerId &&
    !adminRoute &&
    visitor !== "reset";
  useEffect(() => {
    if (!learnerId || !canRecover) return;
    const saved = readActiveExam(learnerId);
    if (!saved) return;
    let alive = true;
    setRecoveringExam(true);
    setRecoveryError("");
    void rpc("exam_session_action", {
      attempt: saved.id,
      response: {},
      action: "status",
      stage: null,
    })
      .then((restored) => {
        if (!alive) return;
        if (restored.submitted) {
          rememberActiveExam(learnerId, null);
          setCompletedExam({ id: saved.id, userId: learnerId });
        } else {
          setAttempt({
            ...restored,
            category: saved.category,
            section: saved.section,
          });
        }
      })
      .catch(() => {
        if (alive)
          setRecoveryError(
            t(
              "Saqlangan testni avtomatik ochib bo‘lmadi. Uni Natijalarim bo‘limidan davom ettiring.",
            ),
          );
      })
      .finally(() => {
        if (alive) setRecoveringExam(false);
      });
    return () => {
      alive = false;
      setRecoveringExam(false);
    };
  }, [learnerId, canRecover]);

  const action = useAction();
  async function start(id: string, category = "", section = "") {
    if (action.busy || id === retiredDiagnosticId) return;
    const fullscreen =
      fullScreenEnabled() && !document.fullscreenElement
        ? document.documentElement.requestFullscreen().catch(() => {})
        : Promise.resolve();
    await action.run(async () => {
      await fullscreen;
      try {
        let result;
        if (id === "fe816150-8c12-4b3a-b04a-000000000031") {
          result = checked(
            await db.functions.invoke("opensat-start", { body: {} }),
          );
          if (result.error) throw Error(result.error);
        } else result = await rpc("start_exam_session", { t: id });
        if (result.submitted) done(result.id);
        else {
          if (learnerId)
            rememberActiveExam(learnerId, { id: result.id, category, section });
          setRecoveryError("");
          setAttempt({ ...result, category, section });
        }
      } catch (error) {
        if (document.fullscreenElement)
          void document.exitFullscreen().catch(() => {});
        throw error;
      }
    }, "");
  }
  const infoPage = ["privacy", "terms", "contact"].includes(visitor);
  useStartupReady(
    ready && (!session || visitor === "reset" || infoPage || !account.loading),
  );
  if (!ready) return <Loading />;
  if (!attempt && infoPage)
    return <InfoPage kind={visitor} back={() => go("home")} />;
  if (!session || (!attempt && visitor === "reset")) {
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
  if (recoveringExam) return <Loading />;
  if (attempt)
    return (
      <Suspense fallback={<Loading />}>
        <ExamPlayer
          key={attempt.id}
          attempt={attempt}
          accessToken={session.access_token}
          onDone={done}
        />
      </Suspense>
    );
  const aiShortcut = (
    <a
      className="tafe-ai-shortcut"
      href="#/student/ai"
      onClick={() => {
        setCompletedExam(null);
      }}
    >
      <Sparkles className="tafe-ai-sparkle" size={18} aria-hidden="true" />
      <span>TAFE AI</span>
    </a>
  );
  if (adminRoute)
    return (
      <Suspense fallback={<Loading />}>
        {aiShortcut}
        <AdminApp onLanguageChange={changeLanguage} />
      </Suspense>
    );
  if (completedExam?.userId === session.user.id) {
    return (
      <>
        {aiShortcut}
        <ExamCompleted
          id={completedExam.id}
          onDetails={() => {
            setCompletedExam(null);
            location.hash = "/student/results/" + completedExam.id;
            setPage("results");
          }}
          onExit={() => {
            setCompletedExam(null);
            location.hash = "/student/dashboard";
            setPage("dashboard");
          }}
        />
      </>
    );
  }
  const fullChat = page === "ai";
  return (
    <>
      {!fullChat && aiShortcut}
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
          <a
            className="student-app-title"
            href="#/student/profile"
            aria-label={t("Profil va sozlamalar")}
          >
            <Brand caption={t(nav.find((n) => n[0] === page)?.[1] || "")} />
          </a>
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
          key={page}
        >
          <Feedback {...action} />
          <Feedback error={recoveryError} />
          <Suspense fallback={<Loading />}>
            {page === "dashboard" && (
              <Dashboard
                profile={profile}
                categories={categories}
                userId={session.user.id}
                onResume={start}
                busy={action.busy}
              />
            )}
            {page === "tests" && (
              <TestsList onStart={start} busy={action.busy} />
            )}
            {page === "results" && (
              <>
                <PageTitle
                  eyebrow={t("MEASURE YOUR PROGRESS")}
                  title={t("Natijalarim")}
                />
                <ResultsPage key={session.user.id} onResume={start} />
              </>
            )}
            {page === "ai" && (
              <Suspense fallback={<Loading />}>
                <ChatPage userId={session.user.id} />
              </Suspense>
            )}
            {page === "library" && <LibraryPage userId={session.user.id} />}
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
          </Suspense>
        </main>
        {!fullChat && <footer>© TAFE · Training And Future Excellence</footer>}
      </div>
    </>
  );
}
function ExamCompleted({
  id,
  onDetails,
  onExit,
}: {
  id: string;
  onDetails: () => void;
  onExit: () => void;
}) {
  const result = useData(async () => {
    const { data, error } = await db
      .from("test_attempts")
      .select("score,total,sat_scores")
      .eq("id", id)
      .not("submitted_at", "is", null)
      .single();
    if (error) throw error;
    return data;
  }, [id]);
  const satScore = result.data?.sat_scores?.total;
  return (
    <main className="exam-completed">
      <section className="exam-completed-panel">
        <Trophy size={40} aria-hidden="true" />
        <h1>{t("Test yakunlandi")}</h1>
        <Feedback error={result.error} loading={result.loading} />
        {result.data && (
          <>
            <strong className="exam-completed-score">
              {satScore == null
                ? `${result.data.score} / ${result.data.total}`
                : `${satScore} / 1600`}
            </strong>
            {satScore != null && (
              <p className="muted">{t("SAT taxminiy balli")}</p>
            )}
          </>
        )}
        <div className="button-row">
          <button className="primary" onClick={onDetails}>
            {t("Natijani ko‘rish")}
          </button>
          <button onClick={onExit}>{t("Chiqish")}</button>
        </div>
      </section>
    </main>
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
  userId,
  onResume,
  busy,
}: {
  profile: Row;
  categories: Row[];
  userId: string;
  onResume: (id: string, category: string, section: string) => void;
  busy: boolean;
}) {
  const result = useData(async () => {
    await rpc("settle_exam_sessions");
    return checked(
      await db
        .from("test_attempts")
        .select(
          "id,test_id,submitted_at,score,total,finish_reason,tests(title,section,exam_categories(name))",
        )
        .order("started_at", { ascending: false }),
    ) as unknown as Row[];
  }, []);
  const ent = useData(() => rpc("my_entitlements"), []);
  const completed = result.data?.filter((r) => r.submitted_at) || [],
    average = completed.length
      ? Math.round(
          completed.reduce((s, r) => s + (r.score / r.total) * 100, 0) /
            completed.length,
        )
      : null;
  const reading = readReadingProgress(userId);
  const book = useData<Row | null>(
    async () =>
      reading
        ? checked(
            await db
              .from("library_resources")
              .select("title")
              .eq("id", reading.bookId)
              .eq("file_path", reading.path)
              .maybeSingle(),
          )
        : null,
    [userId, reading?.bookId, reading?.path],
  );
  const unfinished = result.data?.find(
    (item) =>
      !item.submitted_at &&
      !item.finish_reason &&
      item.test_id !== retiredDiagnosticId,
  );
  const next = unfinished
    ? {
        title: "Testni davom ettirish",
        detail: unfinished.tests?.title || "",
        href: "",
      }
    : book.data && reading
      ? {
          title: "O‘qishni davom ettirish",
          detail: book.data.title + " · " + t("Sahifa") + " " + reading.page,
          href: "#/student/library/read",
        }
      : completed[0]
        ? {
            title: "Natijani ko‘rish",
            detail: t("Takrorlash kerak bo‘lgan mavzular"),
            href: "#/student/results/" + completed[0].id,
          }
        : { title: "Testlarni ko‘rish ", detail: "", href: "#/student/tests" };
  return (
    <>
      <PageTitle
        eyebrow={t("YOUR NEXT CHAPTER STARTS HERE")}
        title={t("Salom, ") + (profile.display_name || t("o‘quvchi")) + "."}
      />
      <Feedback error={result.error || ent.error} loading={result.loading} />
      <section className="dashboard-next">
        <div>
          <h2>{t(next.title)}</h2>
          {next.detail && <p>{next.detail}</p>}
        </div>
        {unfinished ? (
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              onResume(
                unfinished.test_id,
                unfinished.tests?.exam_categories?.name ?? "",
                unfinished.tests?.section ?? "",
              )
            }
          >
            {t(next.title)} <ArrowUpRight size={18} aria-hidden="true" />
          </button>
        ) : (
          <a className="button-link primary" href={next.href}>
            {t(next.title)} <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        )}
      </section>
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
function TestsList({
  onStart,
  busy,
}: {
  onStart: (id: string, category: string, section: string) => void;
  busy: boolean;
}) {
  const data = useData<Row[]>(() => rpc("web_exam_catalog"));
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [section, setSection] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const available = (data.data || []).filter(
    (test) => !test.diagnostic && test.id !== retiredDiagnosticId,
  );
  const categories = [
    ...new Set(
      available.map((test) => test.exam_categories?.name).filter(Boolean),
    ),
  ];
  const sections = [
    ...new Set(available.map((test) => test.section).filter(Boolean)),
  ];
  const difficulties = [
    ...new Set(available.map((test) => test.difficulty).filter(Boolean)),
  ];
  const query = search.trim().toLowerCase();
  const rows = available.filter(
    (test) =>
      (!category || test.exam_categories?.name === category) &&
      (!section || test.section === section) &&
      (!difficulty || test.difficulty === difficulty) &&
      [test.title, test.exam_categories?.name, test.section]
        .join(" ")
        .toLowerCase()
        .includes(query),
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
        <select
          aria-label={t("Yo‘nalish")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{t("Barcha yo‘nalishlar")}</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {t(name)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("Bo‘lim")}
          value={section}
          onChange={(e) => setSection(e.target.value)}
        >
          <option value="">{t("Barcha bo‘limlar")}</option>
          {sections.map((name) => (
            <option key={name} value={name}>
              {t(name)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("Qiyinlik")}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">{t("Har qanday qiyinlik")}</option>
          {difficulties.map((name) => (
            <option key={name} value={name}>
              {t(name)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid">
        {rows.map((test) => (
          <section key={test.id}>
            <span className="badge">
              {t(test.exam_categories?.name || "")} · {t(test.kind)}
            </span>
            <h2>{t(test.title)}</h2>
            <p className="muted">{t(test.description)}</p>
            <p>
              {test.section} · {test.duration}
              {t(" daqiqa · ")}
              {t(test.difficulty)}
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                onStart(
                  test.id,
                  test.exam_categories?.name ?? "",
                  test.section ?? "",
                )
              }
            >
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
