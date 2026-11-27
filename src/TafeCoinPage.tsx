import { CoinExtraShop } from "./CoinExtraShop";
import { coinExtras, equippedExtra, type CoinCollection } from "./coin-extras";
import { CoinBackground } from "./CoinBackground";
import { TafeCoinBadge, TafeCoinReward } from "./TafeCoinBadge";
import { useState } from "react";
import {
  Check,
  Crown,
  CalendarDays,
  ClipboardCheck,
  Eye,
  Sparkles,
  BadgeCheck,
  Image as ImageIcon,
  Timer,
} from "lucide-react";
import { localeTag, t } from "./i18n";
import { db } from "./db";
import { checked, Feedback, Modal, rpc, useAction, useData } from "./platform";

export type CoinTheme =
  | "classic"
  | "aurora"
  | "midnight"
  | "nebula"
  | "atlas"
  | "jade";
type Collectible = CoinTheme | "scholar" | "background" | "study_timer";
export type CoinWallet = {
  balance: number;
  daily_earned?: number;
  equipped?: CoinCollection;
  extra_owned?: string[];
  theme: CoinTheme;
  owned: Collectible[];
  history: { item: string; amount: number; created_at: string }[];
};
const themes = [
  { id: "classic", title: "TAFE Classic", price: 0 },
  { id: "aurora", title: "Aurora Glass", price: 90 },
  { id: "midnight", title: "Midnight Circuit", price: 150 },
  { id: "atlas", title: "Atlas Mosaic", price: 185 },
  { id: "jade", title: "Jade Garden", price: 220 },
  { id: "nebula", title: "Nebula Lab", price: 240 },
] as const;
const focusPrice = 300;
const scholar = { id: "scholar", title: "Golden Scholar", price: 210 } as const;
const features = [
  { id: "background", title: "Shaxsiy fon rasmi", price: 500, Icon: ImageIcon },
  { id: "study_timer", title: "O‘qish taymeri", price: 125, Icon: Timer },
] as const;
const eventLabels: Record<string, string> = {
  exam: "Test mukofoti",
  focus: "3 kunlik TAFE Focus",
  ...Object.fromEntries(themes.map(({ id, title }) => [id, title])),
  scholar: scholar.title,
  ...Object.fromEntries(features.map(({ id, title }) => [id, title])),
  login: "Kunlik kirish mukofoti",
  ...Object.fromEntries(coinExtras.map(({ id, name }) => [id, name])),
};

