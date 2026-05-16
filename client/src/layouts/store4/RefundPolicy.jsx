import StaticPage from './StaticPage';

export default function RefundPolicy() {
  return (
    <StaticPage
      title="Refund Policy"
      description="Anfal Sports refund policy. Returns accepted within 14 days on unused items in original packaging."
    >
      <p className="s2-static-date">Last updated: May 2026</p>

      <section className="s2-static-section">
        <h2>Our Position</h2>
        <p>
          We want you to be happy with what you bought. If the size doesn't fit, the colour isn't quite right, or you simply changed your mind — bring it back within <strong>14 days</strong> in original condition and we'll refund or exchange it.
        </p>
        <p>
          Anything that arrived damaged, wrong or defective is on us — report within 7 days with photos and we'll cover the cost of resolution.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>1. Refund-Eligible Returns</h2>
        <ul>
          <li><strong>Unused, unworn, in original packaging</strong> with all tags, labels and accessories attached.</li>
          <li>Returned within <strong>14 days</strong> of in-store purchase or delivery.</li>
          <li>Proof of purchase: original receipt or order number.</li>
          <li>For online orders, the original courier packaging should be intact where possible.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>2. Non-Refundable Items</h2>
        <ul>
          <li>Worn shoes (outsoles must be unmarked).</li>
          <li>Opened/used socks, underwear, swimwear, mouthguards and similar hygiene items.</li>
          <li>Customised or personalised items (printed jerseys, custom-strung rackets, etc.).</li>
          <li>Gift cards.</li>
          <li>Sale or clearance items marked "Final Sale".</li>
          <li>Items damaged through use, washing, or normal wear and tear.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>3. Damaged, Wrong or Defective</h2>
        <p>
          Contact us within <strong>7 days of receipt</strong> with your order number and clear photos. We will arrange a free pickup and either replace, repair under warranty (manufacturer-permitting), or refund — your choice.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>4. How Refunds Are Issued</h2>
        <ul>
          <li>Refunds are processed within <strong>5–10 business days</strong> after we receive and inspect the returned item.</li>
          <li>Credited back to the <strong>original payment method</strong> (KNET, card via Tap Payments, etc.).</li>
          <li>Cash purchases made in-store are refunded by cash or store credit at the same branch.</li>
          <li>The original delivery charge is non-refundable unless the return is due to our error.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>5. In-Store vs Online Purchases</h2>
        <p>
          You may return online orders to either of our physical stores or by courier (return shipping at customer cost for change-of-mind returns). In-store purchases are returned to the same branch.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>6. Contact</h2>
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
