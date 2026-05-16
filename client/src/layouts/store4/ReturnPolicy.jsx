import StaticPage from './StaticPage';

export default function ReturnPolicy() {
  return (
    <StaticPage
      title="Return Policy"
      description="Anfal Sports return policy. 14-day returns on unused items in original packaging across our two stores and online."
    >
      <p className="s2-static-date">Last updated: May 2026</p>

      <section className="s2-static-section">
        <h2>14-Day Returns, No Hassle</h2>
        <p>
          You have <strong>14 days</strong> from the date of in-store purchase or delivery to return any unused item in original packaging for a refund or exchange. Tags on, box intact, shoes haven't walked outdoors.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>1. What We Accept</h2>
        <ul>
          <li>Footwear in original box, no scuffs or wear on the outsole.</li>
          <li>Apparel with all tags attached and in unworn condition.</li>
          <li>Equipment and accessories in original packaging and unused.</li>
          <li>Items must include any free gifts, manuals or warranty cards that came with them.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>2. What We Don't Accept</h2>
        <ul>
          <li>Worn shoes (we check the outsole).</li>
          <li>Used or opened socks, underwear, swimwear, mouthguards — hygiene items.</li>
          <li>Customised gear (printed names/numbers, custom-strung rackets, etc.).</li>
          <li>Sale or clearance items marked "Final Sale".</li>
          <li>Items past the 14-day window.</li>
          <li>Items damaged through use, mishandling or washing not per label.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>3. How to Return</h2>
        <ol>
          <li><strong>In-store</strong>: walk in to either branch with the item and your receipt or order number. Refund or exchange on the spot.</li>
          <li><strong>By courier</strong>: contact us by email or WhatsApp with your order number. We'll share return instructions. For change-of-mind returns the customer covers return shipping; for damaged or wrong items we cover it.</li>
          <li><strong>Inspection</strong>: items are inspected before the refund is processed. If something fails the check (e.g. clear wear) we'll be in touch to discuss next steps.</li>
        </ol>
      </section>

      <section className="s2-static-section">
        <h2>4. Exchanges</h2>
        <p>
          Wrong size? Wrong colour? Bring it back within 14 days for an exchange. Subject to stock availability at the branch you visit — if the size you want is at the other store, we can usually transfer it over within 1–2 days.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>5. Damaged or Defective on Arrival</h2>
        <p>
          Report within <strong>7 days of receipt</strong> with photos. We arrange free pickup and offer a replacement, repair (where the manufacturer's warranty applies), or refund.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>6. Refund Timeline & Method</h2>
        <p>
          Refunds processed within <strong>5–10 business days</strong> of receiving the return, credited to the original payment method. See our <a href="/refund-policy">Refund Policy</a> for the full breakdown.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>7. Contact</h2>
        <p>
          <strong>Anfal Sports</strong> (Anfal Sports W.L.L.)<br />
          📍 Yaal Mall, Kuwait City<br />
          📧 <a href="mailto:info@anfalsports.com">info@anfalsports.com</a><br />
          📞 / WhatsApp: <a href="tel:+96500000000">+965 0000 0000</a>
        </p>
      </section>
    </StaticPage>
  );
}
