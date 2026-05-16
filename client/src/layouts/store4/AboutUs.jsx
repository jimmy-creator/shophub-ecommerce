import { Link } from 'react-router-dom';
import { Sparkles, Award, Truck, ShieldCheck, Footprints, Dumbbell, Mail, MapPin, Phone } from 'lucide-react';
import StaticPage from './StaticPage';

export default function AboutUs() {
  return (
    <StaticPage
      title="About Us"
      description="Anfal Sports — Kuwait's home for athletic footwear, sportswear, equipment and accessories. In-store and online."
    >
      <section className="s2-static-section">
        <h2>Who We Are</h2>
        <p>
          Anfal Sports is a Kuwait-based sports retailer carrying authentic athletic footwear, performance sportswear, fitness equipment and accessories from the brands athletes trust. Two physical stores plus an online store that pulls from the combined stock of both — what you see is what's actually on the shelf.
        </p>
        <p>
          We started Anfal Sports to make it easier for athletes and active people in Kuwait to buy real gear at honest prices, without flying out or waiting weeks for a parcel from abroad.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>What We Stand For</h2>
        <p>
          <strong>Genuine product, no exceptions.</strong> Every pair of shoes and every piece of equipment we sell is sourced through authorised channels. Boxes, hangtags and warranty cards are intact when they reach you.
        </p>
        <p>
          <strong>Real stock, real time.</strong> Our online catalogue reflects combined inventory across our two stores. If a size shows up online, we have it — not "available on order".
        </p>
        <p>
          <strong>Walk-in friendly.</strong> Try things on, talk to staff who play the sport, and walk out with the right fit. Or buy online and pick up in-store the same day.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>What We Offer</h2>
        <div className="s2-about-services">
          <div className="s2-about-service-card">
            <Footprints size={28} strokeWidth={1.4} />
            <h3>Footwear</h3>
            <p>Running, training, basketball, football, casual — every category from the major sport brands.</p>
          </div>
          <div className="s2-about-service-card">
            <Sparkles size={28} strokeWidth={1.4} />
            <h3>Apparel</h3>
            <p>Performance and lifestyle: tees, shorts, joggers, jerseys and outerwear in men's, women's and kids'.</p>
          </div>
          <div className="s2-about-service-card">
            <Dumbbell size={28} strokeWidth={1.4} />
            <h3>Equipment</h3>
            <p>Gym, fitness, training, ball sports — gloves to dumbbells to balls.</p>
          </div>
          <div className="s2-about-service-card">
            <Award size={28} strokeWidth={1.4} />
            <h3>Accessories</h3>
            <p>Bags, socks, caps, water bottles, recovery gear and the small things that make a difference.</p>
          </div>
          <div className="s2-about-service-card">
            <Truck size={28} strokeWidth={1.4} />
            <h3>Free Delivery</h3>
            <p>Free home delivery across Kuwait above a minimum order value. Same-day or next-day on most areas.</p>
          </div>
          <div className="s2-about-service-card">
            <ShieldCheck size={28} strokeWidth={1.4} />
            <h3>Easy Returns</h3>
            <p>14 days to try, change your mind or swap a size — on unused items in original packaging.</p>
          </div>
        </div>
      </section>

      <section className="s2-static-section">
        <h2>Get in Touch</h2>
        <p>
          Questions about a product, size availability, or store hours — drop us a line on our <Link to="/contact">contact page</Link> and we'll get back to you.
        </p>
        <div className="s2-contact-cards" style={{ marginTop: '1rem' }}>
          <a
            href="https://maps.google.com/?q=Yaal+Mall+Kuwait+City"
            target="_blank"
            rel="noopener noreferrer"
            className="s2-contact-card"
          >
            <div className="s2-contact-icon"><MapPin size={20} strokeWidth={1.6} /></div>
            <div>
              <h4>Stores</h4>
              <p>Yaal Mall, Kuwait City<br />Second branch — TBA</p>
            </div>
          </a>
          <a href="tel:+96500000000" className="s2-contact-card">
            <div className="s2-contact-icon"><Phone size={20} strokeWidth={1.6} /></div>
            <div><h4>Call Us</h4><p>+965 0000 0000</p></div>
          </a>
          <a href="mailto:info@anfalsports.com" className="s2-contact-card">
            <div className="s2-contact-icon"><Mail size={20} strokeWidth={1.6} /></div>
            <div><h4>Email Us</h4><p>info@anfalsports.com</p></div>
          </a>
        </div>
      </section>
    </StaticPage>
  );
}
