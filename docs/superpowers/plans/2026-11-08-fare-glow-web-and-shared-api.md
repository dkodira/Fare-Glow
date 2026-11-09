# Fare Glow Website and Shared API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the existing Fare Glow website in the Sunrise editorial style and add configurable date-pair search counts while preserving every current route and search capability.

**Architecture:** Keep Next.js, React, and the current server-side SerpApi key resolution. Add a backward-compatible request-count preference and bounded eight-pair API chunks, with the website coordinating chunks and displaying progress. Persist the preference with saved searches and history; keep the inclusive 1–240 day trip range.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase JS, CSS, Lucide React.

**Spec:** `docs/superpowers/specs/2026-11-08-fare-glow-cross-platform-design.md`

## Global Constraints

- Default the date-pair count to 8.
- Without a saved personal SerpApi key, cap the selectable count at 8 and use Fare Glow’s shared key. Only a signed-in user with a saved personal key can select above 8; their range is 1 through the lower of candidate pairs and their key's remaining allowance.
- Keep the selected count fixed for a search and its “Check more dates” requests.
- Keep requests without the new count field at the existing eight-pair behavior.
- Resolve the account-linked SerpApi key server-side when present; retain the configured shared key fallback in owner-key mode.
- Count the departure date as day one; allow exact whole-day trip lengths from 1 through 240.
- Keep current validation, candidate ordering, cache, key resolution, monthly caps, and partial results when the budget is reached.
- Preserve every existing website route, search field, filter, account capability, page, and results action.
- Keep English and French localization, keyboard access, readable contrast, and reduced-motion support.
- Do not add or run tests unless the user requests testing or verification.

## Review Focus

- Legacy API requests and saved/history records without a count still use 8.
- Candidate ranges shorter than the selected count clamp the control and never index past the candidates.
- Unauthenticated requests and signed-in accounts without a personal key cannot bypass the eight-pair ceiling by sending a larger count directly to the API.
- Quota that changes after the control loads stops the search safely while preserving fares already found.
- A transport/provider error during a later chunk leaves earlier chunk results visible and the progress state recoverable.
- Restoring old saved searches or history supplies the default count without changing existing fields.

---

## File Structure

- `lib/types.ts`: shared search and result shapes.
- `lib/search-candidate-count.ts`: pure inclusive-date candidate-count calculation used by the route and website.
- `lib/serpapi.ts`: candidate selection, quota-aware bounded search chunks, and response progress metadata.
- `app/api/offers/route.ts`: legacy-compatible request validation and chunk selection.
- `supabase/schema.sql` and a new migration: saved-search count storage for new and existing deployments.
- `app/page.tsx`: search count, exact-day trip control, chunk progress, restore/save behavior, and editorial layout.
- `lib/i18n.ts`: French strings and dynamic day/count phrases.
- `app/innovative.css`, `app/globals.css`, `app/sunrise.css`, `app/layout.tsx`, `app/how-it-works/page.tsx`, `app/feedback/page.tsx`: Sunrise palette, shared icon style, responsive layouts, and motion behavior.
- `package.json` and `package-lock.json`: Lucide React dependency.
- `README.md`: migration and behavior notes.

## Task 1: Add the request-count preference and saved-search migration

**Files:**
- Modify: `lib/types.ts`
- Modify: `supabase/schema.sql`
- Create: `supabase/migrations/20261108_add_pairs_per_request.sql`

**Interfaces:**
- `SearchInput.pairsPerRequest` is an optional integer on the wire; current UI state uses 8 by default.
- Existing `saved_searches` rows gain `pairs_per_request integer not null default 8 check (pairs_per_request between 1 and 250)`; live selection is still bounded by the candidate count and current account allowance.

- [x] Add the optional request field and update saved-search schema for new installs.
- [x] Add an idempotent migration that adds the defaulted column to existing saved searches without rewriting other fields.
- [x] Review SQL and types against the old row shape; records with no saved value resolve to 8 in the page.

## Task 2: Support bounded, quota-aware search chunks

**Files:**
- Create: `lib/search-candidate-count.ts`
- Modify: `lib/serpapi.ts`
- Modify: `app/api/offers/route.ts`

