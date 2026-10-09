import type { AdvancedFilters, FlightOffer, SearchInput } from "@/lib/types";

type Candidate = { outboundDate: string; returnDate: string };
type SerpFlightSegment = {
  departure_airport?: { id?: string; time?: string };
  arrival_airport?: { id?: string; time?: string };
  duration?: number;
};
type SerpFlight = {
  flights?: SerpFlightSegment[];
  price?: number;
  total_duration?: number;
  carbon_emissions?: { this_flight?: number };
};
type SerpSearchResponse = {
  error?: string;
  best_flights?: SerpFlight[];
  other_flights?: SerpFlight[];
};
export type SerpAccount = {
  account_status?: string;
  plan_searches_left?: number;
  searches_per_month?: number;
  this_month_usage?: number;
};

const MAX_BATCH_SIZE = 8;
const CACHE_TTL_MS = 55 * 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; offers: FlightOffer[] }>();
const inFlight = new Map<string, Promise<FlightOffer[]>>();
let budgetQueue: Promise<void> = Promise.resolve();

async function withBudgetLock<T>(operation: () => Promise<T>) {
  const previous = budgetQueue;
  let release!: () => void;
  budgetQueue = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try { return await operation(); }
  finally { release(); }
}

function dateAtOffset(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(first: string, last: string) {
  return Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000);
}

function buildCandidates(input: SearchInput): Candidate[] {
  const span = daysBetween(input.dateFrom, input.dateTo);
  const valid: Candidate[] = [];
  for (let departureOffset = 0; departureOffset <= span; departureOffset += 1) {
    for (let tripDays = input.minNights; tripDays <= input.maxNights; tripDays += 1) {
      // Count the departure date as day 1, so a 30-day trip spans 29 nights.
      const returnOffset = departureOffset + tripDays - 1;
      if (returnOffset <= span) {
        valid.push({ outboundDate: dateAtOffset(input.dateFrom, departureOffset), returnDate: dateAtOffset(input.dateFrom, returnOffset) });
      }
    }
  }

  if (valid.length <= MAX_BATCH_SIZE) return valid;

  // Two slots may favor a weekday pattern reported by Google's 2026 flight
  // analysis. The other slots keep broad date and trip-length coverage because
  // route and season often matter more than a market-wide weekday average.
  const stayMidpoint = Math.round((input.minNights + input.maxNights) / 2);
  const selected: Candidate[] = [];
  const used = new Set<string>();
  const keyOf = (candidate: Candidate) => `${candidate.outboundDate}|${candidate.returnDate}`;

  function addClosest(departureFraction: number, targetNights: number, preferredWeekdaysOnly = false) {
    if (selected.length >= MAX_BATCH_SIZE) return;
    const targetOffset = span * departureFraction;
    const best = valid
      .filter(candidate => {
        if (used.has(keyOf(candidate))) return false;
        if (!preferredWeekdaysOnly) return true;
        const departureWeekday = new Date(`${candidate.outboundDate}T00:00:00Z`).getUTCDay();
        const returnWeekday = new Date(`${candidate.returnDate}T00:00:00Z`).getUTCDay();
        return departureWeekday === 1 && (returnWeekday === 2 || returnWeekday === 3);
      })
      .sort((a, b) => {
        const score = (candidate: Candidate) => {
          const departureOffset = daysBetween(input.dateFrom, candidate.outboundDate);
          const tripDays = daysBetween(candidate.outboundDate, candidate.returnDate) + 1;
          return Math.abs(departureOffset - targetOffset) / Math.max(span, 1) + Math.abs(tripDays - targetNights) / Math.max(input.maxNights - input.minNights, 1);
        };
        return score(a) - score(b);
      })[0];
    if (best) { selected.push(best); used.add(keyOf(best)); }
  }

  // Monday out with a Tuesday/Wednesday return is a modest market-wide prior,
  // not a guarantee. Only use it when it fits the trip length and date window.
  addClosest(0.25, stayMidpoint, true);
  addClosest(0.75, stayMidpoint, true);
  // Keep the remaining checks spread from the beginning through the end.
  addClosest(0, input.minNights);
  addClosest(0.5, stayMidpoint);
  addClosest(1, input.maxNights);
  for (const [departureFraction, targetNights] of [[0.25, input.maxNights], [0.75, input.minNights], [0.5, input.minNights], [0.5, input.maxNights]] as const) {
    if (selected.length >= MAX_BATCH_SIZE) break;
    addClosest(departureFraction, targetNights);
  }

  return [...selected, ...valid.filter(candidate => !used.has(keyOf(candidate)))];
}

function airportCode(value: string) {
  const parenthesized = value.match(/\(([A-Za-z]{3})\)\s*$/);
  if (parenthesized) return parenthesized[1].toUpperCase();
  if (/^[A-Za-z]{3}$/.test(value.trim())) return value.trim().toUpperCase();
  return null;
}

function getBudgetCap() {
  const configured = Number(process.env.SERPAPI_MONTHLY_BUDGET ?? 200);
  return Number.isFinite(configured) ? Math.max(1, Math.min(200, Math.floor(configured))) : 200;
}

