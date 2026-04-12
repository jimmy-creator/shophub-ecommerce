import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="s2-footer">
      <div className="s2-footer-grid">
        <div>
          <h3 className="s2-footer-brand">Zayara<em>&nbsp;Mobiles</em></h3>
          <p className="s2-footer-brand-tag">
            An after-hours showroom for things made with intention. Shipped quietly, worn loudly.
          </p>
        </div>
        <div className="s2-footer-col">
          <h4>Shop</h4>
          <Link to="/products">All Products</Link>
          <Link to="/products?category=Electronics">Electronics</Link>
          <Link to="/products?category=Clothing">Clothing</Link>
          <Link to="/products?category=Accessories">Accessories</Link>
        </div>
        <div className="s2-footer-col">
          <h4>Account</h4>
          <Link to="/cart">Cart</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/profile">Profile</Link>
          <Link to="/wishlist">Wishlist</Link>
        </div>
        <div className="s2-footer-col">
          <h4>Support</h4>
          <Link to="/contact">Contact</Link>
          <Link to="/shipping-info">Shipping</Link>
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
