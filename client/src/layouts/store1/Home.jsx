import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HiArrowRight, HiShieldCheck, HiTruck, HiRefresh } from 'react-icons/hi';
import { Monitor, Shirt, Footprints, Watch, Briefcase, Dumbbell, Home as HomeIcon, Sparkles, LayoutGrid } from 'lucide-react';
import api from '../../api/axios';
import SearchAutocomplete from '../../components/SearchAutocomplete';
import ProductCard from '../../components/ProductCard';
import { SkeletonGrid } from '../../components/Skeleton';
import SEO from '../../components/SEO';
import { CURRENCY } from '../../utils/currency';

const fallbackIcons = {
  Electronics: <Monitor size={24} />,
  Clothing: <Shirt size={24} />,
  Footwear: <Footprints size={24} />,
  Accessories: <Briefcase size={24} />,
  Sports: <Dumbbell size={24} />,
  Home: <HomeIcon size={24} />,
  Beauty: <Sparkles size={24} />,
};

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState(() => {
    const cached = localStorage.getItem('cached-categories');
    return cached ? JSON.parse(cached) : null;
  });
  const [heroImage, setHeroImage] = useState(() => localStorage.getItem('cached-hero-image') || null);
  const [heroReady, setHeroReady] = useState(!!heroImage);

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
        // Preload the image
        const img = new Image();
        img.src = url;
      })
      .catch(() => setHeroImage('/images/hero-banner.jpeg'))
      .finally(() => setHeroReady(true));

    api.get('/categories')
      .then((res) => {
        setCategories(res.data);
        localStorage.setItem('cached-categories', JSON.stringify(res.data));
        // Preload category images
        res.data.forEach((c) => { if (c.image) { const img = new Image(); img.src = c.image; } });
      })
      .catch(() => setCategories([]));
  }, []);

  return (
    <div className="home">
      <SEO title="Home" description="{`Shop the latest products at great prices. Free shipping on orders over ${CURRENCY}500. Electronics, clothing, accessories and more.`}" />
      {/* Marketplace mobile search bar above hero */}
      <div className="home-search-bar">
        <div className="container">
          <SearchAutocomplete className="home-search" />
        </div>
      </div>

      <section className="hero">
        {heroReady && heroImage && <img src={heroImage} alt="ShopHub Collection" className="hero-banner" fetchPriority="high" />}
        <div className="hero-overlay" />
        <div className="container hero-content">
          <h1>Curated for the<br />Modern Lifestyle</h1>
          <p>{`Discover thoughtfully selected products at exceptional value. Free shipping on orders over ${CURRENCY}500.`}</p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-primary">
              Explore Collection <HiArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* Category Icons Bar */}
      <section className="category-bar">
        <div className="container">
          <div className="category-icons">
            {(categories === null ? [] : categories.length > 0 ? categories : [
              { name: 'Electronics' }, { name: 'Clothing' }, { name: 'Footwear' },
              { name: 'Accessories' }, { name: 'Sports' }, { name: 'Home' }, { name: 'Beauty' },
            ]).map((c) => (
              <Link
                key={c.name}
                to={`/products?category=${c.name}`}
                className="category-icon-item"
              >
                <div className="category-icon-circle">
                  {c.image ? (
                    <img src={c.image} alt={c.name} className="category-icon-img" />
                  ) : (
                    fallbackIcons[c.name] || <LayoutGrid size={24} />
                  )}
                </div>
                <span>{c.name}</span>
              </Link>
            ))}
            <Link to="/products" className="category-icon-item">
              <div className="category-icon-circle"><LayoutGrid size={24} /></div>
              <span>All</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="features-grid">
          <div className="feature">
            <HiTruck className="feature-icon" />
            <div>
              <h3>Free Shipping</h3>
              <p>On orders over {CURRENCY}500</p>
            </div>
          </div>
          <div className="feature">
            <HiShieldCheck className="feature-icon" />
            <div>
              <h3>Secure Checkout</h3>
              <p>100% protected payments</p>
            </div>
          </div>
          <div className="feature">
            <HiRefresh className="feature-icon" />
            <div>
              <h3>Easy Returns</h3>
              <p>30-day return policy</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>Featured Collection</h2>
            <Link to="/products" className="view-all">
              View All <HiArrowRight />
            </Link>
          </div>
          {loading ? (
            <SkeletonGrid count={8} />
          ) : (
            <div className="products-grid">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="cta">
        <div className="container cta-content">
          <h2>Stay in the Loop</h2>
          <p>Subscribe for early access to new arrivals and exclusive offers.</p>
          <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="Your email address" />
            <button type="submit" className="btn btn-primary">Subscribe</button>
          </form>
        </div>
      </section>
    </div>
  );
}
