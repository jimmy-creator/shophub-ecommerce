import StaticPage from './StaticPage';

export default function ShippingPolicy() {
  return (
    <StaticPage
      title="Shipping Policy"
      description="Anfal Sports delivery across Kuwait. Free over a minimum order, same-day on most areas."
    >
      <p className="s2-static-date">Last updated: May 2026</p>

      <section className="s2-static-section">
        <h2>Where We Deliver</h2>
        <p>
          We deliver across Kuwait. For most Kuwait City and Hawalli areas we can usually arrange same-day or next-day delivery; outlying governorates take a day or two longer.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>1. Processing Time</h2>
        <p>
          Online orders placed before 4 PM on a working day are typically dispatched the same day. Orders placed later, on Fridays or public holidays go out on the next working day.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>2. Delivery Timeframes</h2>
        <table className="s2-static-table">
          <thead>
            <tr>
              <th>Area</th>
              <th>Estimated Delivery</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Kuwait City, Hawalli</td><td>Same day – 1 business day</td></tr>
            <tr><td>Farwaniya, Mubarak Al-Kabeer</td><td>1–2 business days</td></tr>
            <tr><td>Ahmadi, Jahra</td><td>2–3 business days</td></tr>
          </tbody>
        </table>
      </section>

      <section className="s2-static-section">
        <h2>3. Shipping Charges</h2>
        <ul>
          <li><strong>Free home delivery</strong> on orders above the minimum order value (shown at checkout).</li>
          <li>Flat delivery fee for orders below the threshold; exact amount shown at checkout.</li>
          <li>Cash on Delivery may carry a small handling fee.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>4. Click &amp; Collect</h2>
        <p>
          Order online and pick up from either of our physical stores within 1–2 hours of dispatch confirmation, free of charge. You'll receive an SMS / email when it's ready.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>5. Order Tracking</h2>
        <p>
          Once your order is shipped, you'll receive a confirmation with tracking information. You can also view live status under <strong>My Orders</strong> on our website.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>6. Failed Delivery</h2>
        <p>
          If the courier can't reach you, they'll attempt redelivery for up to 2 more days. After repeated failed attempts the parcel returns to us — we'll contact you to either reship (additional fee may apply) or refund per our <a href="/refund-policy">Refund Policy</a>.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>7. Damaged in Transit</h2>
        <p>
          If your parcel arrives with visible damage to the carton or product, take photos and contact us within <strong>7 days of delivery</strong>. Full details in our <a href="/return-policy">Return Policy</a> and <a href="/refund-policy">Refund Policy</a>.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>8. International Shipping</h2>
        <p>
          We currently ship within Kuwait only. For GCC or international orders, drop us a line and we can arrange on a case-by-case basis.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>9. Contact</h2>
        <p>
          📞 / WhatsApp: <a href="tel:+96500000000">+965 0000 0000</a><br />
          📧 <a href="mailto:info@anfalsports.com">info@anfalsports.com</a>
        </p>
      </section>
    </StaticPage>
  );
}
