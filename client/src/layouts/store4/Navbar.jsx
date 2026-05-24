import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, User, ShoppingBag, ChevronDown, X, Home, LayoutGrid, Heart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import api from '../../api/axios';
import AnnouncementBar from '../../components/AnnouncementBar';
import ScrollToTopButton from '../../components/ScrollToTopButton';
import ProductImage from '../../components/ProductImage';
import { CURRENCY, formatPrice } from '../../utils/currency';

export default function Navbar() {
  const { t } = useTranslation();
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
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const catWrapRef = useRef(null);
  const searchWrapRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(Array.isArray(res.data) ? res.data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (catWrapRef.current && !catWrapRef.current.contains(e.target)) setShowCatList(false);
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Search autocomplete (debounced)
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/products/search-suggestions?q=${encodeURIComponent(query)}`);
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const pickSuggestion = (product) => {
    setShowSuggestions(false);
    setQuery('');
    navigate(`/product/${product.slug}`);
    setShowMobileMenu(false);
  };

  const onSearchKeyDown = (e) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

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
    if (name === 'All Categories') {
      navigate('/products');
    } else {
      navigate(`/products?category=${encodeURIComponent(name)}`);
    }
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
          <img src="/images/anfal-logo.png" alt="Anfal Sports" className="s2-nav-logo-img" />
        </Link>

        <form className="s2-nav-searchwrap" onSubmit={handleSearch} ref={searchWrapRef}>
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
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onKeyDown={onSearchKeyDown}
            placeholder={t('common.searchPlaceholder')}
            className="s2-nav-searchinput"
          />
          <button type="submit" className="s2-nav-searchbtn" aria-label="Search">
            <Search size={20} strokeWidth={2} />
          </button>

          {showSuggestions && (
            <div className="s2-nav-suggestions">
              {suggestions.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className={`s2-nav-suggest ${activeIndex === i ? 'active' : ''}`}
                  onClick={() => pickSuggestion(p)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <div className="s2-nav-suggest-img">
                    <ProductImage product={p} size="small" />
                  </div>
                  <div className="s2-nav-suggest-info">
                    <span className="s2-nav-suggest-name">{p.name}</span>
                    <span className="s2-nav-suggest-meta">
                      {p.category} · {CURRENCY}{formatPrice(p.price)}
                    </span>
                  </div>
                </button>
              ))}
              <button type="button" className="s2-nav-suggest-viewall" onClick={handleSearch}>
                View all results for "{query}"
              </button>
            </div>
          )}
        </form>

        <div className="s2-nav-actions s2-nav-actions-desktop">
          <LanguageSwitcher compact />
          <Link
            to={user ? '/profile' : '/login'}
            className={`s2-icon-btn ${isAccount ? 'is-active' : ''}`}
            aria-label={user ? 'Account' : 'Sign in'}
          >
            <User size={20} strokeWidth={1.8} />
          </Link>
          <Link to="/cart" className="s2-icon-btn s2-nav-cart-inline" aria-label="Cart">
            <ShoppingBag size={20} strokeWidth={1.8} />
            {cartCount > 0 && <span className="s2-badge">{cartCount}</span>}
          </Link>
        </div>

        {/* /ar mobile only: cart hoisted to the row end so RTL puts it at the
            visual left edge. Hidden everywhere else (see layout.css). */}
        <Link to="/cart" className="s2-icon-btn s2-nav-cart-arabic" aria-label="Cart">
          <ShoppingBag size={20} strokeWidth={1.8} />
          {cartCount > 0 && <span className="s2-badge">{cartCount}</span>}
        </Link>
      </nav>

      {/* Mobile slide-in menu */}
      {showMobileMenu && (
        <div className="s2-mobile-drawer-overlay" onClick={() => setShowMobileMenu(false)}>
          <aside className="s2-mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="s2-mobile-drawer-head">
              <span className="s2-mobile-drawer-title">{t('common.menu')}</span>
              <button type="button" onClick={() => setShowMobileMenu(false)} aria-label={t('common.close')}>
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <nav className="s2-mobile-drawer-nav">
              <Link to="/" onClick={() => setShowMobileMenu(false)}><Home size={18} /> {t('common.home')}</Link>
              <Link to="/products" onClick={() => setShowMobileMenu(false)}><LayoutGrid size={18} /> {t('common.products')}</Link>
              <Link to="/wishlist" onClick={() => setShowMobileMenu(false)}>
                <Heart size={18} /> {t('common.wishlist')} {wishlistCount > 0 && <span className="s2-mobile-drawer-count">{wishlistCount}</span>}
              </Link>
              <Link to="/cart" onClick={() => setShowMobileMenu(false)}>
                <ShoppingBag size={18} /> {t('common.cart')} {cartCount > 0 && <span className="s2-mobile-drawer-count">{cartCount}</span>}
              </Link>
              <Link to={user ? '/profile' : '/login'} onClick={() => setShowMobileMenu(false)}>
                <User size={18} /> {user ? t('common.account') : t('common.signIn')}
              </Link>
            </nav>
            {categories.length > 0 && (
              <>
                <div className="s2-mobile-drawer-section-title">{t('common.categories')}</div>
                <nav className="s2-mobile-drawer-cats">
                  <Link to="/products" onClick={() => setShowMobileMenu(false)}>{t('common.all')} {t('common.categories').toLowerCase()}</Link>
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
