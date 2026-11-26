import { ArrowUpRight } from "lucide-react";
import { t } from "./i18n";

export function PlanPurchaseLink({ planName }: { planName: string }) {
  return (
    <a
      className="button-link primary plan-purchase-link"
      href="https://t.me/darspro_admin"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${planName} · ${t("Telegram orqali sotib olish")}`}
    >
      {t("Sotib olish")}
      <ArrowUpRight aria-hidden="true" size={16} />
    </a>
  );
}
