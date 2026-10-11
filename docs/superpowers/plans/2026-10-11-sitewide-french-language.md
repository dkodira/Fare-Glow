# Site-wide French Language Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent English/French selector and translate Fare Glow-authored interface text on the search, How it works, and Feedback pages.

**Architecture:** Add an app-level client locale provider and a small typed message dictionary. A shared selector updates the provider and local storage; pages read the selected locale to render their own translations. The provider updates the document language after client initialization, with English as the server-rendered default.

**Tech Stack:** Next.js App Router, React 19, TypeScript, browser local storage, `Intl` locale formatting.

**Spec:** `docs/superpowers/specs/2026-10-11-sitewide-french-language-design.md`

## Global Constraints

- Support only `en` and `fr`; default to `en`.
- Persist the locale on the current device and preserve it across routes and reloads.
- Translate app-owned UI copy; preserve user-authored feedback, user-entered airport names, and airport/airline names.
- Do not call an external machine translation service.
- Keep the selector keyboard-operable and expose an accessible name.
- Format Fare Glow-generated dates using the active locale.

## Review Focus

- A missing, malformed, or unavailable local storage value must leave the app in English without breaking hydration.
- Changing locale while on each route must update the current page and persist when navigating or reloading.
- Dynamic counts, prices, and date values must retain their values while translated surrounding copy uses correct French wording.
- User-generated feedback and airport/airline names must remain unchanged when switching languages.
- Long French labels must remain usable in the existing compact top navigation and mobile layouts.

---

### Task 1: Add shared locale state and language selector

**Files:**
- Create: `lib/i18n.ts`
- Create: `components/LocaleProvider.tsx`
- Create: `components/LanguageSwitcher.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- `Locale` is the union type `"en" | "fr"`.
- `useLocale()` returns `{ locale: Locale; setLocale: (locale: Locale) => void; ready: boolean }`.
- `LanguageSwitcher` consumes `useLocale()` and renders a native accessible select with English and Français options.
- The message dictionary exports the English and French copy needed by the three page tasks; use named, typed sections per page and a common navigation/footer section.

- [ ] Add the typed locale and message dictionary structure in `lib/i18n.ts`; include shared navigation and footer strings.
- [ ] Add the app-level provider in `components/LocaleProvider.tsx`; initialize to English, read only supported values from `localStorage` after mount, persist changes, expose the context hook, and update `document.documentElement.lang` when ready.
- [ ] Add the native `LanguageSwitcher` in `components/LanguageSwitcher.tsx`, labeled “Language” in English and “Langue” in French; show “English” and “Français” as option labels.
- [ ] Wrap `RootLayout` children in `LocaleProvider` while preserving the server-rendered `lang="en"` default.
- [ ] Add focused styles for the compact selector and verify the existing topbar layout remains responsive.

### Task 2: Translate the flight search page

**Files:**
- Modify: `lib/i18n.ts`
- Modify: `app/page.tsx`
- Modify: `app/globals.css` only if translated search-page text needs a targeted layout adjustment.

**Interfaces:**
- Use the search-page message section defined in Task 1.
- Import and render `LanguageSwitcher` from Task 1 in the existing top-right actions.
- Read `locale` and `ready` from `useLocale()`; use `locale` for date/time formatting and `ready` only where needed to avoid reading browser state during server render.

- [ ] Add French and English messages for all search-page-owned text: search controls, filters, help and demo copy, results, saved history, account and API-key dialog, loading/empty/error/status messages, and footer.
- [ ] Replace hard-coded search-page UI strings with the typed messages, preserving dynamic values through interpolation and leaving user-entered values, airport/airline names, and prices unchanged.
- [ ] Add the language selector to the search page’s top-right actions.
- [ ] Format app-generated dates and date/time strings with `fr-CA` in French and the existing English locale in English.

### Task 3: Translate How it works and Feedback pages

**Files:**
- Modify: `lib/i18n.ts`
- Modify: `app/how-it-works/page.tsx`
- Modify: `app/feedback/page.tsx`
- Modify: `app/globals.css` only if translated copy needs a targeted layout adjustment.

**Interfaces:**
- Use the shared message sections and locale context from Task 1.
- Both pages render `LanguageSwitcher` in their top-right actions.
- Keep feedback categories and submitted user content stored in their current form; translate only surrounding labels and app-generated state messages.

- [ ] Add French and English messages for all How it works headings, descriptions, workflow copy, navigation, and footer.
- [ ] Replace hard-coded How it works UI strings with the messages and add the shared selector.
- [ ] Add French and English messages for Feedback form labels, option labels, notices, loading/error/empty states, feedback-board labels, navigation, and footer.
- [ ] Replace hard-coded Feedback UI strings with the messages and add the shared selector; leave feedback post contents untouched.
- [ ] Format feedback dates with `fr-CA` when French is active and `en-CA` when English is active.

### Task 4: Review localization completeness and integration

**Files:**
- Review: `lib/i18n.ts`
- Review: `app/page.tsx`
- Review: `app/how-it-works/page.tsx`
- Review: `app/feedback/page.tsx`
- Review: `app/layout.tsx`

- [ ] Search the three page components for remaining user-visible English copy and add any missed app-authored strings to the dictionaries.
- [ ] Confirm every dictionary key used by the pages has both English and French values and every required spec acceptance criterion maps to an implementation.
- [ ] Review local storage initialization, document language updates, route persistence, preserved user content, and translated layout behavior against the spec.
