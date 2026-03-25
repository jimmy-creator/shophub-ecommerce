import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HiShoppingCart, HiUser, HiMenu, HiX, HiSearch, HiHeart } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    document.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClick);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/products?search=${encodeURIComponent(search.trim())}`);
      setSearch('');
    }
  };

  return (
    <nav className="navbar" style={scrolled ? { boxShadow: '0 4px 20px rgba(26,22,20,0.06)' } : {}}>
      <div className="container navbar-content">
        <Link to="/" className="logo">ShopHub</Link>

        <form className="search-bar" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search for products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" aria-label="Search"><HiSearch /></button>
        </form>

        <div className="nav-links">
          <Link to="/products" className="nav-link">Shop</Link>
        </div>

        <div className="nav-actions">
          <Link to="/wishlist" className="cart-icon" aria-label="Wishlist">
            <HiHeart />
            {wishlistCount > 0 && <span className="cart-badge">{wishlistCount}</span>}
          </Link>

          <Link to="/cart" className="cart-icon">
            <HiShoppingCart />
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>

          {user ? (
            <div className="user-menu" ref={dropdownRef}>
              <button className="user-btn" onClick={() => setMenuOpen(!menuOpen)}>
                <HiUser /> {user.name.split(' ')[0]}
              </button>
              {menuOpen && (
                <div className="dropdown">
                  <Link to="/orders" onClick={() => setMenuOpen(false)}>My Orders</Link>
                  <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
                  {user.role === 'admin' && <Link to="/admin" onClick={() => setMenuOpen(false)}>Admin Panel</Link>}
                  <button onClick={() => { logout(); setMenuOpen(false); }}>Logout</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="login-btn" aria-label="Sign In">
              <HiUser className="login-btn-icon" />
              <span className="login-btn-text">Sign In</span>
            </Link>
          )}

          <button className="mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <HiX /> : <HiMenu />}
          </button>
        </div>
      </div>
    </nav>
  );
}
