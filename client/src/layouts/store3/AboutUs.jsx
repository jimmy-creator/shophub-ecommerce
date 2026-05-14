import { Link } from 'react-router-dom';
import { Sparkles, Leaf, Cookie, Gem, Gift, Star, Mail, MapPin, Phone } from 'lucide-react';
import StaticPage from './StaticPage';

export default function AboutUs() {
  return (
    <StaticPage
      title="About Us"
      description="Kalif — premium dates and dry fruits from the Middle East. Naturally good, beautifully boxed, and made for every day."
    >
      <section className="s2-static-section">
        <h2>Who We Are</h2>
        <p>
          Kalif is a new dates and dry fruits brand from the Middle East, bringing naturally and lightly-processed foods to a generation that is rediscovering them as healthy, everyday snacks.
        </p>
        <p>
          We grew out of a simple observation: the best dates in the world come from our region, yet most of what reaches international shelves is either commodity-grade or wrapped in luxury pricing. Kalif sits in between — premium fruit, careful sourcing, and design that travels well.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>What We Stand For</h2>
        <p>
          <strong>Better quality at a greater value.</strong> Where the market is dominated by premium players selling at premium-only prices, Kalif is built to challenge that — starting with our own products, and then, in time, our own stores.
        </p>
        <p>
          <strong>Naturally good.</strong> Dates and dry fruits are some of the oldest, most nourishing foods on earth. We treat them simply — minimal processing, no shortcuts on the fruit, no apologies for what's left out.
        </p>
        <p>
          <strong>Design that respects the product.</strong> International standards of packaging and identity, because a great date deserves more than a clear plastic tray.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>What We Offer</h2>
        <div className="s2-about-services">
          <div className="s2-about-service-card">
            <Sparkles size={28} strokeWidth={1.4} />
            <h3>Premium Dates</h3>
            <p>Selected varieties from the Middle East — graded for size, moisture and freshness, packed close to harvest.</p>
          </div>
          <div className="s2-about-service-card">
            <Gem size={28} strokeWidth={1.4} />
            <h3>Stuffed Dates</h3>
            <p>Dates filled with almonds, pistachios, walnuts, candied peel and chocolate — small luxuries, made well.</p>
          </div>
          <div className="s2-about-service-card">
            <Leaf size={28} strokeWidth={1.4} />
            <h3>Dry Fruits</h3>
            <p>Apricots, figs, raisins, prunes and more — naturally dried and carefully sorted, the way fruit is meant to last.</p>
          </div>
          <div className="s2-about-service-card">
            <Cookie size={28} strokeWidth={1.4} />
            <h3>Nuts</h3>
            <p>Almonds, cashews, pistachios, walnuts — clean, fresh, and trusted to be exactly what's on the label.</p>
          </div>
          <div className="s2-about-service-card">
            <Gift size={28} strokeWidth={1.4} />
            <h3>Gift Hampers</h3>
            <p>Curated boxes for festivals, weddings and corporate gifting — packaging you'll want to keep, contents you'll want to share.</p>
          </div>
          <div className="s2-about-service-card">
            <Star size={28} strokeWidth={1.4} />
            <h3>Date Specialties</h3>
            <p>Date-based products — pastes, syrups, energy bites and seasonal launches — for the kitchen, lunchbox and on-the-go.</p>
          </div>
        </div>
      </section>

      <section className="s2-static-section">
        <h2>Where We're Going</h2>
        <p>
          Kalif is starting in India, where dates and dry fruits are an everyday part of life, and where there is room for a brand that takes both quality and design seriously. From there, we'll grow into other markets where the same shift is happening — people moving away from processed snacks and back towards food that is simply good for them.
        </p>
        <p>
          Stores will come in time. For now, we'd rather earn that step one product at a time.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>Get in Touch</h2>
        <p>
          Questions about a product, bulk orders, gifting or retail — we'd like to hear from you. Drop us a line on our <Link to="/contact">contact page</Link> and someone will get back to you.
        </p>
        <div className="s2-contact-cards" style={{ marginTop: '1rem' }}>
          <a
            href="https://maps.google.com/?q=6/559+Neerad+Kondotty+Kerala+673638"
            target="_blank"
            rel="noopener noreferrer"
            className="s2-contact-card"
          >
            <div className="s2-contact-icon"><MapPin size={20} strokeWidth={1.6} /></div>
            <div>
              <h4>Office</h4>
              <p>Kalif Dates &amp; Nuts<br />Tamar International<br />6/559 Neerad, Kondotty<br />Kerala 673638, India</p>
            </div>
          </a>
          <a href="tel:+917510762657" className="s2-contact-card">
            <div className="s2-contact-icon"><Phone size={20} strokeWidth={1.6} /></div>
            <div><h4>Call Us</h4><p>+91 75107 62657</p></div>
          </a>
          <a href="mailto:mail@kalif.co" className="s2-contact-card">
            <div className="s2-contact-icon"><Mail size={20} strokeWidth={1.6} /></div>
            <div><h4>Email Us</h4><p>mail@kalif.co</p></div>
          </a>
        </div>
      </section>
    </StaticPage>
  );
}
