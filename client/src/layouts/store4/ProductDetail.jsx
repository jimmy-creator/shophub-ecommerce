import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Star, Minus, Plus, ArrowLeft, Zap, Heart, ShoppingBag, Share2, Link as LinkIcon, Check } from 'lucide-react';
import { FaFacebookF, FaXTwitter, FaPinterestP, FaTelegram, FaWhatsapp, FaEnvelope } from 'react-icons/fa6';
import { useTranslation } from 'react-i18next';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { useRecentlyViewed } from '../../context/RecentlyViewedContext';
import ProductImage from '../../components/ProductImage';
import SEO from '../../components/SEO';
import api from '../../api/axios';
import { showToast } from '../../utils/toast';
import { CURRENCY, CurrencySymbol } from '../../utils/currency';
import { localizedName, localizedDescription } from '../../utils/i18nHelpers';
import ProductCard from './ProductCard';
import { SkeletonGrid } from '../../components/Skeleton';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { viewed, addViewed } = useRecentlyViewed();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const shareWrapRef = useRef(null);
  const { t } = useTranslation();

  // Close the share popover when clicking outside or pressing Escape.
  useEffect(() => {
    if (!shareOpen) return;
    const onPointerDown = (e) => {
      if (shareWrapRef.current && !shareWrapRef.current.contains(e.target)) setShareOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setShareOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [shareOpen]);

  useEffect(() => {
    api.get(`/products/${slug}`)
      .then((res) => {
        setProduct(res.data);
        addViewed(res.data);
        if (res.data.variantOptions) {
          const defaults = {};
          Object.entries(res.data.variantOptions).forEach(([type, values]) => {
            defaults[type] = values[0];
          });
          setSelectedOptions(defaults);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    api.get(`/products/${slug}/related`)
      .then((res) => setRelatedProducts(res.data))
      .catch(() => {});
  }, [slug]);

  if (loading) {
    return (
      <div className="s2-root">
        <div className="s2-detail">
          <div className="s2-detail-grid">
            <div className="skeleton-detail-img skeleton-pulse" style={{ aspectRatio: '1' }} />
            <div className="s2-detail-info">
              <div className="skeleton-line short skeleton-pulse" style={{ marginBottom: '1rem' }} />
              <div className="skeleton-line skeleton-pulse" style={{ height: '2rem', marginBottom: '0.5rem' }} />
              <div className="skeleton-line medium skeleton-pulse" style={{ marginBottom: '2rem' }} />
              <div className="skeleton-line skeleton-pulse" style={{ height: '1.5rem', width: '30%', marginBottom: '1.5rem' }} />
              <div className="skeleton-line skeleton-pulse" style={{ marginBottom: '0.5rem' }} />
              <div className="skeleton-line skeleton-pulse" style={{ marginBottom: '0.5rem' }} />
              <div className="skeleton-line medium skeleton-pulse" style={{ marginBottom: '2rem' }} />
              <div className="skeleton-line skeleton-pulse" style={{ height: '3rem', width: '50%' }} />
            </div>
          </div>

          {/* Related products placeholder — matches the real .s2-related .s2-grid layout below */}
          <div className="s2-related">
            <div className="s2-section-head" style={{ padding: 0 }}>
              <div className="skeleton-line medium skeleton-pulse" style={{ height: '1.6rem', width: '40%' }} />
            </div>
            <SkeletonGrid count={4} className="s2-grid" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="s2-root">
        <div className="s2-detail" style={{ textAlign: 'center', padding: '6rem 1.5rem' }}>
          <h2 className="s2-display" style={{ fontSize: '2.5rem' }}>
            The room is <em>empty</em>.
          </h2>
          <p style={{ color: 'var(--s2-text-dim)', marginTop: '1rem' }}>This product no longer exists.</p>
          <Link to="/products" className="s2-btn s2-btn-primary" style={{ marginTop: '2rem' }}>
            Back to the atrium
          </Link>
        </div>
      </div>
    );
  }

  const hasVariants = product.variants && product.variants.length > 0;
  const activeVariant = hasVariants
    ? product.variants.find((v) =>
        Object.entries(selectedOptions).every(([k, val]) => v.options[k] === val)
      )
    : null;

  const displayPrice = activeVariant?.price != null ? activeVariant.price : product.price;
  const displayStock = hasVariants ? (activeVariant?.stock ?? 0) : product.stock;
  const discount = product.comparePrice
    ? Math.round((1 - displayPrice / product.comparePrice) * 100)
    : 0;

  const handleAddToCart = () => {
    const variant = hasVariants ? selectedOptions : null;
    addToCart(product, quantity, variant);
  };

  const handleBuyNow = () => {
    const variant = hasVariants ? selectedOptions : null;
    addToCart(product, quantity, variant);
    navigate('/checkout');
  };

  const isOptionAvailable = (type, value) => {
    if (!hasVariants) return true;
    return product.variants.some((v) =>
      v.options[type] === value &&
      v.stock > 0 &&
      Object.entries(selectedOptions).every(
        ([k, sv]) => k === type || v.options[k] === sv
      )
    );
  };

  return (
    <div className="s2-root">
      <SEO
        title={product.name}
        description={product.description?.slice(0, 160) || `${product.name} at ${CURRENCY}${parseFloat(displayPrice).toFixed(2)}`}
        image={product.images?.[0] ? `${window.location.origin}${product.images[0]}` : undefined}
        type="product"
        product={{ ...product, price: displayPrice, stock: displayStock }}
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Products', url: '/products' },
          ...(product.category ? [{ name: product.category, url: `/products?category=${encodeURIComponent(product.category)}` }] : []),
          { name: product.name, url: `/product/${product.slug}` },
        ]}
      />

      <div className="s2-detail">
        <Link to="/products" className="s2-back">
          <ArrowLeft size={14} strokeWidth={1.8} /> Back to collection
        </Link>

        <div className="s2-detail-grid">
          {/* Gallery */}
          <GallerySwipe
            images={product.images}
            product={product}
            activeImage={activeImage}
            setActiveImage={setActiveImage}
            discount={discount}
            isInWishlist={isInWishlist}
            toggleWishlist={toggleWishlist}
          />

          {/* Info */}
          <div className="s2-detail-info">
            <span className="s2-detail-cat">{product.category}</span>
            <h1 className="s2-detail-name">{localizedName(product)}</h1>
            {product.brand && <p className="s2-detail-brand">by {product.brand}</p>}

            <div className="s2-rating">
              <Star size={14} className="star" fill="currentColor" />
              <span>{product.ratings || '0.0'}</span>
              <span style={{ color: 'var(--s2-text-faint)' }}>· {product.numReviews} review{product.numReviews !== 1 ? 's' : ''}</span>
            </div>

            <div className="s2-pricing">
              <span className="now"><CurrencySymbol />{parseFloat(displayPrice).toFixed(0)}</span>
              {product.comparePrice && (
                <span className="was"><CurrencySymbol />{parseFloat(product.comparePrice).toFixed(0)}</span>
              )}
              {discount > 0 && <span className="save">Save {discount}%</span>}
            </div>

            {hasVariants && product.variantOptions && (
              <div className="s2-variants">
                {Object.entries(product.variantOptions).map(([type, values]) => (
                  <div key={type}>
                    <label className="s2-variant-label">
                      {type} · <strong>{selectedOptions[type]}</strong>
                    </label>
                    <div className="s2-variant-options">
                      {values.map((val) => {
                        const available = isOptionAvailable(type, val);
                        const isColor = type.toLowerCase() === 'color' || type.toLowerCase() === 'colour';
                        return (
                          <button
                            key={val}
                            type="button"
                            className={`s2-variant-btn ${selectedOptions[type] === val ? 'active' : ''} ${!available ? 'out-of-stock' : ''}`}
                            onClick={() => {
                              if (available) {
                                setSelectedOptions({ ...selectedOptions, [type]: val });
                                setQuantity(1);
                              }
                            }}
                            disabled={!available}
                            title={val}
                          >
                            {isColor ? (
                              <span className="s2-color-swatch" style={{ backgroundColor: val }} />
                            ) : (
                              val
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {activeVariant?.sku && <p className="s2-variant-sku">SKU · {activeVariant.sku}</p>}
              </div>
            )}

            {(() => {
              const desc = localizedDescription(product);
              const lines = (desc || '').split('\n').map((l) => l.trim()).filter(Boolean);
              return lines.length > 1 ? (
                <ul className="s2-description-list">
                  {lines.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              ) : (
                <p className="s2-description">{desc}</p>
              );
            })()}

            <div className={`s2-stock ${displayStock > 0 ? 'in' : 'out'}`}>
              {displayStock > 0
                ? `In stock · ${displayStock} available`
                : 'Out of stock'}
            </div>

            {displayStock > 0 ? (
              <div className="s2-add-to-cart">
                <label className="s2-qty-label">Quantity:</label>
                <div className="s2-qty">
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease">
                    <Minus size={14} strokeWidth={2} />
                  </button>
                  <span>{quantity}</span>
                  <button type="button" onClick={() => setQuantity(Math.min(displayStock, quantity + 1))} aria-label="Increase">
                    <Plus size={14} strokeWidth={2} />
                  </button>
                </div>
                <button type="button" className="s2-btn s2-btn-lg" onClick={handleAddToCart}>
                  <ShoppingBag size={16} strokeWidth={1.8} /> Add to cart
                </button>
                <button type="button" className="s2-btn s2-btn-primary s2-btn-lg" onClick={handleBuyNow}>
                  <Zap size={16} strokeWidth={1.8} /> Buy now
                </button>
              </div>
            ) : (
              <button type="button" className="s2-btn s2-btn-lg s2-btn-soldout" disabled>
                Sold out
              </button>
            )}

            {(() => {
              const url = typeof window !== 'undefined' ? window.location.href : '';
              const title = product.name || '';
              const img = product.images?.[0]
                ? (window.location.origin + product.images[0])
                : '';
              const u = encodeURIComponent(url);
              const tt = encodeURIComponent(title);
              const i = encodeURIComponent(img);
              const shares = [
                { name: 'Facebook',  href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, color: '#1877F2', icon: <FaFacebookF /> },
                { name: 'X',         href: `https://twitter.com/intent/tweet?url=${u}&text=${tt}`, color: '#000000', icon: <FaXTwitter /> },
                { name: 'Pinterest', href: `https://pinterest.com/pin/create/button/?url=${u}&media=${i}&description=${tt}`, color: '#E60023', icon: <FaPinterestP /> },
                { name: 'Telegram',  href: `https://t.me/share/url?url=${u}&text=${tt}`, color: '#229ED9', icon: <FaTelegram /> },
                { name: 'WhatsApp',  href: `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`, color: '#25D366', icon: <FaWhatsapp /> },
                { name: 'Email',     href: `mailto:?subject=${tt}&body=${u}`, color: '#EA4335', icon: <FaEnvelope /> },
              ];
              const copyLink = async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 1500);
                } catch { /* clipboard unavailable */ }
              };
              return (
                <div className="s2-detail-share" ref={shareWrapRef}>
                  <button
                    type="button"
                    className="s2-share-btn"
                    onClick={() => setShareOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={shareOpen}
                  >
                    <Share2 size={16} strokeWidth={2} />
                    <span>{t('product.shareProduct')}</span>
                  </button>
                  {shareOpen && (
                    <div className="s2-share-pop" role="menu">
                      {shares.map((s) => (
                        <a
                          key={s.name}
                          href={s.href}
                          target={s.name === 'Email' ? undefined : '_blank'}
                          rel={s.name === 'Email' ? undefined : 'noopener noreferrer'}
                          className="s2-share-pop-item"
                          role="menuitem"
                          onClick={() => setShareOpen(false)}
                        >
                          <span className="s2-share-icon" style={{ background: s.color }}>{s.icon}</span>
                          <span>{s.name}</span>
                        </a>
                      ))}
                      <button
                        type="button"
                        className="s2-share-pop-item"
                        role="menuitem"
                        onClick={copyLink}
                      >
                        <span className="s2-share-icon s2-share-icon-neutral">
                          {linkCopied ? <Check size={14} strokeWidth={2.5} /> : <LinkIcon size={14} strokeWidth={2.2} />}
                        </span>
                        <span>{linkCopied ? t('product.linkCopied') : t('product.copyLink')}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Mobile sticky bottom bar */}
        {displayStock > 0 && (
          <div className="s2-mobile-buy-bar">
            <span className="s2-mobile-buy-price">
              <CurrencySymbol />{parseFloat(displayPrice).toFixed(0)}
            </span>
            <button type="button" className="s2-mobile-buy-btn s2-mobile-buy-now" onClick={handleBuyNow}>
              <Zap size={15} strokeWidth={1.8} /> Buy now
            </button>
            <button type="button" className="s2-mobile-buy-btn s2-mobile-add-cart" onClick={handleAddToCart}>
              <ShoppingBag size={15} strokeWidth={1.8} /> Add to cart
            </button>
          </div>
        )}

        <ReviewsSection productId={product.id} user={user} />

        {relatedProducts.length > 0 && (
          <div className="s2-related">
            <div className="s2-section-head" style={{ padding: 0 }}>
              <h2 className="s2-section-title">You may also <em>love</em></h2>
            </div>
            <div className="s2-grid" style={{ padding: 0 }}>
              {relatedProducts.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}

        {viewed.filter((p) => p.id !== product.id).length > 0 && (
          <div className="s2-related">
            <div className="s2-section-head" style={{ padding: 0 }}>
              <h2 className="s2-section-title">Recently <em>admired</em></h2>
            </div>
            <div className="s2-grid" style={{ padding: 0 }}>
              {viewed.filter((p) => p.id !== product.id).slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function GallerySwipe({ images, product, activeImage, setActiveImage, discount, isInWishlist, toggleWishlist }) {
  const touchStart = useRef(null);
  const touchDelta = useRef(0);
  const imgCount = images?.length || 0;

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
      if (touchDelta.current < 0 && activeImage < imgCount - 1) {
        setActiveImage(activeImage + 1);
      } else if (touchDelta.current > 0 && activeImage > 0) {
        setActiveImage(activeImage - 1);
      }
    }
    touchStart.current = null;
    touchDelta.current = 0;
  };

  return (
    <div className="s2-gallery">
      <div
        className="s2-gallery-main"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="s2-gallery-track" style={{ transform: `translateX(-${activeImage * 100}%)` }}>
          {imgCount > 0 ? (
            images.map((url, i) => (
              <div key={i} className="s2-gallery-slide">
                <img src={url} alt={`${product.name} ${i + 1}`} />
              </div>
            ))
          ) : (
            <div className="s2-gallery-slide">
              <ProductImage product={product} size="large" />
            </div>
          )}
        </div>
        {discount > 0 && <span className="s2-discount-badge">−{discount}%</span>}
        <button
          type="button"
          className={`s2-wishlist-btn ${isInWishlist(product.id) ? 'active' : ''}`}
          onClick={() => {
            toggleWishlist(product);
            showToast(isInWishlist(product.id) ? 'Removed from wishlist' : 'Added to wishlist');
          }}
          aria-label="Toggle wishlist"
        >
          <Heart size={18} strokeWidth={1.8} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} />
        </button>
        {imgCount > 1 && (
          <div className="s2-gallery-dots">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`s2-gallery-dot ${activeImage === i ? 'active' : ''}`}
                onClick={() => setActiveImage(i)}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
      {imgCount > 1 && (
        <div className="s2-gallery-thumbs">
          {images.map((url, i) => (
            <button
              key={i}
              type="button"
              className={`s2-thumb ${activeImage === i ? 'active' : ''}`}
              onClick={() => setActiveImage(i)}
            >
              <img src={url} alt={`${product.name} ${i + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewsSection({ productId, user }) {
  const [reviews, setReviews] = useState([]);
  const [breakdown, setBreakdown] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ rating: 5, title: '', comment: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = () => {
    api.get(`/reviews/product/${productId}?page=${page}&limit=5`)
      .then((res) => {
        setReviews(res.data.reviews);
        setBreakdown(res.data.breakdown);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      })
      .catch(console.error);
  };

  useEffect(() => { fetchReviews(); }, [productId, page]);

  const avgRating = total > 0
    ? (Object.entries(breakdown).reduce((sum, [r, c]) => sum + r * c, 0) / total).toFixed(1)
    : '0.0';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/reviews', { productId, ...formData });
      showToast('Review submitted');
      setShowForm(false);
      setFormData({ rating: 5, title: '', comment: '' });
      fetchReviews();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to submit review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="s2-reviews">
      <div className="s2-reviews-head">
        <h2>Customer <em style={{ fontStyle: 'italic', color: 'var(--s2-lavender)' }}>voices</em></h2>
        {user && (
          <button type="button" className="s2-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Write a review'}
          </button>
        )}
      </div>

      <div className="s2-reviews-summary">
        <div className="s2-reviews-avg">
          <span className="s2-reviews-avg-number">{avgRating}</span>
          <div className="s2-reviews-avg-stars">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={16}
                fill={parseFloat(avgRating) >= s ? 'currentColor' : 'none'}
                className={parseFloat(avgRating) >= s ? '' : 'star-empty'}
              />
            ))}
          </div>
          <span className="s2-reviews-avg-count">{total} review{total !== 1 ? 's' : ''}</span>
        </div>
        <div className="s2-reviews-bars">
          {[5, 4, 3, 2, 1].map((r) => (
            <div key={r} className="s2-reviews-bar-row">
              <span>{r}★</span>
              <div className="s2-reviews-bar">
                <div
                  className="s2-reviews-bar-fill"
                  style={{ width: total > 0 ? `${(breakdown[r] / total) * 100}%` : '0%' }}
                />
              </div>
              <span>{breakdown[r]}</span>
            </div>
          ))}
        </div>
      </div>

      {showForm && user && (
        <form className="s2-review-form" onSubmit={handleSubmit}>
          <label>Rating</label>
          <div className="s2-rating-input">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                className={formData.rating >= s ? 'active' : ''}
                onClick={() => setFormData({ ...formData, rating: s })}
              >
                ★
              </button>
            ))}
          </div>

          <label>Title (optional)</label>
          <input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Summarize your experience"
          />

          <label>Your review</label>
          <textarea
            value={formData.comment}
            onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
            rows={4}
            required
            placeholder="What did you think?"
          />

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="s2-btn s2-btn-primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit review'}
            </button>
            <button type="button" className="s2-btn" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {reviews.length === 0 ? (
        <p style={{
          color: 'var(--s2-text-dim)',
          padding: '2rem 0',
          textAlign: 'center',
          fontFamily: 'var(--s2-font-display)',
          fontStyle: 'italic',
          fontSize: '1.15rem',
        }}>
          The room is quiet. Be the first to speak.
        </p>
      ) : (
        <div>
          {reviews.map((review) => (
            <div key={review.id} className="s2-review-card">
              <div className="s2-review-top">
                <div className="s2-review-stars">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={13}
                      fill={review.rating >= s ? 'currentColor' : 'none'}
                      className={review.rating >= s ? '' : 'star-empty'}
                    />
                  ))}
                </div>
                {review.verified && <span className="s2-verified">Verified</span>}
              </div>
              {review.title && <h4 className="s2-review-title">{review.title}</h4>}
              <p className="s2-review-comment">{review.comment}</p>
              <div className="s2-review-meta">
                <span>{review.name}</span>
                <span>
                  {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="s2-pagination">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  type="button"
                  className={page === i + 1 ? 'active' : ''}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
