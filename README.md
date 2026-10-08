# Fare Glow

Fare Glow is a phone-first return-flight date finder for Canadian travellers. People choose a route, a date window that suits them, and how long they want to be away. The app ranks possible departure/return date pairs by total fare.

## Two SerpApi versions

Fare Glow supports two deployments from the same code. Choose a mode with the environment variables; for two public URLs, deploy the app twice and give each deployment its own environment settings.

### 1. Private version using your key

Set `SERPAPI_KEY_MODE=owner`, `NEXT_PUBLIC_SERPAPI_KEY_MODE=owner`, and `SERPAPI_API_KEY` in the server environment. The app uses your key for searches. It stops at `SERPAPI_MONTHLY_BUDGET` (default 200, hard maximum 200) to leave some of SerpApi's free-plan allowance unused. Do not put the key in a `NEXT_PUBLIC_` variable or browser code.

When Supabase server credentials and the encryption secret are configured, signed-in users can also open **API key** in the account menu and optionally connect their own key. Their searches then use their personal allowance; removing it returns them to the app's key. Without that optional account setup, the private owner-key search still works as before.

### 2. User version with personal keys

Set both mode variables to `byok`:

```env
SERPAPI_KEY_MODE=byok
NEXT_PUBLIC_SERPAPI_KEY_MODE=byok
```

For this deployment, connect Supabase email sign-in and set the server-only `SUPABASE_SERVICE_ROLE_KEY` and `FARE_GLOW_ENCRYPTION_KEY`. Apply the current `supabase/schema.sql` so the private key table exists. Generate the encryption secret with `openssl rand -hex 32`; store it as a deployment secret and keep a backup. Losing or changing it makes previously saved keys unreadable.

Users sign into Fare Glow, open **API key** beside their account, and paste the key from their own SerpApi account. Fare Glow checks the key, encrypts it on the server, and never returns it to the browser after saving. The key field is password-masked. Users can replace or remove their key in the same account panel. Their fare searches use their own SerpApi allowance, with Fare Glow enforcing a maximum of 250 searches in the current billing month for each account. Any searches they made elsewhere with that SerpApi key also consume its allowance; Fare Glow shows the remaining amount and will stop when it runs out. The user's SerpApi key is never used by another Fare Glow account.

This mode still needs a SerpApi account and key per user. Supabase login does not issue SerpApi quota. To use the free 250-search plan, each user must create a SerpApi account and supply their own key; SerpApi controls the plan and quota.

The private and personal-key deployments can run independently with different environment settings. Never set the service role key, encryption secret, or SerpApi key as a `NEXT_PUBLIC_` variable.

## Live flight searches

Fare Glow uses SerpApi's Google Flights engine for live round-trip fare searches. It checks up to eight date pairs at a time. When the chosen trip length permits, up to two pairs favor Monday departures with Tuesday/Wednesday returns, a market-wide pattern from Google's 2026 analysis; the other pairs stay spread across the user's date and trip-length ranges. This is only a heuristic, since route and season prices vary. Users can request more date pairs in later batches. Identical route/date/passenger queries are reused from a 55-minute in-memory cache; SerpApi also provides free caching for identical searches for one hour. The app reads SerpApi account usage before each uncached search and stops at the configured ceiling.

Fare Glow needs three-letter airport codes. Enter a code directly (such as `YYZ`) or in parentheses after a city (such as `Toronto (YYZ)`). Trip length is counted in calendar days, including the departure date, and can extend to eight approximate months. Month options use 30-day increments, so eight months is 240 inclusive days and returns 239 days after departure. Search results show the lowest round-trip price found among the checked date pairs, and link to Google Flights to confirm the itinerary and current fare. A sampled search can miss a cheaper date pair that has not been checked yet.

The cache is held in the running Next.js process, and uncached calls are serialized while Fare Glow checks account usage to avoid parallel searches crossing the configured ceiling. This is suitable for local use and a single server process; a multi-instance public deployment should move the cache and shared monthly budget guard into a shared database before opening it to many users.

The account and saved-search flow is prepared for Supabase. Price-alert records are included in the database schema, but scheduled live fare checks and alert emails are not active until a flight-price supplier and email sender are connected.

## Run on your computer

1. Install Node.js 20.9 or newer.
2. In this folder, run `npm install`.
3. Run `npm run dev` and open the local address shown in the terminal.

You can search using the preview fares without an account.

## Turn on accounts and saved searches

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in the project URL and public anon key from Supabase project settings.
3. In the Supabase SQL Editor, run `supabase/schema.sql`. This creates saved-search support and the encrypted-key table used by BYOK mode.
4. In Supabase Auth settings, enable email sign-in and set the app’s local and deployed URLs as allowed redirect URLs.
5. Restart the development server.

Saved searches are private to the signed-in account through row-level security. Searches store route, date window, trip-length range, traveler count, and alert preference. The fare itself is not saved as a promise; prices must be checked again when a search runs.

To enable the **API key** option in the account menu, retrieve the Supabase service role key from Project Settings → API Keys and create a 32-byte encryption secret with `openssl rand -hex 32`. Add both as server-only environment secrets. In owner mode these enable optional personal keys while keeping your server key as the fallback. To make personal keys required for all searches, deploy with both `SERPAPI_KEY_MODE` values set to `byok`.

## Price alerts

Price-alert preferences can be saved with an account, but automatic scheduled fare checks and email delivery are not active yet. They need a scheduled task and an email delivery service.
