"use client";

import { cloneElement, createContext, Fragment, isValidElement, type ReactElement, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { translateText, type Locale } from "@/lib/i18n";

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; ready: boolean };
const LocaleContext = createContext<LocaleContextValue>({ locale: "en", setLocale: () => undefined, ready: false });
const LOCALE_STORAGE_KEY = "fare-glow-locale-v1";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (savedLocale === "en" || savedLocale === "fr") setLocaleState(savedLocale);
    } catch { /* Keep English if browser storage is unavailable. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try { window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale); }
    catch { /* The selected language still applies for this page session. */ }
  }, []);

  return <LocaleContext.Provider value={{ locale, setLocale, ready }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

function localizeNode(node: ReactNode, locale: Locale): ReactNode {
  if (typeof node === "string") return translateText(node, locale);
  if (typeof node === "number" || node === null || node === undefined || typeof node === "boolean") return node;
  if (Array.isArray(node)) return node.map(child => localizeNode(child, locale));
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<Record<string, unknown>>;
  const props = element.props;
  if (props["data-no-translate"] !== undefined) return element;
  if (typeof element.type !== "string" && element.type !== Fragment) return element;

  const localizedProps: Record<string, unknown> = { ...props };
  for (const attribute of ["aria-label", "aria-description", "placeholder", "title", "alt"]) {
    const value = localizedProps[attribute];
    if (typeof value === "string") localizedProps[attribute] = translateText(value, locale);
  }
  if ("children" in localizedProps) localizedProps.children = localizeNode(localizedProps.children as ReactNode, locale);
  return cloneElement(element, localizedProps);
}

export function LocalizedContent({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  return <>{localizeNode(children, locale)}</>;
}