**Interfaces:**
- `countCandidatePairs(input: Pick<SearchInput, "dateFrom" | "dateTo" | "minNights" | "maxNights">): number` returns the number of legal inclusive departure/return pairs.
- New clients send `startAt` and `limit` for a chunk; `limit` is 1–8. Requests omitting both fields retain `batch * 8` offset and limit 8.
- `searchLiveOffers` returns `nextOffset`, `totalCandidates`, `checked`, `moreAvailable`, `budgetReached`, `usageRemaining`, and offers.

- [x] Calculate the candidate count with the same inclusive-day rules used by `buildCandidates`.
- [x] Validate `pairsPerRequest` as an integer from 1 through the candidate count; default missing values to 8. Reject values above 8 unless request authentication resolves a saved personal SerpApi key for that user.
- [x] Validate explicit chunk offsets and limits, rejecting invalid ranges before SerpApi calls.
- [x] Keep candidate searches sequential under the existing quota lock; stop at the remaining quota and return all fares already found.
- [x] Return a cursor that advances only past successfully checked candidates, so clients can merge chunks and resume safely.
- [x] Review old `batch` request behavior and ensure no new field is required for existing callers.

## Task 3: Add configurable counts, progress, and saved preference restore

**Files:**
- Modify: `app/page.tsx`
- Modify: `lib/i18n.ts`

**Interfaces:**
- Search state carries `pairsPerRequest` with default 8.
- Without a saved personal key, the control defaults to 8 and cannot exceed 8 (or the candidate count if fewer pairs exist); Fare Glow's shared key is used. With a saved personal key, the maximum is `min(candidatePairCount, usageRemaining)` when allowance is known; while allowance is loading, it is bounded by candidate count and the server remains authoritative. The selected value stays fixed for subsequent “Check more dates” chunks, even when fewer than that number remain.
- The form sends sequential requests of at most 8 pairs until the selected count is reached, updates visible progress after each response, and keeps prior chunk results on later errors.
- `saved_searches.pairs_per_request` and `SearchInput.pairsPerRequest` history data restore the same selection; missing legacy values restore to 8.

- [x] Replace the old eight-pair-only helper copy with the selected-count behavior.
- [x] Add the count control, dynamically clamp it when dates, trip length, allowance, sign-in, or personal-key status changes; cap shared-key users at 8 and preserve the chosen count for subsequent date searches.
- [x] Change trip-length options to every whole day from 1 to 240 and remove month labels and 30-day jumps.
- [x] Coordinate bounded API chunks with live progress, cursor, merged offers, budget messaging, and history updates.
- [x] Add the count to new saved searches and restore it with a backward-compatible fallback of 8.
- [x] Add English/French copy for the new control and progress states.
- [x] Review all existing filters, saved-search fields, account history, and search actions remain present.

## Task 4: Apply the Sunrise editorial website design

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`, `app/innovative.css`, `app/layout.tsx`
- Create: `app/sunrise.css`
- Modify: `app/how-it-works/page.tsx`, `app/feedback/page.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Keep current Next.js routes and the existing `LocalizedContent` behavior.
- Use Lucide outline icons on the website and retain the current form/result data contracts.

- [x] Add Lucide React and replace mixed glyph/custom icon treatments with a consistent outline icon family.
- [x] Recompose the desktop home hero beside the search form; use the compact search-first order on narrow screens.
- [x] Apply warm cream/parchment surfaces, coral actions, slate-blue text, sky/sage accents, and restrained sunrise gradients behind opaque form surfaces.
- [x] Restyle form, advanced filters, result cards, saved/history sections, feedback page, explainer page, account dialogs, and footer in the same system.
- [x] Add short state transitions and disable nonessential motion under `prefers-reduced-motion`.
- [x] Review contrast, focus visibility, keyboard operation, and mobile form text/touch targets.

## Task 5: Update setup documentation

**Files:**
- Modify: `README.md`

- [x] Explain the new saved-search migration and the request-count default, candidate/quota bounds, and eight-pair server chunking.
- [x] Keep the existing SerpApi and Supabase key-handling guidance intact.
