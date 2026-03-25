import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { HiShoppingCart, HiStar, HiMinus, HiPlus, HiArrowLeft, HiLightningBolt, HiHeart, HiOutlineHeart } from 'react-icons/hi';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import ProductImage from '../components/ProductImage';
import api from '../api/axios';
import toast from 'react-hot-toast';

const toastOpts = {
  style: { background: '#1a1614', color: '#f5f0eb', fontSize: '0.88rem', fontFamily: "'Outfit', sans-serif", borderRadius: '4px' },
  iconTheme: { primary: '#c4784a', secondary: '#f5f0eb' },
};

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState({});

  useEffect(() => {
    api.get(`/products/${slug}`)
      .then((res) => {
        setProduct(res.data);
        // Initialize default variant selections
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
  }, [slug]);

  if (loading) return <div className="loading page-loading">Loading...</div>;
  if (!product) return <div className="not-found">Product not found</div>;

  const hasVariants = product.variants && product.variants.length > 0;

  // Find active variant based on selected options
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
    toast.success('Added to cart', toastOpts);
  };

  const handleBuyNow = () => {
    const variant = hasVariants ? selectedOptions : null;
    addToCart(product, quantity, variant);
    navigate('/checkout');
  };

  // Check if a specific option value is available given other selections
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
    <div className="product-detail">
      <div className="container">
        <Link to="/products" className="back-link">
          <HiArrowLeft /> Back to Collection
        </Link>

        <div className="product-detail-grid">
          <div className="product-gallery">
            <div className="product-detail-image">
              {product.images?.length > 0 ? (
                <img
                  src={product.images[activeImage] || product.images[0]}
                  alt={product.name}
                  className="gallery-main-img"
                />
              ) : (
                <ProductImage product={product} size="large" />
              )}
              {discount > 0 && <span className="discount-badge large">-{discount}%</span>}
            </div>
            {product.images?.length > 1 && (
              <div className="gallery-thumbnails">
                {product.images.map((url, i) => (
                  <button
                    key={i}
                    className={`gallery-thumb ${activeImage === i ? 'active' : ''}`}
                    onClick={() => setActiveImage(i)}
                  >
                    <img src={url} alt={`${product.name} ${i + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="product-detail-info">
            <span className="product-category">{product.category}</span>
            <h1>{product.name}</h1>
            {product.brand && <p className="product-brand">by {product.brand}</p>}

            <div className="product-rating">
              <HiStar className="star" />
              <span>{product.ratings || '0.0'}</span>
              <span className="review-count">({product.numReviews} reviews)</span>
            </div>

            <div className="product-detail-pricing">
              <span className="price">₹{parseFloat(displayPrice).toFixed(2)}</span>
              {product.comparePrice && (
                <span className="compare-price">
                  ₹{parseFloat(product.comparePrice).toFixed(2)}
                </span>
              )}
              {discount > 0 && <span className="save-badge">Save {discount}%</span>}
            </div>

            {/* Variant Selectors */}
            {hasVariants && product.variantOptions && (
              <div className="variant-selectors">
                {Object.entries(product.variantOptions).map(([type, values]) => (
                  <div key={type} className="variant-selector">
                    <label className="variant-label">
                      {type}: <strong>{selectedOptions[type]}</strong>
                    </label>
                    <div className="variant-options">
                      {values.map((val) => {
                        const available = isOptionAvailable(type, val);
                        const isColor = type.toLowerCase() === 'color' || type.toLowerCase() === 'colour';
                        return (
                          <button
                            key={val}
                            className={`variant-btn ${selectedOptions[type] === val ? 'active' : ''} ${!available ? 'out-of-stock' : ''}`}
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
                              <span className="color-swatch" style={{ backgroundColor: val }} />
                            ) : (
                              val
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {activeVariant?.sku && (
                  <p className="variant-sku">SKU: {activeVariant.sku}</p>
                )}
              </div>
            )}

            <p className="product-description">{product.description}</p>

            <div className="stock-status">
              {displayStock > 0 ? (
                <span className="in-stock">In Stock ({displayStock} available)</span>
              ) : (
                <span className="out-of-stock">Out of Stock</span>
              )}
            </div>

            {displayStock > 0 && (
              <div className="add-to-cart-section">
                <div className="quantity-selector">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                    <HiMinus />
                  </button>
                  <span>{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(displayStock, quantity + 1))}>
                    <HiPlus />
                  </button>
                </div>
                <button className="btn btn-primary btn-lg" onClick={handleAddToCart}>
                  <HiShoppingCart /> Add to Cart
                </button>
                <button className="btn btn-buy-now btn-lg" onClick={handleBuyNow}>
                  <HiLightningBolt /> Buy Now
                </button>
                <button
                  className={`wishlist-detail-btn ${product && isInWishlist(product.id) ? 'active' : ''}`}
                  onClick={() => {
                    toggleWishlist(product);
                    toast.success(isInWishlist(product.id) ? 'Removed from wishlist' : 'Added to wishlist', toastOpts);
                  }}
                >
                  {product && isInWishlist(product.id) ? <HiHeart /> : <HiOutlineHeart />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Reviews Section */}
        <ReviewsSection productId={product.id} user={user} />
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
      toast.success('Review submitted!', toastOpts);
      setShowForm(false);
      setFormData({ rating: 5, title: '', comment: '' });
      fetchReviews();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit review', toastOpts);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reviews-section">
      <div className="reviews-header">
        <h2>Customer Reviews</h2>
        {user && (
          <button className="btn btn-secondary" onClick={() => setShowForm(!showForm)}>
            Write a Review
          </button>
        )}
      </div>

      {/* Rating Summary */}
      <div className="reviews-summary">
        <div className="reviews-avg">
          <span className="reviews-avg-number">{avgRating}</span>
          <div className="reviews-avg-stars">
            {[1, 2, 3, 4, 5].map((s) => (
              <HiStar key={s} className={parseFloat(avgRating) >= s ? 'star-filled' : 'star-empty'} />
            ))}
          </div>
          <span className="reviews-avg-count">{total} review{total !== 1 ? 's' : ''}</span>
        </div>
        <div className="reviews-bars">
          {[5, 4, 3, 2, 1].map((r) => (
            <div key={r} className="reviews-bar-row">
              <span>{r}★</span>
              <div className="reviews-bar">
                <div className="reviews-bar-fill" style={{ width: total > 0 ? `${(breakdown[r] / total) * 100}%` : '0%' }} />
              </div>
              <span className="reviews-bar-count">{breakdown[r]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Write Review Form */}
      {showForm && user && (
        <form className="review-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Rating</label>
            <div className="rating-input">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s} type="button"
                  className={`rating-star ${formData.rating >= s ? 'active' : ''}`}
                  onClick={() => setFormData({ ...formData, rating: s })}
                >
                  <HiStar />
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Title (optional)</label>
            <input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Summarize your experience"
            />
          </div>
          <div className="form-group">
            <label>Your Review</label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              rows={4}
              required
              placeholder="What did you like or dislike?"
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', padding: '2rem 0', textAlign: 'center' }}>
          No reviews yet. Be the first to review!
        </p>
      ) : (
        <div className="reviews-list">
          {reviews.map((review) => (
            <div key={review.id} className="review-card">
              <div className="review-top">
                <div className="review-stars">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <HiStar key={s} className={review.rating >= s ? 'star-filled' : 'star-empty'} />
                  ))}
                </div>
                {review.verified && <span className="verified-badge">Verified Purchase</span>}
              </div>
              {review.title && <h4 className="review-title">{review.title}</h4>}
              <p className="review-comment">{review.comment}</p>
              <div className="review-meta">
                <span className="review-author">{review.name}</span>
                <span className="review-date">
                  {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="pagination">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
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
