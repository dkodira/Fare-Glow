import { NextResponse } from "next/server";
import type { SearchInput } from "@/lib/types";
import { searchLiveOffers } from "@/lib/serpapi";
import { authenticateRequest, getStoredSerpApiKey } from "@/lib/user-serpapi-key";

export const runtime = "nodejs";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function hasAirportCode(value: string) {
  return /^[A-Za-z]{3}$/.test(value.trim()) || /\([A-Za-z]{3}\)\s*$/.test(value.trim());
}

export async function POST(request: Request) {
  let body: SearchInput & { batch?: number };
  try {
    body = await request.json() as SearchInput & { batch?: number };
  } catch {
    return NextResponse.json({ error: "Please check the search details and try again." }, { status: 400 });
  }

  const { origin, destination, dateFrom, dateTo, minNights, maxNights, travellers } = body;
  if (!origin?.trim() || !destination?.trim() || !dateFrom || !dateTo || dateTo < dateFrom || !isValidDate(dateFrom) || !isValidDate(dateTo)) {
    return NextResponse.json({ error: "Enter a starting place, destination, and a valid date range." }, { status: 400 });
  }
  if (!hasAirportCode(origin) || !hasAirportCode(destination)) {
    return NextResponse.json({ error: "For live fares, include a 3-letter airport code, such as Toronto (YYZ) or Vancouver (YVR)." }, { status: 400 });
  }
  if (origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
    return NextResponse.json({ error: "Choose two different places." }, { status: 400 });
  }
  if (!Number.isInteger(minNights) || !Number.isInteger(maxNights) || minNights < 1 || maxNights < minNights || maxNights > 240) {
    return NextResponse.json({ error: "Choose a trip length between 1 day and 8 months (240 days), counting the departure day." }, { status: 400 });
  }
  if (!Number.isInteger(travellers) || travellers < 1 || travellers > 9) {
    return NextResponse.json({ error: "Choose between 1 and 9 adult travelers." }, { status: 400 });
  }
  const dateSpan = (Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86_400_000;
  if (dateSpan > 366) {
    return NextResponse.json({ error: "Choose a travel window of one year or less." }, { status: 400 });
  }
  if (minNights > dateSpan + 1) {
    return NextResponse.json({ error: "Your travel window must be at least as long as your minimum trip length." }, { status: 400 });
  }
  const batch = body.batch ?? 0;
  if (!Number.isInteger(batch) || batch < 0 || batch > 100) {
    return NextResponse.json({ error: "That date batch is not valid." }, { status: 400 });
  }

  try {
    const keyMode = process.env.SERPAPI_KEY_MODE ?? "owner";
    let keyOptions: { apiKey?: string; cacheScope?: string; monthlyCap?: number } = {};
    if (keyMode === "byok") {
      const identity = await authenticateRequest(request);
      if (!identity) return NextResponse.json({ error: "Sign in to use your own SerpApi key." }, { status: 401 });
      const apiKey = await getStoredSerpApiKey(identity.admin, identity.user.id);
      if (!apiKey) return NextResponse.json({ error: "Add your SerpApi key in account settings before searching." }, { status: 403 });
      keyOptions = { apiKey, cacheScope: identity.user.id, monthlyCap: 250 };
    } else if (keyMode === "owner") {
      // In owner mode a signed-in user may choose to use their own key from
      // account settings. If they have not added one, use the owner's key.
      if (request.headers.has("authorization")) {
        const identity = await authenticateRequest(request);
        if (!identity) return NextResponse.json({ error: "Please sign in again to use your saved SerpApi key." }, { status: 401 });
        const userApiKey = await getStoredSerpApiKey(identity.admin, identity.user.id);
        if (userApiKey) keyOptions = { apiKey: userApiKey, cacheScope: identity.user.id, monthlyCap: 250 };
      }
    } else {
      return NextResponse.json({ error: "Fare Glow's SerpApi key mode is not configured correctly." }, { status: 503 });
    }
    const result = await searchLiveOffers(body, batch, keyOptions);
    return NextResponse.json({ ...result, mode: "live" as const });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live fares could not be checked. Please try again.";
    const status = message.includes("not configured") || message.includes("not connected") ? 503 : message.includes("budget") ? 429 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
