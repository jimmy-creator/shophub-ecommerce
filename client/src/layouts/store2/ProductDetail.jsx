import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Star, Minus, Plus, ArrowLeft, Zap, Heart, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { useRecentlyViewed } from '../../context/RecentlyViewedContext';
import ProductImage from '../../components/ProductImage';
import PincodeChecker from '../../components/PincodeChecker';
import SEO from '../../components/SEO';
import api from '../../api/axios';
import { showToast } from '../../utils/toast';
import ProductCard from './ProductCard';

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
            <div className="s2-gallery-main" style={{ opacity: 0.4 }} />
            <div className="s2-detail-info">
              <div style={{ height: 20, width: 120, background: 'rgba(255,255,255,0.05)', borderRadius: 6, marginBottom: 20 }} />
              <div style={{ height: 50, background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 20 }} />
              <div style={{ height: 80, background: 'rgba(255,255,255,0.04)', borderRadius: 16 }} />
            </div>
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
    showToast('Added to cart');
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
        description={product.description?.slice(0, 160) || `${product.name} at ₹${parseFloat(displayPrice).toFixed(2)}`}
        image={product.images?.[0] ? `${window.location.origin}${product.images[0]}` : undefined}
        type="product"
        product={{ price: displayPrice, stock: displayStock }}
      />

      <div className="s2-detail">
        <Link to="/products" className="s2-back">
          <ArrowLeft size={14} strokeWidth={1.8} /> Back to collection
        </Link>

        <div className="s2-detail-grid">
          {/* Gallery */}
          <div className="s2-gallery">
            <div className="s2-gallery-main">
              {product.images?.length > 0 ? (
                <img
                  src={product.images[activeImage] || product.images[0]}
                  alt={product.name}
                />
              ) : (
                <ProductImage product={product} size="large" />
              )}
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
                <Heart
                  size={18}
                  strokeWidth={1.8}
                  fill={isInWishlist(product.id) ? 'currentColor' : 'none'}
                />
              </button>
            </div>
            {product.images?.length > 1 && (
              <div className="s2-gallery-thumbs">
                {product.images.map((url, i) => (
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

          {/* Info */}
          <div className="s2-detail-info">
            <span className="s2-detail-cat">{product.category}</span>
            <h1 className="s2-detail-name">{product.name}</h1>
            {product.brand && <p className="s2-detail-brand">by {product.brand}</p>}

            <div className="s2-rating">
              <Star size={14} className="star" fill="currentColor" />
              <span>{product.ratings || '0.0'}</span>
              <span style={{ color: 'var(--s2-text-faint)' }}>· {product.numReviews} review{product.numReviews !== 1 ? 's' : ''}</span>
            </div>

            <div className="s2-pricing">
              <span className="now">₹{parseFloat(displayPrice).toFixed(0)}</span>
              {product.comparePrice && (
                <span className="was">₹{parseFloat(product.comparePrice).toFixed(0)}</span>
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

            <p className="s2-description">{product.description}</p>

            <div className={`s2-stock ${displayStock > 0 ? 'in' : 'out'}`}>
              {displayStock > 0
                ? `In stock · ${displayStock} available`
                : 'Out of stock'}
            </div>

            <PincodeChecker />

            {displayStock > 0 && (
              <div className="s2-add-to-cart">
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
            )}
          </div>
        </div>

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
