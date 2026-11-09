# Fare Glow Website and iPhone Design

**Status:** Draft for approval
**Date:** 2026-11-08

## Intent

Keep Fare Glow’s existing flight-finding website fully usable, refresh its visual design, and add a native iPhone app. The website and app use the same Fare Glow account and personal SerpApi credential. Both platforms gain a selectable number of date pairs per search request and trip lengths shown in days throughout.

## Goals

- Preserve every current website capability and route while changing its presentation.
- Add a native SwiftUI iPhone app for the existing Fare Glow search flow.
- Use the same Supabase sign-in and account-linked personal SerpApi key on web and iPhone.
- If a signed-in user has not added a personal SerpApi key, route searches through Fare Glow’s configured general key. A personal key overrides it for that account on either platform.
- Let users choose how many return-date pairs each search request checks. Default to 8. Only a signed-in user with their own SerpApi key saved in Fare Glow can increase the count above 8; everyone else uses Fare Glow’s configured shared key and stays at 8 or fewer.
- Allow the selected search count to reach the user’s remaining SerpApi quota, bounded by the remaining candidate date pairs.
- Sync iPhone saved searches and search history across the user’s iPhones while keeping those lists separate from the website’s lists.
- Show trip length as days, including for trips longer than 30 days, using one-day increments throughout the existing 1–240 day range.
- Use the Sunrise editorial palette from the visual exploration, with simpler type, clearer form placement, a shared icon style, atmospheric backgrounds, and restrained transitions.

## Approaches

1. **Native SwiftUI app using the existing Fare Glow services — selected.** The iPhone app has a native interface and calls the existing Next.js API. Supabase remains the shared identity and personal-key store. The website remains the existing Next.js app and receives the visual and search-option updates. This reuses the current fare-search and quota logic without embedding a web page in iOS.
2. **Package the website in a web-view app.** This reuses the browser interface, but would feel less native and makes it harder to use iOS navigation, controls, and transitions well.
3. **Build a separate iPhone backend.** This could be independently tuned for mobile, but would duplicate account, key-resolution, quota, and flight-search behavior and make regressions more likely.

The user chose the native SwiftUI approach.

## Product behavior

### Search count

- Add a whole-number **Date pairs per request** control to the website and iPhone search forms.
- Default the value to 8, matching the current batch size.
- Selectable range for a signed-in user with a saved personal SerpApi key: 1 through the lower of the remaining candidate date pairs and that key’s remaining allowance. Do not add a fixed 20-pair ceiling. Without a saved personal key, cap the selectable range at 8 and use Fare Glow’s configured shared key. If the allowance runs out, keep results already found and show the existing budget state.
- Keep the selected count fixed for the duration of a search, including **Check more dates** requests. Store it with search history and newly saved website searches so restoring a search preserves its setting. Add a `pairs_per_request` field with a default of 8 to the existing saved-search schema; existing records without this field behave as 8.
- Keep the API backward compatible: requests without the new field continue to use 8.
- Show progress for larger selected counts. The implementation may split one user-initiated search into bounded server calls, as long as the UI checks no more than the selected count and never exceeds the remaining quota.

### Trip length

- Keep the current inclusive day-count behavior, where the departure date is day one.
- Expose exact whole-day values from 1 through 240 in both platforms. Remove month wording and 30-day jumps from the website selector.
- Keep minimum and maximum trip length validation, the current 240-day ceiling, and the requirement that the date window can contain the minimum trip length.

### Accounts and keys

- Use the same Supabase user identity on both platforms. Support the existing email sign-in link and Google sign-in where configured.
- Associate one personal SerpApi key with the shared user account. Adding or replacing it on either platform makes it available on the other.
- Continue storing the personal key encrypted on the server. Never return it to or store it in the iPhone client.
- Resolve the key on the server: personal key when connected, otherwise Fare Glow’s general key in owner-key mode.
- Only allow a request count above 8 when the authenticated account has a saved personal SerpApi key; enforce this on the server as well as in both clients.
- Preserve existing monthly budget limits, usage display, and budget stops.

