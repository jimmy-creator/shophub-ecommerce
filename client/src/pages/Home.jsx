import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HiArrowRight, HiShieldCheck, HiTruck, HiRefresh } from 'react-icons/hi';
import api from '../api/axios';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/products?featured=true&limit=8')
      .then((res) => setFeatured(res.data.products))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="home">
      <section className="hero">
        <img src="/images/hero-banner.jpg" alt="ShopHub Collection" className="hero-banner" />
        <div className="hero-overlay" />
        <div className="container hero-content">
          <h1>Curated for the<br />Modern Lifestyle</h1>
          <p>Discover thoughtfully selected products at exceptional value. Free shipping on orders over ₹500.</p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-primary">
              Explore Collection <HiArrowRight />
            </Link>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="features-grid">
          <div className="feature">
            <HiTruck className="feature-icon" />
            <div>
              <h3>Free Shipping</h3>
              <p>On orders over ₹500</p>
            </div>
          </div>
          <div className="feature">
            <HiShieldCheck className="feature-icon" />
            <div>
              <h3>Secure Checkout</h3>
              <p>100% protected payments</p>
            </div>
          </div>
          <div className="feature">
            <HiRefresh className="feature-icon" />
            <div>
              <h3>Easy Returns</h3>
              <p>30-day return policy</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>Featured Collection</h2>
            <Link to="/products" className="view-all">
              View All <HiArrowRight />
            </Link>
          </div>
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div className="products-grid">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="cta">
        <div className="container cta-content">
          <h2>Stay in the Loop</h2>
          <p>Subscribe for early access to new arrivals and exclusive offers.</p>
          <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="Your email address" />
            <button type="submit" className="btn btn-primary">Subscribe</button>
          </form>
        </div>
      </section>
    </div>
  );
}
