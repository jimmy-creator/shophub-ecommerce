import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Flower2, Droplet, Gem, Gift, Wind, LayoutGrid } from 'lucide-react';
import api from '../../api/axios';
import SEO from '../../components/SEO';
import { CURRENCY } from '../../utils/currency';
import ProductCard from './ProductCard';
import { SkeletonGrid } from '../../components/Skeleton';

const fallbackIcons = {
  'Eau de Parfum': <Droplet size={20} strokeWidth={1.6} />,
  'Eau de Toilette': <Wind size={20} strokeWidth={1.6} />,
  'Perfume Oils': <Gem size={20} strokeWidth={1.6} />,
  'Niche': <Sparkles size={20} strokeWidth={1.6} />,
  'Floral': <Flower2 size={20} strokeWidth={1.6} />,
  'Gift Sets': <Gift size={20} strokeWidth={1.6} />,
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
  const [midBanners, setMidBanners] = useState(() => {
    const cached = localStorage.getItem('cached-mid-banners');
    return cached ? JSON.parse(cached) : [];
  });
  const [categoryCards, setCategoryCards] = useState(() => {
    const cached = localStorage.getItem('cached-category-cards');
    return cached ? JSON.parse(cached) : [];
  });

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

    api.get('/settings/mid-banners')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setMidBanners(res.data);
          localStorage.setItem('cached-mid-banners', JSON.stringify(res.data));
          res.data.forEach((b) => { if (b.image) { const img = new Image(); img.src = b.image; } });
        }
      })
      .catch(() => {});

    api.get('/settings/category-cards')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setCategoryCards(res.data);
          localStorage.setItem('cached-category-cards', JSON.stringify(res.data));
          res.data.forEach((c) => { if (c.image) { const img = new Image(); img.src = c.image; } });
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
    { name: 'Eau de Parfum' }, { name: 'Eau de Toilette' }, { name: 'Perfume Oils' },
    { name: 'Niche' }, { name: 'Floral' }, { name: 'Gift Sets' },
  ]);

  return (
    <div className="s2-root">
      <SEO
        title="Kalif"
        description="Kalif — quality goods, carefully curated."
      />

      {/* ── Banner carousel (with desktop + mobile variants) ─── */}
      {banners.length > 0 ? (
        <section
          className="s2-banners"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="s2-banner-track" style={{ transform: `translateX(-${activeBanner * 100}%)` }}>
            {banners.map((banner, i) => (
              <Link key={i} to={banner.link || '/products'} className="s2-banner-slide">
                <picture>
                  {banner.mobileImage && (
                    <source media="(max-width: 720px)" srcSet={banner.mobileImage} />
                  )}
                  <img
                    src={banner.image}
                    alt={banner.title || ''}
                    className="s2-banner-img"
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                </picture>
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
      ) : (
        /* Placeholder hero block — visible only when no banners configured */
        <section className="s2-hero-block" aria-label="Hero">
          <div className="s2-hero-block-inner" />
        </section>
      )}

      {/* ── Category cards (coloured promo tiles) ─────────── */}
      {categoryCards.length > 0 && (
        <section className="s2-cat-cards-section">
          <div className="s2-cat-cards-grid">
            {categoryCards.map((c, i) => (
              <Link
                key={i}
                to={c.link || '/products'}
                className="s2-cat-card-tile"
                style={{ background: c.bgColor || '#2c5f7d' }}
              >
                <div className="s2-cat-card-text">
                  <h3 className="s2-cat-card-title">{c.title}</h3>
                  <span className="s2-cat-card-cta">
                    Shop Now <ArrowRight size={14} strokeWidth={2.4} />
                  </span>
                </div>
                <picture className="s2-cat-card-img">
                  {c.mobileImage && <source media="(max-width: 720px)" srcSet={c.mobileImage} />}
                  {c.image && <img src={c.image} alt={c.title || ''} loading="lazy" />}
                </picture>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Featured grid ────────────────────────────────── */}
      <section className="s2-section">
        <div className="s2-section-head">
          <h2 className="s2-section-title">
            Best <em>Sellers</em>
          </h2>
          <Link to="/products" className="s2-view-all">
            See all <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>
        {loading ? (
          <SkeletonGrid count={8} className="s2-grid" />
        ) : (
          <div className="s2-grid">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* ── Mid-page promo banners ─────────────────────── */}
      {midBanners.length > 0 && (
        <section className="s2-section s2-mid-banners">
          <div className={`s2-mid-banner-grid s2-mid-banner-grid-${midBanners.length}`}>
            {midBanners.map((b, i) => (
              <Link key={i} to={b.link || '/products'} className="s2-mid-banner">
                <img src={b.image} alt={b.title || ''} className="s2-mid-banner-img" loading="lazy" />
                {(b.title || b.subtitle) && (
                  <div className="s2-mid-banner-overlay">
                    {b.subtitle && <p className="s2-eyebrow">{b.subtitle}</p>}
                    {b.title && <h3 className="s2-mid-banner-title">{b.title}</h3>}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

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

