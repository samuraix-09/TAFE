import { t, LanguagePicker, localeTag } from "./i18n";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  GraduationCap,
  Library,
  Menu,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  X,
} from "lucide-react";
import { db } from "./db";
import { WindowsDownloads } from "./WindowsDownloads";
import "./visitor.css";
export type VisitorPage =
  | "home"
  | "login"
  | "register"
  | "forgot"
  | "reset"
  | "privacy"
  | "terms"
  | "contact";
export function Brand({
  caption = "TRAINING AND FUTURE EXCELLENCE",
}: {
  caption?: string;
}) {
  return (
    <span className="tafe-brand">
      <img
        className="tafe-logo-light"
        src="/tafe-logo-light.svg"
        alt="TAFE"
        width={150}
        height={42}
      />
      <img
        className="tafe-logo-dark"
        src="/tafe-logo-dark.svg"
        alt="TAFE"
        width={150}
        height={42}
      />
      <small>{caption}</small>
    </span>
  );
}
type Category = { id: string; name: string; description: string };
type Plan = {
  id: string;
  name: string;
  monthly_price: number | null;
  currency: string;
  features: string[];
};
const features = [
  [
    BookOpen,
    "Smart Exam Preparation",
    "Imtihon yo‘nalishingizni tanlang va mavjud testlarda bilimingizni sinang.",
  ],
  [
    Sparkles,
    "Personal TAFE AI",
    "Savollar bering, murakkab mavzularni tushuntirishni so‘rang.",
  ],
  [
    ChartNoAxesCombined,
    "Performance Analysis",
    "Saqlangan test natijalaringizni ko‘rib, tayyorgarlikni baholang.",
  ],
  [
    Target,
    "Personalized Study Plans",
    "Maqsadli ball va imtihon sanasini belgilab, AI bilan reja tuzing.",
  ],
  [
    Library,
    "Educational Library",
    "Administrator joylashtirgan o‘quv materiallarini bir joyda toping.",
  ],
  [
    GraduationCap,
    "Multiple Examination Systems",
    "Turli imtihonlarga bitta shaxsiy kabinet orqali tayyorlaning.",
  ],
] as const;
export function Landing({
  go,
  dark,
  toggle,
}: {
  go: (p: VisitorPage) => void;
  dark: boolean;
  toggle: () => void;
}) {
  const [cats, setCats] = useState<Category[]>([]),
    [plans, setPlans] = useState<Plan[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.all([
      db
        .from("exam_categories")
        .select("id,name,description")
        .eq("active", true)
        .order("display_order"),
      db
        .from("plans")
        .select("id,name,monthly_price,currency,features")
        .eq("active", true)
        .order("display_order"),
    ])
      .then(([c, p]) => {
        if (!alive) return;
        if (c.error || p.error)
          setError(
            "Katalogni yuklashning imkoni bo‘lmadi. Sahifani yangilab ko‘ring.",
          );
        else {
          setCats(c.data || []);
          setPlans(p.data || []);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (alive) {
          setError("Internet ulanishini tekshiring.");
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="landing">
      <header className="public-header">
        <a
          href="#home"
          onClick={() => go("home")}
          aria-label={t("TAFE bosh sahifa")}
        >
          <Brand />
        </a>
        <nav
          id="public-navigation"
          className={menu ? "public-links open" : "public-links"}
          aria-label={t("Bosh menyu")}
        >
          <a href="#home" onClick={() => setMenu(false)}>
            {t("Home")}
          </a>
          <a href="#features" onClick={() => setMenu(false)}>
            {t("Features")}
          </a>
          <a href="#exams" onClick={() => setMenu(false)}>
            {t("Exams")}
          </a>
          <a href="#pricing" onClick={() => setMenu(false)}>
            {t("Pricing")}
          </a>
          <a
            className="mobile-login-link"
            href="#/login"
            onClick={() => setMenu(false)}
          >
            {t("Log in")}
          </a>
          <a
            className="compact-register-link"
            href="#/register"
            onClick={() => setMenu(false)}
          >
            {t("Get Started ")}
          </a>
        </nav>
        <div className="header-actions">
          <LanguagePicker />
          <button
            className="icon-button"
            aria-label={dark ? t("Yorug‘ rejim") : t("Tungi rejim")}
            onClick={toggle}
          >
            {dark ? <Sun /> : <Moon />}
          </button>
          <button onClick={() => go("login")}>{t("Log in")}</button>
          <button className="primary" onClick={() => go("register")}>
            {t("Get Started ")}
            <ArrowUpRight size={16} />
          </button>
          <button
            className="mobile-menu icon-button"
            aria-label={t(menu ? "Menyuni yopish" : "Menyuni ochish")}
            aria-expanded={menu}
            aria-controls="public-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main className="public-main">
        <div className="landing-hero" id="home">
          <div className="hero-copy">
            <span className="tiny-label">
              <span className="status-dot" />
              {t(" YOUR NEXT CHAPTER STARTS HERE")}
            </span>
            <h1>
              <span className="hero-line">{t("Prepare Smarter.")}</span>
              <em className="hero-line">{t("Achieve More.")}</em>
            </h1>
            <p>
              {t(
                "Your personal platform for preparing for IELTS, SAT, National Certificates, and other important examinations.",
              )}
            </p>
            <div className="hero-actions">
              <button className="primary" onClick={() => go("register")}>
                {t("Get Started ")}
                <ArrowRight size={18} />
              </button>
              <a className="secondary-link" href="#features">
                {t("Explore Platform ")}
                <ArrowUpRight size={18} />
              </a>
            </div>
            <div className="hero-note">
              <ShieldCheck size={16} />
              {t(" Shaxsiy natijalar. Aniq maqsad. Doimiy rivojlanish.")}
            </div>
          </div>
          <div className="hero-stage">
            <div
              className="platform-preview"
              aria-label={t("TAFE dashboard interfeysi ko‘rinishi")}
            >
              <div className="preview-top">
                <span className="window-dots">● ● ●</span>
                <span>{t("TAFE / Learning workspace")}</span>
                <ShieldCheck size={14} />
              </div>
              <div className="preview-body">
                <div className="preview-sidebar">
                  <img
                    src="/tafe-mark-dark.svg"
                    alt=""
                    width={28}
                    height={28}
                  />
                  <span className="preview-active">
                    <ChartNoAxesCombined />
                  </span>
                  <BookOpen />
                  <Sparkles />
                  <Library />
                </div>
                <div className="preview-content">
                  <div className="preview-greeting">
                    <div>
                      <small>{t("YOUR PERSONAL WORKSPACE")}</small>
                      <h3>{t("Kelajagingiz shu yerdan boshlanadi.")}</h3>
                    </div>
                    <span className="preview-avatar">T</span>
                  </div>
                  <div className="preview-banner">
                    <span>{t("PREPARE · PRACTICE · PROGRESS")}</span>
                    <h3>
                      {t("Har bir mashq —")}
                      <br />
                      {t("oldinga bir qadam.")}
                    </h3>
                    <GraduationCap size={58} />
                  </div>
                  <div className="preview-tiles">
                    <div>
                      <Target />
                      <span>{t("Maqsadlaringiz")}</span>
                    </div>
                    <div>
                      <BookOpen />
                      <span>{t("Testlaringiz")}</span>
                    </div>
                    <div>
                      <ChartNoAxesCombined />
                      <span>{t("Natijalaringiz")}</span>
                    </div>
                  </div>
                  <div className="preview-progress">
                    <span>{t("Shaxsiy o‘rganish yo‘lingiz")}</span>
                    <p>
                      {t("Hisob yarating va birinchi testingizni boshlang.")}
                    </p>
                    <div className="preview-track" />
                  </div>
                </div>
              </div>
              <span className="floating-note">
                <Sparkles size={19} />
                <span>
                  {t("Learn with clarity.")}
                  <small>{t("Grow with TAFE.")}</small>
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className="exam-strip">
          <span>{t("YOUR GOALS. ONE WORKSPACE.")}</span>
          {cats.map((c) => (
            <a key={c.id} href="#exams">
              {t(c.name)}
            </a>
          ))}
        </div>
        <div className="section-heading" id="features">
          <p className="eyebrow">{t("BUILT AROUND YOUR AMBITION")}</p>
          <h2>
            {t("Everything you need.")}
            <br />
            <span>{t("A clearer path forward.")}</span>
          </h2>
          <p className="muted">
            {t("Tayyorgarlik, amaliyot va shaxsiy natijalaringiz bir joyda.")}
          </p>
        </div>
        <div className="feature-grid">
          {features.map(([Icon, title, text]) => (
            <section key={title} className="feature-card">
              <span className="feature-icon">
                <Icon size={23} />
              </span>
              <h3>{t(title)}</h3>
              <p>{t(text)}</p>
            </section>
          ))}
        </div>
        <div className="section-heading" id="exams">
          <p className="eyebrow">{t("CHOOSE YOUR DIRECTION")}</p>
          <h2>
            {t("Your exam. ")}
            <span>{t("Your starting point.")}</span>
          </h2>
        </div>
        {error && (
          <div role="alert" className="error">
            {t(error)}
          </div>
        )}
        <div className="public-exams">
          {cats.map((c, i) => (
            <button key={c.id} onClick={() => go("register")}>
              <small>0{i + 1}</small>
              <h3>{t(c.name)}</h3>
              <p>{c.description || t("Tayyorgarlikni shu yerdan boshlang.")}</p>
              <ArrowUpRight size={20} />
            </button>
          ))}
        </div>
        {!loaded && (
          <p className="muted" role="status">
            {t("Yo‘nalishlar yuklanmoqda…")}
          </p>
        )}
        <div className="how-block">
          <div>
            <p className="eyebrow">{t("A SIMPLE WAY FORWARD")}</p>
            <h2>
              {t("Small steps.")}
              <br />
              {t("Meaningful progress.")}
            </h2>
            <p className="muted">
              {t("O‘zingizga mos sur’atda tayyorlaning.")}
            </p>
            <button className="primary" onClick={() => go("register")}>
              {t("Start your journey ")}
              <ArrowRight size={17} />
            </button>
          </div>
          <ol>
            {[
              "Create your account",
              "Choose your examination",
              "Complete practice tests",
              "Understand your mistakes with TAFE AI",
              "Improve your performance",
            ].map((s, i) => (
              <li key={s}>
                <span>0{i + 1}</span>
                <strong>{t(s)}</strong>
              </li>
            ))}
          </ol>
        </div>
        <div className="section-heading" id="pricing">
          <p className="eyebrow">{t("ROOM TO GROW")}</p>
          <h2>
            {t("A plan for ")}
            <span>{t("your ambition.")}</span>
          </h2>
          <p className="muted">
            {t("Tariflar va narxlar platforma bazasidan olinadi.")}
          </p>
        </div>
        <div className="pricing-grid">
          {plans.map((p, i) => (
            <section
              key={p.id}
              className={i === 1 ? "pricing-card featured" : "pricing-card"}
            >
              <span className="plan-index">0{i + 1} / TAFE</span>
              <h3>{p.name}</h3>
              <div className="plan-price">
                {p.monthly_price === null ? (
                  <span>{t("Narx hali e’lon qilinmagan")}</span>
                ) : p.monthly_price === 0 ? (
                  <>
                    {t("Bepul")}
                    <small>{t("boshlash uchun")}</small>
                  </>
                ) : (
                  <>
                    {new Intl.NumberFormat(localeTag()).format(p.monthly_price)}
                    <small>
                      {p.currency}
                      {t(" / oy")}
                    </small>
                  </>
                )}
              </div>
              <ul>
                {p.features.map((f, i) => (
                  <li key={i}>
                    <Check size={16} />
                    {t(f)}
                  </li>
                ))}
              </ul>
              {p.monthly_price === 0 ? (
                <button className="primary" onClick={() => go("register")}>
                  {t("Get Started ")}
                  <ArrowUpRight size={16} />
                </button>
              ) : (
                <p className="muted">{t("Pullik ulanish hali ochilmagan.")}</p>
              )}
            </section>
          ))}
        </div>
        {loaded && !plans.length && !error && (
          <p>{t("Tariflar hali e’lon qilinmagan.")}</p>
        )}
        <WindowsDownloads />
        <div className="final-cta">
          <p className="eyebrow">{t("MAKE YOUR NEXT MOVE")}</p>
          <h2>
            {t("Your next achievement")}
            <br />
            {t("starts with TAFE.")}
          </h2>
          <button className="primary" onClick={() => go("register")}>
            {t("Start Learning ")}
            <ArrowRight size={18} />
          </button>
        </div>
      </main>
      <footer className="public-footer">
        <div>
          <Brand />
          <p>{t("Prepare Smarter. Achieve More.")}</p>
        </div>
        <nav aria-label={t("Pastki menyu")}>
          <a href="#home">{t("About")}</a>
          <a href="#features">{t("Features")}</a>
          <a href="#windows">Windows</a>
          <button onClick={() => go("contact")}>{t("Contact")}</button>
          <button onClick={() => go("privacy")}>{t("Privacy Policy")}</button>
          <button onClick={() => go("terms")}>{t("Terms of Service")}</button>
        </nav>
        <small>© {new Date().getFullYear()} TAFE</small>
      </footer>
    </div>
  );
}
export function InfoPage({
  kind,
  back,
}: {
  kind: VisitorPage;
  back: () => void;
}) {
  const [contact, setContact] = useState<string | null>(null);
  useEffect(() => {
    void db
      .rpc("public_contact")
      .then(({ data }) => setContact(data?.contact_email || null));
  }, []);

  const content =
    kind === "privacy"
      ? [
          "Privacy Policy",
          "TAFE hisobingizdagi ism, email, tayyorgarlik maqsadlari, test javoblari va natijalarini xizmatni taqdim etish uchun Supabase’da saqlaydi.",
          "Tasdiqlash xatlari EmailJS orqali yuboriladi. TAFE AI’da xabar yuborganingizda, shu xabar Google Gemini’ga uzatiladi. Suhbatga maxfiy ma’lumot kiritmang.",
          "Hisob va o‘quv ma’lumotlari tegishli foydalanuvchining sessiyasi orqali himoyalanadi. Email yetkazib berish va AI javoblari tashqi xizmatlarga bog‘liq.",
        ]
      : kind === "terms"
        ? [
            "Terms of Service",
            "TAFE imtihonlarga tayyorlanish uchun o‘quv platformasidir. Hisobingiz uchun to‘g‘ri email manzilidan foydalaning va parolingizni maxfiy saqlang.",
            "Test natijalari platformadagi mashqlarni aks ettiradi. Rasmiy imtihondagi natija yoki universitetga qabulni kafolatlamaydi. AI javoblarini o‘quv manbalari bilan tekshiring.",
            "Platformaga zarar yetkazish, boshqalarning hisobiga kirish yoki foydalanish limitlarini chetlab o‘tishga yo‘l qo‘yilmaydi. Pullik tariflar faqat narx va to‘lov shartlari e’lon qilingach ochiladi.",
          ]
        : [
            "Contact",
            contact ||
              "Platformaning aloqa manzili hali administrator tomonidan belgilanmagan.",
          ];
  return (
    <main className="info-page motion-view">
      <LanguagePicker />
      <button onClick={back}>{t("← Bosh sahifa")}</button>
      <section>
        <h1>{t(content[0])}</h1>
        {content.slice(1).map((p) => (
          <p key={p}>{t(p)}</p>
        ))}
      </section>
    </main>
  );
}
