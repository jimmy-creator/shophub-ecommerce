import { Link } from 'react-router-dom';
import { HiShoppingCart, HiStar, HiHeart, HiOutlineHeart } from 'react-icons/hi';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import ProductImage from './ProductImage';
import { showToast } from '../utils/toast';
import { CURRENCY } from '../utils/currency';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const hasVariants = product.variants && product.variants.length > 0;
  const wishlisted = isInWishlist(product.id);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasVariants) {
      window.location.href = `/product/${product.slug}`;
      return;
    }
    addToCart(product);
    showToast('Added to cart');
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
    showToast(wishlisted ? 'Removed from wishlist' : 'Added to wishlist');
  };

  const discount = product.comparePrice
    ? Math.round((1 - product.price / product.comparePrice) * 100)
    : 0;

  return (
    <Link to={`/product/${product.slug}`} className="product-card">
      <div className="product-image">
        <ProductImage product={product} fit="contain" />
        {discount > 0 && <span className="discount-badge">-{discount}%</span>}
        <button className={`wishlist-btn ${wishlisted ? 'active' : ''}`} onClick={handleWishlist}>
          {wishlisted ? <HiHeart /> : <HiOutlineHeart />}
        </button>
      </div>
      <div className="product-info">
        <span className="product-category">{product.category}</span>
        <h3 className="product-name">{product.name}</h3>
        <div className="product-rating">
          <HiStar className="star" />
          <span>{product.ratings || '0.0'}</span>
          <span className="review-count">({product.numReviews})</span>
        </div>
        <div className="product-pricing">
          <span className="price">{CURRENCY}{parseFloat(product.price).toFixed(2)}</span>
          {product.comparePrice && (
            <span className="compare-price">
              {CURRENCY}{parseFloat(product.comparePrice).toFixed(2)}
            </span>
          )}
        </div>
        <button className="add-to-cart-btn" onClick={handleAdd}>
          <HiShoppingCart /> {hasVariants ? 'Select Options' : 'Add to Cart'}
        </button>
      </div>
    </Link>
  );
}
