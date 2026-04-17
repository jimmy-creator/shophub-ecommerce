import StaticPage from './StaticPage';

export default function TermsOfService() {
  return (
    <StaticPage
      title="Terms of Service"
      description="Terms and conditions for using Zayara Mobile Phones LLC website and services."
    >
      <p className="s2-static-date">Last updated: April 2025</p>

      <section className="s2-static-section">
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using the Zayara website (zayaraelectronics.com) or purchasing from our store, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</p>
      </section>

      <section className="s2-static-section">
        <h2>2. About Us</h2>
        <p>Zayara Mobile Phones LLC is a registered business operating in Fujairah, United Arab Emirates. We sell smartphones, accessories, computer solutions, gaming products, and offer repair and trade-in services.</p>
      </section>

      <section className="s2-static-section">
        <h2>3. Products & Pricing</h2>
        <ul>
          <li>All prices are listed in UAE Dirhams (AED) and include VAT where applicable.</li>
          <li>We reserve the right to change prices at any time without prior notice.</li>
          <li>Product images are for illustrative purposes; actual products may vary slightly.</li>
          <li>We make every effort to display accurate stock availability, but errors may occasionally occur.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>4. Orders & Payment</h2>
        <ul>
          <li>By placing an order, you confirm that all information provided is accurate and complete.</li>
          <li>We reserve the right to cancel or refuse any order at our discretion (e.g., pricing errors, suspected fraud).</li>
          <li>Payment is processed securely via Stripe. We do not store card details.</li>
          <li>Cash on delivery (COD) may be available for select locations.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>5. Warranty</h2>
        <p>All products sold by Zayara carry the manufacturer's standard warranty. Warranty claims must be made directly with the manufacturer or through our store. Warranty does not cover physical damage, liquid damage, or unauthorised repairs.</p>
      </section>

      <section className="s2-static-section">
        <h2>6. Repair Services</h2>
        <ul>
          <li>Repair quotes are provided after device inspection and are valid for 48 hours.</li>
          <li>Zayara is not liable for any pre-existing data loss or damage not caused by our repair work.</li>
          <li>We recommend backing up your device before bringing it in for repair.</li>
          <li>Uncollected devices left for more than 30 days after repair completion may be disposed of.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>7. Trade-In</h2>
        <p>Trade-in values are assessed at the time of inspection and are subject to change based on device condition. We reserve the right to revise or decline a trade-in offer after physical inspection of the device.</p>
      </section>

      <section className="s2-static-section">
        <h2>8. Intellectual Property</h2>
        <p>All content on this website — including text, images, logos, and design — is the property of Zayara Mobile Phones LLC or its licensors. Reproduction without written permission is prohibited.</p>
      </section>

      <section className="s2-static-section">
        <h2>9. Limitation of Liability</h2>
        <p>Zayara shall not be liable for any indirect, incidental, or consequential damages arising from the use of our website or products, to the fullest extent permitted by UAE law.</p>
      </section>

      <section className="s2-static-section">
        <h2>10. Governing Law</h2>
        <p>These terms are governed by the laws of the United Arab Emirates. Any disputes shall be subject to the jurisdiction of the courts of Fujairah, UAE.</p>
      </section>

      <section className="s2-static-section">
        <h2>11. Contact</h2>
        <p>For any questions regarding these terms:<br />
        <strong>Zayara Mobile Phones LLC</strong><br />
        📍 Murbah St, Fujairah, UAE<br />
        📞 <a href="tel:+971506397752">+971 50 639 7752</a><br />
        📧 <a href="mailto:zayaraelectronics@gmail.com">zayaraelectronics@gmail.com</a></p>
      </section>
    </StaticPage>
  );
}
