# Fare Glow iPhone App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task after the shared API and website plan is accepted.

**Goal:** Add a native iPhone Fare Glow app that shares Supabase identity and server-held SerpApi keys with the website while keeping saved searches and search history iPhone-specific.

**Architecture:** Build a SwiftUI iOS target that calls the existing Next.js airports, offers, and provider-key endpoints. Use the Supabase Swift SDK for email-link and Google sign-in and for RLS-protected iPhone-only saved-search/history tables. The app stores only the user's Supabase session and ordinary search data; the SerpApi key remains encrypted on the server.

**Tech Stack:** SwiftUI, Swift Concurrency, Supabase Swift Package, existing Next.js JSON APIs, Supabase Postgres/RLS.

**Spec:** `docs/superpowers/specs/2026-11-08-fare-glow-cross-platform-design.md`

## Global Constraints

- Keep the app native SwiftUI; do not embed the website in a web view.
- Use the same Supabase user identity and personal SerpApi key as the website.
- Resolve the key on the server: the account key when connected, otherwise Fare Glow's general key in owner-key mode.
- Never return the personal SerpApi key to or store it in the iPhone client.
- Use the existing `/api/airports`, `/api/offers`, and `/api/provider-key` endpoints.
- Default to 8 date pairs and use Fare Glow's shared key unless the user has signed in and saved a personal key. Only a signed-in user with a saved personal key can select above 8, capped by candidate pairs and that key's remaining allowance; all server chunks remain at most 8.
- Show trip lengths as exact inclusive days from 1 through 240.
- Include existing search filters, sort options, Google Flights handoff, saved searches, history, and account/key settings.
- Sync signed-in iPhone saved searches and history across the user's iPhones in separate RLS-protected tables; keep signed-out history on-device.
- Use a system sans, comfortable touch targets, matching SF Symbols, sunrise backgrounds behind readable surfaces, and reduced-motion support.
- Use iOS deployment target 17.0, selected for broad SwiftUI availability while remaining compatible with the installed Xcode 26.6 toolchain.
- Do not add or run tests unless the user requests testing or verification.

## Review Focus

- Deep-link return from email and Google sign-in restores the Supabase session before authenticated API calls.
- The app's bearer token reaches the Next.js API, while the SerpApi secret never appears in app state or responses.
- Airport and fare API errors show actionable messages without clearing already returned results.
- Search count clamps to candidate and allowance limits and advances in bounded chunks without repeating dates.
- A shared-key or signed-out account cannot raise the count above 8 through the native UI or a direct API request.
- Signed-out history stays on-device; account lists sync across devices and stay separate from website saved searches/history.

---

## File Structure

- `ios/FareGlow.xcodeproj`: native iPhone app target and Supabase Swift package dependency.
- `ios/FareGlow/App`: app entry point, URL callback handling, configuration, and Sunrise theme.
- `ios/FareGlow/Models`: Codable search, advanced-filter, candidate-count, result, saved-search, and history models.
- `ios/FareGlow/Services`: Next.js API client and Supabase client/auth integration.
- `ios/FareGlow/Stores`: observable search, account, and history state.
- `ios/FareGlow/Views`: search form, airport picker, advanced filters, result list, settings, saved searches, and history.
- `supabase/migrations/20261108_add_ios_search_lists.sql`: iPhone-only saved-search/history tables and owner-only RLS policies.
- `README.md`: iOS configuration and Supabase redirect setup.

## Task 1: Create iPhone-only storage tables

**Files:**
- Create: `supabase/migrations/20261108_add_ios_search_lists.sql`

**Interfaces:**
- `ios_saved_searches`: `(user_id uuid, id text, created_at timestamptz, search_data jsonb)` with `(user_id, id)` primary key.
- `ios_search_history`: `(user_id uuid, id text, searched_at timestamptz, search_data jsonb, offers jsonb, checked_pairs integer, total_pairs integer)` with `(user_id, id)` primary key.
- Authenticated users can select/insert/update/delete rows only where `auth.uid() = user_id`.

- [x] Add idempotent table/index/policy creation for these two tables, separate from website saved-search/history tables.
- [x] Review that deleting a Supabase user cascades to these rows and RLS prevents cross-account access.

## Task 2: Scaffold the SwiftUI target and configuration

**Files:**
- Create: `ios/FareGlow.xcodeproj/project.pbxproj`
- Create: `ios/FareGlow/App/FareGlowApp.swift`
- Create: `ios/FareGlow/App/AppConfiguration.swift`
- Create: `ios/FareGlow/App/SunriseTheme.swift`
- Create: `ios/FareGlow/Info.plist`

