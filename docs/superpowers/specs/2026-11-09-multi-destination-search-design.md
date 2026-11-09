# Multi-Destination Fare Search

**Status:** Implemented locally; production build passes.

## Intent

Help travelers compare several possible destinations from one origin over the same flexible date window. The user chooses a total number of date-pair searches; Fare Glow distributes that total as evenly as possible across the selected destinations and shows which destination produced the lowest sampled fare.

## Scope and behavior

- Website search only for this change; the iPhone app is not changed.
- Keep one origin and add destination airport rows with a plus button. Extra rows can be removed. Limit the form to five destinations total.
- Use the existing airport autocomplete for every row. Require distinct destination airport codes and keep the current origin, date window, trip length, passengers, currency, and advanced filters shared across destinations.
- Treat the selected date-pair amount as the total for one search action, across all destinations. Divide evenly; give any remainder to earlier rows. For example, 8 pairs across 3 destinations becomes 3, 3, and 2.
- Require at least one pair per destination. The add button may raise the selected total to the new number of destinations when allowance and candidate dates permit; otherwise it remains disabled with an explanation.
- Search destinations sequentially through the existing single-destination API, in chunks of no more than eight pairs. This keeps existing shared-key/personal-key enforcement and limits request concurrency.
- Show one results group per destination, ordered by the lowest fare found in that group. Keep offers, checked counts, and follow-up date cursors associated with their destination. Explain that the comparison is based on sampled pairs.
- “Check more dates” requests another evenly split total batch and resumes each destination at its own cursor. Preserve partial results if a later destination fails.
- Save and restore all destinations. Keep the existing `destination` field for older website clients and add a `destinations` text-array column through a migration. Store destinations in the existing JSON search history, with a fallback to `destination` for old records.
- After the initial fare search, make one supplementary Google Flights Deals request with the same SerpApi key and budget controls. Match deals by exact arrival airport code, and show SerpApi's deal fare, average fare, and returned percentage below average. Keep deal data separate from sampled date-pair offers because its dates may differ. Missing or failed deal data must not hide route fares.

## Approaches

- **Plus-button rows (chosen):** Reuses the site's accessible airport autocomplete, makes each location visible and removable, and fits the existing single-route form.
- **Multi-select chips:** More compact, but makes repeated airport lookup and editing less obvious on narrow screens.
- **Comma-separated text:** Requires the least UI work but makes airport validation and correction harder.

## Implementation choices

- Fan out requests from the website to the existing endpoint, one destination at a time. Each request carries that destination's allocation and cursor; the server remains the authority for key ownership and monthly allowance.
- Sort destination summaries by best observed price, with input order as a stable tie-breaker. Keep each group's offers in the user's selected existing sort order.
- Persist a maximum of five destinations as an interface bound; five is enough for a useful shortlist while keeping comparison and progress readable.

## Non-goals

- Multiple origins, multi-city itineraries, nearby-airport radius searches, or itinerary optimization.
- Changes to the iPhone app or SerpApi key policy. The supplementary Deals lookup uses one additional SerpApi search for an initial multi-destination search.
- Guaranteeing the global cheapest fare; the results remain a sample of date pairs.
