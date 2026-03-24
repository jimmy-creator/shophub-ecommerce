import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { HiShoppingCart, HiStar, HiMinus, HiPlus, HiArrowLeft, HiLightningBolt } from 'react-icons/hi';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import ProductImage from '../components/ProductImage';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, clearCart } = useCart();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    api.get(`/products/${slug}`)
      .then((res) => setProduct(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="loading page-loading">Loading...</div>;
  if (!product) return <div className="not-found">Product not found</div>;

  const discount = product.comparePrice
    ? Math.round((1 - product.price / product.comparePrice) * 100)
    : 0;

  const handleAddToCart = () => {
    addToCart(product, quantity);
    toast.success(`Added to cart`, {
      style: {
        background: '#1a1614',
        color: '#f5f0eb',
        fontSize: '0.88rem',
        fontFamily: "'Outfit', sans-serif",
        borderRadius: '4px',
      },
      iconTheme: { primary: '#c4784a', secondary: '#f5f0eb' },
    });
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    navigate('/checkout');
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
              <span className="price">₹{parseFloat(product.price).toFixed(2)}</span>
              {product.comparePrice && (
                <span className="compare-price">
                  ₹{parseFloat(product.comparePrice).toFixed(2)}
                </span>
              )}
              {discount > 0 && <span className="save-badge">Save {discount}%</span>}
            </div>

            <p className="product-description">{product.description}</p>

            <div className="stock-status">
              {product.stock > 0 ? (
                <span className="in-stock">In Stock ({product.stock} available)</span>
              ) : (
                <span className="out-of-stock">Out of Stock</span>
              )}
            </div>

            {product.stock > 0 && (
              <div className="add-to-cart-section">
                <div className="quantity-selector">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                    <HiMinus />
                  </button>
                  <span>{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}>
                    <HiPlus />
                  </button>
                </div>
                <button className="btn btn-primary btn-lg" onClick={handleAddToCart}>
                  <HiShoppingCart /> Add to Cart
                </button>
                <button className="btn btn-buy-now btn-lg" onClick={handleBuyNow}>
                  <HiLightningBolt /> Buy Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