export function TafeCoinPage({
  wallet,
  userId,
  background,
  onBackground,
  loading,
  error,
  onChange,
}: {
  wallet: CoinWallet | null;
  userId: string;
  background: string | null;
  onBackground: (value: string | null) => void;
  loading: boolean;
  error: string;
  onChange: (wallet: CoinWallet) => void;
}) {
  const action = useAction();
  const [earned, setEarned] = useState<number | null>(null);
  const [rewardId, setRewardId] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<
    | (typeof themes)[number]
    | typeof scholar
    | (typeof features)[number]
    | { id: "focus"; title: string; price: number }
  >();
  const [darkPreview, setDarkPreview] = useState(false);
  const focus = useData(
    async () =>
      selectedProduct?.id === "focus"
        ? checked(
            await db
              .from("plans")
              .select("ai_daily,tests_daily,library_rank")
              .eq("name", "TAFE Focus")
              .eq("active", true)
              .maybeSingle(),
          )
        : null,
    [selectedProduct?.id === "focus"],
  );
  function preview(product: NonNullable<typeof selectedProduct>) {
    action.clear();
    setDarkPreview(document.documentElement.dataset.theme === "dark");
    setSelectedProduct(product);
  }
  async function refresh() {
    onChange(await rpc("tafe_coin_wallet"));
  }

  const selectedOwned =
    selectedProduct &&
    (selectedProduct.id === "classic" ||
      (selectedProduct.id !== "focus" &&
        wallet?.owned.includes(selectedProduct.id)));
  const selectedActive =
    selectedProduct &&
    (wallet?.theme === selectedProduct.id ||
      (["scholar", "study_timer", "background"].includes(selectedProduct.id) &&
        selectedOwned));

  async function purchase(product: string) {
    await rpc("tafe_coin_purchase", {
      product,
      request_id: crypto.randomUUID(),
    });
    await refresh();
    if (product !== "background") setSelectedProduct(undefined);
  }

  return (
    <div className="coin-page">
      <section className="coin-hero">
        <div>
          <p className="coin-eyebrow">
            <TafeCoinBadge /> TafeCoin
          </p>
          <h1>{t("O‘quv mukofotlari")}</h1>
          <p>
            {t(
              "Test ishlang va tangalarni mavzular yoki TAFE Focus uchun sarflang.",
            )}
          </p>
        </div>
        <div className="coin-balance">
          <span>{t("Balans")}</span>
          <strong aria-live="polite">{wallet?.balance ?? "—"}</strong>
          <span>TafeCoin</span>
        </div>
      </section>
      <Feedback error={action.error || error} loading={loading} />
      {!wallet && !loading && (
        <button onClick={() => void action.run(refresh, "")}>
          {t("Qayta urinish")}
        </button>
      )}
      <section className="coin-earn">
        <div className="coin-earn-guide">
          <h2>{t("Tanga ishlab topish")}</h2>
          <div className="coin-earning-grid">
            <article>
              <CalendarDays size={21} aria-hidden="true" />
              <strong>+10</strong>
              <h3>{t("Har kuni birinchi kirish")}</h3>
              <p>
                {t(
                  "Toshkent vaqti bo‘yicha kuniga bir marta avtomatik qo‘shiladi.",
                )}
              </p>
            </article>
            <article>
              <ClipboardCheck size={21} aria-hidden="true" />
              <strong>+10</strong>
              <h3>{t("Test natijasi 50–79%")}</h3>
              <p>{t("Kamida 10 ballik testni yakunlang.")}</p>
            </article>
            <article>
              <Sparkles size={21} aria-hidden="true" />
              <strong>+15</strong>
              <h3>{t("Test natijasi 80% yoki yuqori")}</h3>
              <p>{t("Yuqori natija uchun 15 tanga beriladi.")}</p>
            </article>
          </div>
          <p className="muted">
            {t(
              "Kuniga 3 tagacha turli test uchun. So‘nggi 30 kundagi mos testlar hisobga olinadi.",
            )}
          </p>
        </div>
        <button
          className="primary"
          disabled={!wallet || action.busy}
          onClick={() =>
            void action.run(async () => {
              const amount = await rpc("claim_tafe_coins");
              setEarned(amount);
              if (amount > 0) setRewardId((value) => value + 1);
              await refresh();
            }, "")
          }
        >
          <TafeCoinBadge /> {t("Tangalarni yig‘ish")}
        </button>
        {earned !== null && (
          <p className="coin-earned" role="status">
            {earned ? `+${earned} TafeCoin` : t("Yangi mukofot mavjud emas.")}
          </p>
        )}
      </section>
      {earned !== null && earned > 0 && (
        <TafeCoinReward
          key={rewardId}
          effect={equippedExtra(wallet?.equipped, "effect")}
          amount={earned}
          label={t("Test mukofoti")}
        />
      )}
      <section aria-labelledby="coin-store-heading">
        <h2 id="coin-store-heading">{t("TafeCoin do‘koni")}</h2>
        <div className="coin-shop">
          {themes.map((theme) => {
            const owned =
              theme.id === "classic" || wallet?.owned.includes(theme.id);
            const selected = wallet?.theme === theme.id;
            return (
              <article className="coin-product" key={theme.id}>
                <ThemePreview theme={theme.id} dark={false} />
                <h3>{theme.title}</h3>
                <p className="muted">
                  {owned ? t("Sizda mavjud") : `${theme.price} TafeCoin`}
                </p>
                <button type="button" onClick={() => preview(theme)}>
                  {selected ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Eye size={16} aria-hidden="true" />
                  )}
                  {t(selected ? "Faol mavzu" : "Batafsil ko‘rish")}
                </button>
              </article>
            );
          })}
          {features.map((product) => (
            <article className="coin-product" key={product.id}>
              <div className="coin-theme-preview" data-preview={product.id}>
                <product.Icon size={30} aria-hidden="true" />
              </div>
              <h3>{t(product.title)}</h3>
              <p className="muted">
                {wallet?.owned.includes(product.id)
                  ? t("Sizda mavjud")
                  : `${product.price} TafeCoin`}
              </p>
              <button onClick={() => preview(product)}>
                {t("Batafsil ko‘rish")}
              </button>
            </article>
          ))}
          <article className="coin-product">
            <div className="coin-theme-preview coin-scholar-preview">
              <BadgeCheck size={30} aria-hidden="true" />
            </div>
            <h3>{scholar.title}</h3>
            <p className="muted">
              {wallet?.owned.includes("scholar")
                ? t("Sizda mavjud")
                : `${scholar.price} TafeCoin`}
            </p>
            <button type="button" onClick={() => preview(scholar)}>
              <Eye size={16} aria-hidden="true" /> {t("Batafsil ko‘rish")}
            </button>
          </article>
          <article className="coin-product">
            <div className="coin-theme-preview" data-preview="focus">
              <Crown size={24} aria-hidden="true" />
            </div>
            <h3>{t("3 kunlik TAFE Focus")}</h3>
            <p className="muted">{focusPrice} TafeCoin</p>
            <button
              type="button"
              onClick={() =>
                preview({
                  id: "focus",
                  title: "3 kunlik TAFE Focus",
                  price: focusPrice,
                })
              }
            >
              <Eye size={16} aria-hidden="true" /> {t("Batafsil ko‘rish")}
            </button>
          </article>
        </div>
      </section>
      {selectedProduct && (
        <Modal
          title={t(selectedProduct.title)}
          onClose={() => setSelectedProduct(undefined)}
        >
          <div className="coin-product-details">
            {selectedProduct.id === "focus" ? (
              <>
                <p>{t("Faol obuna bo‘lmasa, TAFE Focus darhol boshlanadi.")}</p>
                <Feedback loading={focus.loading} error={focus.error} />
                {focus.data && (
                  <ul>
                    <li>
                      TAFE AI · {focus.data.ai_daily} {t("kunlik")}
                    </li>
                    <li>
                      {t("Testlar")} · {focus.data.tests_daily} {t("kunlik")}
                    </li>
                    <li>
                      {t("Kutubxona")} · {t("Daraja")} {focus.data.library_rank}
                    </li>
                  </ul>
                )}
              </>
            ) : selectedProduct.id === "background" ? (
              <>
                <p>
                  {t(
                    "Bir marta sotib oling va kabinet fonini istalgan payt almashtiring.",
                  )}
                </p>
                {selectedOwned && (
                  <CoinBackground
                    userId={userId}
                    current={background}
                    onChange={onBackground}
                  />
                )}
              </>
            ) : selectedProduct.id === "study_timer" ? (
              <>
                <p>
                  {t(
                    "Bosh sahifadagi taymer bilan 15, 25 yoki 45 daqiqalik o‘qish sessiyasini boshlang.",
                  )}
                </p>
                {selectedOwned && (
                  <a
                    className="button-link"
                    href="#/student/dashboard"
                    onClick={() => setSelectedProduct(undefined)}
                  >
                    {t("Dashboard")}
                  </a>
                )}
              </>
            ) : selectedProduct.id === "scholar" ? (
              <>
                <div className="coin-theme-preview coin-scholar-preview">
                  <BadgeCheck size={34} aria-hidden="true" />{" "}
                  <strong>{scholar.title}</strong>
                </div>
                <p>
                  {t(
                    "Xariddan so‘ng oltin belgi profil logosi yonida ko‘rinadi.",
                  )}
                </p>
              </>
            ) : (
              <>
                <ThemePreview theme={selectedProduct.id} dark={darkPreview} />
                <div className="button-row" aria-label={t("Rang rejimi")}>
                  <button
                    aria-pressed={!darkPreview}
                    onClick={() => setDarkPreview(false)}
                  >
                    {t("Yorug‘")}
                  </button>
                  <button
                    aria-pressed={darkPreview}
                    onClick={() => setDarkPreview(true)}
                  >
                    {t("Tungi")}
                  </button>
                </div>
              </>
            )}
            <p>
              <strong>
                {selectedOwned
                  ? t("Sizda mavjud")
                  : `${selectedProduct.price} TafeCoin`}
              </strong>
            </p>
            <Feedback error={action.error} />
            <button
              className="primary"
              disabled={
                !wallet ||
                action.busy ||
                Boolean(selectedActive) ||
                (!selectedOwned && wallet.balance < selectedProduct.price)
              }
              onClick={() =>
                void action.run(async () => {
                  if (selectedOwned && !selectedActive) {
                    await rpc("set_tafe_coin_theme", {
                      product: selectedProduct.id,
                    });
                    await refresh();
                    setSelectedProduct(undefined);
                  } else await purchase(selectedProduct.id);
                }, "")
              }
            >
              {t(
                selectedActive
                  ? selectedProduct.id !== wallet?.theme
                    ? "Sizda mavjud"
                    : "Faol mavzu"
                  : selectedOwned
                    ? "Mavzuni yoqish"
                    : "Xaridni tasdiqlash",
              )}
            </button>
          </div>
        </Modal>
      )}
      <CoinExtraShop wallet={wallet} onChange={onChange} />
      {Boolean(wallet?.history.length) && (
        <section className="coin-history">
          <h2>{t("Tanga tarixi")}</h2>
          <ul>
            {wallet?.history.map((event, index) => (
              <li key={index}>
                <span>{t(eventLabels[event.item] || event.item)}</span>
                <time dateTime={event.created_at}>
                  {new Date(event.created_at).toLocaleDateString(localeTag())}
                </time>
                <strong>
                  {event.amount > 0 ? "+" : ""}
                  {event.amount}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ThemePreview({ theme, dark }: { theme: CoinTheme; dark: boolean }) {
  return (
    <div
      className="coin-workspace-preview"
      data-coin-theme={theme}
      data-preview-mode={dark ? "dark" : "light"}
      aria-hidden="true"
    >
      <div className="coin-preview-nav">
        <b>TAFE</b>
        <i />
        <i />
      </div>
      <div className="coin-preview-content">
        <div className="coin-preview-hero">{t("Testlarni ko‘rish ")}</div>
        <div className="coin-preview-panels">
          <span>{t("Testlar")}</span>
          <span>{t("Kutubxona")}</span>
        </div>
      </div>
    </div>
  );
}
