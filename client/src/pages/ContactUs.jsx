import { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import SEO from '../components/SEO';

export default function ContactUs() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      toast.success('Message sent! We\'ll get back to you soon.');
      setForm({ name: '', email: '', subject: '', message: '' });
      setLoading(false);
    }, 800);
  };

  return (
    <div className="static-page">
      <SEO title="Contact Us" description="Get in touch with ShopHub. We're here to help with orders, products, and more." />
      <div className="container">
        <div className="static-hero">
          <h1>Contact Us</h1>
          <p>Have a question or need help? We'd love to hear from you.</p>
        </div>

        <div className="contact-layout">
          <div className="contact-info">
            <div className="contact-card">
              <Mail size={20} />
              <div>
                <h4>Email</h4>
                <p>support@shophub.com</p>
              </div>
            </div>
            <div className="contact-card">
              <Phone size={20} />
              <div>
                <h4>Phone</h4>
                <p>+91 9072262297</p>
              </div>
            </div>
            <div className="contact-card">
              <MapPin size={20} />
              <div>
                <h4>Address</h4>
                <p>Kozhikode, Kerala, India</p>
              </div>
            </div>
            <div className="contact-card">
              <Clock size={20} />
              <div>
                <h4>Business Hours</h4>
                <p>Mon - Sat: 9AM - 7PM</p>
              </div>
            </div>
          </div>

          <form className="contact-form" onSubmit={handleSubmit}>
            <h3>Send us a Message</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label>Subject</label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Message</label>
              <textarea rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Send size={16} /> {loading ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
