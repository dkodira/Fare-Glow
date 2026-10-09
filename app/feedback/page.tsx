"use client";

import { type FormEvent, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type FeedbackItem = { id: string; category: string; message: string; created_at: string };

export default function FeedbackPage() {
  const [category, setCategory] = useState("Idea");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadFeedback(nextOffset = 0, append = false) {
    setLoading(true);
    try {
      const response = await fetch(`/api/feedback?limit=20&offset=${nextOffset}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load feedback.");
      const items = (data.feedback ?? []) as FeedbackItem[];
      setFeedback(current => append ? [...current, ...items] : items);
      setOffset(nextOffset + items.length);
      setHasMore(Boolean(data.hasMore));
    } catch {
      setNotice("Feedback could not load. Please try again in a moment.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadFeedback(0, false); }, []);

  async function submitFeedback(event: FormEvent) {
    event.preventDefault();
    const cleanMessage = message.trim();
    if (cleanMessage.length < 5) { setNotice("Please add a little more detail (at least 5 characters)."); return; }
    setBusy(true);
    setNotice("");
    const supabase = getSupabase();
    if (!supabase) { setNotice("Feedback is not connected yet. Supabase setup is required."); setBusy(false); return; }
    const { error } = await supabase.from("user_feedback").insert({ category, message: cleanMessage });
    if (error) setNotice("We couldn’t post that feedback. Run the Supabase migration, then try again.");
    else {
      setMessage("");
      setNotice("Thanks for sharing. Your feedback is now on the public board.");
      await loadFeedback(0, false);
    }
    setBusy(false);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Fare Glow home">
          <span className="brand-mark" aria-hidden="true">✦</span><span>Fare <span className="brand-glow">Glow</span></span>
        </a>
        <div className="top-actions">
          <a className="how-link" href="/how-it-works">How it works</a>
          <a className="sign-in" href="/">Find fares <span>↗</span></a>
        </div>
      </header>

      <section className="feedback-section feedback-page-section" aria-labelledby="feedback-heading">
        <div className="feedback-intro">
          <span className="section-kicker">COMMUNITY FEEDBACK</span>
          <h1 id="feedback-heading">Help make Fare Glow better.</h1>
          <p>Share an idea or tell us what isn’t working. Everyone can read posts on this page, so please don’t include private or sensitive details.</p>
        </div>
        <form className="feedback-form" onSubmit={submitFeedback}>
          <label className="input-block"><span>WHAT KIND OF FEEDBACK?</span><div className="input-wrap"><select value={category} onChange={event => setCategory(event.target.value)}><option>Idea</option><option>Something is broken</option><option>Other</option></select></div></label>
          <label className="input-block"><span>YOUR FEEDBACK</span><textarea value={message} onChange={event => setMessage(event.target.value)} minLength={5} maxLength={2000} placeholder="Tell us what would make planning easier…" required /></label>
          <div className="feedback-form-bottom"><small>{message.length}/2000 characters · visible to everyone</small><button className="search-button" type="submit" disabled={busy}>{busy ? "Posting…" : "Post feedback"}<span aria-hidden="true">↗</span></button></div>
          {notice && <p className="feedback-notice" role="status">{notice}</p>}
        </form>

        <div className="feedback-board-heading"><h2>Recent feedback</h2><span>Public community board · {feedback.length} shown</span></div>
        {feedback.length === 0 && !loading ? <div className="saved-empty">{notice.includes("could not load") ? "The feedback board is temporarily unavailable." : "No feedback yet. You can be the first to share an idea."}</div> : <div className="public-feedback-list">{feedback.map(item => <article className="public-feedback-item" key={item.id}><div><span className="feedback-category">{item.category}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</time></div><p>{item.message}</p></article>)}</div>}
        {hasMore && <button className="load-feedback" type="button" disabled={loading} onClick={() => loadFeedback(offset, true)}>{loading ? "Loading…" : "Show more feedback"}</button>}
      </section>

      <footer className="footer"><div className="footer-brand"><span className="brand-mark small" aria-hidden="true">✦</span><span>Fare <span className="brand-glow">Glow</span></span></div><span>Find the days that make the trip.</span><span className="footer-country"><a href="/">Back to flight search</a></span><span className="footer-credit">Dileep Kodira App</span></footer>
    </main>
  );
}
