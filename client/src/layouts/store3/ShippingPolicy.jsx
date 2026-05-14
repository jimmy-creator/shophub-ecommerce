import StaticPage from './StaticPage';

export default function ShippingPolicy() {
  return (
    <StaticPage
      title="Shipping Policy"
      description="Kalif Dates & Nuts shipping information. Delivery across India from our Kondotty facility."
    >
      <p className="s2-static-date">Last updated: May 2026</p>

      <section className="s2-static-section">
        <h2>Where We Deliver</h2>
        <p>
          We ship across India from our facility in Kondotty, Kerala. Most PIN codes are serviceable; for a few remote locations we will reach out before dispatch if a delivery cannot be confirmed. International shipping is offered only on a case-by-case basis for wholesale orders — write to us if that's what you need.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>1. Processing Time</h2>
        <p>Orders are packed and dispatched within <strong>1–2 business days</strong> of payment confirmation. Orders placed on Sundays or public holidays are processed on the next working day. Custom and bulk B2B orders may take 3–5 business days to prepare and will be confirmed at the quote stage.</p>
      </section>

      <section className="s2-static-section">
        <h2>2. Delivery Timeframes</h2>
        <p>Estimated transit times from dispatch (not counting processing days):</p>
        <table className="s2-static-table">
          <thead>
            <tr>
              <th>Destination</th>
              <th>Estimated Transit</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Kerala (local)</td><td>1–2 business days</td></tr>
            <tr><td>South India (TN, KA, AP, TS, Puducherry)</td><td>2–3 business days</td></tr>
            <tr><td>Rest of India (metros)</td><td>3–5 business days</td></tr>
            <tr><td>North-East, J&amp;K, Ladakh, remote PINs</td><td>5–8 business days</td></tr>
          </tbody>
        </table>
        <p>These are courier estimates, not guarantees — actual times can vary with weather, festivals, and regional courier conditions.</p>
      </section>

      <section className="s2-static-section">
        <h2>3. Shipping Charges</h2>
        <ul>
          <li><strong>Free shipping</strong> on orders above ₹500.</li>
          <li>For smaller orders, a flat shipping fee (typically ₹40–₹100) is calculated by destination and weight.</li>
          <li>The exact shipping cost is shown at checkout before you pay.</li>
          <li>Wholesale and B2B shipping is quoted separately per order.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>4. Order Tracking</h2>
        <p>Once your order is shipped, you will receive a tracking link by email and SMS. You can also view live status under <strong>My Orders</strong> on our website.</p>
      </section>

      <section className="s2-static-section">
        <h2>5. Failed Delivery</h2>
        <p>If the courier cannot reach you, they will normally attempt redelivery for up to two more days. After repeated failed attempts the parcel may be returned to us — we'll contact you to either reship (additional shipping may apply) or refund per our <a href="/refund-policy">Refund Policy</a>.</p>
      </section>

      <section className="s2-static-section">
        <h2>6. Damaged in Transit</h2>
        <p>If your parcel arrives with visible damage to the carton or pack, please don't sign for it as received without noting the damage. Take photos and contact us within <strong>48 hours of delivery</strong> — full details are in our <a href="/return-policy">Return Policy</a> and <a href="/refund-policy">Refund Policy</a>.</p>
      </section>

      <section className="s2-static-section">
        <h2>7. Storage on Arrival</h2>
        <p>Most Kalif products are best stored in a cool, dry place away from direct sunlight; some date varieties keep longer in the refrigerator. Storage and best-before details are printed on each pack — please follow them, since storage issues after delivery are not covered by our refund policy.</p>
      </section>

      <section className="s2-static-section">
        <h2>8. Contact</h2>
        <p>For shipping questions, reach us at:</p>
        <p>
          📞 / WhatsApp: <a href="tel:+917510762657">+91 75107 62657</a><br />
          📧 <a href="mailto:mail@kalif.co">mail@kalif.co</a>
        </p>
      </section>
    </StaticPage>
  );
}