### Native iPhone app

- Use SwiftUI and the shared Next.js endpoints for airports, fare searches, and key status/management.
- Include the complete fare-search workflow: origin and destination with airport suggestions and route swap; date window; trip length; travelers; currency; advanced filters; results and sorting; more-date batches; booking links; account/key settings; saved searches; and search history.
- Keep iPhone saved searches and search history separate from the website’s lists, as indicated by the earlier request not to share saved searches. Store signed-in iPhone lists in separate Supabase tables with row-level security so they sync across the same user’s iPhones. Keep signed-out history on-device. The shared account and personal API key remain account-based.
- Keep flight booking on the existing Google Flights handoff. Fare Glow does not sell or reserve tickets.

## Visual direction

- **Palette:** warm cream and parchment surfaces, sunrise coral as the main action color, deep slate-blue text, pale sky and sage accents, and a restrained golden glow.
- **Layout:** use the Editorial composition on wide website screens, placing a concise headline beside the search form. On narrow screens and iPhone, use the Compact search-first composition so the route and date controls appear quickly. This is my design call; the user chose the Sunrise palette but did not select a layout variant.
- **Typography:** one clean system sans family across platforms, with a moderate heading scale, readable field labels, and 15–16 pt form values on iPhone. Avoid the oversized headline and tiny labels in the first visual exploration.
- **Backgrounds:** layered sunrise/horizon gradients and lightweight decorative shapes, implemented in CSS and SwiftUI. Keep them behind opaque form surfaces so the form remains easy to read and fast to load.
- **Icons:** use a consistent outline style, with Lucide on the website and matching SF Symbols in the native app. Keep icons simple, legible, and paired with text labels for important actions.
- **Transitions:** use short, purposeful transitions when advanced filters expand, search states change, and results appear. Respect the user’s reduced-motion setting and avoid constant animation that competes with search or affects performance.
- Keep English and French localization, readable contrast, keyboard access on web, and comfortable touch targets on iPhone.

## Existing website capabilities to preserve

The redesign and shared API change must not remove or weaken any current behavior:

- Airport suggestions and three-letter airport validation, route swapping, travel windows, travelers, and supported currencies.
- All existing advanced search filters: stops, carry-on bags, airline inclusion/exclusion, maximum price, outbound and return times, maximum duration, layover length, cabin, offer sorting, excluded connection airports, and lower-emissions preference.
- Live Google Flights/SerpApi searches, candidate selection, cache behavior, budget checks, usage remaining display, result details, booking links, and checking more date pairs.
- Supabase sign-in, encrypted personal-key management, owner-key fallback, account saved searches and their existing preference fields, and account or device search history.
- Rotating airfare tips, English/French switching, the how-it-works page, community feedback page, and existing validation, loading, empty, and error states.

The changes are additive. Existing API callers and saved records without a request-count value retain the current eight-pair behavior. Existing website saved-search and history data stays intact. No existing website route, search field, filter, account capability, page, or results action is removed or disabled by the redesign.

## Non-goals

- No new booking or payment flow.
- No automatic scheduled price-alert service; it is not active today.
- No separate iPhone fare-search backend or separate account system.
- No migration of website saved searches into the iPhone app.
- No change to the current airport/date search limits or fare provider.

## Constraints

- Website stack remains Next.js/React and its current API routes.
- iPhone app is a native SwiftUI target in the existing repository.
- Supabase auth and the server-side encrypted user-key table remain the source of account and key state.
- Search-pair count is validated server-side and cannot exceed candidate dates or remaining quota.
- The current website keeps its URL routes and database records. Add backward-compatible migrations for the saved-search count and iPhone-only saved-search/history tables; do not rewrite or delete existing search data.

## Calls left to the builder

- Select the exact iOS deployment target supported by the available Xcode toolchain.
- Choose native SwiftUI components and SF Symbol names that best match the approved website icon family.
- Implement larger user-selected counts with bounded server work and visible progress; never exceed the selected count or remaining quota.
