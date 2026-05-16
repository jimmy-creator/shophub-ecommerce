import StaticPage from './StaticPage';

export default function PrivacyPolicy() {
  return (
    <StaticPage
      title="Privacy Policy"
      description="Privacy Policy for Anfal Sports (Anfal Sports W.L.L.). How we collect, use, and protect your personal information."
    >
      <p className="s2-static-date">Last updated: May 2026</p>

      <section className="s2-static-section">
        <h2>1. Who We Are</h2>
        <p>
          This Privacy Policy is issued by <strong>Anfal Sports W.L.L.</strong>, operating the brand <strong>Anfal Sports</strong>, with its registered office at Yaal Mall, Kuwait City, Kuwait ("Anfal Sports", "we", "us"). It explains how we collect and handle personal information when you visit our website or place an order with us.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>2. Information We Collect</h2>
        <ul>
          <li><strong>Account & contact details:</strong> Name, email address, phone number, and shipping address you provide at checkout, signup, or when raising a wholesale request.</li>
          <li><strong>Order information:</strong> Items purchased, order amount, delivery address.</li>
          <li><strong>Payment data:</strong> Processed by our payment gateway partners (such as Razorpay). We do not see or store your full card or UPI credentials.</li>
          <li><strong>Device & usage data:</strong> Browser type, IP address, pages visited, and basic analytics — collected automatically to keep the site working and improve it.</li>
          <li><strong>Communications:</strong> Messages you send via our contact form, WhatsApp, or email.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>To process and fulfil your orders and B2B/wholesale quotes.</li>
          <li>To send order confirmations, shipping updates, invoices, and quote emails.</li>
          <li>To respond to your enquiries and provide customer support.</li>
          <li>To send promotional emails only where you have opted in.</li>
          <li>To improve our website, packaging, and product range.</li>
          <li>To comply with applicable Kuwaiti laws and respond to lawful requests.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>4. Data Sharing</h2>
        <p>We do not sell or rent your personal data. We share it only with:</p>
        <ul>
          <li><strong>Payment processors:</strong> Razorpay (and any other gateways we enable) for secure payment handling.</li>
          <li><strong>Logistics partners:</strong> Courier and shipping providers that deliver your order.</li>
          <li><strong>Service providers:</strong> Email, hosting, and analytics vendors operating on our behalf under appropriate confidentiality terms.</li>
          <li><strong>Legal authorities:</strong> When required by Kuwaiti law, court order, or to protect our rights.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>5. Data Retention</h2>
        <p>
          We retain your personal data only for as long as needed to provide our services, comply with tax and accounting obligations under Kuwaiti law, and resolve disputes. You may request deletion of your account and associated data at any time by emailing us at <a href="mailto:info@anfalsports.com">info@anfalsports.com</a>.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>6. Cookies</h2>
        <p>Our website uses cookies and similar technologies to keep you signed in, remember your cart, and measure basic site traffic. You can disable cookies in your browser settings, but some features (cart, checkout, account) may stop working.</p>
      </section>

      <section className="s2-static-section">
        <h2>7. Your Rights</h2>
        <p>
          Subject to Kuwaiti law (including the applicable data protection law as applicable), you have the right to access, correct, or delete the personal data we hold about you, and to withdraw consent at any time. To exercise these rights, write to <a href="mailto:info@anfalsports.com">info@anfalsports.com</a>.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>8. Children</h2>
        <p>Our website is not directed at children under 18. We do not knowingly collect personal data from minors.</p>
      </section>

      <section className="s2-static-section">
        <h2>9. Changes to This Policy</h2>
        <p>We may update this policy from time to time. Material changes will be highlighted on this page and dated above. Continued use of our website after changes constitutes acceptance.</p>
      </section>

      <section className="s2-static-section">
        <h2>10. Contact / Grievance Officer</h2>
        <p>For any privacy-related questions or to raise a grievance:</p>
        <p>
          <strong>Anfal Sports</strong> (Anfal Sports W.L.L.)<br />
          Yaal Mall<br />
          Kuwait City, Kuwait<br />
          Email: <a href="mailto:info@anfalsports.com">info@anfalsports.com</a><br />
          Phone / WhatsApp: <a href="tel:+96500000000">+965 0000 0000</a>
        </p>
        <p>We will acknowledge complaints within 24 hours and aim to resolve them within 15 days, in line with applicable applicable Kuwait regulations.</p>
      </section>
    </StaticPage>
  );
}
