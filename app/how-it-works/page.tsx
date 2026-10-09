export default function HowItWorksPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Fare Glow home">
          <span className="brand-mark" aria-hidden="true">✦</span><span>Fare <span className="brand-glow">Glow</span></span>
        </a>
        <div className="top-actions"><a className="how-link" href="/feedback">Feedback</a><a className="sign-in" href="/">Find fares <span>↗</span></a></div>
      </header>

      <section className="mission-section how-page" aria-labelledby="mission-heading">
        <div className="mission-intro">
          <span className="section-kicker">WHY FARE GLOW</span>
          <h1 id="mission-heading">Have time off coming up? Find dates that may cost less.</h1>
          <p>Tell Fare Glow when you can travel, where you want to go, and how long you want to stay. Compare the return fares found for selected dates, then decide what works for you.</p>
        </div>
        <ol className="mission-workflow" aria-label="How Fare Glow works">
          <li className="mission-step"><span className="mission-number">1</span><div><h2>Choose your dates</h2><p>Pick the earliest and latest dates you could travel.</p></div><div className="mission-visual mission-dates" aria-hidden="true"><span>OCT</span><b>12</b><i>to</i><b>19</b></div></li>
          <li className="mission-step"><span className="mission-number">2</span><div><h2>Choose a place and trip length</h2><p>Enter where you want to go and how many days you can be away.</p></div><div className="mission-visual mission-route" aria-hidden="true"><span>HOME</span><b>→</b><span>AWAY</span></div></li>
          <li className="mission-step"><span className="mission-number">3</span><div><h2>Find affordable dates</h2><p>Fare Glow uses an optimized search within your date window and trip length. It checks up to 8 return-date pairs per search and highlights the lowest fares it finds.</p></div><div className="mission-visual mission-price" aria-hidden="true"><span>RETURN FARE</span><b>Compare</b></div></li>
        </ol>
        <div className="mission-example"><strong>For example:</strong> If you have a week off in October and want to visit Lisbon, compare fares for return trips that fit your dates. If you find a lower fare, you could put the money saved toward another trip or something fun while you’re there.</div>
        <p className="mission-audience"><strong>Who is it for?</strong> Anyone hoping to spend less by being flexible with flight dates: people planning vacation around work, families planning around school breaks, students, and budget-conscious travellers. Fares can change, and only the dates checked are compared.</p>
      </section>

      <footer className="footer"><div className="footer-brand"><span className="brand-mark small" aria-hidden="true">✦</span><span>Fare <span className="brand-glow">Glow</span></span></div><span>Find the days that make the trip.</span><span className="footer-country"><a href="/feedback">Community feedback</a> · <a href="/">Back to flight search</a></span><span className="footer-credit">Dileep Kodira App</span></footer>
    </main>
  );
}
