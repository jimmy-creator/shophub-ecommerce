import { Link } from 'react-router-dom';
import { Eye, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { CurrencySymbol } from '../../utils/currency';

export default function ProductCard({ product, eager = false }) {
  const { addToCart } = useCart();
  const imgFull = product.images?.[0];
  const img = imgFull?.replace(/\/uploads\/(.+?)\.webp$/, '/api/upload/thumb/$1.webp') || imgFull;
  const hasDiscount = product.comparePrice && product.comparePrice > product.price;
  const discount = hasDiscount
    ? Math.round((1 - product.price / product.comparePrice) * 100)
    : 0;
  const soldOut = product.stock === 0;

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) return;
    addToCart(product, 1, null);
  };

  return (
    <article className="s2-product">
      <Link to={`/product/${product.slug}`} className="s2-product-img">
        {img ? (
          <img
            src={img}
            alt={product.name}
            loading={eager ? 'eager' : 'lazy'}
            fetchpriority={eager ? 'high' : 'auto'}
          />
        ) : (
          <div className="s2-product-placeholder">
            {product.name?.[0] || '·'}
          </div>
        )}
        <span className="s2-product-quickview" aria-hidden="true">
          <Eye size={15} strokeWidth={1.8} />
        </span>
        {soldOut ? (
          <span className="s2-product-badge s2-product-badge-soldout">SOLDOUT</span>
        ) : discount > 0 ? (
          <span className="s2-product-badge">{discount}% OFF</span>
        ) : null}
      </Link>
      <div className="s2-product-body">
        <Link to={`/product/${product.slug}`} className="s2-product-name">
          {product.name}
        </Link>
        <div className="s2-product-foot">
          <div className="s2-product-price">
            <span className="now">
              {hasDiscount ? 'From ' : ''}
              <CurrencySymbol />{parseFloat(product.price).toFixed(0)}
            </span>
            {hasDiscount && (
              <span className="was"><CurrencySymbol />{parseFloat(product.comparePrice).toFixed(0)}</span>
            )}
          </div>
          <button
            type="button"
            className="s2-product-cart-btn"
            onClick={handleAddToCart}
            disabled={soldOut}
            aria-label={soldOut ? 'Out of stock' : 'Add to cart'}
          >
            <ShoppingBag size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </article>
  );
}
