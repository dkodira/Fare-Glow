import { NextResponse } from "next/server";
import { FARE_CURRENCIES, type SearchInput } from "@/lib/types";
import { getSerpApiAccount, searchLiveDeals } from "@/lib/serpapi";
import { authenticateRequest, getStoredSerpApiKey } from "@/lib/user-serpapi-key";

export const runtime = "nodejs";

function ownerMonthlyCap() {
  const configured = Number(process.env.SERPAPI_MONTHLY_BUDGET ?? 200);
  return Number.isFinite(configured) ? Math.max(1, Math.min(200, Math.floor(configured))) : 200;
}

function hasAirportCode(value: string) {
  return /^[A-Za-z]{3}$/.test(value.trim()) || /\([A-Za-z]{3}\)\s*$/.test(value.trim());
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export async function POST(request: Request) {
  let body: SearchInput;
  try {
    body = await request.json() as SearchInput;
  } catch {
    return NextResponse.json({ error: "Please check the deal search details and try again." }, { status: 400 });
  }

  const destinations = Array.isArray(body.destinations) && body.destinations.length ? body.destinations : typeof body.destination === "string" ? [body.destination] : [];
  if (typeof body.origin !== "string" || destinations.some(value => typeof value !== "string")) {
    return NextResponse.json({ error: "Choose a departure airport and up to five destination airports." }, { status: 400 });
  }
  const destinationCodes = destinations.map(value => value.match(/\(([A-Za-z]{3})\)\s*$/)?.[1]?.toUpperCase() ?? value.trim().toUpperCase());
  const originCode = body.origin?.match(/\(([A-Za-z]{3})\)\s*$/)?.[1]?.toUpperCase() ?? body.origin?.trim().toUpperCase();
  if (!originCode || !hasAirportCode(body.origin) || destinations.length < 1 || destinations.length > 5 || destinations.some(value => !value?.trim() || !hasAirportCode(value))) {
    return NextResponse.json({ error: "Choose a departure airport and up to five destination airports." }, { status: 400 });
  }
  if (new Set(destinationCodes).size !== destinationCodes.length || destinationCodes.includes(originCode)) {
    return NextResponse.json({ error: "Choose different destination airports from each other and from your departure airport." }, { status: 400 });
  }
  if (!body.dateFrom || !body.dateTo || !validDate(body.dateFrom) || !validDate(body.dateTo) || body.dateTo < body.dateFrom) {
    return NextResponse.json({ error: "Choose a valid travel date window." }, { status: 400 });
  }
  const dateSpan = (Date.parse(`${body.dateTo}T00:00:00Z`) - Date.parse(`${body.dateFrom}T00:00:00Z`)) / 86_400_000;
  if (dateSpan > 366 || !Number.isInteger(body.minNights) || !Number.isInteger(body.maxNights) || body.minNights < 1 || body.maxNights < body.minNights || body.maxNights > 240 || body.minNights > dateSpan + 1) {
    return NextResponse.json({ error: "Choose a valid date window and trip length." }, { status: 400 });
  }
  if (!Number.isInteger(body.travellers) || body.travellers < 1 || body.travellers > 9 || !FARE_CURRENCIES.some(({ code }) => code === body.currency)) {
    return NextResponse.json({ error: "Choose a supported currency and traveler count." }, { status: 400 });
  }

  try {
    const keyMode = process.env.SERPAPI_KEY_MODE ?? "owner";
    let apiKey = process.env.SERPAPI_API_KEY;
    let monthlyCap = ownerMonthlyCap();
    let cacheScope = "owner";
    let keySource = "Fare Glow's shared key";
    if (keyMode === "byok") {
      const identity = await authenticateRequest(request);
      if (!identity) return NextResponse.json({ error: "Sign in to use your own SerpApi key." }, { status: 401 });
      apiKey = (await getStoredSerpApiKey(identity.admin, identity.user.id)) ?? undefined;
      if (!apiKey) return NextResponse.json({ error: "Add your SerpApi key in account settings before searching." }, { status: 403 });
      monthlyCap = 250;
      cacheScope = identity.user.id;
      keySource = "your SerpApi key";
    } else if (keyMode === "owner") {
      if (request.headers.has("authorization")) {
        const identity = await authenticateRequest(request);
        if (!identity) return NextResponse.json({ error: "Please sign in again to use your saved SerpApi key." }, { status: 401 });
        const userApiKey = await getStoredSerpApiKey(identity.admin, identity.user.id);
        if (userApiKey) {
          apiKey = userApiKey;
          monthlyCap = 250;
          cacheScope = identity.user.id;
          keySource = "your SerpApi key";
        }
      }
    } else {
      return NextResponse.json({ error: "Fare Glow's SerpApi key mode is not configured correctly." }, { status: 503 });
    }
    if (!apiKey) return NextResponse.json({ error: "Live fares are not connected yet." }, { status: 503 });

    const search: SearchInput = { ...body, destination: destinations[0], destinations };
    const deals = await searchLiveDeals(search, destinations, { apiKey, cacheScope, monthlyCap });
    const account = await getSerpApiAccount(apiKey);
    const limit = Math.min(monthlyCap, account.searches_per_month ?? 250);
    const requestsRemaining = Math.max(0, limit - (account.this_month_usage ?? 0));
    return NextResponse.json({ deals, keySource, requestsRemaining });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Flights deals could not be checked.";
    const status = message.includes("not configured") || message.includes("not connected") ? 503 : message.includes("budget") ? 429 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
