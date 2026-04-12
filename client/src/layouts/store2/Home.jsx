import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState(() => {
    const cached = localStorage.getItem('cached-categories');
    return cached ? JSON.parse(cached) : null;
  });
  const [heroImage, setHeroImage] = useState(() => localStorage.getItem('cached-hero-image') || null);
  const [banners, setBanners] = useState([]);
  const [activeBanner, setActiveBanner] = useState(0);

  useEffect(() => {
    api.get('/products?featured=true&limit=8')
      .then((res) => setFeatured(res.data.products))
      .catch(console.error)
      .finally(() => setLoading(false));

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

    api.get('/settings/banners')
      .then((res) => { if (Array.isArray(res.data) && res.data.length > 0) setBanners(res.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const categoryList = (categories === null ? [] : categories.length > 0 ? categories : [
    { name: 'Electronics' }, { name: 'Clothing' }, { name: 'Footwear' },
    { name: 'Accessories' }, { name: 'Sports' }, { name: 'Home' }, { name: 'Beauty' },
  ]);

  return (
    <div className="s2-root">
      <SEO
        title="Zayara Mobiles"
        description={`A luminous after-hours showroom. Carefully chosen objects lit by aurora light — shipped free over ${CURRENCY}500.`}
      />

      {/* ── Banner carousel ────────────────────────────────── */}
      {banners.length > 0 && (
        <section className="s2-banners">
          <div className="s2-banner-track" style={{ transform: `translateX(-${activeBanner * 100}%)` }}>
            {banners.map((banner, i) => (
              <div key={i} className="s2-banner-slide">
                <img src={banner.image} alt={banner.title || ''} className="s2-banner-img" />
                <div className="s2-banner-overlay" />
                <div className="s2-banner-content">
                  {banner.subtitle && <p className="s2-eyebrow">{banner.subtitle}</p>}
                  {banner.title && <h2 className="s2-banner-title">{banner.title}</h2>}
                  {banner.link && (
                    <Link to={banner.link} className="s2-btn s2-banner-cta">
                      Shop Collection
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
          {banners.length > 1 && (
            <div className="s2-banner-dots">
              {banners.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`s2-banner-dot ${activeBanner === i ? 'active' : ''}`}
                  onClick={() => setActiveBanner(i)}
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
            Drift through <em>rooms</em>
          </h2>
          <Link to="/products" className="s2-view-all">
            All rooms <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>
        <div className="s2-category-rail">
          {categoryList.map((c) => (
            <Link key={c.name} to={`/products?category=${c.name}`} className="s2-cat-card">
              {c.image && <img src={c.image} alt="" className="s2-cat-img" />}
              <span className="s2-cat-icon">{fallbackIcons[c.name] || <LayoutGrid size={20} strokeWidth={1.6} />}</span>
              <span className="s2-cat-label">{c.name}</span>
            </Link>
          ))}
          <Link to="/products" className="s2-cat-card">
            <span className="s2-cat-icon"><LayoutGrid size={20} strokeWidth={1.6} /></span>
            <span className="s2-cat-label"><em>All</em></span>
          </Link>
        </div>
      </section>

      {/* ── Featured grid ────────────────────────────────── */}
      <section className="s2-section">
        <div className="s2-section-head">
          <h2 className="s2-section-title">
            Tonight's <em>features</em>
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

    </div>
  );
}

