import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingBag, User, Heart, Search, X, ShoppingCart, ChevronDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import SearchAutocomplete from './SearchAutocomplete';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const dropdownRef = useRef(null);
  const searchExpandRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (searchExpandRef.current && !searchExpandRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    document.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClick);
    };
  }, []);

  return (
    <>
    <nav className="navbar" style={scrolled ? { boxShadow: '0 4px 20px rgba(26,22,20,0.06)' } : {}}>
      <div className="container navbar-content">
        <Link to="/" className="logo">ShopHub</Link>

        <SearchAutocomplete className="desktop-search" />

        {/* Mobile expandable search */}
        <div ref={searchExpandRef} className={`mobile-search-expand ${searchOpen ? 'open' : ''}`}>
          <button
            className="mobile-search-btn"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label={searchOpen ? 'Close search' : 'Open search'}
          >
            {searchOpen ? <X size={18} /> : <Search size={18} />}
          </button>
          {searchOpen && (
            <div className="mobile-search-form">
              <SearchAutocomplete onSubmit={() => setSearchOpen(false)} className="mobile-search-ac" />
            </div>
          )}
        </div>

        <div className="nav-links">
          <Link to="/products" className="nav-link">Shop</Link>
        </div>

        <div className="nav-actions">
          <Link to="/wishlist" className="cart-icon" aria-label="Wishlist">
            <Heart size={20} strokeWidth={1.5} />
            {wishlistCount > 0 && <span className="cart-badge">{wishlistCount}</span>}
          </Link>

          <Link to="/cart" className="cart-icon">
            <ShoppingCart size={20} strokeWidth={1.5} />
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>

          {user ? (
            <div className="user-menu" ref={dropdownRef}>
              <button className="user-btn" onClick={() => setMenuOpen(!menuOpen)}>
                <User size={16} strokeWidth={1.5} /> {user.name.split(' ')[0]}
                <ChevronDown size={14} strokeWidth={1.5} style={{ opacity: 0.5 }} />
              </button>
              {menuOpen && (
                <div className="dropdown">
                  <Link to="/orders" onClick={() => setMenuOpen(false)}>My Orders</Link>
                  <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
                  {(user.role === 'admin' || user.role === 'staff') && <Link to="/admin" onClick={() => setMenuOpen(false)}>Admin Panel</Link>}
                  <button onClick={() => { logout(); setMenuOpen(false); }}>Logout</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="login-btn" aria-label="Sign In">
              <User size={18} strokeWidth={1.5} className="login-btn-icon" />
              <span className="login-btn-text">Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </nav>

    {/* Mobile Bottom Nav */}
    <nav className="bottom-nav">
      <Link to="/" className={`bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
        <Home size={22} strokeWidth={location.pathname === '/' ? 2.5 : 1.5} />
        <span>Home</span>
      </Link>
      <Link to="/products" className={`bottom-nav-item ${location.pathname === '/products' ? 'active' : ''}`}>
        <LayoutGrid size={22} strokeWidth={location.pathname === '/products' ? 2.5 : 1.5} />
        <span>Shop</span>
      </Link>
      <Link to="/cart" className={`bottom-nav-item ${location.pathname === '/cart' ? 'active' : ''}`}>
        <div className="bottom-nav-icon-wrap">
          <ShoppingBag size={22} strokeWidth={location.pathname === '/cart' ? 2.5 : 1.5} />
          {cartCount > 0 && <span className="bottom-nav-badge">{cartCount}</span>}
        </div>
        <span>Cart</span>
      </Link>
      <Link
        to={user ? '/profile' : '/login'}
        className={`bottom-nav-item ${['/profile', '/login', '/orders', '/admin'].includes(location.pathname) ? 'active' : ''}`}
      >
        <User size={22} strokeWidth={['/profile', '/login', '/orders', '/admin'].includes(location.pathname) ? 2.5 : 1.5} />
        <span>{user ? 'Account' : 'Login'}</span>
      </Link>
    </nav>
    </>
  );
}
