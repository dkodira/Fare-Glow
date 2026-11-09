# Multi-Destination Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let website users compare up to five destinations while distributing each selected total date-pair batch evenly across them.

**Architecture:** Keep the existing one-destination offers API and fan out from the website sequentially. Add a shared allocation helper, associate returned offers and cursors with destinations, and persist destination arrays while retaining the legacy single-destination field. Make one budget-checked Google Flights Deals lookup after each initial search, then match its average-fare discount data to selected arrival airports.

**Tech Stack:** Next.js App Router, React/TypeScript, Supabase Postgres.

**Spec:** `docs/superpowers/specs/2026-11-09-multi-destination-search-design.md`

## Global Constraints

- Web experience only; do not change the iPhone app.
- One origin, at most five distinct destination airport codes, one shared date/filter/passenger/currency configuration.
- The selected date-pair count is total across destinations; divide evenly and assign remainders in row order.
- Each fare-search server call checks at most eight pairs; the existing server controls shared-key and personal-key access. The separate deals lookup consumes one additional SerpApi search.
- Preserve old searches that only have `destination` and old history records without `destinations`.
- Do not add or run tests; run the production build as compile verification.

## File Map

- `lib/types.ts`: optional destination list and destination identity on offers.
- `lib/distribute-date-pairs.ts`: deterministic even allocation and next-batch allocation within per-destination remaining capacity.
- `app/page.tsx`: plus/remove destination rows; sequential search fan-out; grouped/ranked results; per-destination continuation cursors; saved/history restore.
- `app/api/deals/route.ts`, `lib/serpapi.ts`: budget-checked deals lookup with destination airport matching and one-hour provider caching.
- `app/sunrise.css`: responsive row controls and destination result groups.
- `supabase/migrations/20261109_add_saved_search_destinations.sql`: add/backfill the destination array while retaining the old column.
- `lib/i18n.ts`, `README.md`: copy and setup notes.

## Tasks

### 1. Model destination allocation and persistence

- [x] Add allocation helpers for first batches and follow-up batches, including remainder order and exhausted destinations.
- [x] Extend types so old single-destination searches remain valid and offers can retain their destination.
- [x] Add the SQL migration: `destinations text[] not null default '{}'`, backfilled from `destination` where empty.

### 2. Add multiple destination rows

- [x] Render the existing airport autocomplete for each destination row.
- [x] Add an accessible plus control beside the destination label, remove controls on added rows, a five-destination limit, and duplicate-code prevention.
- [x] Keep the total pair selector valid when the row count changes; explain any allocation or allowance limit.

### 3. Search and compare destinations

- [x] Allocate the total batch across destinations, search sequentially in server-sized chunks, and track separate cursors and checked counts.
- [x] Preserve completed groups on later errors and expose total progress.
- [x] Render destination groups sorted by their lowest observed fare, with each offer labeled by destination and the sampling caveat visible.
- [x] Make “Check more dates” continue with another even total allocation.
- [x] Add average fare and provider-reported percentage-below-average deal cards when an exact destination airport match is returned.

### 4. Preserve saved searches and history

- [x] Save and restore destination arrays while retaining `destination` as the first selected value for compatibility.
- [x] Persist destination identity on history offers; restore old history with only one destination.
- [x] Update English/French labels and setup documentation.

### 5. Verify and record

- [x] Run `npm run build` from `codex/` and record the result.
- [x] Inspect the final diff for accidental secrets and confirm the worktree scope. No secret files were staged.
