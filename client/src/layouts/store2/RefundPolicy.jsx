import StaticPage from './StaticPage';

export default function RefundPolicy() {
  return (
    <StaticPage
      title="Refund Policy"
      description="Zayara Mobile Phones LLC refund and return policy. Easy returns within 7 days of purchase."
    >
      <p className="s2-static-date">Last updated: April 2025</p>

      <section className="s2-static-section">
        <h2>Our Commitment</h2>
        <p>At Zayara, your satisfaction is our priority. If you are not completely satisfied with your purchase, we offer a straightforward return and refund process.</p>
      </section>

      <section className="s2-static-section">
        <h2>1. Return Window</h2>
        <p>You may return eligible items within <strong>7 days</strong> of the purchase or delivery date. Items must be:</p>
        <ul>
          <li>In their original, unused condition.</li>
          <li>In original packaging with all accessories, manuals, and warranty cards included.</li>
          <li>Accompanied by proof of purchase (order number or receipt).</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>2. Non-Returnable Items</h2>
        <p>The following items cannot be returned or refunded:</p>
        <ul>
          <li>Opened earphones, headphones, or any in-ear audio products (for hygiene reasons).</li>
          <li>Devices with physical damage caused after purchase.</li>
          <li>Products with broken or tampered warranty seals.</li>
          <li>Digital products or software licences.</li>
          <li>Items purchased during clearance or final sale promotions.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>3. Defective or Damaged Items</h2>
        <p>If you receive a defective or damaged product, please contact us within <strong>48 hours</strong> of delivery with photos of the item. We will arrange a replacement or full refund at no additional cost to you.</p>
      </section>

      <section className="s2-static-section">
        <h2>4. Refund Process</h2>
        <p>Once we receive and inspect the returned item:</p>
        <ul>
          <li>Refunds are processed within <strong>5–7 business days</strong>.</li>
          <li>For online orders paid via card, refunds are credited to the original payment method.</li>
          <li>For in-store cash purchases, refunds are issued as store credit or cash (at our discretion).</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>5. Repair Warranty</h2>
        <p>All repairs carried out at Zayara come with a <strong>30-day warranty</strong> on parts and labour. If the same issue recurs within this period, we will re-repair at no charge.</p>
      </section>

      <section className="s2-static-section">
        <h2>6. How to Initiate a Return</h2>
        <p>To start a return, contact us via:</p>
        <ul>
          <li>📧 Email: <a href="mailto:zayaraelectronics@gmail.com">zayaraelectronics@gmail.com</a></li>
          <li>📞 Phone / WhatsApp: <a href="tel:+971506397752">+971 50 639 7752</a></li>
          <li>📍 Walk in: Murbah St, Fujairah, UAE</li>
        </ul>
        <p>Please have your order number ready when you contact us.</p>
      </section>
    </StaticPage>
  );
}
