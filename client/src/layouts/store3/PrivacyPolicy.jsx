import StaticPage from './StaticPage';

export default function PrivacyPolicy() {
  return (
    <StaticPage
      title="Privacy Policy"
      description="Privacy Policy of Zayara Mobile Phones LLC. How we collect, use, and protect your personal information."
    >
      <p className="s2-static-date">Last updated: April 2025</p>

      <section className="s2-static-section">
        <h2>1. Information We Collect</h2>
        <p>When you shop with Zayara, we collect the following types of information:</p>
        <ul>
          <li><strong>Personal Information:</strong> Name, email address, phone number, and delivery address provided during checkout or account registration.</li>
          <li><strong>Payment Information:</strong> Payment details are processed securely through our payment partners (Stripe). We do not store your card details.</li>
          <li><strong>Device & Usage Data:</strong> Browser type, IP address, pages visited, and time spent on our site — collected automatically to improve your experience.</li>
          <li><strong>Communication Data:</strong> Messages you send us via the contact form or email.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To process and fulfil your orders.</li>
          <li>To send order confirmations, shipping updates, and invoices.</li>
          <li>To respond to your enquiries and provide customer support.</li>
          <li>To send promotional emails (only if you have opted in).</li>
          <li>To improve our website, products, and services.</li>
          <li>To comply with legal obligations.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>3. Data Sharing</h2>
        <p>We do not sell or rent your personal data. We may share your information with:</p>
        <ul>
          <li><strong>Payment Processors:</strong> Stripe, for secure payment handling.</li>
          <li><strong>Delivery Partners:</strong> Courier and logistics providers to fulfil your orders.</li>
          <li><strong>Legal Authorities:</strong> When required by UAE law or court order.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>4. Data Retention</h2>
        <p>We retain your personal data for as long as necessary to provide our services and comply with UAE legal requirements. You may request deletion of your account and associated data at any time by contacting us.</p>
      </section>

      <section className="s2-static-section">
        <h2>5. Cookies</h2>
        <p>Our website uses cookies to maintain your session, remember your cart, and analyse site traffic. You can disable cookies in your browser settings, though this may affect some features of the website.</p>
      </section>

      <section className="s2-static-section">
        <h2>6. Your Rights</h2>
        <p>You have the right to access, correct, or delete the personal data we hold about you. To exercise these rights, contact us at <a href="mailto:zayaraelectronics@gmail.com">zayaraelectronics@gmail.com</a>.</p>
      </section>

      <section className="s2-static-section">
        <h2>7. Contact</h2>
        <p>For privacy-related questions, please contact:</p>
        <p><strong>Zayara Mobile Phones LLC</strong><br />
        Murbah St, Fujairah, UAE<br />
        Email: <a href="mailto:zayaraelectronics@gmail.com">zayaraelectronics@gmail.com</a><br />
        Phone: +971 50 639 7752</p>
      </section>
    </StaticPage>
  );
}
