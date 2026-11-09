import { useSyncExternalStore } from "react";
import translations from "./translations.json";

export type Locale = "uz" | "en" | "ru";

const catalog: Record<string, Record<Locale, string> | undefined> =
  translations;
const tags: Record<Locale, string> = { uz: "uz-UZ", en: "en", ru: "ru-RU" };
const listeners = new Set<() => void>();
export const isLocale = (value: unknown): value is Locale =>
  value === "uz" || value === "en" || value === "ru";

const saved = localStorage.getItem("tafe-locale");
let locale: Locale = isLocale(saved) ? saved : "uz";
document.documentElement.lang = locale;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const getLocale = () => locale;
export const localeTag = () => tags[locale];
export const useLocale = () => useSyncExternalStore(subscribe, getLocale);

export function setLocale(next: Locale) {
  if (locale === next) return;
  locale = next;
  document.documentElement.lang = next;
  localStorage.setItem("tafe-locale", next);
  for (const listener of listeners) listener();
}

export function t(source: string) {
  const key = source.trim().replace(/\s+/g, " ");
  const numbered = key.match(/^Savol (\d+): (.+)$/);
  const translated = numbered
    ? catalog[`Savol {number}: ${numbered[2]}`]?.[locale]?.replace(
        "{number}",
        numbered[1],
      )
    : catalog[key]?.[locale];
  return translated === undefined
    ? source
    : source.replace(/\S[\s\S]*\S|\S/, translated);
}

export function LanguagePicker({
  onChange = setLocale,
}: {
  onChange?: (locale: Locale) => void;
}) {
  const language = useLocale();
  return (
    <select
      className="language-picker"
      aria-label={t("Til")}
      value={language}
      onChange={(event) => {
        if (isLocale(event.target.value)) onChange(event.target.value);
      }}
    >
      <option value="uz" lang="uz">
        O‘zbekcha
      </option>
      <option value="en" lang="en">
        English
      </option>
      <option value="ru" lang="ru">
        Русский
      </option>
    </select>
  );
}