export async function getSerpApiAccount(apiKey: string): Promise<SerpAccount> {
  const url = new URL("https://serpapi.com/account.json");
  url.searchParams.set("api_key", apiKey);
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const data = await response.json() as SerpAccount & { error?: string };
  if (!response.ok || data.error) throw new Error(data.error || "Could not read SerpApi account usage.");
  if (!Number.isFinite(data.this_month_usage)) throw new Error("SerpApi did not return monthly usage; search stopped to protect your free quota.");
  return data;
}

function totalDuration(flight: SerpFlight) {
  const minutes = (flight.flights ?? []).reduce((total, segment) => total + (segment.duration ?? 0), 0);
  if (!minutes) return "See itinerary";
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function flightTime(segment?: SerpFlightSegment) {
  const raw = segment?.departure_airport?.time;
  if (!raw) return "See itinerary";
  const match = raw.match(/[ T](\d{2}):(\d{2})/);
  if (!match) return "See itinerary";
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

function timeValue(raw?: string) { return raw ? Date.parse(raw) || 0 : 0; }

function mapFlights(data: SerpSearchResponse, input: SearchInput, candidate: Candidate): FlightOffer[] {
  const advanced = input.advanced;
  const flights = [...(data.best_flights ?? []), ...(data.other_flights ?? [])]
    .filter(flight => Number.isFinite(flight.price) && (flight.price ?? 0) > 0)
    .sort((a, b) => sortFlights(a, b, advanced?.sortBy ?? 2));
  const cheapest = flights[0];
  if (!cheapest) return [];

  const segments = cheapest.flights ?? [];
  const origin = airportCode(input.origin)!;
  const destination = airportCode(input.destination)!;
  const googleLink = new URL("https://www.google.com/travel/flights");
  googleLink.searchParams.set("q", `round trip flights from ${origin} to ${destination} leaving ${candidate.outboundDate} returning ${candidate.returnDate}`);
  googleLink.searchParams.set("hl", "en");
  googleLink.searchParams.set("gl", "CA");
  googleLink.searchParams.set("curr", input.currency);

  return [{
    id: `${candidate.outboundDate}-${candidate.returnDate}`,
    departureDate: candidate.outboundDate,
    returnDate: candidate.returnDate,
    price: Math.round(cheapest.price ?? 0),
    outboundTime: flightTime(segments[0]),
    outboundStops: Math.max(0, segments.length - 1),
    duration: totalDuration(cheapest),
    arrivalTime: flightTime(segments.length ? { departure_airport: segments[segments.length - 1].arrival_airport } : undefined),
    durationMinutes: cheapest.total_duration ?? segments.reduce((sum, segment) => sum + (segment.duration ?? 0), 0),
    emissionsGrams: cheapest.carbon_emissions?.this_flight,
    source: "Google Flights",
    bookingUrl: googleLink.toString(),
  }];
}

function sortFlights(a: SerpFlight, b: SerpFlight, sortBy: number) {
  if (sortBy === 1) return 0;
  if (sortBy === 3) return (Date.parse(a.flights?.[0]?.departure_airport?.time ?? "") || 0) - (Date.parse(b.flights?.[0]?.departure_airport?.time ?? "") || 0);
  if (sortBy === 4) return (Date.parse(a.flights?.[Math.max(0, (a.flights?.length ?? 1) - 1)]?.arrival_airport?.time ?? "") || 0) - (Date.parse(b.flights?.[Math.max(0, (b.flights?.length ?? 1) - 1)]?.arrival_airport?.time ?? "") || 0);
  if (sortBy === 5) return (a.total_duration ?? Infinity) - (b.total_duration ?? Infinity);
  if (sortBy === 6) return (a.carbon_emissions?.this_flight ?? Infinity) - (b.carbon_emissions?.this_flight ?? Infinity);
  return (a.price ?? Infinity) - (b.price ?? Infinity);
}

function addAdvancedParams(url: URL, advanced?: AdvancedFilters) {
  if (!advanced) return;
  const stops = { any: "0", nonstop: "1", one: "2", two: "3" }[advanced.stops];
  if (stops !== "0") url.searchParams.set("stops", stops);
  if (advanced.carryOn > 0) url.searchParams.set("bags", String(advanced.carryOn));
  if (advanced.airlines.length && advanced.airlineMode !== "any") {
    url.searchParams.set(advanced.airlineMode === "include" ? "include_airlines" : "exclude_airlines", advanced.airlines.join(","));
  }
  if (Number(advanced.maxPrice) > 0) url.searchParams.set("max_price", String(Math.floor(Number(advanced.maxPrice))));
  if (advanced.outboundTime) url.searchParams.set("outbound_times", `${advanced.outboundTime},${advanced.outboundTime}`);
  if (advanced.returnTime) url.searchParams.set("return_times", `${advanced.returnTime},${advanced.returnTime}`);
  if (advanced.maxDuration > 0) url.searchParams.set("max_duration", String(advanced.maxDuration));
  if (advanced.layover) url.searchParams.set("layover_duration", advanced.layover);
  if (advanced.excludedAirports.length) url.searchParams.set("exclude_conns", advanced.excludedAirports.join(","));
  if (advanced.cabin > 1) url.searchParams.set("travel_class", String(advanced.cabin));
  if (advanced.sortBy > 1) url.searchParams.set("sort_by", String(advanced.sortBy));
  if (advanced.lowEmissions) url.searchParams.set("emissions", "1");
}

async function searchPair(input: SearchInput, candidate: Candidate, apiKey: string, cacheScope: string, monthlyCap: number): Promise<FlightOffer[]> {
  const origin = airportCode(input.origin)!;
  const destination = airportCode(input.destination)!;
  const key = [cacheScope, origin, destination, candidate.outboundDate, candidate.returnDate, input.travellers, input.currency, JSON.stringify(input.advanced ?? {})].join("|");
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.offers;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = withBudgetLock(async () => {
    const account = await getSerpApiAccount(apiKey);
    const monthlyUsage = account.this_month_usage ?? 0;
    const actualPlanLimit = account.searches_per_month ?? 250;
    const allowedSearchCount = Math.min(monthlyCap, actualPlanLimit);
    if (monthlyUsage >= allowedSearchCount || (account.plan_searches_left !== undefined && account.plan_searches_left <= 0)) {
      throw new Error("Fare Glow has reached its SerpApi search budget for this month. Try again when the allowance renews.");
    }

    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_flights");
    url.searchParams.set("departure_id", origin);
    url.searchParams.set("arrival_id", destination);
    url.searchParams.set("outbound_date", candidate.outboundDate);
    url.searchParams.set("return_date", candidate.returnDate);
    url.searchParams.set("type", "1");
    url.searchParams.set("adults", String(input.travellers));
    url.searchParams.set("currency", input.currency);
    url.searchParams.set("gl", "ca");
    url.searchParams.set("hl", "en");
    addAdvancedParams(url, input.advanced);
    url.searchParams.set("api_key", apiKey);

    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
    const data = await response.json() as SerpSearchResponse;
    if (!response.ok || data.error) throw new Error(data.error || "SerpApi could not search that date pair.");
    const offers = mapFlights(data, input, candidate);
    responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, offers });
    return offers;
  });

  inFlight.set(key, request);
  try { return await request; }
  finally { inFlight.delete(key); }
}

