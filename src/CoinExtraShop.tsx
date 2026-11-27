import { useState } from "react";
import { Eye } from "lucide-react";
import { coinExtras, type CoinExtra, type ExtraCategory } from "./coin-extras";
import type { CoinWallet } from "./TafeCoinPage";
import { CoinDecoration } from "./CoinDecoration";
import { t } from "./i18n";
import { Feedback, Modal, rpc, useAction } from "./platform";

const categories: Record<ExtraCategory, string> = {
  scene: "Kabinet fonlari",
  badge: "Profil nishonlari",
  frame: "Avatar ramkalari",
  effect: "Mukofot animatsiyalari",
  dashboard: "Bosh sahifa bezaklari",
};

export function CoinExtraShop({
  wallet,
  onChange,
}: {
  wallet: CoinWallet | null;
  onChange: (wallet: CoinWallet) => void;
}) {
  const [category, setCategory] = useState<ExtraCategory>("scene");
  const [selected, setSelected] = useState<CoinExtra>();
  const [preview, setPreview] = useState(0);
  const action = useAction();
  const owns = (item: CoinExtra) =>
    Boolean(wallet?.extra_owned?.includes(item.id));
  const isEquipped = (item: CoinExtra) =>
    wallet?.equipped?.[item.category] === item.id;

  return (
    <section className="coin-extra-shop">
      <h2>{t("Maxsus kolleksiya")}</h2>
      <div className="coin-category-filters" aria-label={t("Kategoriya")}>
        {(Object.keys(categories) as ExtraCategory[]).map((key) => (
          <button
            key={key}
            aria-pressed={category === key}
            onClick={() => setCategory(key)}
          >
            {t(categories[key])}
          </button>
        ))}
      </div>
      <div className="coin-shop">
        {coinExtras
          .filter((item) => item.category === category)
          .map((item) => (
            <article className="coin-product" key={item.id}>
              <CoinDecoration item={item} sample />
              <h3>{item.name}</h3>
              <p className="muted">
                {owns(item) ? t("Sizda mavjud") : `${item.price} TafeCoin`}
              </p>
              <button
                onClick={() => {
                  action.clear();
                  setSelected(item);
                }}
              >
                <Eye size={16} aria-hidden="true" /> {t("Batafsil ko‘rish")}
              </button>
            </article>
          ))}
      </div>
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(undefined)}>
          <div className="coin-product-details">
            <CoinDecoration
              key={preview}
              item={selected}
              sample
              animate={selected.category === "effect"}
            />
            <p>
              {t(categories[selected.category])} ·{" "}
              {owns(selected)
                ? t("Sizda mavjud")
                : `${selected.price} TafeCoin`}
            </p>
            {selected.category === "effect" && (
              <button onClick={() => setPreview((n) => n + 1)}>
                {t("Animatsiyani ko‘rish")}
              </button>
            )}
            <Feedback error={action.error} />
            <button
              className="primary"
              disabled={
                !wallet ||
                action.busy ||
                (!owns(selected) && wallet.balance < selected.price)
              }
              onClick={() =>
                void action.run(async () => {
                  if (owns(selected)) {
                    await rpc("equip_tafe_coin_extra", {
                      item_id: selected.id,
                      enabled: !isEquipped(selected),
                    });
                  } else {
                    await rpc("buy_tafe_coin_extra", { item_id: selected.id });
                  }
                  onChange(await rpc("tafe_coin_wallet"));
                }, "")
              }
            >
              {t(
                !owns(selected)
                  ? "Xaridni tasdiqlash"
                  : isEquipped(selected)
                    ? "O‘chirish"
                    : "Faollashtirish",
              )}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
