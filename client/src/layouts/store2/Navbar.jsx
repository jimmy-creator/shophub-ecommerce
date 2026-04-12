import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, User, Heart, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import SearchAutocomplete from '../../components/SearchAutocomplete';

export default function Navbar() {
  const { user } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const location = useLocation();

  const isAccount = ['/profile', '/login', '/orders', '/admin'].includes(location.pathname);

  return (
    <>
      <nav className="s2-nav s2-glass">
        <Link to="/" className="s2-nav-logo">
          <img src="/images/zayara-logo.png" alt="Zayara Mobiles" className="s2-nav-logo-img" />
        </Link>

        <div className="s2-nav-search s2-nav-search-desktop">
          <SearchAutocomplete />
        </div>

        <div className="s2-nav-links">
          <Link to="/" className="s2-nav-link">Home</Link>
          <Link to="/products" className="s2-nav-link">Shop</Link>
        </div>

        <Link to="/wishlist" className="s2-icon-btn s2-nav-wishlist-mobile" aria-label="Wishlist">
          <Heart size={18} strokeWidth={1.6} />
          {wishlistCount > 0 && <span className="s2-badge">{wishlistCount}</span>}
        </Link>
      </nav>

      <div className="s2-mobile-search">
        <SearchAutocomplete />
      </div>

      <nav className="s2-bottom-nav s2-bottom-nav-always">
        <Link to="/" className={`s2-bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
          <Home size={20} strokeWidth={location.pathname === '/' ? 2.4 : 1.6} />
          <span>Home</span>
        </Link>
        <Link to="/products" className={`s2-bottom-nav-item ${location.pathname === '/products' ? 'active' : ''}`}>
          <LayoutGrid size={20} strokeWidth={location.pathname === '/products' ? 2.4 : 1.6} />
          <span>Shop</span>
        </Link>
        <Link to="/wishlist" className={`s2-bottom-nav-item s2-bottom-wishlist ${location.pathname === '/wishlist' ? 'active' : ''}`}>
          <span className="s2-bottom-nav-icon-wrap">
            <Heart size={20} strokeWidth={location.pathname === '/wishlist' ? 2.4 : 1.6} />
            {wishlistCount > 0 && <span className="s2-bottom-nav-badge">{wishlistCount}</span>}
          </span>
          <span>Wishlist</span>
        </Link>
        <Link to="/cart" className={`s2-bottom-nav-item ${location.pathname === '/cart' ? 'active' : ''}`}>
          <span className="s2-bottom-nav-icon-wrap">
            <ShoppingBag size={20} strokeWidth={location.pathname === '/cart' ? 2.4 : 1.6} />
            {cartCount > 0 && <span className="s2-bottom-nav-badge">{cartCount}</span>}
          </span>
          <span>Cart</span>
        </Link>
        <Link
          to={user ? '/profile' : '/login'}
          className={`s2-bottom-nav-item ${isAccount ? 'active' : ''}`}
        >
          <User size={20} strokeWidth={isAccount ? 2.4 : 1.6} />
          <span>{user ? 'Me' : 'Sign in'}</span>
        </Link>
      </nav>
    </>
  );
}
