import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Monitor, Shirt, Footprints, Briefcase, Dumbbell, Home as HomeIcon, LayoutGrid } from 'lucide-react';
import api from '../../api/axios';
import SEO from '../../components/SEO';
import { CURRENCY } from '../../utils/currency';
import ProductCard from './ProductCard';

const fallbackIcons = {
  Electronics: <Monitor size={20} strokeWidth={1.6} />,
  Clothing: <Shirt size={20} strokeWidth={1.6} />,
  Footwear: <Footprints size={20} strokeWidth={1.6} />,
  Accessories: <Briefcase size={20} strokeWidth={1.6} />,
  Sports: <Dumbbell size={20} strokeWidth={1.6} />,
  Home: <HomeIcon size={20} strokeWidth={1.6} />,
  Beauty: <Sparkles size={20} strokeWidth={1.6} />,
};

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState(() => {
    const cached = localStorage.getItem('cached-categories');
    return cached ? JSON.parse(cached) : null;
  });
  const [heroImage, setHeroImage] = useState(() => localStorage.getItem('cached-hero-image') || null);
  const [banners, setBanners] = useState(() => {
    const cached = localStorage.getItem('cached-banners');
    return cached ? JSON.parse(cached) : [];
  });
  const [activeBanner, setActiveBanner] = useState(0);

  useEffect(() => {
    api.get('/settings/banners')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setBanners(res.data);
          localStorage.setItem('cached-banners', JSON.stringify(res.data));
          res.data.forEach((b) => { if (b.image) { const img = new Image(); img.src = b.image; } });
        }
      })
      .catch(() => {});

    api.get('/products?featured=true&limit=8')
      .then((res) => setFeatured(res.data.products))
      .catch(console.error)
      .finally(() => setLoading(false));

    api.get('/products?sort=createdAt&order=DESC&limit=8')
      .then((res) => setLatest(res.data.products))
      .catch(console.error);

    api.get('/settings/hero-image')
      .then((res) => {
        const url = res.data.value || '/images/hero-banner.jpeg';
        setHeroImage(url);
        localStorage.setItem('cached-hero-image', url);
      })
      .catch(() => setHeroImage('/images/hero-banner.jpeg'));

    api.get('/categories')
      .then((res) => {
        setCategories(res.data);
        localStorage.setItem('cached-categories', JSON.stringify(res.data));
      })
      .catch(() => setCategories([]));
  }, []);

  const touchStart = useRef(null);
  const touchDelta = useRef(0);
  const autoplayRef = useRef(null);

  const goTo = useCallback((index) => {
    setActiveBanner(index);
    clearInterval(autoplayRef.current);
    autoplayRef.current = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    autoplayRef.current = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(autoplayRef.current);
  }, [banners.length]);

  const handleTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
    touchDelta.current = 0;
  };
  const handleTouchMove = (e) => {
    if (touchStart.current === null) return;
    touchDelta.current = e.touches[0].clientX - touchStart.current;
  };
  const handleTouchEnd = () => {
    if (Math.abs(touchDelta.current) > 50) {
      if (touchDelta.current < 0 && activeBanner < banners.length - 1) {
        goTo(activeBanner + 1);
      } else if (touchDelta.current > 0 && activeBanner > 0) {
        goTo(activeBanner - 1);
      }
    }
    touchStart.current = null;
    touchDelta.current = 0;
  };

  const categoryList = (categories === null ? [] : categories.length > 0 ? categories : [
    { name: 'Electronics' }, { name: 'Clothing' }, { name: 'Footwear' },
    { name: 'Accessories' }, { name: 'Sports' }, { name: 'Home' }, { name: 'Beauty' },
  ]);

  return (
    <div className="s2-root">
      <SEO
        title="Zayara Mobiles"
        description={`Fujairah's trusted destination for smartphones, accessories & repairs. Shop the latest devices from top brands — fast delivery across the UAE.`}
      />

      {/* ── Banner carousel ────────────────────────────────── */}
      {banners.length > 0 && (
        <section
          className="s2-banners"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="s2-banner-track" style={{ transform: `translateX(-${activeBanner * 100}%)` }}>
            {banners.map((banner, i) => (
              <Link key={i} to={banner.link || '/products'} className="s2-banner-slide">
                <img src={banner.image} alt={banner.title || ''} className="s2-banner-img" fetchPriority={i === 0 ? 'high' : 'auto'} loading={i === 0 ? 'eager' : 'lazy'} />
                <div className="s2-banner-overlay" />
                <div className="s2-banner-content">
                  {banner.subtitle && <p className="s2-eyebrow">{banner.subtitle}</p>}
                  {banner.title && <h2 className="s2-banner-title">{banner.title}</h2>}
                </div>
              </Link>
            ))}
          </div>
          {banners.length > 1 && (
            <div className="s2-banner-dots">
              {banners.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`s2-banner-dot ${activeBanner === i ? 'active' : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={`Banner ${i + 1}`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Categories rail ──────────────────────────────── */}
      <section className="s2-section">
        <div className="s2-section-head">
          <h2 className="s2-section-title">
            Shop by <em>category</em>
          </h2>
          <Link to="/products" className="s2-view-all">
            View all <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>
        <div className="s2-category-rail">
          {categoryList.map((c) => (
            <Link key={c.name} to={`/products?category=${c.name}`} className="s2-cat-card">
              {c.image && <img src={c.image.replace(/\/uploads\/(.+?)\.webp$/, '/api/upload/thumb/$1.webp') || c.image} alt="" className="s2-cat-img" loading="lazy" />}
              <span className="s2-cat-icon">{fallbackIcons[c.name] || <LayoutGrid size={20} strokeWidth={1.6} />}</span>
              <span className="s2-cat-label">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Featured grid ────────────────────────────────── */}
      <section className="s2-section">
        <div className="s2-section-head">
          <h2 className="s2-section-title">
            Trending <em>now</em>
          </h2>
          <Link to="/products" className="s2-view-all">
            See all <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>
        {loading ? (
          <div className="s2-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="s2-product" style={{ aspectRatio: '0.72' }} />
            ))}
          </div>
        ) : (
          <div className="s2-grid">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* ── Latest launches ─────────────────────────────── */}
      {latest.length > 0 && (
        <section className="s2-section">
          <div className="s2-section-head">
            <h2 className="s2-section-title">
              Latest <em>launches</em>
            </h2>
            <Link to="/products?sort=createdAt&order=DESC" className="s2-view-all">
              See all <ArrowRight size={14} strokeWidth={2} />
            </Link>
          </div>
          <div className="s2-grid">
            {latest.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

    </div>
  );
}

