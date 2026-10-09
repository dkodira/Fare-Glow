"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { FARE_CURRENCIES, type AdvancedFilters, type FareCurrency, type FlightOffer, type SearchInput } from "@/lib/types";

type SavedSearch = { id: string; origin: string; destination: string; date_from: string; date_to: string; min_nights: number; max_nights: number; travellers: number };
type SearchHistoryItem = { id: string; searchedAt: string; search: SearchInput; offers: FlightOffer[]; checked: number; total: number };
type SearchHistoryRow = { id: string; searched_at: string; search_data: SearchInput; offers: FlightOffer[]; checked_pairs: number; total_pairs: number };
const HISTORY_STORAGE_KEY = "fare-glow-search-history-v1";
const bookingTips = [
  { title: "Tuesday booking myth:", text: "Google’s 2025 U.S. data found booking on Tuesday averaged just 1.3% less than Sunday. Search whenever it suits you." },
  { title: "Your travel day matters more.", text: "In that same U.S. data, Monday–Wednesday flights averaged about 13% less than weekend flights. Your route and season may differ." },
  { title: "Consider a connection.", text: "Layovers can reduce fares on average. Compare the savings with the longer trip and any extra airport costs." },
  { title: "Compare the full price.", text: "Add baggage and seat-selection fees before choosing. A low starting fare may not be the lowest total." },
  { title: "Treat fares as snapshots.", text: "Prices and seat availability can change. Confirm the exact return itinerary and total with the booking site before paying." },
  { title: "Search more dates for a wider view.", text: "Fare Glow checks up to 8 return date pairs per batch. Use “Check more dates” to compare additional options." },
];

