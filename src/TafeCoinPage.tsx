import { TafeCoinBadge, TafeCoinReward } from "./TafeCoinBadge";
import { useState } from "react";
import {
  Check,
  Crown,
  CalendarDays,
  ClipboardCheck,
  Eye,
  Sparkles,
} from "lucide-react";
import { localeTag, t } from "./i18n";
import { db } from "./db";
import { checked, Feedback, Modal, rpc, useAction, useData } from "./platform";

export type CoinTheme = "classic" | "aurora" | "midnight";
export type CoinWallet = {
  balance: number;
  daily_earned?: number;
  theme: CoinTheme;
  owned: CoinTheme[];
  history: { item: string; amount: number; created_at: string }[];
};
const themes = [
  { id: "classic", title: "TAFE Classic", price: 0 },
  { id: "aurora", title: "Aurora Glass", price: 90 },
  { id: "midnight", title: "Midnight Circuit", price: 150 },
] as const;
const focusPrice = 300;
const eventLabels: Record<string, string> = {
  exam: "Test mukofoti",
  aurora: "Aurora Glass",
  midnight: "Midnight Circuit",
  focus: "3 kunlik TAFE Focus",
  login: "Kunlik kirish mukofoti",
};

export function TafeCoinPage({
  wallet,
  loading,
  error,
  onChange,
}: {
  wallet: CoinWallet | null;
  loading: boolean;
  error: string;
  onChange: (wallet: CoinWallet) => void;
}) {
  const action = useAction();
  const [earned, setEarned] = useState<number | null>(null);
  const [rewardId, setRewardId] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<
    (typeof themes)[number] | { id: "focus"; title: string; price: number }
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

  async function purchase(product: string) {
    await rpc("tafe_coin_purchase", {
      product,
      request_id: crypto.randomUUID(),
    });
    await refresh();
    setSelectedProduct(undefined);
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
                {wallet?.theme === selectedProduct.id ||
                selectedProduct.id === "classic" ||
                wallet?.owned.includes(selectedProduct.id as CoinTheme)
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
                wallet.theme === selectedProduct.id ||
                (selectedProduct.id !== "classic" &&
                  !wallet.owned.includes(selectedProduct.id as CoinTheme) &&
                  wallet.balance < selectedProduct.price)
              }
              onClick={() =>
                void action.run(async () => {
                  if (
                    selectedProduct.id === "classic" ||
                    wallet?.owned.includes(selectedProduct.id as CoinTheme)
                  ) {
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
                wallet?.theme === selectedProduct.id
                  ? "Faol mavzu"
                  : selectedProduct.id === "classic" ||
                      wallet?.owned.includes(selectedProduct.id as CoinTheme)
                    ? "Mavzuni yoqish"
                    : "Xaridni tasdiqlash",
              )}
            </button>
          </div>
        </Modal>
      )}
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
