import { Truck, Zap, Package, MapPin, Clock, HelpCircle } from 'lucide-react';
import SEO from '../components/SEO';
import { CURRENCY } from '../utils/currency';

export default function ShippingInfo() {
  return (
    <div className="static-page">
      <SEO title="Shipping Information" description={`Free shipping on orders over ${CURRENCY}500. Standard and express delivery across India.`} />
      <div className="container">
        <div className="static-hero">
          <h1>Shipping Information</h1>
          <p>Everything you need to know about our shipping and delivery.</p>
        </div>

        <div className="static-content">
          <div className="info-cards-grid">
            <div className="info-card">
              <Truck size={24} />
              <h3>Standard Shipping</h3>
              <p className="info-card-price">{CURRENCY}49</p>
              <p>Delivered in 5-7 business days. Available for all orders across India.</p>
            </div>
            <div className="info-card">
              <Zap size={24} />
              <h3>Express Shipping</h3>
              <p className="info-card-price">{CURRENCY}99</p>
              <p>Delivered in 1-2 business days. Get your order faster when you need it.</p>
            </div>
            <div className="info-card highlight">
              <Package size={24} />
              <h3>Free Shipping</h3>
              <p className="info-card-price">{CURRENCY}0</p>
              <p>{`Free standard shipping on all orders above ${CURRENCY}500.`} No code needed!</p>
            </div>
          </div>

          <div className="static-section">
            <h2>Delivery Coverage</h2>
            <div className="static-grid">
              <div>
                <h4><MapPin size={16} /> Domestic Shipping</h4>
                <p>We deliver across all states and union territories in India. Most major cities receive deliveries within 3-5 business days, while remote areas may take 7-10 business days.</p>
              </div>
              <div>
                <h4><Clock size={16} /> Processing Time</h4>
                <p>Orders are processed within 24 hours of placement (excluding Sundays and public holidays). You'll receive a confirmation email with tracking details once your order ships.</p>
              </div>
            </div>
          </div>

          <div className="static-section">
            <h2>Tracking Your Order</h2>
            <p>Once your order is shipped, you'll receive an email with your tracking number. You can track your order by:</p>
            <ul className="static-list">
              <li>Logging into your account and visiting "My Orders"</li>
              <li>Using the tracking number provided in your shipping confirmation email</li>
              <li>Contacting our support team with your order number</li>
            </ul>
          </div>

          <div className="static-section">
            <h2>Frequently Asked Questions</h2>
            <div className="faq-list">
              <details className="faq-item">
                <summary><HelpCircle size={16} /> Can I change my shipping address after placing an order?</summary>
                <p>You can update your shipping address within 2 hours of placing the order by contacting our support team. Once the order is shipped, address changes cannot be made.</p>
              </details>
              <details className="faq-item">
                <summary><HelpCircle size={16} /> Do you ship internationally?</summary>
                <p>Currently, we only ship within India. We're working on expanding to international shipping in the near future.</p>
              </details>
              <details className="faq-item">
                <summary><HelpCircle size={16} /> What happens if I'm not available to receive the delivery?</summary>
                <p>Our delivery partner will attempt delivery up to 3 times. If all attempts fail, the package will be returned to our warehouse and a refund will be initiated.</p>
              </details>
              <details className="faq-item">
                <summary><HelpCircle size={16} /> Is there a weight limit for shipping?</summary>
                <p>Standard and express shipping apply to orders up to 20kg. For heavier orders, additional charges may apply and will be displayed at checkout.</p>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