- [x] Create the iOS 17.0 target and add the Supabase Swift Package dependency.
- [x] Read public API base URL, Supabase URL, and anon key from app configuration; never add service-role, encryption, or SerpApi secrets.
- [x] Register a `fareglow://auth-callback` URL scheme and forward callback URLs to Supabase auth.
- [x] Add reusable Sunrise colors, typography, and SF Symbol treatment.

## Task 3: Add models, auth, and API clients

**Files:**
- Create: `ios/FareGlow/Models/FareSearch.swift`
- Create: `ios/FareGlow/Models/FlightOffer.swift`
- Create: `ios/FareGlow/Models/SearchHistory.swift`
- Create: `ios/FareGlow/Services/SupabaseService.swift`
- Create: `ios/FareGlow/Services/FareGlowAPI.swift`

**Interfaces:**
- `FareSearch.candidatePairCount: Int` counts valid inclusive departure/return pairs for the current window and day range.
- `FareGlowAPI.airports(query: String) async throws -> [Airport]`
- `FareGlowAPI.search(search: FareSearch, startAt: Int, limit: Int) async throws -> SearchChunk`
- `FareGlowAPI.usageAllowance() async throws -> SearchAllowance` reads `GET /api/offers` and returns `requestsRemaining` plus `keySource`.
- `FareGlowAPI.providerKeyStatus() async throws -> ProviderKeyStatus`
- `FareGlowAPI.saveProviderKey(_ key: String) async throws -> ProviderKeyStatus`
- `FareGlowAPI.removeProviderKey() async throws`
- All authenticated API calls use the active Supabase access token in `Authorization: Bearer …`.

- [x] Mirror the JSON field names and advanced-filter values expected by the existing TypeScript API.
- [x] Implement airport, search-chunk, usage, and provider-key calls with structured non-2xx errors.
- [x] Implement email OTP and Google OAuth with Supabase's native auth flow and the registered callback URL.
- [x] Keep the SerpApi key only in the secure entry form until the server accepts it; clear the field after save.

## Task 4: Build the full search form and airport flow

**Files:**
- Create: `ios/FareGlow/Stores/SearchStore.swift`
- Create: `ios/FareGlow/Views/SearchView.swift`
- Create: `ios/FareGlow/Views/AirportPicker.swift`
- Create: `ios/FareGlow/Views/AdvancedFiltersView.swift`

- [x] Add origin/destination autocomplete, three-letter airport support, and route swapping.
- [x] Add date window, 1–240 inclusive trip days, travelers, currency, and selectable pairs-per-request control.
- [x] Add every current advanced filter: stops, carry-on bags, airline include/exclude, maximum price, outbound/return time, maximum duration, layover length, cabin, sort order, excluded connection airports, and lower-emissions preference.
- [x] Compute candidate count using the same inclusive-day rules as the API; default the count to 8. Without a saved personal key, cap it at 8 and use the shared key. With a personal key, allow higher counts up to candidate and quota limits. Preserve it for “Check more dates”.
- [x] Use native keyboard, focus, VoiceOver labels, and touch-target behavior.

## Task 5: Add results, bounded progress, and Google Flights handoff

**Files:**
- Modify: `ios/FareGlow/Stores/SearchStore.swift`
- Create: `ios/FareGlow/Views/ResultsView.swift`

- [x] Request at most eight candidates per API call until the user-selected count is satisfied or the server reports quota exhaustion.
- [x] Merge and sort results after each chunk; show checked/target progress and retain earlier fares on a later error.
- [x] Show fare, date pair, duration, stops, and Google Flights booking link for every offer.
- [x] Support “Check more dates” using the server cursor without repeating candidate pairs.

## Task 6: Add account settings and separate saved-search/history flows

**Files:**
- Create: `ios/FareGlow/Stores/AccountStore.swift`
- Create: `ios/FareGlow/Stores/HistoryStore.swift`
- Create: `ios/FareGlow/Views/AccountView.swift`
- Create: `ios/FareGlow/Views/SavedSearchesView.swift`
- Create: `ios/FareGlow/Views/SearchHistoryView.swift`

- [x] Add email-link and Google sign-in, sign-out, API-key status, replace, and remove flows.
- [x] Use `ios_saved_searches` and `ios_search_history` for signed-in data, with the active user ID and Supabase RLS.
- [x] Keep signed-out history on-device and never merge iPhone lists into website tables.
- [x] Store selected pair count in saved-search/history JSON; older local records default to 8.

## Task 7: Finish navigation, visual behavior, and setup notes

**Files:**
- Modify: `ios/FareGlow/App/FareGlowApp.swift`
- Modify: `README.md`

- [x] Connect search, results, account, saved searches, and history in the native navigation flow.
- [x] Add restrained state transitions and honor `accessibilityReduceMotion`.
- [x] Document app configuration, `fareglow://auth-callback` Supabase redirect, new migration, and deployment URL setup.
- [x] Review the full feature list against the spec and confirm no website-only list is shared with iPhone.
