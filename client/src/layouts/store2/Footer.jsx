import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function Footer() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data.slice(0, 5))).catch(() => {});
  }, []);

  return (
    <footer className="s2-footer">
      <div className="s2-footer-grid">
        <div>
          <img src="/images/zayara-logo.png" alt="Zayara Mobiles" className="s2-footer-logo-img" />
          <p className="s2-footer-brand-tag">
            An after-hours showroom for things made with intention. Shipped quietly, worn loudly.
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
        <span>© {new Date().getFullYear()} Zayara Mobiles</span>
        <span>Crafted after midnight</span>
      </div>
    </footer>
  );
}
