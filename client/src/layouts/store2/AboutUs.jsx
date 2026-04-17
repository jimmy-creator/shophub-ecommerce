import { Phone, Mail, MapPin, Wrench, RefreshCw, Gamepad2, Monitor, Smartphone, Plug } from 'lucide-react';
import StaticPage from './StaticPage';

export default function AboutUs() {
  return (
    <StaticPage
      title="About Us"
      description="Zayara Mobile Phones LLC — your one-stop destination for smartphones, accessories, computer solutions, gaming, repairs and trade-ins in Fujairah, UAE."
    >
      <section className="s2-static-section">
        <h2>Who We Are</h2>
        <p>
          Zayara Mobile Phones LLC is Fujairah's trusted destination for everything tech. Founded with a passion for connecting people to the latest technology, we have grown into a full-service electronics retailer and repair centre serving customers across the UAE.
        </p>
        <p>
          Whether you're after the newest smartphone, need a quick repair, want to trade in your old device, or are building a gaming setup — Zayara has you covered under one roof.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>What We Offer</h2>
        <div className="s2-about-services">
          <div className="s2-about-service-card">
            <Smartphone size={28} strokeWidth={1.4} />
            <h3>Mobile Phones</h3>
            <p>Latest flagship and mid-range smartphones from Apple, Samsung, Google, OnePlus, and more.</p>
          </div>
          <div className="s2-about-service-card">
            <Plug size={28} strokeWidth={1.4} />
            <h3>Accessories</h3>
            <p>Cases, chargers, cables, earphones, power banks, screen protectors, and every essential you need.</p>
          </div>
          <div className="s2-about-service-card">
            <Monitor size={28} strokeWidth={1.4} />
            <h3>Computer Solutions</h3>
            <p>Laptops, tablets, peripherals, and complete computer solutions for home and business use.</p>
          </div>
          <div className="s2-about-service-card">
            <Gamepad2 size={28} strokeWidth={1.4} />
            <h3>Gaming & More</h3>
            <p>Gaming controllers, headsets, consoles, and all the gear to elevate your gaming experience.</p>
          </div>
          <div className="s2-about-service-card">
            <Wrench size={28} strokeWidth={1.4} />
            <h3>Repairs</h3>
            <p>Professional screen replacements, battery swaps, water damage recovery, and all device repairs — fast turnaround guaranteed.</p>
          </div>
          <div className="s2-about-service-card">
            <RefreshCw size={28} strokeWidth={1.4} />
            <h3>Trade-In</h3>
            <p>Get the best value for your old device. Bring it in and upgrade seamlessly with our trade-in programme.</p>
          </div>
        </div>
      </section>

      <section className="s2-static-section">
        <h2>Our Promise</h2>
        <p>
          At Zayara, we believe technology should be accessible, reliable, and supported by people who genuinely care. Every product we sell is authentic, and every repair we do is backed by our satisfaction guarantee.
        </p>
        <p>
          We treat every customer like a neighbour — because in Fujairah, that's exactly what you are.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>Find Us</h2>
        <div className="s2-contact-cards" style={{ marginTop: '1rem' }}>
          <a href="https://maps.google.com/?q=Murbah+St+Fujairah" target="_blank" rel="noopener noreferrer" className="s2-contact-card">
            <div className="s2-contact-icon"><MapPin size={20} strokeWidth={1.6} /></div>
            <div><h4>Visit Us</h4><p>Murbah St, Fujairah, UAE</p></div>
          </a>
          <a href="tel:+971506397752" className="s2-contact-card">
            <div className="s2-contact-icon"><Phone size={20} strokeWidth={1.6} /></div>
            <div><h4>Call Us</h4><p>+971 50 639 7752</p></div>
          </a>
          <a href="mailto:zayaraelectronics@gmail.com" className="s2-contact-card">
            <div className="s2-contact-icon"><Mail size={20} strokeWidth={1.6} /></div>
            <div><h4>Email Us</h4><p>zayaraelectronics@gmail.com</p></div>
          </a>
        </div>
      </section>
    </StaticPage>
  );
}
