import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, User, ShoppingBag, ChevronDown, X, Home, LayoutGrid, Heart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import api from '../../api/axios';
import AnnouncementBar from '../../components/AnnouncementBar';
import ScrollToTopButton from '../../components/ScrollToTopButton';

export default function Navbar() {
  const { user } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const location = useLocation();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState('All Categories');
  const [showCatList, setShowCatList] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [query, setQuery] = useState('');
  const catWrapRef = useRef(null);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(Array.isArray(res.data) ? res.data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (catWrapRef.current && !catWrapRef.current.contains(e.target)) setShowCatList(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const isAccount = ['/profile', '/login', '/orders', '/admin'].includes(location.pathname);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('search', query.trim());
    if (activeCat && activeCat !== 'All Categories') params.set('category', activeCat);
    navigate(`/products?${params.toString()}`);
    setShowMobileMenu(false);
  };

  const pickCategory = (name) => {
    setActiveCat(name);
    setShowCatList(false);
  };

  return (
    <>
      <ScrollToTopButton />
      <AnnouncementBar />

      <nav className="s2-nav">
        <button
          type="button"
          className="s2-nav-hamburger"
          onClick={() => setShowMobileMenu(true)}
          aria-label="Open menu"
        >
          <Menu size={22} strokeWidth={2} />
        </button>

        <Link to="/" className="s2-nav-logo">
          <img src="/images/kalif-logo.png" alt="Kalif" className="s2-nav-logo-img" />
        </Link>

        <form className="s2-nav-searchwrap" onSubmit={handleSearch}>
          <div className="s2-nav-cat" ref={catWrapRef}>
            <button
              type="button"
              className="s2-nav-cat-btn"
              onClick={() => setShowCatList((s) => !s)}
              aria-haspopup="listbox"
              aria-expanded={showCatList}
            >
              <LayoutGrid size={16} strokeWidth={2} />
              <span className="s2-nav-cat-label">{activeCat}</span>
              <ChevronDown size={14} strokeWidth={2} />
            </button>
            {showCatList && (
              <ul className="s2-nav-cat-list" role="listbox">
                <li>
                  <button type="button" onClick={() => pickCategory('All Categories')}>
                    All Categories
                  </button>
                </li>
                {categories.map((c) => (
                  <li key={c.id || c.name}>
                    <button type="button" onClick={() => pickCategory(c.name)}>
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are you looking for?"
            className="s2-nav-searchinput"
          />
          <button type="submit" className="s2-nav-searchbtn" aria-label="Search">
            <Search size={20} strokeWidth={2} />
          </button>
        </form>

        <div className="s2-nav-actions s2-nav-actions-desktop">
          <Link
            to={user ? '/profile' : '/login'}
            className={`s2-icon-btn ${isAccount ? 'is-active' : ''}`}
            aria-label={user ? 'Account' : 'Sign in'}
          >
            <User size={20} strokeWidth={1.8} />
          </Link>
          <Link to="/cart" className="s2-icon-btn" aria-label="Cart">
            <ShoppingBag size={20} strokeWidth={1.8} />
            {cartCount > 0 && <span className="s2-badge">{cartCount}</span>}
          </Link>
        </div>
      </nav>

      {/* Mobile slide-in menu */}
      {showMobileMenu && (
        <div className="s2-mobile-drawer-overlay" onClick={() => setShowMobileMenu(false)}>
          <aside className="s2-mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="s2-mobile-drawer-head">
              <span className="s2-mobile-drawer-title">Menu</span>
              <button type="button" onClick={() => setShowMobileMenu(false)} aria-label="Close menu">
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <nav className="s2-mobile-drawer-nav">
              <Link to="/" onClick={() => setShowMobileMenu(false)}><Home size={18} /> Home</Link>
              <Link to="/products" onClick={() => setShowMobileMenu(false)}><LayoutGrid size={18} /> Shop</Link>
              <Link to="/wishlist" onClick={() => setShowMobileMenu(false)}>
                <Heart size={18} /> Wishlist {wishlistCount > 0 && <span className="s2-mobile-drawer-count">{wishlistCount}</span>}
              </Link>
              <Link to="/cart" onClick={() => setShowMobileMenu(false)}>
                <ShoppingBag size={18} /> Cart {cartCount > 0 && <span className="s2-mobile-drawer-count">{cartCount}</span>}
              </Link>
              <Link to={user ? '/profile' : '/login'} onClick={() => setShowMobileMenu(false)}>
                <User size={18} /> {user ? 'Account' : 'Sign in'}
              </Link>
            </nav>
            {categories.length > 0 && (
              <>
                <div className="s2-mobile-drawer-section-title">Browse</div>
                <nav className="s2-mobile-drawer-cats">
                  <Link to="/products" onClick={() => setShowMobileMenu(false)}>All Categories</Link>
                  {categories.map((c) => (
                    <Link
                      key={c.id || c.name}
                      to={`/products?category=${encodeURIComponent(c.name)}`}
                      onClick={() => setShowMobileMenu(false)}
                    >
                      {c.name}
                    </Link>
                  ))}
                </nav>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
