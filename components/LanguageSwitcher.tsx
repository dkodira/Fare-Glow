"use client";

import { useLocale } from "@/components/LocaleProvider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <label className="language-switcher">
      <span className="visually-hidden">{locale === "fr" ? "Langue" : "Language"}</span>
      <select aria-label={locale === "fr" ? "Langue" : "Language"} value={locale} onChange={event => setLocale(event.target.value as "en" | "fr")}>
        <option value="en">English</option>
        <option value="fr">Français</option>
      </select>
    </label>
  );
}
