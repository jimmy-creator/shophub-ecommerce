import { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import SEO from '../../components/SEO';

export default function ContactUs() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/contact/send', form);
      toast.success('Message sent! We\'ll get back to you shortly.');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="s2-root s2-contact-page">
      <SEO title="Contact Us — Zayara Mobiles" description="Get in touch with Zayara Mobiles, Fujairah. Questions about orders, products, or anything else — we're here to help." />

      <div className="s2-container" style={{ padding: '3rem 1.5rem 6rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p className="s2-eyebrow" style={{ marginBottom: '0.75rem' }}>Get in touch</p>
          <h1 style={{
            fontFamily: 'var(--s2-font-display)',
            fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
            fontWeight: 400,
            letterSpacing: '-0.015em',
            lineHeight: 1.1,
            margin: '0 0 1rem',
          }}>
            We'd love to<br />hear from you
          </h1>
          <p style={{ color: 'var(--s2-text-dim)', maxWidth: 480, margin: '0 auto', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Whether it's about a product, an order, or just to say hello — reach out and we'll respond as quickly as we can.
          </p>
        </div>

        <div className="s2-contact-grid">
          {/* Contact cards */}
          <div className="s2-contact-cards">
            <a href="tel:+971506397752" className="s2-contact-card">
              <div className="s2-contact-icon">
                <Phone size={20} strokeWidth={1.6} />
              </div>
              <div>
                <h4>Call us</h4>
                <p>+971 50 639 7752</p>
              </div>
            </a>

            <a href="mailto:zayaraelectronics@gmail.com" className="s2-contact-card">
              <div className="s2-contact-icon">
                <Mail size={20} strokeWidth={1.6} />
              </div>
              <div>
                <h4>Email us</h4>
                <p>zayaraelectronics@gmail.com</p>
              </div>
            </a>

            <a
              href="https://wa.me/971506397752"
              target="_blank"
              rel="noopener noreferrer"
              className="s2-contact-card"
            >
              <div className="s2-contact-icon">
                <MessageCircle size={20} strokeWidth={1.6} />
              </div>
              <div>
                <h4>WhatsApp</h4>
                <p>Chat with us instantly</p>
              </div>
            </a>

            <div className="s2-contact-card">
              <div className="s2-contact-icon">
                <MapPin size={20} strokeWidth={1.6} />
              </div>
              <div>
                <h4>Visit us</h4>
                <p>Murbah St, Fujairah<br />Fujairah, UAE</p>
              </div>
            </div>
          </div>

          {/* Contact form */}
          <form className="s2-contact-form" onSubmit={handleSubmit}>
            <h3 style={{
              fontFamily: 'var(--s2-font-display)',
              fontSize: '1.6rem',
              fontWeight: 400,
              margin: '0 0 1.5rem',
            }}>
              Send a message
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="s2-field">
                <label>Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="s2-field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className="s2-field">
              <label>Subject</label>
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="What's this about?"
                required
              />
            </div>

            <div className="s2-field">
              <label>Message</label>
              <textarea
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Tell us more..."
                required
              />
            </div>

            <button type="submit" className="s2-btn s2-btn-primary s2-btn-lg" disabled={loading} style={{ width: '100%' }}>
              <Send size={16} strokeWidth={1.8} />
              {loading ? 'Sending...' : 'Send message'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
