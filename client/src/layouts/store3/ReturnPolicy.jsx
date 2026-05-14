import StaticPage from './StaticPage';

export default function ReturnPolicy() {
  return (
    <StaticPage
      title="Return Policy"
      description="Kalif sells food products and does not accept returns, except for items that arrive damaged, wrong, or defective."
    >
      <p className="s2-static-date">Last updated: May 2026</p>

      <section className="s2-static-section">
        <h2>No Returns on Food Products</h2>
        <p>
          Kalif products are <strong>fresh and lightly-processed food</strong>. For reasons of <strong>food safety, hygiene and perishability</strong>, we do not accept returns once an order has been dispatched. Please order what you need.
        </p>
        <p>
          We will, however, resolve any order that arrives <strong>damaged, wrong, or defective</strong>. Those situations are covered below and in our <a href="/refund-policy">Refund Policy</a>.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>1. The Three Exceptions</h2>
        <p>We will replace or refund (your choice) if any of the following applies:</p>
        <ul>
          <li><strong>Damaged in transit</strong> — the outer carton or an inner pack arrived broken, crushed, or leaking.</li>
          <li><strong>Wrong item shipped</strong> — what we sent does not match what you ordered.</li>
          <li><strong>Defective on arrival</strong> — the sealed pack shows a clear quality issue (visible mould, foreign matter, off smell at first opening, broken vacuum seal, etc.).</li>
        </ul>
        <p>Each of these must be reported within <strong>48 hours of delivery</strong> with photos. After 48 hours we are unable to verify what happened to the food before opening, so the window cannot be extended.</p>
      </section>

      <section className="s2-static-section">
        <h2>2. What Is Not Considered a Return Reason</h2>
        <ul>
          <li>Change of mind after placing the order.</li>
          <li>Packs that have been opened, partly consumed, or stored away from the conditions on the label.</li>
          <li>Natural variation in taste, sweetness, texture, colour or moisture — agricultural produce is not identical across batches.</li>
          <li>Wrong delivery address provided by you, or refusing a parcel that arrived in good condition.</li>
          <li>Items past their best-before date if the order was delivered with reasonable shelf life remaining at the time of dispatch.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>3. How to Raise an Issue</h2>
        <ol>
          <li>Contact us within 48 hours of delivery via email or WhatsApp.</li>
          <li>Send your <strong>order number</strong>, a short description, and clear photos: outer parcel, the affected pack(s), and a close-up of the label.</li>
          <li>Please keep the product and packaging until your case is resolved — we may need additional photos or to arrange a pickup.</li>
          <li>We will acknowledge within 1 business day and confirm the resolution after a quick review.</li>
        </ol>
      </section>

      <section className="s2-static-section">
        <h2>4. What Happens Next</h2>
        <p>
          Once your report is verified, you can pick between a <strong>replacement</strong> on the next dispatch day or a <strong>refund</strong> per our <a href="/refund-policy">Refund Policy</a>. Where the issue is on us (damaged / wrong / defective), there is no return-shipping cost to you.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>5. Wholesale &amp; B2B</h2>
        <p>
          The same rules apply to wholesale and B2B orders. Custom-packed or co-branded bulk orders, once dispatched, are non-returnable except where the goods themselves are damaged, wrong, or defective.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>6. Contact</h2>
        <p>
          <strong>Kalif Dates &amp; Nuts</strong> (Tamar International)<br />
          📍 6/559 Neerad, Kondotty, Kerala 673638, India<br />
          📧 <a href="mailto:mail@kalif.co">mail@kalif.co</a><br />
          📞 / WhatsApp: <a href="tel:+917510762657">+91 75107 62657</a>
        </p>
      </section>
    </StaticPage>
  );
}
