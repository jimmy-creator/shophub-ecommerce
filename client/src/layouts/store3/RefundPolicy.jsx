import StaticPage from './StaticPage';

export default function RefundPolicy() {
  return (
    <StaticPage
      title="Refund Policy"
      description="Kalif Dates & Nuts refund policy. Because we sell food, refunds are limited to damaged, wrong, or defective items reported within 48 hours."
    >
      <p className="s2-static-date">Last updated: May 2026</p>

      <section className="s2-static-section">
        <h2>Our Position</h2>
        <p>
          Kalif sells fresh and lightly-processed food — dates, dry fruits, nuts and date-based products. For reasons of <strong>food safety, hygiene and perishability</strong>, we do not accept change-of-mind returns and do not refund orders that have been opened, consumed, or stored away from the conditions printed on the pack.
        </p>
        <p>
          Refunds are available only in the limited situations described below, and only if you report the issue within <strong>48 hours of delivery</strong> with supporting photos.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>1. When You Are Eligible for a Refund</h2>
        <p>We will refund you, send a replacement, or issue store credit (your choice) if any of these apply:</p>
        <ul>
          <li><strong>Damaged in transit</strong> — outer carton or inner pack arrived broken, crushed, or leaking.</li>
          <li><strong>Wrong item shipped</strong> — what you received does not match what was ordered.</li>
          <li><strong>Defective on arrival</strong> — a sealed pack contains a clear quality defect (e.g. visible mould, foreign matter, off smell at first opening).</li>
          <li><strong>Order not delivered / lost in transit</strong> — confirmed by the courier as undelivered or lost.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>2. When You Are Not Eligible for a Refund</h2>
        <ul>
          <li>Change of mind after the order has been dispatched.</li>
          <li>Packs that have been opened, partly consumed, or stored away from the recommended conditions.</li>
          <li>Issues reported more than 48 hours after delivery.</li>
          <li>Differences in taste, sweetness, texture, colour or moisture that fall within the natural variation of agricultural produce.</li>
          <li>Refused or returned-to-sender deliveries where the address was correct and the parcel was undamaged.</li>
          <li>Custom or bulk orders prepared specifically for a B2B request, once dispatched.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>3. How to Report an Issue</h2>
        <ol>
          <li>Contact us within 48 hours of delivery via email or WhatsApp.</li>
          <li>Share your <strong>order number</strong>, a short description of the issue, and clear photos of the product and packaging (front and back labels included).</li>
          <li>Please keep the product and packaging until the case is resolved — we may ask for additional photos or a pickup.</li>
        </ol>
      </section>

      <section className="s2-static-section">
        <h2>4. How Refunds Are Issued</h2>
        <ul>
          <li>Once we confirm eligibility, refunds are processed within <strong>5–7 business days</strong>.</li>
          <li>Refunds are credited back to the <strong>original payment method</strong> (Razorpay, UPI, card or net banking).</li>
          <li>For orders paid by bank transfer (typically B2B), refunds are issued by NEFT/IMPS to the account the payment originated from.</li>
          <li>Replacements are shipped at our cost on the next dispatch day.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>5. Wholesale / B2B Orders</h2>
        <p>
          For B2B and bulk orders fulfilled through our wholesale process, the same eligibility rules apply (damaged, wrong, or defective on arrival, reported within 48 hours). Custom-packaged or co-branded orders, once dispatched, are non-refundable except where the goods themselves are defective.
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
