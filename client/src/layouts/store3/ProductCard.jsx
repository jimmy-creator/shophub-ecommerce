import { Link } from 'react-router-dom';
import { Plus, Heart } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { showToast } from '../../utils/toast';
import { CurrencySymbol } from '../../utils/currency';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const imgFull = product.images?.[0];
  const img = imgFull?.replace(/\/uploads\/(.+?)\.webp$/, '/api/upload/thumb/$1.webp') || imgFull;
  const hasDiscount = product.comparePrice && product.comparePrice > product.price;
  const discount = hasDiscount
    ? Math.round((1 - product.price / product.comparePrice) * 100)
    : 0;
  const wishlisted = isInWishlist(product.id);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1, null);
    showToast('Added to cart');
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
    showToast(wishlisted ? 'Removed from wishlist' : 'Added to wishlist');
  };

  return (
    <article className="s2-product">
      <Link to={`/product/${product.slug}`} className="s2-product-img">
        {img ? (
          <img src={img} alt={product.name} loading="lazy" />
        ) : (
          <div className="s2-product-placeholder">
            {product.name?.[0] || '·'}
          </div>
        )}
        {discount > 0 && <span className="s2-product-badge">−{discount}%</span>}
        <button
          type="button"
          className={`s2-product-wish ${wishlisted ? 'active' : ''}`}
          onClick={handleWishlist}
          aria-label="Toggle wishlist"
        >
          <Heart size={15} strokeWidth={1.8} fill={wishlisted ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          className="s2-product-cart-btn"
          onClick={handleAddToCart}
          aria-label="Add to cart"
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </Link>
      <div className="s2-product-body">
        <div className="s2-product-cat">{product.category}</div>
        <Link to={`/product/${product.slug}`} className="s2-product-name">
          {product.name}
        </Link>
        <div className="s2-product-price">
          <span className="now"><CurrencySymbol />{parseFloat(product.price).toFixed(0)}</span>
          {hasDiscount && (
            <span className="was"><CurrencySymbol />{parseFloat(product.comparePrice).toFixed(0)}</span>
          )}
        </div>
      </div>
    </article>
  );
}