export async function searchLiveOffers(input: SearchInput, batch: number, options?: { apiKey?: string; cacheScope?: string; monthlyCap?: number }) {
  const apiKey = options?.apiKey ?? process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new Error("Live fares are not connected yet. Add SERPAPI_API_KEY to .env.local, then restart Fare Glow.");
  const cacheScope = options?.cacheScope ?? "owner";
  const monthlyCap = options?.monthlyCap ?? getBudgetCap();
  const allCandidates = buildCandidates(input);
  const offset = batch * MAX_BATCH_SIZE;
  const candidates = allCandidates.slice(offset, offset + MAX_BATCH_SIZE);
  const offers: FlightOffer[] = [];
  let checked = 0;
  let budgetReached = false;

  for (const candidate of candidates) {
    try {
      offers.push(...await searchPair(input, candidate, apiKey, cacheScope, monthlyCap));
      checked += 1;
    } catch (error) {
      if (error instanceof Error && error.message.includes("search budget")) {
        budgetReached = true;
        break;
      }
      throw error;
    }
  }

  let usageRemaining: number | null = null;
  try {
    const account = await getSerpApiAccount(apiKey);
    usageRemaining = Math.max(0, Math.min(monthlyCap, account.searches_per_month ?? 250) - (account.this_month_usage ?? 0));
  } catch {
    // The search itself may have succeeded. Do not hide fares if the optional usage refresh fails.
  }

  const moreAvailable = !budgetReached && offset + candidates.length < allCandidates.length;
  return {
    offers: offers.sort((a, b) => {
      switch (input.advanced?.sortBy) {
        case 1: return 0;
        case 3: return timeValue(`${a.departureDate} ${a.outboundTime}`) - timeValue(`${b.departureDate} ${b.outboundTime}`);
        case 4: return timeValue(`${a.departureDate} ${a.arrivalTime ?? ""}`) - timeValue(`${b.departureDate} ${b.arrivalTime ?? ""}`);
        case 5: return (a.durationMinutes ?? parseDuration(a.duration)) - (b.durationMinutes ?? parseDuration(b.duration));
        case 6: return (a.emissionsGrams ?? Infinity) - (b.emissionsGrams ?? Infinity);
        default: return a.price - b.price;
      }
    }),
    checked,
    totalCandidates: allCandidates.length,
    nextBatch: batch + 1,
    moreAvailable,
    budgetReached,
    usageRemaining,
  };
}

function parseDuration(value: string) {
  const match = value.match(/(\d+)h\s*(\d+)m/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Infinity;
}
