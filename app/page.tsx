"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import type { FlightOffer, SearchInput } from "@/lib/types";

type SavedSearch = { id: string; origin: string; destination: string; date_from: string; date_to: string; min_nights: number; max_nights: number; travellers: number; price_alert_enabled: boolean; target_price: number | null };

const today = new Date();
const addDays = (date: Date, count: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const defaultSearch: SearchInput = {
  origin: "Toronto (YYZ)",
  destination: "Vancouver (YVR)",
  dateFrom: iso(addDays(today, 28)),
  dateTo: iso(addDays(today, 70)),
  minNights: 3,
  maxNights: 10,
  travellers: 1,
};
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
  const [offers, setOffers] = useState<FlightOffer[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMoreDates, setHasMoreDates] = useState(false);
  const [nextBatch, setNextBatch] = useState(0);
  const [checkedPairs, setCheckedPairs] = useState(0);
  const [totalPairs, setTotalPairs] = useState(0);
  const [usageRemaining, setUsageRemaining] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [alertTarget, setAlertTarget] = useState("");
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
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUserEmail(data.session?.user.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      if (session?.user.email) setAccountOpen(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

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
      setOffers(current => {
        const merged = batch === 0 ? data.offers as FlightOffer[] : [...current, ...data.offers as FlightOffer[]];
        return merged.sort((a, b) => a.price - b.price).filter((offer, index, all) => all.findIndex(item => item.id === offer.id) === index);
      });
      setCheckedPairs(current => batch === 0 ? data.checked : current + data.checked);
      setTotalPairs(data.totalCandidates);
      setHasMoreDates(data.moreAvailable);
      setNextBatch(data.nextBatch);
      setUsageRemaining(data.usageRemaining);
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
      setProviderKeyConfigured(false); setProviderKeyUsage(null); setProviderKeyValue("");
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
      min_nights: search.minNights, max_nights: search.maxNights, travellers: search.travellers, price_alert_enabled: alertEnabled,
      target_price: alertTarget ? Number(alertTarget) : null,
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

  async function toggleSavedAlert(item: SavedSearch) {
    const supabase = getSupabase();
    if (!supabase) return;
    const enabled = !item.price_alert_enabled;
    const { error: updateError } = await supabase.from("saved_searches").update({ price_alert_enabled: enabled }).eq("id", item.id);
    if (updateError) setToast("Couldn’t update that alert.");
    else {
      setSaved(current => current.map(searchItem => searchItem.id === item.id ? { ...searchItem, price_alert_enabled: enabled } : searchItem));
      setToast(enabled ? "Fare alert preference saved." : "Fare alert turned off.");
    }
  }

  function restoreSearch(item: SavedSearch) {
    setSearch({ origin: item.origin, destination: item.destination, dateFrom: item.date_from, dateTo: item.date_to, minNights: item.min_nights, maxNights: item.max_nights, travellers: item.travellers });
    window.scrollTo({ top: 0, behavior: "smooth" });
    setToast("Search details restored. Search again for current prices.");
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
          <span className="market-pill"><span className="flag">CA</span> Canada · CAD</span>
          {userEmail ? <div className="account-menu"><span className="user-dot">{userEmail.slice(0, 1).toUpperCase()}</span><button className="text-button" onClick={openProviderKeySettings}>API key</button><button className="text-button" onClick={signOut}>Sign out</button></div> : <><button className="text-button" onClick={openProviderKeySettings}>Add API key</button><button className="sign-in" onClick={() => { setAccountMessage(""); setAccountOpen(true); }}>Sign in <span>↗</span></button></>}
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

      <section className="search-card" aria-labelledby="search-heading">
        <div className="card-heading">
          <div><span className="section-kicker">YOUR TRIP</span><h2 id="search-heading">Where can you go?</h2></div>
          <span className="round-trip"><span className="round-icon">↔</span> Return trip</span>
        </div>
        <form onSubmit={findFlights}>
          <div className="route-fields">
            <label className="input-block"><span>FROM</span><div className="input-wrap"><span className="field-symbol origin-symbol">●</span><input aria-label="From city or airport" value={search.origin} onChange={e => update("origin", e.target.value)} placeholder="City (airport code)" required /></div></label>
            <button className="swap-button" type="button" onClick={swapRoute} aria-label="Swap origin and destination">⇄</button>
            <label className="input-block"><span>TO</span><div className="input-wrap"><span className="field-symbol destination-symbol">◎</span><input aria-label="To city or airport" value={search.destination} onChange={e => update("destination", e.target.value)} placeholder="City (airport code)" required /></div></label>
          </div>
          <div className="range-row">
            <label className="input-block"><span>YOU CAN TRAVEL BETWEEN</span><div className="input-wrap date-input"><CalendarIcon /><input aria-label="Earliest travel date" type="date" min={iso(today)} value={search.dateFrom} onChange={e => update("dateFrom", e.target.value)} required /><span className="date-divider">and</span><input aria-label="Latest travel date" type="date" value={search.dateTo} min={search.dateFrom} onChange={e => update("dateTo", e.target.value)} required /></div></label>
            <label className="input-block nights-block"><span>TRIP LENGTH · DAYS INCLUDING DEPARTURE</span><div className="input-wrap nights-input"><select aria-label="Minimum trip length in days including departure" value={search.minNights} onChange={e => update("minNights", Number(e.target.value))}>{tripLengthOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="date-divider">to</span><select aria-label="Maximum trip length in days including departure" value={search.maxNights} onChange={e => update("maxNights", Number(e.target.value))}>{tripLengthOptions.filter(option => option.value >= search.minNights).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></label>
            <label className="input-block traveller-block"><span>TRAVELERS</span><div className="input-wrap traveller-input"><select aria-label="Number of travelers" value={search.travellers} onChange={e => update("travellers", Number(e.target.value))}>{[1,2,3,4,5,6,7,8,9].map(n => <option value={n} key={n}>{n} {n === 1 ? "adult" : "adults"}</option>)}</select></div></label>
          </div>
          <div className="alert-setting"><label className="alert-check"><input type="checkbox" checked={alertEnabled} onChange={e => setAlertEnabled(e.target.checked)} /><span className="fake-check">✓</span><span><strong>Email me when fares drop</strong><small>Alerts need live fares and email service setup</small></span></label><label className="target-price"><span>OPTIONAL TARGET · CAD</span><div><b>$</b><input aria-label="Optional target total fare in Canadian dollars" type="number" min="1" max="50000" placeholder="Any drop" value={alertTarget} onChange={e => setAlertTarget(e.target.value)} /></div></label></div>
          <div className="form-bottom"><p>We’ll check selected return dates inside your window and show their live prices.</p><button className="search-button" type="submit" disabled={loading}>{loading ? <><span className="spinner" /> Looking for dates…</> : <>Find cheaper dates <ArrowIcon /></>}</button></div>
        </form>
      </section>

      {searched && <section className="results-section" aria-live="polite">
        <div className="results-title-row"><div><span className="section-kicker">YOUR FARE WINDOW</span><h2>{search.origin.split(" (")[0]} <span className="route-arrow">→</span> {search.destination.split(" (")[0]}</h2><p>{prettyRange(search.dateFrom, search.dateTo)} · return trips · CAD</p></div>
          {offers.length > 0 && <button className="save-button" onClick={saveSearch} disabled={saveBusy}><span>＋</span> {saveBusy ? "Saving…" : "Save search"}</button>}
        </div>
        {loading && <div className="loading-panel"><span className="spinner spinner-dark" /> Checking available dates…</div>}
        {!loading && error && <div className="empty-panel"><span className="empty-spark"><SparkIcon /></span><strong>{error}</strong><span>Try adjusting the range or trip length.</span></div>}
        {!loading && offers.length > 0 && <>
          <div className="fare-summary"><div className="summary-icon"><SparkIcon /></div><div><span>LOWEST RETURN FARE FOUND</span><strong>${cheapest} <small>CAD</small></strong></div><p>Checked {checkedPairs} of {totalPairs} possible date pairs{usageRemaining !== null ? ` · ${usageRemaining} API searches left in this budget` : ""}</p></div>
          <div className="legend-row"><span className="legend-label">DATE PAIRS BY PRICE</span><span><i className="legend-dot best" /> Lowest</span><span><i className="legend-dot good" /> Good value</span><span><i className="legend-dot other" /> Other fares</span></div>
          <div className="offer-list">
            {offers.map((offer, index) => <article key={offer.id} className={`offer-card tier-${index < 2 ? "best" : index < 4 ? "good" : "other"}`}>
              <div className="offer-rank">{index === 0 ? <span className="best-tag"><SparkIcon /> LOWEST</span> : <span className="rank-label">OPTION {String(index + 1).padStart(2, "0")}</span>}<span className="offer-source">{offer.source}</span></div>
              <div className="offer-main">
                <div className="date-pair"><div><span>GO</span><strong>{prettyDate(offer.departureDate)}</strong><small>{offer.outboundTime}</small></div><div className="pair-connector"><span /><ArrowIcon /><span /></div><div><span>RETURN</span><strong>{prettyDate(offer.returnDate)}</strong><small>Round trip date</small></div></div>
              <div className="offer-price"><strong>${offer.price}</strong><span>CAD · {search.travellers} {search.travellers === 1 ? "traveler" : "travelers"}</span></div>
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
        {saved.length === 0 ? <div className="saved-empty">Save a route and date window to find it here again.</div> : <div className="saved-list">{saved.map(item => <div className="saved-item" key={item.id}><button className="saved-restore" onClick={() => restoreSearch(item)}><span>{item.origin.split(" (")[0]} <i>→</i> {item.destination.split(" (")[0]}</span><small>{prettyRange(item.date_from, item.date_to)} · round trip</small></button><button className={`alert-pill ${item.price_alert_enabled ? "on" : "off"}`} onClick={() => toggleSavedAlert(item)} title="Turn fare alert preference on or off"><span /> {item.price_alert_enabled ? item.target_price ? `Alert preference · under $${item.target_price}` : "Alert preference on" : "Alert preference off"}</button><button className="delete-saved" onClick={() => removeSaved(item.id)} aria-label="Delete saved search">×</button></div>)}</div>}
      </section>}

      <footer className="footer"><div className="footer-brand"><span className="brand-mark small"><SparkIcon /></span><span>Fare <span className="brand-glow">Glow</span></span></div><span>Find the days that make the trip.</span><span className="footer-country">Made for Canadian travellers · CAD</span></footer>

      {accountOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAccountOpen(false); }}><section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title"><button className="modal-close" onClick={() => setAccountOpen(false)} aria-label="Close">×</button><span className="modal-mark"><SparkIcon /></span><span className="section-kicker">FARE GLOW ACCOUNT</span><h2 id="account-title">Keep your dates close.</h2><p>Sign in to save searches and set fare alert preferences.</p>
        {supabaseReady ? <form onSubmit={signIn}><label className="input-block"><span>EMAIL ADDRESS</span><div className="input-wrap"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></div></label><button className="search-button modal-submit" type="submit" disabled={accountBusy}>{accountBusy ? "Sending link…" : "Email me a sign-in link"}<ArrowIcon /></button></form> : <div className="setup-note"><strong>Account connection needed</strong><span>Supabase account details are not set up yet. The setup guide explains how to switch on sign-in and saved searches.</span></div>}
        {accountMessage && <p className="account-message" role="status">{accountMessage}</p>}<small className="privacy-note">A password isn’t needed. We’ll send a secure one-time link.</small>
      </section></div>}
      {providerKeyOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setProviderKeyOpen(false); }}><section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="provider-key-title"><button className="modal-close" onClick={() => setProviderKeyOpen(false)} aria-label="Close">×</button><span className="modal-mark"><SparkIcon /></span><span className="section-kicker">YOUR FLIGHT SEARCHES</span><h2 id="provider-key-title">Connect your SerpApi key.</h2><p>{byokMode ? "Use your own SerpApi account. Its free plan includes up to 250 searches per month; Fare Glow shows the remaining allowance and stops at 250." : "Optionally use your own SerpApi key for your searches. Without one, Fare Glow uses the app's shared key."}</p>{providerKeyConfigured && <div className="setup-note"><strong>SerpApi key connected</strong><span>{providerKeyUsage === null ? "Your key is saved and hidden." : `${providerKeyUsage} searches remain in this month's allowance.`} The key is encrypted on the server and never shown again.</span></div>}<form onSubmit={updateProviderKey}><label className="input-block"><span>{providerKeyConfigured ? "REPLACE KEY" : "SERPAPI PRIVATE KEY"}</span><div className="input-wrap"><input type="password" autoComplete="new-password" value={providerKeyValue} onChange={event => setProviderKeyValue(event.target.value)} placeholder={providerKeyConfigured ? "Enter a replacement key" : "Paste your SerpApi key"} required /></div></label><button className="search-button modal-submit" type="submit" disabled={providerKeyBusy}>{providerKeyBusy ? "Checking and saving…" : providerKeyConfigured ? "Replace key" : "Save key"}<ArrowIcon /></button></form>{providerKeyConfigured && <button className="text-button remove-provider-key" onClick={removeProviderKey} disabled={providerKeyBusy}>Remove saved key</button>}{providerKeyMessage && <p className="account-message" role="status">{providerKeyMessage}</p>}<small className="privacy-note">Your SerpApi key is managed under your account. <a href="https://serpapi.com/" target="_blank" rel="noreferrer">SerpApi account</a></small></section></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
