import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-content">
        <div className="footer-section">
          <h3>ShopHub</h3>
          <p>Curated essentials for the modern lifestyle. Quality products, thoughtfully selected.</p>
        </div>
        <div className="footer-section">
          <h4>Shop</h4>
          <Link to="/products">All Products</Link>
          <Link to="/products?category=Electronics">Electronics</Link>
          <Link to="/products?category=Clothing">Clothing</Link>
          <Link to="/products?category=Accessories">Accessories</Link>
        </div>
        <div className="footer-section">
          <h4>Account</h4>
          <Link to="/cart">Cart</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/profile">Profile</Link>
        </div>
        <div className="footer-section">
          <h4>Support</h4>
          <a href="mailto:support@shophub.com">Contact Us</a>
          <a href="#">Shipping Info</a>
          <a href="#">Return Policy</a>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} ShopHub. All rights reserved.</p>
      </div>
    </footer>
  );
}
