import type { CSSProperties } from "react";
import {
  BookOpen,
  Compass,
  Flame,
  GraduationCap,
  Moon,
  Mountain,
  Rocket,
  Sparkles,
  Sun,
  Target,
  Trophy,
} from "lucide-react";
import type { CoinExtra } from "./coin-extras";

const badgeIcons = [BookOpen, Trophy, Sun, Moon, Compass, Target];
const dashboardIcons = [Rocket, Target, Compass, Flame, BookOpen, Mountain];
const patterns = [
  "repeating-linear-gradient(125deg, transparent 0 18px, var(--coin-extra-tint) 18px 21px)",
  "radial-gradient(ellipse at right top, var(--coin-extra-tint), transparent 60%)",
  "repeating-radial-gradient(ellipse at 80% 15%, var(--coin-extra-tint) 0 1px, transparent 2px 22px)",
  "radial-gradient(circle at 20% 20%, var(--coin-extra-tint), transparent 50%)",
  "radial-gradient(circle, var(--coin-extra-tint) 1px, transparent 2px) 0 0 / 16px 16px",
  "repeating-linear-gradient(0deg, var(--coin-extra-tint) 0 2px, transparent 2px 15px)",
];

export function decorationStyle(item: CoinExtra): CSSProperties {
  return {
    "--coin-extra-color": item.color,
    "--coin-extra-tint": item.color + "55",
    "--coin-extra-pattern": patterns[item.variant],
  } as CSSProperties;
}

export function CoinDecoration({
  item,
  sample,
  animate,
}: {
  item: CoinExtra;
  sample?: boolean;
  animate?: boolean;
}) {
  const Icon =
    item.category === "badge"
      ? badgeIcons[item.variant]
      : item.category === "dashboard"
        ? dashboardIcons[item.variant]
        : Sparkles;
  return (
    <span
      className={sample ? "coin-decoration-sample" : "coin-decoration"}
      data-kind={item.category}
      data-variant={item.variant}
      data-animate={animate || undefined}
      style={decorationStyle(item)}
      aria-hidden={sample ? true : undefined}
      title={sample ? undefined : item.name}
    >
      {item.category === "frame" ? (
        <span className="coin-frame-demo">
          <GraduationCap size={24} />
        </span>
      ) : (
        <Icon size={sample ? 28 : 18} />
      )}
    </span>
  );
}
