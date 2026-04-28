import StaticPage from './StaticPage';

export default function ReturnPolicy() {
  return (
    <StaticPage
      title="Return Policy"
      description="Zayara Mobile Phones LLC return policy. Easy returns within 7 days for eligible items across the UAE."
    >
      <p className="s2-static-date">Last updated: April 2025</p>

      <section className="s2-static-section">
        <h2>Our Promise</h2>
        <p>At Zayara, every device is checked before it leaves our store. If something is not right with your order, we want to make the return process as simple as possible. This policy explains how returns work — for refund timelines and methods, please also see our <a href="/refund-policy">Refund Policy</a>.</p>
      </section>

      <section className="s2-static-section">
        <h2>1. Return Window</h2>
        <p>You may request a return within <strong>7 days</strong> of delivery or in-store purchase. Items must be:</p>
        <ul>
          <li>In their original, unused condition.</li>
          <li>In the original sealed packaging with all accessories, manuals, free gifts, and warranty cards.</li>
          <li>Free from physical damage, scratches, or signs of use.</li>
          <li>Accompanied by the original invoice or order number.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>2. Eligible for Return</h2>
        <ul>
          <li>Smartphones and tablets (sealed and unused).</li>
          <li>Accessories such as cases, cables, chargers, and power banks (in original packaging).</li>
          <li>Smartwatches and wearables (factory-sealed).</li>
          <li>Defective or damaged products reported within 48 hours of delivery.</li>
          <li>Wrong item or wrong model received.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>3. Non-Returnable Items</h2>
        <ul>
          <li>Opened earphones, headphones, or any in-ear audio products (for hygiene reasons).</li>
          <li>Devices that have been activated, registered, or have user data on them.</li>
          <li>Products with broken or tampered warranty seals.</li>
          <li>Items damaged due to mishandling, water, or physical impact after delivery.</li>
          <li>Screen protectors, SIM cards, prepaid recharge vouchers, and digital licences.</li>
          <li>Items purchased during clearance or marked as final sale.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>4. Damaged or Defective on Arrival</h2>
        <p>If your order arrives damaged or has a manufacturing defect, please contact us within <strong>48 hours</strong> of delivery with clear photos and a short video of the issue. We will arrange a free pickup and offer a replacement, repair under warranty, or full refund — whichever you prefer.</p>
      </section>

      <section className="s2-static-section">
        <h2>5. How to Initiate a Return</h2>
        <ol>
          <li>Contact us by phone, WhatsApp, or email with your order number and reason for return.</li>
          <li>Our team will confirm eligibility and share return instructions within one business day.</li>
          <li>You can either drop the item off at our Fujairah store or schedule a pickup (charges may apply for non-defective returns).</li>
          <li>Once we receive and inspect the item, we will start the refund or exchange as per our <a href="/refund-policy">Refund Policy</a>.</li>
        </ol>
      </section>

      <section className="s2-static-section">
        <h2>6. Exchanges</h2>
        <p>If you would prefer to exchange an item for a different model or colour instead of a refund, please mention this when raising your return request. Exchanges are subject to stock availability and any price difference will be settled at the time of exchange.</p>
      </section>

      <section className="s2-static-section">
        <h2>7. Return Shipping</h2>
        <ul>
          <li>For damaged, defective, or wrong items, return shipping is <strong>free</strong>.</li>
          <li>For change-of-mind returns, the customer is responsible for return shipping costs.</li>
          <li>We recommend using a trackable courier — Zayara is not responsible for items lost in return transit.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>8. Need Help?</h2>
        <p>Our team is happy to assist with any return-related question:</p>
        <ul>
          <li>📧 Email: <a href="mailto:zayaraelectronics@gmail.com">zayaraelectronics@gmail.com</a></li>
          <li>📞 Phone / WhatsApp: <a href="tel:+971506397752">+971 50 639 7752</a></li>
          <li>📍 Walk in: Murbah St, Fujairah, UAE</li>
        </ul>
        <p>Store hours: Saturday – Thursday 9:00 AM – 10:00 PM, Friday 2:00 PM – 10:00 PM.</p>
      </section>
    </StaticPage>
  );
}