const today = new Date();
const addDays = (date: Date, count: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const defaultSearch: SearchInput = {
  origin: "",
  destination: "",
  currency: "CAD",
  dateFrom: iso(addDays(today, 28)),
  dateTo: iso(addDays(today, 70)),
  minNights: 3,
  maxNights: 10,
  travellers: 1,
  advanced: { stops: "any", carryOn: 0, airlineMode: "any", airlines: [], maxPrice: "", outboundTime: "", returnTime: "", maxDuration: 0, layover: "", excludedAirports: [], cabin: 1, sortBy: 2, lowEmissions: false },
};
const airlineOptions = [
  ["AC", "Air Canada"], ["WS", "WestJet"], ["PD", "Porter Airlines"], ["TS", "Air Transat"], ["F8", "Flair Airlines"],
  ["AA", "American Airlines"], ["UA", "United Airlines"], ["DL", "Delta Air Lines"], ["AS", "Alaska Airlines"], ["BA", "British Airways"],
  ["AF", "Air France"], ["KL", "KLM"], ["LH", "Lufthansa"], ["EK", "Emirates"], ["QR", "Qatar Airways"], ["NH", "ANA"], ["JL", "Japan Airlines"],
];
const timeOptions = [["", "Any time"], ["4,7", "Early morning · 4–8am"], ["8,11", "Morning · 8am–noon"], ["12,15", "Afternoon · noon–4pm"], ["16,19", "Evening · 4–8pm"], ["20,23", "Late evening · 8pm–midnight"]];
const defaultAdvanced: AdvancedFilters = defaultSearch.advanced!;
function clockMinutes(value: string) {
  const match = value.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return hour * 60 + Number(match[2]);
}
const tripLengthOptions = [
  ...Array.from({ length: 30 }, (_, index) => {
    const days = index + 1;
    return { value: days, label: days === 30 ? "30 days (about 1 month)" : `${days} day${days === 1 ? "" : "s"}` };
  }),
  ...Array.from({ length: 7 }, (_, index) => {
    const months = index + 2;
    return { value: months * 30, label: `${months} months (about ${months * 30} days)` };
  }),
];

const airportOptions = [
  { city: "Toronto", name: "Toronto Pearson International", code: "YYZ", country: "Canada" },
  { city: "Toronto", name: "Billy Bishop Toronto City", code: "YTZ", country: "Canada" },
  { city: "Vancouver", name: "Vancouver International", code: "YVR", country: "Canada" },
  { city: "Montréal", name: "Montréal–Trudeau International", code: "YUL", country: "Canada" },
  { city: "Calgary", name: "Calgary International", code: "YYC", country: "Canada" },
  { city: "Edmonton", name: "Edmonton International", code: "YEG", country: "Canada" },
  { city: "Ottawa", name: "Ottawa International", code: "YOW", country: "Canada" },
  { city: "Winnipeg", name: "Winnipeg Richardson International", code: "YWG", country: "Canada" },
  { city: "Halifax", name: "Halifax Stanfield International", code: "YHZ", country: "Canada" },
  { city: "Québec City", name: "Québec City Jean Lesage International", code: "YQB", country: "Canada" },
  { city: "Victoria", name: "Victoria International", code: "YYJ", country: "Canada" },
  { city: "Kelowna", name: "Kelowna International", code: "YLW", country: "Canada" },
  { city: "Abbotsford", name: "Abbotsford International", code: "YXX", country: "Canada" },
  { city: "Hamilton", name: "John C. Munro Hamilton International", code: "YHM", country: "Canada" },
  { city: "Waterloo", name: "Region of Waterloo International", code: "YKF", country: "Canada" },
  { city: "London, Ontario", name: "London International", code: "YXU", country: "Canada" },
  { city: "Saskatoon", name: "Saskatoon John G. Diefenbaker International", code: "YXE", country: "Canada" },
  { city: "Regina", name: "Regina International", code: "YQR", country: "Canada" },
  { city: "St. John's", name: "St. John's International", code: "YYT", country: "Canada" },
  { city: "Moncton", name: "Greater Moncton Roméo LeBlanc International", code: "YQM", country: "Canada" },
  { city: "Fredericton", name: "Fredericton International", code: "YFC", country: "Canada" },
  { city: "Saint John", name: "Saint John Airport", code: "YSJ", country: "Canada" },
  { city: "Thunder Bay", name: "Thunder Bay International", code: "YQT", country: "Canada" },
  { city: "Charlottetown", name: "Charlottetown Airport", code: "YYG", country: "Canada" },
  { city: "Gander", name: "Gander International", code: "YQX", country: "Canada" },
  { city: "Deer Lake", name: "Deer Lake Regional", code: "YDF", country: "Canada" },
  { city: "Yellowknife", name: "Yellowknife Airport", code: "YZF", country: "Canada" },
  { city: "Whitehorse", name: "Erik Nielsen Whitehorse International", code: "YXY", country: "Canada" },
  { city: "Iqaluit", name: "Iqaluit Airport", code: "YFB", country: "Canada" },
  { city: "Prince George", name: "Prince George Airport", code: "YXS", country: "Canada" },
  { city: "New York", name: "John F. Kennedy International", code: "JFK", country: "United States" },
  { city: "New York", name: "Newark Liberty International", code: "EWR", country: "United States" },
  { city: "New York", name: "LaGuardia Airport", code: "LGA", country: "United States" },
  { city: "Boston", name: "Logan International", code: "BOS", country: "United States" },
  { city: "Chicago", name: "O'Hare International", code: "ORD", country: "United States" },
  { city: "Los Angeles", name: "Los Angeles International", code: "LAX", country: "United States" },
  { city: "San Francisco", name: "San Francisco International", code: "SFO", country: "United States" },
  { city: "Seattle", name: "Seattle–Tacoma International", code: "SEA", country: "United States" },
  { city: "Las Vegas", name: "Harry Reid International", code: "LAS", country: "United States" },
  { city: "Orlando", name: "Orlando International", code: "MCO", country: "United States" },
  { city: "Miami", name: "Miami International", code: "MIA", country: "United States" },
  { city: "Atlanta", name: "Hartsfield–Jackson Atlanta International", code: "ATL", country: "United States" },
  { city: "Dallas", name: "Dallas Fort Worth International", code: "DFW", country: "United States" },
  { city: "Denver", name: "Denver International", code: "DEN", country: "United States" },
  { city: "London", name: "Heathrow Airport", code: "LHR", country: "United Kingdom" },
  { city: "London", name: "Gatwick Airport", code: "LGW", country: "United Kingdom" },
  { city: "Paris", name: "Charles de Gaulle Airport", code: "CDG", country: "France" },
  { city: "Amsterdam", name: "Amsterdam Airport Schiphol", code: "AMS", country: "Netherlands" },
  { city: "Rome", name: "Leonardo da Vinci–Fiumicino Airport", code: "FCO", country: "Italy" },
  { city: "Lisbon", name: "Humberto Delgado Airport", code: "LIS", country: "Portugal" },
  { city: "Dubai", name: "Dubai International", code: "DXB", country: "United Arab Emirates" },
  { city: "Tokyo", name: "Haneda Airport", code: "HND", country: "Japan" },
  { city: "Tokyo", name: "Narita International", code: "NRT", country: "Japan" },
  { city: "Seoul", name: "Incheon International", code: "ICN", country: "South Korea" },
  { city: "Singapore", name: "Changi Airport", code: "SIN", country: "Singapore" },
  { city: "Bangkok", name: "Suvarnabhumi Airport", code: "BKK", country: "Thailand" },
  { city: "Sydney", name: "Sydney Kingsford Smith Airport", code: "SYD", country: "Australia" },
  { city: "Auckland", name: "Auckland Airport", code: "AKL", country: "New Zealand" },
  { city: "Cancún", name: "Cancún International", code: "CUN", country: "Mexico" },
  { city: "Mexico City", name: "Mexico City International", code: "MEX", country: "Mexico" },
  { city: "Bengaluru", name: "Kempegowda International", code: "BLR", country: "India" },
  { city: "Delhi", name: "Indira Gandhi International", code: "DEL", country: "India" },
  { city: "Mumbai", name: "Chhatrapati Shivaji Maharaj International", code: "BOM", country: "India" },
  { city: "Hyderabad", name: "Rajiv Gandhi International", code: "HYD", country: "India" },
  { city: "Chennai", name: "Chennai International", code: "MAA", country: "India" },
  { city: "Kochi", name: "Cochin International", code: "COK", country: "India" },
  { city: "Frankfurt", name: "Frankfurt Airport", code: "FRA", country: "Germany" },
  { city: "Madrid", name: "Adolfo Suárez Madrid–Barajas", code: "MAD", country: "Spain" },
  { city: "Barcelona", name: "Barcelona–El Prat Airport", code: "BCN", country: "Spain" },
  { city: "Zurich", name: "Zurich Airport", code: "ZRH", country: "Switzerland" },
  { city: "Istanbul", name: "Istanbul Airport", code: "IST", country: "Türkiye" },
  { city: "Dublin", name: "Dublin Airport", code: "DUB", country: "Ireland" },
  { city: "Copenhagen", name: "Copenhagen Airport", code: "CPH", country: "Denmark" },
  { city: "Vienna", name: "Vienna International", code: "VIE", country: "Austria" },
  { city: "Athens", name: "Athens International", code: "ATH", country: "Greece" },
  { city: "Doha", name: "Hamad International", code: "DOH", country: "Qatar" },
  { city: "Abu Dhabi", name: "Zayed International", code: "AUH", country: "United Arab Emirates" },
  { city: "Hong Kong", name: "Hong Kong International", code: "HKG", country: "Hong Kong" },
  { city: "Taipei", name: "Taiwan Taoyuan International", code: "TPE", country: "Taiwan" },
  { city: "Shanghai", name: "Shanghai Pudong International", code: "PVG", country: "China" },
  { city: "Beijing", name: "Beijing Capital International", code: "PEK", country: "China" },
  { city: "Kuala Lumpur", name: "Kuala Lumpur International", code: "KUL", country: "Malaysia" },
  { city: "Jakarta", name: "Soekarno–Hatta International", code: "CGK", country: "Indonesia" },
  { city: "Manila", name: "Ninoy Aquino International", code: "MNL", country: "Philippines" },
  { city: "Melbourne", name: "Melbourne Airport", code: "MEL", country: "Australia" },
  { city: "Brisbane", name: "Brisbane Airport", code: "BNE", country: "Australia" },
  { city: "Johannesburg", name: "O. R. Tambo International", code: "JNB", country: "South Africa" },
  { city: "Cape Town", name: "Cape Town International", code: "CPT", country: "South Africa" },
  { city: "Nairobi", name: "Jomo Kenyatta International", code: "NBO", country: "Kenya" },
  { city: "Cairo", name: "Cairo International", code: "CAI", country: "Egypt" },
  { city: "São Paulo", name: "São Paulo–Guarulhos International", code: "GRU", country: "Brazil" },
  { city: "Buenos Aires", name: "Ministro Pistarini International", code: "EZE", country: "Argentina" },
  { city: "Santiago", name: "Arturo Merino Benítez International", code: "SCL", country: "Chile" },
  { city: "Lima", name: "Jorge Chávez International", code: "LIM", country: "Peru" },
  { city: "Bogotá", name: "El Dorado International", code: "BOG", country: "Colombia" },
];

const quickPickAirportCodes = ["LHR", "BLR", "DEL", "DXB", "SIN", "CDG", "JFK", "HKG"];

function normalizeAirportSearch(value: string) {
  return value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function AirportInput({ label, field, value, onChange, symbol, symbolClass }: {
  label: string;
  field: "origin" | "destination";
  value: string;
  onChange: (value: string) => void;
  symbol: string;
  symbolClass: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [worldwideMatches, setWorldwideMatches] = useState<typeof airportOptions>([]);
  const [airportLoading, setAirportLoading] = useState(false);
  const query = normalizeAirportSearch(value);
  const queryParts = query.split(/\s+/).filter(Boolean);
  const localMatches = query ? airportOptions
    .filter(airport => {
      const haystack = normalizeAirportSearch(`${airport.city} ${airport.name} ${airport.code} ${airport.country}`);
      return queryParts.every(part => haystack.includes(part));
    }).slice(0, 8) : [];
  const matches = query
    ? (worldwideMatches.length ? worldwideMatches : localMatches)
    : quickPickAirportCodes.map(code => airportOptions.find(airport => airport.code === code)).filter((airport): airport is typeof airportOptions[number] => Boolean(airport));
  const listId = `airport-suggestions-${field}`;

  useEffect(() => {
    if (query.length < 2) { setWorldwideMatches([]); setAirportLoading(false); return; }
    const controller = new AbortController();
    setWorldwideMatches([]);
    setAirportLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/airports?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        const data = await response.json();
        if (response.ok && Array.isArray(data.airports)) setWorldwideMatches(data.airports);
      } catch { /* Keep the popular airport list available if the global directory is offline. */ }
      finally { if (!controller.signal.aborted) setAirportLoading(false); }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, value]);

  function chooseAirport(airport: typeof airportOptions[number]) {
    onChange(`${airport.city} (${airport.code})`);
    setOpen(false);
    setActiveIndex(-1);
  }

  return <div className="input-block airport-field">
    <span>{label}</span>
    <div className="airport-autocomplete">
      <div className="input-wrap">
        <span className={`field-symbol ${symbolClass}`} aria-hidden="true">{symbol}</span>
        <input
          aria-label={`${label === "FROM" ? "Departure" : "Destination"} city or airport`}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${matches[activeIndex]?.code}` : undefined}
          role="combobox"
          autoComplete="off"
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => { window.setTimeout(() => setOpen(false), 180); }}
          onChange={event => { onChange(event.target.value); setOpen(true); setActiveIndex(-1); }}
          onKeyDown={event => {
            if (event.key === "ArrowDown" && matches.length) { event.preventDefault(); setOpen(true); setActiveIndex(index => Math.min(index + 1, matches.length - 1)); }
            if (event.key === "ArrowUp" && matches.length) { event.preventDefault(); setActiveIndex(index => Math.max(index - 1, 0)); }
            if (event.key === "Enter" && open && matches.length) { event.preventDefault(); chooseAirport(matches[activeIndex >= 0 ? activeIndex : 0]); }
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Type a city, airport, or code"
          required
        />
      </div>
      {open && <div className="airport-suggestions" id={listId} role="listbox" aria-label={`${label === "FROM" ? "Departure" : "Destination"} airports`}>
        {!query && <div className="airport-list-heading">Popular airports · type to search worldwide</div>}
        {matches.length ? matches.map((airport, index) => <div
          className={`airport-suggestion${index === activeIndex ? " is-active" : ""}`}
          id={`${listId}-${airport.code}`}
          key={airport.code}
          role="option"
          aria-selected={index === activeIndex}
          onClick={() => chooseAirport(airport)}
        >
          <span className="airport-suggestion-main"><strong>{airport.city}</strong><small>{airport.name} · {airport.country}</small></span>
          <b className="airport-suggestion-code">{airport.code}</b>
        </div>) : airportLoading ? <div className="airport-no-results">Searching worldwide airports…</div> : <div className="airport-no-results">No airport found. Try its city, name, or 3-letter IATA code.</div>}
        <a className="airport-data-credit" href="https://ourairports.com/data/" target="_blank" rel="noreferrer">Worldwide airport directory · OurAirports</a>
      </div>}
    </div>
  </div>;
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18"/><path d="m8 15 2 2 5-5"/></svg>;
}
function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>;
}
function SparkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>;
}

function prettyDate(value: string) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function formatFare(amount: number, currency: FareCurrency) {
  return `${currency} ${new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(amount)}`;
}

function prettyRange(from: string, to: string) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  return `${start.toLocaleDateString("en-CA", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`;
}

function tripDaysInclusive(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export default function Home() {
  const [search, setSearch] = useState<SearchInput>(defaultSearch);
  const [bookingTipIndex, setBookingTipIndex] = useState(0);
  const [bookingTipsPaused, setBookingTipsPaused] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [airlineQuery, setAirlineQuery] = useState("");
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyStorageMode, setHistoryStorageMode] = useState<"loading" | "device" | "account">("loading");
  const [historyError, setHistoryError] = useState("");
  const [activeHistoryId, setActiveHistoryId] = useState("");
  const [offers, setOffers] = useState<FlightOffer[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMoreDates, setHasMoreDates] = useState(false);
  const [nextBatch, setNextBatch] = useState(0);
  const [checkedPairs, setCheckedPairs] = useState(0);
  const [totalPairs, setTotalPairs] = useState(0);
  const [usageRemaining, setUsageRemaining] = useState<number | null>(null);
  const [usageKeySource, setUsageKeySource] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [providerKeyOpen, setProviderKeyOpen] = useState(false);
  const [providerKeyValue, setProviderKeyValue] = useState("");
  const [providerKeyConfigured, setProviderKeyConfigured] = useState(false);
  const [providerKeyUsage, setProviderKeyUsage] = useState<number | null>(null);
  const [providerKeyMessage, setProviderKeyMessage] = useState("");
  const [providerKeyBusy, setProviderKeyBusy] = useState(false);
  const supabaseReady = hasSupabaseConfig();
  const byokMode = process.env.NEXT_PUBLIC_SERPAPI_KEY_MODE === "byok";

  useEffect(() => {
    if (bookingTipsPaused) return;
    const timer = window.setInterval(() => {
      setBookingTipIndex(index => (index + 1) % bookingTips.length);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [bookingTipIndex, bookingTipsPaused]);

  useEffect(() => {
    let cancelled = false;
    let currentUserId: string | null | undefined;
    const readDeviceHistory = (): SearchHistoryItem[] => {
      try {
        const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.slice(0, 10) as SearchHistoryItem[] : [];
      } catch { return []; }
    };
    const loadSessionHistory = async (session: Session | null) => {
      const user = session?.user ?? null;
      const userId = user?.id ?? null;
      if (currentUserId === userId) return;
      currentUserId = userId;
      setUserEmail(user?.email ?? null);
      setHistoryError("");
      if (!user) {
        setHistoryStorageMode("device");
        setSearchHistory(readDeviceHistory());
        setHistoryReady(true);
        return;
      }

      setHistoryStorageMode("account");
      setHistoryReady(false);
      const supabase = getSupabase();
      if (!supabase) return;
      const deviceHistory = readDeviceHistory();
      if (deviceHistory.length) {
        const rows = deviceHistory.map(item => ({
          user_id: user.id, id: item.id, searched_at: item.searchedAt,
          search_data: item.search, offers: item.offers,
          checked_pairs: item.checked, total_pairs: item.total,
        }));
        const { error } = await supabase.from("search_history").upsert(rows, { onConflict: "user_id,id" });
        if (cancelled || currentUserId !== user.id) return;
        if (error) {
          setSearchHistory(deviceHistory);
          setHistoryError("Account history needs a database update. Run the new account-history SQL migration in Supabase.");
          setHistoryReady(true);
          return;
        }
        window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      }
      const { data, error } = await supabase.from("search_history").select("*").eq("user_id", user.id).order("searched_at", { ascending: false }).limit(10);
      if (cancelled || currentUserId !== user.id) return;
      if (error) {
        setSearchHistory(deviceHistory);
        setHistoryError("Account history could not be loaded. Check that the account-history SQL migration has been run in Supabase.");
      } else {
        setSearchHistory((data ?? []).map(row => {
          const item = row as SearchHistoryRow;
          return { id: item.id, searchedAt: item.searched_at, search: item.search_data, offers: item.offers ?? [], checked: item.checked_pairs ?? 0, total: item.total_pairs ?? 0 };
        }));
      }
      setHistoryReady(true);
    };

    const supabase = getSupabase();
    if (!supabase) {
      currentUserId = null;
      setUserEmail(null);
      setHistoryStorageMode("device");
      setSearchHistory(readDeviceHistory());
      setHistoryReady(true);
      return;
    }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { void loadSessionHistory(session); });
    void supabase.auth.getSession().then(({ data }) => loadSessionHistory(data.session)).catch(() => loadSessionHistory(null));
    return () => { cancelled = true; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!historyReady || historyStorageMode !== "device") return;
    try { window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(searchHistory.slice(0, 10))); }
    catch { /* Search results remain available for this page session. */ }
  }, [historyReady, historyStorageMode, searchHistory]);

  useEffect(() => {
    if (!userEmail) { setSaved([]); return; }
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.from("saved_searches").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setSaved((data ?? []) as SavedSearch[]));
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail) { setProviderKeyConfigured(false); setProviderKeyUsage(null); return; }
    let cancelled = false;
    async function loadProviderKeyStatus() {
      const supabase = getSupabase();
      const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
      const token = data.session?.access_token;
      if (!token) return;
      try {
        const response = await fetch("/api/provider-key", { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (cancelled) return;
        if (response.ok) {
          setProviderKeyConfigured(Boolean(result.configured));
          setProviderKeyUsage(typeof result.usageRemaining === "number" ? result.usageRemaining : null);
        }
      } catch { /* Status can be retried when the user opens API key settings. */ }
    }
    void loadProviderKeyStatus();
    return () => { cancelled = true; };
  }, [userEmail]);

  useEffect(() => {
    let cancelled = false;
    async function loadUsage() {
      if (byokMode && !userEmail) {
        setUsageRemaining(null);
        setUsageKeySource("");
        return;
      }
      const headers: Record<string, string> = {};
      if (userEmail) {
        const supabase = getSupabase();
        const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
        if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      try {
        const response = await fetch("/api/offers", { headers, cache: "no-store" });
        const result = await response.json();
        if (cancelled || !response.ok || typeof result.requestsRemaining !== "number") return;
        setUsageRemaining(result.requestsRemaining);
        setUsageKeySource(result.keySource ?? "");
        if (result.keySource === "your SerpApi key") setProviderKeyUsage(result.requestsRemaining);
      } catch { /* The balance is also refreshed after each fare search. */ }
    }
    void loadUsage();
    return () => { cancelled = true; };
  }, [userEmail, providerKeyConfigured, byokMode]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);


  const cheapest = useMemo(() => offers[0]?.price ?? 0, [offers]);

  function update<K extends keyof SearchInput>(key: K, value: SearchInput[K]) {
    setSearch(current => {
      const next: SearchInput = { ...current, [key]: value } as SearchInput;
      if (key === "minNights" && Number(value) > current.maxNights) next.maxNights = Number(value);
      if (key === "dateFrom" && String(value) > current.dateTo) next.dateTo = String(value);
      return next;
    });
  }

  function updateAdvanced<K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) {
    setSearch(current => ({ ...current, advanced: { ...defaultAdvanced, ...current.advanced, [key]: value } }));
  }

  function updateCurrency(currency: FareCurrency) {
    setSearch(current => ({ ...current, currency, advanced: { ...defaultAdvanced, ...current.advanced, maxPrice: "" } }));
    setOffers([]); setSearched(false); setError(""); setHasMoreDates(false); setCheckedPairs(0); setTotalPairs(0); setNextBatch(0); setActiveHistoryId("");
  }

  function sortOffers(items: FlightOffer[]) {
    const sortBy = search.advanced?.sortBy ?? 2;
    const compare = (a: FlightOffer, b: FlightOffer) => sortBy === 3 ? a.departureDate.localeCompare(b.departureDate) || clockMinutes(a.outboundTime) - clockMinutes(b.outboundTime)
      : sortBy === 4 ? a.departureDate.localeCompare(b.departureDate) || clockMinutes(a.arrivalTime ?? "") - clockMinutes(b.arrivalTime ?? "")
      : sortBy === 5 ? (a.durationMinutes ?? Infinity) - (b.durationMinutes ?? Infinity)
      : sortBy === 6 ? (a.emissionsGrams ?? Infinity) - (b.emissionsGrams ?? Infinity)
      : sortBy === 1 ? 0 : a.price - b.price;
    return [...items].sort(compare).filter((offer, index, all) => all.findIndex(item => item.id === offer.id) === index);
  }

  async function saveAccountHistory(item: SearchHistoryItem) {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;
    const { error: saveError } = await supabase.from("search_history").upsert({
      user_id: user.id, id: item.id, searched_at: item.searchedAt, search_data: item.search,
      offers: item.offers, checked_pairs: item.checked, total_pairs: item.total,
    }, { onConflict: "user_id,id" });
    if (saveError) {
      setHistoryError("Could not save this search to your account. Check the Supabase account-history setup.");
      return;
    }
    setHistoryError("");
  }

  async function findFlights(event?: FormEvent, batch = 0) {
    event?.preventDefault();
    if (byokMode && !userEmail) {
      setAccountMessage("Sign in first, then add your SerpApi key in account settings.");
      setAccountOpen(true);
      return;
    }
    if (byokMode && !providerKeyConfigured) {
      setProviderKeyMessage("");
      setProviderKeyOpen(true);
      return;
    }
    setLoading(true); setError(""); setSearched(true);
    if (batch === 0) { setOffers([]); setHasMoreDates(false); setCheckedPairs(0); setTotalPairs(0); setUsageRemaining(null); }
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (byokMode || providerKeyConfigured) {
        const supabase = getSupabase();
        const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
        if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch("/api/offers", { method: "POST", headers, body: JSON.stringify({ ...search, batch }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We couldn’t search those dates.");
      const makeHistoryId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const historyId = batch === 0 ? makeHistoryId() : activeHistoryId || makeHistoryId();
      if (batch === 0) setActiveHistoryId(historyId);
      const mergedOffers = sortOffers(batch === 0 ? (data.offers as FlightOffer[]) : [...offers, ...(data.offers as FlightOffer[])]);
      setOffers(mergedOffers);
      const existing = batch > 0 ? searchHistory.find(item => item.id === historyId) : undefined;
      const historyItem: SearchHistoryItem = {
        id: historyId,
        searchedAt: existing?.searchedAt ?? new Date().toISOString(),
        search: { ...search, advanced: { ...defaultAdvanced, ...search.advanced, airlines: [...(search.advanced?.airlines ?? [])], excludedAirports: [...(search.advanced?.excludedAirports ?? [])] } },
        offers: mergedOffers,
        checked: batch === 0 ? data.checked : (existing?.checked ?? checkedPairs) + data.checked,
        total: data.totalCandidates,
      };
      setSearchHistory(current => [historyItem, ...current.filter(item => item.id !== historyId)].slice(0, 10));
      if (userEmail) await saveAccountHistory(historyItem);
      setCheckedPairs(current => batch === 0 ? data.checked : current + data.checked);
      setTotalPairs(data.totalCandidates);
      setHasMoreDates(data.moreAvailable);
      setNextBatch(data.nextBatch);
      setUsageRemaining(data.usageRemaining);
      setUsageKeySource(data.keySource ?? "");
      if (data.keySource === "your SerpApi key") setProviderKeyUsage(data.usageRemaining);
      if (!data.offers.length && batch === 0) setError("No fares came back for the first dates checked. You can check more dates or adjust your travel window.");
      if (data.budgetReached) setError("This month’s SerpApi search budget has been reached. The fares already found are still shown.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }

  async function signIn(event: FormEvent) {
    event.preventDefault(); setAccountBusy(true); setAccountMessage("");
    const supabase = getSupabase();
    if (!supabase) {
      setAccountMessage("Accounts are ready to connect. Add the Supabase project details from the setup guide first.");
      setAccountBusy(false); return;
    }
    const { error: authError } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setAccountMessage(authError ? authError.message : "Check your inbox for your secure sign-in link.");
    setAccountBusy(false);
  }

  async function signInWithGoogle() {
    setAccountBusy(true); setAccountMessage("");
    const supabase = getSupabase();
    if (!supabase) {
      setAccountMessage("Connect Supabase first to enable Google sign-in.");
      setAccountBusy(false);
      return;
    }
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (authError) throw authError;
    } catch (reason) {
      setAccountMessage(reason instanceof Error ? reason.message : "Google sign-in could not start. Please try again.");
      setAccountBusy(false);
    }
  }

  async function signOut() {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    setToast("You’ve signed out.");
  }

  async function updateProviderKey(event: FormEvent) {
    event.preventDefault();
    setProviderKeyBusy(true); setProviderKeyMessage("");
    const supabase = getSupabase();
    const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
    const token = data.session?.access_token;
    if (!token) {
      setProviderKeyMessage("Please sign in again before saving your key.");
      setProviderKeyBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/provider-key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apiKey: providerKeyValue }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your SerpApi key.");
      setProviderKeyConfigured(true);
      setProviderKeyUsage(typeof result.usageRemaining === "number" ? result.usageRemaining : null);
      setUsageRemaining(typeof result.usageRemaining === "number" ? result.usageRemaining : null);
      setUsageKeySource("your SerpApi key");
      setProviderKeyValue("");
      setProviderKeyMessage("Key saved securely. Fare Glow will use it for your searches.");
    } catch (reason) {
      setProviderKeyMessage(reason instanceof Error ? reason.message : "Could not save your SerpApi key.");
    } finally { setProviderKeyBusy(false); }
  }

  async function removeProviderKey() {
    setProviderKeyBusy(true); setProviderKeyMessage("");
    const supabase = getSupabase();
    const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
    const token = data.session?.access_token;
    if (!token) { setProviderKeyMessage("Please sign in again before removing your key."); setProviderKeyBusy(false); return; }
    try {
      const response = await fetch("/api/provider-key", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not remove your SerpApi key.");
      setProviderKeyConfigured(false); setProviderKeyUsage(null); setProviderKeyValue(""); setUsageRemaining(null); setUsageKeySource(byokMode ? "" : "Fare Glow's shared key");
      setProviderKeyMessage("Your saved SerpApi key was removed.");
    } catch (reason) {
      setProviderKeyMessage(reason instanceof Error ? reason.message : "Could not remove your SerpApi key.");
    } finally { setProviderKeyBusy(false); }
  }

  function openProviderKeySettings() {
    if (!userEmail) {
      setAccountMessage("Sign in first to add your SerpApi key.");
      setAccountOpen(true);
      return;
    }
    setProviderKeyMessage("");
    setProviderKeyOpen(true);
  }

  async function saveSearch() {
    if (!userEmail) { setAccountOpen(true); setAccountMessage("Sign in to keep this search in your account."); return; }
    const supabase = getSupabase();
    if (!supabase) return;
    setSaveBusy(true);
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult.user) {
      setSaveBusy(false);
      setAccountMessage("Please sign in again to save your search.");
      setAccountOpen(true);
      return;
    }
    const { data, error: saveError } = await supabase.from("saved_searches").insert({
      user_id: userResult.user.id,
      origin: search.origin, destination: search.destination, date_from: search.dateFrom, date_to: search.dateTo,
      min_nights: search.minNights, max_nights: search.maxNights, travellers: search.travellers,
    }).select().single();
    if (saveError) setToast("Couldn’t save yet. Check the account setup guide.");
    else { setSaved(current => [data as SavedSearch, ...current]); setToast("Search saved. Price alert setup is the next connection step."); }
    setSaveBusy(false);
  }

  async function removeSaved(id: string) {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error: deleteError } = await supabase.from("saved_searches").delete().eq("id", id);
    if (deleteError) setToast("Couldn’t remove that search.");
    else { setSaved(current => current.filter(item => item.id !== id)); setToast("Saved search removed."); }
  }

  function restoreSearch(item: SavedSearch) {
    setSearch(current => ({ origin: item.origin, destination: item.destination, currency: current.currency, dateFrom: item.date_from, dateTo: item.date_to, minNights: item.min_nights, maxNights: item.max_nights, travellers: item.travellers }));
    window.scrollTo({ top: 0, behavior: "smooth" });
    setToast("Search details restored. Search again for current prices.");
  }

  function restoreHistory(item: SearchHistoryItem) {
    setSearch({ ...item.search, currency: item.search.currency ?? "CAD" });
    setOffers(item.offers);
    setCheckedPairs(item.checked);
    setTotalPairs(item.total);
    setSearched(true);
    setHasMoreDates(false);
    setError("");
    setAdvancedOpen(Boolean(item.search.advanced && (item.search.advanced.airlineMode !== "any" || item.search.advanced.carryOn || item.search.advanced.stops !== "any" || item.search.advanced.cabin !== 1 || item.search.advanced.maxPrice || item.search.advanced.lowEmissions)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function clearSearchHistory() {
    if (historyStorageMode === "account") {
      const supabase = getSupabase();
      const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
      const user = data.session?.user;
      if (!supabase || !user) { setHistoryError("Please sign in again to clear account history."); return; }
      const { error: deleteError } = await supabase.from("search_history").delete().eq("user_id", user.id);
      if (deleteError) { setHistoryError("Could not clear account history. Check the Supabase account-history setup."); return; }
      setSearchHistory([]);
      setHistoryError("");
      setToast("Search history cleared from your account.");
      return;
    }
    setSearchHistory([]);
    setToast("Search history cleared on this device.");
  }

  function swapRoute() {
    setSearch(current => ({ ...current, origin: current.destination, destination: current.origin }));
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Fare Glow home">
          <span className="brand-mark"><SparkIcon /></span><span>Fare <span className="brand-glow">Glow</span></span>
        </a>
        <div className="top-actions">
          <a className="how-link" href="/how-it-works">How it works</a>
          <a className="feedback-nav" href="/feedback">Feedback</a>
          {userEmail ? <div className="account-menu"><span className="user-dot">{userEmail.slice(0, 1).toUpperCase()}</span><button className="text-button" onClick={openProviderKeySettings}>API key</button><button className="text-button" onClick={signOut}>Sign out</button></div> : <button className="sign-in" onClick={() => { setAccountMessage(""); setAccountOpen(true); }}>Sign in <span>↗</span></button>}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> FIND YOUR LOW FARE WINDOW</div>
          <h1>Good trips start<br /><span>with better dates.</span></h1>
          <p>Choose when you can travel. We’ll help you spot the return dates that cost less.</p>
        </div>
        <div className="hero-stamp"><span>GO</span><i>↗</i><span>RETURN</span></div>
      </section>

      <div className="demo-banner"><span className="demo-icon">i</span><span><strong>Fare searches check a few dates at a time.</strong> Each batch checks up to eight return date pairs. Use “Check more dates” to expand the search while keeping API use low.</span></div>

      <section className="booking-tip" aria-label="Airfare tips">
        <p className="booking-tip-copy" aria-live="polite" aria-atomic="true"><strong>{bookingTips[bookingTipIndex].title}</strong> {bookingTips[bookingTipIndex].text}</p>
        <div className="booking-tip-controls">
          <span className="booking-tip-count" aria-label={`Tip ${bookingTipIndex + 1} of ${bookingTips.length}`}>{bookingTipIndex + 1} / {bookingTips.length}</span>
          <button type="button" onClick={() => setBookingTipIndex(index => (index - 1 + bookingTips.length) % bookingTips.length)} aria-label="Previous airfare tip">‹ Previous</button>
          <button type="button" onClick={() => setBookingTipsPaused(paused => !paused)} aria-label={bookingTipsPaused ? "Resume rotating airfare tips" : "Pause rotating airfare tips"}>{bookingTipsPaused ? "Resume" : "Pause"}</button>
          <button type="button" onClick={() => setBookingTipIndex(index => (index + 1) % bookingTips.length)} aria-label="Next airfare tip">Next ›</button>
        </div>
      </section>

      <section className="search-card" aria-labelledby="search-heading">
        <div className="card-heading">
          <div><span className="section-kicker">YOUR TRIP</span><h2 id="search-heading">Where can you go?</h2></div>
          <span className="round-trip"><span className="round-icon">↔</span> Return trip</span>
        </div>
      <form onSubmit={findFlights}>
          <div className="route-fields">
            <AirportInput label="FROM" field="origin" value={search.origin} onChange={value => update("origin", value)} symbol="●" symbolClass="origin-symbol" />
            <button className="swap-button" type="button" onClick={swapRoute} aria-label="Swap origin and destination">⇄</button>
            <AirportInput label="TO" field="destination" value={search.destination} onChange={value => update("destination", value)} symbol="◎" symbolClass="destination-symbol" />
          </div>
          <div className="range-row">
            <div className="input-block"><span>CHOOSE YOUR TRAVEL DATE WINDOW</span><div className="date-range-picker"><CalendarIcon /><div className="date-range-fields"><label className="date-field"><span>Earliest date</span><input aria-label="Earliest travel date" type="date" min={iso(today)} value={search.dateFrom} onChange={e => update("dateFrom", e.target.value)} required /></label><label className="date-field"><span>Latest date</span><input aria-label="Latest travel date" type="date" value={search.dateTo} min={search.dateFrom} onChange={e => update("dateTo", e.target.value)} required /></label></div></div></div>
            <label className="input-block nights-block"><span>TRIP LENGTH · DAYS INCLUDING DEPARTURE</span><div className="input-wrap nights-input"><select aria-label="Minimum trip length in days including departure" value={search.minNights} onChange={e => update("minNights", Number(e.target.value))}>{tripLengthOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="date-divider">to</span><select aria-label="Maximum trip length in days including departure" value={search.maxNights} onChange={e => update("maxNights", Number(e.target.value))}>{tripLengthOptions.filter(option => option.value >= search.minNights).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></label>
            <label className="input-block traveller-block"><span>TRAVELERS</span><div className="input-wrap traveller-input"><select aria-label="Number of travelers" value={search.travellers} onChange={e => update("travellers", Number(e.target.value))}>{[1,2,3,4,5,6,7,8,9].map(n => <option value={n} key={n}>{n} {n === 1 ? "adult" : "adults"}</option>)}</select></div></label>
          </div>
          <div className="currency-row">
            <label className="input-block"><span>FARE CURRENCY</span><div className="input-wrap"><select aria-label="Fare currency" value={search.currency} disabled={loading} onChange={e => updateCurrency(e.target.value as FareCurrency)}>{FARE_CURRENCIES.map(currency => <option value={currency.code} key={currency.code}>{currency.code} — {currency.name}</option>)}</select></div></label>
            <small>Changing currency clears current results; search again for new fares. Confirm the final price when booking.</small>
          </div>
          <section className="advanced-search" aria-label="Advanced flight options">
            <button className="advanced-toggle" type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(open => !open)}>
              <span><strong>Advanced search</strong><small>Stops, airlines, bags, times, and more</small></span><span className="advanced-toggle-right">{advancedOpen ? "Hide options" : "Show options"} <b>{advancedOpen ? "−" : "+"}</b></span>
            </button>
            {advancedOpen && <div className="advanced-panel">
              <div className="advanced-grid">
                <label className="input-block"><span>STOPS · EACH DIRECTION</span><div className="input-wrap"><select value={search.advanced?.stops ?? "any"} onChange={e => updateAdvanced("stops", e.target.value as AdvancedFilters["stops"])}><option value="any">Any number of stops</option><option value="nonstop">Nonstop only</option><option value="one">1 stop or fewer</option><option value="two">2 stops or fewer</option></select></div><small className="field-help">“1 stop or fewer” includes nonstop flights.</small></label>
                <label className="input-block"><span>CARRY-ON BAGS</span><div className="input-wrap"><select value={search.advanced?.carryOn ?? 0} onChange={e => updateAdvanced("carryOn", Number(e.target.value))}><option value="0">No preference</option><option value="1">At least 1 carry-on</option><option value="2">At least 2 carry-ons</option></select></div><small className="field-help">Carry-on bags only; checked bags aren’t filterable here.</small></label>
                <div className="input-block airline-filter-field"><span>AIRLINE PREFERENCE</span><div className="input-wrap"><select aria-label="Airline preference" value={search.advanced?.airlineMode ?? "any"} onChange={e => { updateAdvanced("airlineMode", e.target.value as AdvancedFilters["airlineMode"]); setAirlineQuery(""); }}><option value="any">Any airline</option><option value="include">Only airlines I choose</option><option value="exclude">Avoid airlines I choose</option></select></div>{search.advanced?.airlineMode !== "any" && <fieldset className="airline-picker"><legend>{search.advanced?.airlineMode === "include" ? "Choose airlines to include" : "Choose airlines to avoid"}</legend><input className="airline-search" type="search" aria-label="Search airlines" placeholder="Search airline name or code" value={airlineQuery} onChange={e => setAirlineQuery(e.target.value)} /><div className="airline-choice-list">{airlineOptions.filter(([code, name]) => `${code} ${name}`.toLowerCase().includes(airlineQuery.toLowerCase())).map(([code,name]) => <label key={code}><input type="checkbox" checked={search.advanced?.airlines.includes(code) ?? false} onChange={e => updateAdvanced("airlines", e.target.checked ? [...(search.advanced?.airlines ?? []), code] : (search.advanced?.airlines ?? []).filter(item => item !== code))} /><span>{name}</span><small>{code}</small></label>)}</div><small className="airline-selected">{search.advanced?.airlines.length ? `${search.advanced.airlines.length} selected` : "Choose one or more airlines"}</small></fieldset>}</div>
                <label className="input-block"><span>MAXIMUM TOTAL FARE · {search.currency}</span><div className="input-wrap"><span className="field-symbol">{search.currency}</span><input type="number" min="1" placeholder="No price limit" value={search.advanced?.maxPrice ?? ""} onChange={e => updateAdvanced("maxPrice", e.target.value)} /></div></label>
                <label className="input-block"><span>OUTBOUND DEPARTURE TIME</span><div className="input-wrap"><select value={search.advanced?.outboundTime ?? ""} onChange={e => updateAdvanced("outboundTime", e.target.value)}>{timeOptions.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></div></label>
                <label className="input-block"><span>RETURN DEPARTURE TIME</span><div className="input-wrap"><select value={search.advanced?.returnTime ?? ""} onChange={e => updateAdvanced("returnTime", e.target.value)}>{timeOptions.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></div></label>
                <label className="input-block"><span>MAXIMUM FLIGHT TIME · EACH WAY</span><div className="input-wrap"><select value={search.advanced?.maxDuration ?? 0} onChange={e => updateAdvanced("maxDuration", Number(e.target.value))}><option value="0">No limit</option>{[6,8,10,12,16,20,24,30].map(hours => <option key={hours} value={hours * 60}>Up to {hours} hours</option>)}</select></div></label>
                <label className="input-block"><span>LAYOVER LENGTH</span><div className="input-wrap"><select value={search.advanced?.layover ?? ""} onChange={e => updateAdvanced("layover", e.target.value)}><option value="">Any layover</option><option value="90,210">1.5–3.5 hours</option><option value="90,330">1.5–5.5 hours</option><option value="120,360">2–6 hours</option><option value="180,480">3–8 hours</option></select></div></label>
                <label className="input-block"><span>TRAVEL CABIN</span><div className="input-wrap"><select value={search.advanced?.cabin ?? 1} onChange={e => updateAdvanced("cabin", Number(e.target.value))}><option value="1">Economy</option><option value="2">Premium economy</option><option value="3">Business</option><option value="4">First class</option></select></div></label>
                <label className="input-block"><span>SHOW OFFERS SORTED BY</span><div className="input-wrap"><select value={search.advanced?.sortBy ?? 2} onChange={e => updateAdvanced("sortBy", Number(e.target.value))}><option value="1">Recommended</option><option value="2">Lowest price</option><option value="3">Earliest departure</option><option value="4">Earliest arrival</option><option value="5">Shortest flight time</option><option value="6">Lowest emissions</option></select></div></label>
              </div>
              <details className="airport-exclusions"><summary>Avoid specific connection airports <small>Optional · choose any airports</small></summary><div className="choice-list">{airportOptions.map(airport => <label key={airport.code}><input type="checkbox" checked={search.advanced?.excludedAirports.includes(airport.code) ?? false} onChange={e => updateAdvanced("excludedAirports", e.target.checked ? [...(search.advanced?.excludedAirports ?? []), airport.code] : (search.advanced?.excludedAirports ?? []).filter(code => code !== airport.code))} /><span>{airport.city} ({airport.code})</span></label>)}</div></details>
              <label className="advanced-check"><input type="checkbox" checked={search.advanced?.lowEmissions ?? false} onChange={e => updateAdvanced("lowEmissions", e.target.checked)} /><span><strong>Show lower-emissions flights</strong><small>Filter for flights Google classifies as lower emissions on this route.</small></span></label>
              <p className="canada-note">Basic Economy exclusion isn’t available for Canada market searches through this fare provider.</p>
            </div>}
          </section>
          <div className="form-bottom"><p>We’ll check selected return dates inside your window and show their live prices.</p><button className="search-button" type="submit" disabled={loading}>{loading ? <><span className="spinner" /> Looking for dates…</> : <>Find cheaper dates <ArrowIcon /></>}</button></div>
        </form>
      </section>

      {searched && <section className="results-section" aria-live="polite">
        <div className="results-title-row"><div><span className="section-kicker">YOUR FARE WINDOW</span><h2>{search.origin.split(" (")[0]} <span className="route-arrow">→</span> {search.destination.split(" (")[0]}</h2><p>{prettyRange(search.dateFrom, search.dateTo)} · return trips · {search.currency}</p></div>
          {offers.length > 0 && <button className="save-button" onClick={saveSearch} disabled={saveBusy}><span>＋</span> {saveBusy ? "Saving…" : "Save search"}</button>}
        </div>
        {loading && <div className="loading-panel"><span className="spinner spinner-dark" /> Checking available dates…</div>}
        {!loading && error && <div className="empty-panel"><span className="empty-spark"><SparkIcon /></span><strong>{error}</strong><span>Try adjusting the range or trip length.</span></div>}
        {!loading && offers.length > 0 && <>
          <div className="fare-summary"><div className="summary-icon"><SparkIcon /></div><div><span>LOWEST RETURN FARE FOUND</span><strong>{formatFare(cheapest, search.currency)}</strong></div><p>Checked {checkedPairs} of {totalPairs} possible date pairs{usageRemaining !== null ? ` · ${usageRemaining} API searches left in this budget` : ""}</p></div>
          <div className="legend-row"><span className="legend-label">DATE PAIRS BY PRICE</span><span><i className="legend-dot best" /> Lowest</span><span><i className="legend-dot good" /> Good value</span><span><i className="legend-dot other" /> Other fares</span></div>
          <div className="offer-list">
            {offers.map((offer, index) => <article key={offer.id} className={`offer-card tier-${index < 2 ? "best" : index < 4 ? "good" : "other"}`}>
              <div className="offer-rank">{index === 0 ? <span className="best-tag"><SparkIcon /> LOWEST</span> : <span className="rank-label">OPTION {String(index + 1).padStart(2, "0")}</span>}<span className="offer-source">{offer.source}</span></div>
              <div className="offer-main">
                <div className="date-pair"><div><span>GO</span><strong>{prettyDate(offer.departureDate)}</strong><small>{offer.outboundTime}</small></div><div className="pair-connector"><span /><ArrowIcon /><span /></div><div><span>RETURN</span><strong>{prettyDate(offer.returnDate)}</strong><small>Round trip date</small></div></div>
              <div className="offer-price"><strong>{formatFare(offer.price, search.currency)}</strong><span>{search.travellers} {search.travellers === 1 ? "traveler" : "travelers"}</span></div>
              </div>
              <div className="offer-details"><span>{offer.outboundStops === 0 ? "Non-stop outbound" : `${offer.outboundStops} stop${offer.outboundStops === 1 ? "" : "s"} outbound`}</span><span>{offer.duration} outbound</span><span>{tripDaysInclusive(offer.departureDate, offer.returnDate)} days including departure</span></div>
              <div className="offer-footnote"><a href={offer.bookingUrl} target="_blank" rel="noreferrer">Check these dates on Google Flights ↗</a> · final fare and return itinerary confirmed there</div>
            </article>)}
          </div>
          <div className="results-note"><span>i</span> These are live round-trip prices for the sampled date pairs. The absolute lowest fare may be on a date pair not checked yet; confirm the itinerary and current total on Google Flights.</div>
        </>}
        {!loading && hasMoreDates && <div className="more-dates-row"><button className="save-button" onClick={() => findFlights(undefined, nextBatch)}>Check more dates <ArrowIcon /></button><span>Each additional batch checks up to eight new date pairs.</span></div>}
        {!loading && error && offers.length > 0 && <div className="results-note"><span>i</span>{error}</div>}
      </section>}

      {userEmail && <section className="saved-section">
        <div className="saved-heading"><div><span className="section-kicker">YOUR ACCOUNT</span><h2>Saved searches</h2></div><span className="saved-count">{saved.length} saved</span></div>
        {saved.length === 0 ? <div className="saved-empty">Save a route and date window to find it here again.</div> : <div className="saved-list">{saved.map(item => <div className="saved-item" key={item.id}><button className="saved-restore" onClick={() => restoreSearch(item)}><span>{item.origin.split(" (")[0]} <i>→</i> {item.destination.split(" (")[0]}</span><small>{prettyRange(item.date_from, item.date_to)} · round trip</small></button><button className="delete-saved" onClick={() => removeSaved(item.id)} aria-label="Delete saved search">×</button></div>)}</div>}
      </section>}

      <section className="history-section" aria-labelledby="history-heading">
        <div className="saved-heading"><div><span className="section-kicker">{historyStorageMode === "account" ? "YOUR ACCOUNT" : historyStorageMode === "loading" ? "LOADING SEARCH HISTORY" : "ON THIS DEVICE"}</span><h2 id="history-heading">Recent searches</h2></div>{searchHistory.length > 0 && <button className="text-button clear-history" onClick={clearSearchHistory}>Clear history</button>}</div>
        {historyError && <div className="history-setup-error" role="status">{historyError}</div>}
        {searchHistory.length === 0 ? <div className="saved-empty">Your searches and the fares found will appear here.</div> : <div className="history-list">{searchHistory.map(item => {
          const lowest = item.offers.length ? Math.min(...item.offers.map(offer => offer.price)) : null;
          const itemCurrency = item.search.currency ?? "CAD";
          return <details className="history-item" key={item.id}><summary><span className="history-route"><strong>{item.search.origin.split(" (")[0]} <i>→</i> {item.search.destination.split(" (")[0]}</strong><small>{prettyRange(item.search.dateFrom, item.search.dateTo)} · {new Date(item.searchedAt).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small></span><span className="history-summary-price">{lowest === null ? "No fares found" : `From ${formatFare(lowest, itemCurrency)}`}</span></summary><div className="history-results">{item.offers.length ? <>{item.offers.map(offer => <div className="history-result" key={offer.id}><span><strong>{prettyDate(offer.departureDate)} → {prettyDate(offer.returnDate)}</strong><small>{offer.outboundTime} outbound · {offer.outboundStops === 0 ? "Non-stop" : `${offer.outboundStops} stop${offer.outboundStops === 1 ? "" : "s"}`} · {offer.duration}</small></span><b>{formatFare(offer.price, itemCurrency)}</b></div>)}<p>Checked {item.checked} of {item.total} possible date pairs.</p></> : <p>No fares were returned for this search.</p>}<button className="history-restore" onClick={() => restoreHistory(item)}>Show this previous result</button></div></details>;
        })}</div>}
      </section>

      <footer className="footer"><div className="footer-brand"><span className="brand-mark small"><SparkIcon /></span><span>Fare <span className="brand-glow">Glow</span></span></div><span>Find the days that make the trip.</span><span className="footer-api-usage">SerpApi requests left this month: <strong>{usageRemaining === null ? "run a search to check" : usageRemaining}</strong>{usageKeySource && <small> · using {usageKeySource}</small>}</span><span className="footer-country">Made for Canadian travellers · {search.currency}</span><a className="footer-feedback-link" href="/feedback">Community feedback</a><span className="footer-credit">Dileep Kodira App</span></footer>

      {accountOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAccountOpen(false); }}><section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title"><button className="modal-close" onClick={() => setAccountOpen(false)} aria-label="Close">×</button><span className="modal-mark"><SparkIcon /></span><span className="section-kicker">FARE GLOW ACCOUNT</span><h2 id="account-title">Keep your dates close.</h2><p>Sign in to save searches to your account.</p>
        {supabaseReady ? <><button className="google-signin" type="button" onClick={signInWithGoogle} disabled={accountBusy}><span className="google-mark" aria-hidden="true">G</span>{accountBusy ? "Connecting to Google…" : "Continue with Google"}</button><div className="auth-divider"><span>or sign in with email</span></div><form onSubmit={signIn}><label className="input-block"><span>EMAIL ADDRESS</span><div className="input-wrap"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></div></label><button className="search-button modal-submit" type="submit" disabled={accountBusy}>{accountBusy ? "Sending link…" : "Email me a sign-in link"}<ArrowIcon /></button></form></> : <div className="setup-note"><strong>Account connection needed</strong><span>Supabase account details are not set up yet. The setup guide explains how to switch on sign-in and saved searches.</span></div>}
        {accountMessage && <p className="account-message" role="status">{accountMessage}</p>}<small className="privacy-note">A password isn’t needed. We’ll send a secure one-time link.</small>
      </section></div>}
      {providerKeyOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setProviderKeyOpen(false); }}><section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="provider-key-title"><button className="modal-close" onClick={() => setProviderKeyOpen(false)} aria-label="Close">×</button><span className="modal-mark"><SparkIcon /></span><span className="section-kicker">YOUR FLIGHT SEARCHES</span><h2 id="provider-key-title">Connect your SerpApi key.</h2><p>{byokMode ? "Use your own SerpApi account. Its free plan includes up to 250 searches per month; Fare Glow shows the remaining allowance and stops at 250." : "Optionally use your own SerpApi key for your searches. Without one, Fare Glow uses the app's shared key."}</p>{!providerKeyConfigured && <div className="setup-note api-key-help"><strong>Get your key in 3 quick steps</strong><span>1. <a href="https://serpapi.com/manage-api-key" target="_blank" rel="noreferrer">Open your SerpApi API key page ↗</a> and sign in, or <a href="https://serpapi.com/users/sign_up" target="_blank" rel="noreferrer">create a SerpApi account ↗</a>.</span><span>2. On SerpApi, click or tap <b>Copy</b> next to your API key.</span><span>3. Return here, select the box below, paste your key, then tap <b>Save key</b>.</span><span className="paste-hint">Computer: ⌘V on Mac or Ctrl+V on Windows. Phone/tablet: press and hold the box, then tap Paste.</span></div>}{providerKeyConfigured && <div className="setup-note"><strong>SerpApi key connected</strong><span>{providerKeyUsage === null ? "Your key is saved and hidden." : `${providerKeyUsage} searches remain in this month's allowance.`} The key is encrypted on the server and never shown again.</span></div>}<form onSubmit={updateProviderKey}><label className="input-block"><span>{providerKeyConfigured ? "REPLACE KEY" : "PASTE YOUR SERPAPI KEY"}</span><div className="input-wrap"><input type="password" autoComplete="new-password" value={providerKeyValue} onChange={event => setProviderKeyValue(event.target.value)} placeholder={providerKeyConfigured ? "Paste a replacement key" : "Tap here, then paste your key"} required /></div></label><button className="search-button modal-submit" type="submit" disabled={providerKeyBusy}>{providerKeyBusy ? "Checking and saving…" : providerKeyConfigured ? "Replace key" : "Save key"}<ArrowIcon /></button></form>{providerKeyConfigured && <button className="text-button remove-provider-key" onClick={removeProviderKey} disabled={providerKeyBusy}>Remove saved key</button>}{providerKeyMessage && <p className="account-message" role="status">{providerKeyMessage}</p>}<small className="privacy-note">Your SerpApi key is encrypted and hidden after saving. <a href="https://serpapi.com/manage-api-key" target="_blank" rel="noreferrer">Manage your SerpApi key</a></small></section></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
