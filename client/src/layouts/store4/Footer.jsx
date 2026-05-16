import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../../api/axios';

const B2B_ENABLED = import.meta.env.VITE_FEATURE_B2B === 'true';

export default function Footer() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data.slice(0, 5))).catch(() => {});
  }, []);

  return (
    <footer className="s2-footer">
      <div className="s2-footer-grid">
        <div>
          <img src="/images/anfal-logo.png" alt="Anfal Sports" className="s2-footer-logo-img" />
          <p className="s2-footer-brand-tag">
            Anfal Sports — Kuwait's home for authentic athletic footwear, sportswear and equipment. In-store and online.
          </p>
        </div>
        <div className="s2-footer-col">
          <h4>Shop</h4>
          <Link to="/products">All Products</Link>
          {categories.map(cat => (
            <Link key={cat.id} to={`/products?category=${encodeURIComponent(cat.name)}`}>{cat.name}</Link>
          ))}
        </div>
        <div className="s2-footer-col">
          <h4>Account</h4>
          <Link to="/cart">Cart</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/profile">Profile</Link>
          <Link to="/wishlist">Wishlist</Link>
        </div>
        <div className="s2-footer-col">
          <h4>Company</h4>
          <Link to="/about">About Us</Link>
          <Link to="/contact">Contact</Link>
          {B2B_ENABLED && <Link to="/wholesale">Wholesale</Link>}
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
        </div>
        <div className="s2-footer-col">
          <h4>Support</h4>
          <Link to="/shipping-policy">Shipping Policy</Link>
          <Link to="/refund-policy">Refund Policy</Link>
          <Link to="/return-policy">Returns</Link>
        </div>
      </div>
      <div className="s2-footer-bottom">
        <span>© {new Date().getFullYear()} Anfal Sports</span>
        <span>Sport, played right</span>
      </div>
    </footer>
  );
}
