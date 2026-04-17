import StaticPage from './StaticPage';

export default function ShippingPolicy() {
  return (
    <StaticPage
      title="Shipping Policy"
      description="Zayara Mobile Phones LLC shipping information. Fast delivery across Fujairah and the UAE."
    >
      <p className="s2-static-date">Last updated: April 2025</p>

      <section className="s2-static-section">
        <h2>Delivery Coverage</h2>
        <p>We deliver to all Emirates across the UAE. For customers in Fujairah, same-day or next-day delivery is often available depending on your location and order time.</p>
      </section>

      <section className="s2-static-section">
        <h2>1. Processing Time</h2>
        <p>Orders are processed within <strong>1–2 business days</strong> after payment confirmation. Orders placed on weekends or UAE public holidays will be processed the next working day.</p>
      </section>

      <section className="s2-static-section">
        <h2>2. Delivery Timeframes</h2>
        <table className="s2-static-table">
          <thead>
            <tr>
              <th>Location</th>
              <th>Estimated Delivery</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Fujairah (local)</td><td>Same day – 1 business day</td></tr>
            <tr><td>Dubai, Sharjah, Ajman</td><td>1–2 business days</td></tr>
            <tr><td>Abu Dhabi, Al Ain</td><td>2–3 business days</td></tr>
            <tr><td>Ras Al Khaimah, Umm Al Quwain</td><td>1–3 business days</td></tr>
            <tr><td>Remote areas</td><td>3–5 business days</td></tr>
          </tbody>
        </table>
      </section>

      <section className="s2-static-section">
        <h2>3. Shipping Charges</h2>
        <ul>
          <li><strong>Free shipping</strong> on orders above AED 200.</li>
          <li>A flat shipping fee of <strong>AED 15–25</strong> applies to orders below AED 200 depending on location.</li>
          <li>Exact shipping cost is shown at checkout before payment.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>4. Order Tracking</h2>
        <p>Once your order is shipped, you will receive an SMS or email with tracking information. You can also view your order status in real time under <strong>My Orders</strong> on our website.</p>
      </section>

      <section className="s2-static-section">
        <h2>5. Failed Delivery</h2>
        <p>If a delivery attempt fails because no one is available to receive the order, our courier will try again the next business day. After two failed attempts, the order will be returned to our store and you will need to arrange re-delivery or collection.</p>
      </section>

      <section className="s2-static-section">
        <h2>6. In-Store Pickup</h2>
        <p>You can also choose to pick up your order directly from our store at no additional cost:</p>
        <p><strong>📍 Murbah St, Fujairah, UAE</strong><br />
        Saturday – Thursday: 9:00 AM – 10:00 PM<br />
        Friday: 2:00 PM – 10:00 PM</p>
      </section>

      <section className="s2-static-section">
        <h2>7. Contact</h2>
        <p>For shipping queries, reach us at:<br />
        📞 <a href="tel:+971506397752">+971 50 639 7752</a> &nbsp;|&nbsp;
        📧 <a href="mailto:zayaraelectronics@gmail.com">zayaraelectronics@gmail.com</a></p>
      </section>
    </StaticPage>
  );
}
