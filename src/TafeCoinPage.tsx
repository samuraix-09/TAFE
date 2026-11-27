import { TafeCoinBadge, TafeCoinReward } from "./TafeCoinBadge";
import { useState } from "react";
import { Check, Crown, Palette } from "lucide-react";
import { localeTag, t } from "./i18n";
import { Feedback, rpc, useAction } from "./platform";

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
  const [confirmFocus, setConfirmFocus] = useState(false);
  async function refresh() {
    onChange(await rpc("tafe_coin_wallet"));
  }

  async function purchase(product: string) {
    await rpc("tafe_coin_purchase", {
      product,
      request_id: crypto.randomUUID(),
    });
    setConfirmFocus(false);
    await refresh();
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
        <div>
          <h2>{t("Tanga ishlab topish")}</h2>
          <ul>
            <li>
              {t("Har kuni birinchi kirish")} · <strong>+10</strong>
            </li>
            <li>
              {t("Kamida 10 ballik testda 50% yoki undan yuqori natija")} ·{" "}
              <strong>+10</strong>
            </li>
            <li>
              {t("Shu testda 80% yoki undan yuqori natija")} ·{" "}
              <strong>+15</strong>
            </li>
          </ul>
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
                <div className="coin-theme-preview" data-preview={theme.id}>
                  <Palette size={24} aria-hidden="true" />
                </div>
                <h3>{theme.title}</h3>
                <p className="muted">
                  {owned ? t("Sizda mavjud") : `${theme.price} TafeCoin`}
                </p>
                <button
                  disabled={
                    !wallet ||
                    action.busy ||
                    selected ||
                    (!owned && wallet.balance < theme.price)
                  }
                  onClick={() =>
                    void action.run(async () => {
                      if (owned) {
                        await rpc("set_tafe_coin_theme", { product: theme.id });
                        await refresh();
                      } else await purchase(theme.id);
                    }, "")
                  }
                >
                  {selected && <Check size={16} aria-hidden="true" />}
                  {t(
                    selected
                      ? "Faol mavzu"
                      : owned
                        ? "Mavzuni yoqish"
                        : "Sotib olish",
                  )}
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
            {confirmFocus && (
              <p>{t("Faol obuna bo‘lmasa, TAFE Focus darhol boshlanadi.")}</p>
            )}
            <button
              disabled={!wallet || action.busy || wallet.balance < focusPrice}
              onClick={() =>
                confirmFocus
                  ? void action.run(() => purchase("focus"), "")
                  : setConfirmFocus(true)
              }
            >
              {t(confirmFocus ? "Tasdiqlash" : "Sotib olish")}
            </button>
            {confirmFocus && (
              <button onClick={() => setConfirmFocus(false)}>
                {t("Bekor qilish")}
              </button>
            )}
          </article>
        </div>
      </section>
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
