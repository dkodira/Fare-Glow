"use client";

import { useLocale } from "@/components/LocaleProvider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <label className="language-switcher">
      <span className="visually-hidden">{locale === "fr" ? "Langue" : "Language"}</span>
      <svg className="language-icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7.25" />
        <path d="M2.9 10h14.2M10 2.75c2 2 3 4.4 3 7.25s-1 5.25-3 7.25c-2-2-3-4.4-3-7.25s1-5.25 3-7.25Z" />
      </svg>
      <select aria-label={locale === "fr" ? "Langue" : "Language"} value={locale} onChange={event => setLocale(event.target.value as "en" | "fr")}>
        <option value="en">English</option>
        <option value="fr">Français</option>
      </select>
      <svg className="language-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>
    </label>
  );
}
