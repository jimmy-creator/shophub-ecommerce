import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { CurrencySymbol } from '../../utils/currency';
import { localizedName } from '../../utils/i18nHelpers';

export default function ProductCard({ product, eager = false }) {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const displayName = localizedName(product);
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
            alt={displayName}
            loading={eager ? 'eager' : 'lazy'}
            fetchpriority={eager ? 'high' : 'auto'}
          />
        ) : (
          <div className="s2-product-placeholder">
            {displayName?.[0] || '·'}
          </div>
        )}
        <span className="s2-product-quickview" aria-hidden="true">
          <Eye size={15} strokeWidth={1.8} />
        </span>
        {soldOut ? (
          <span className="s2-product-badge s2-product-badge-soldout">{t('common.outOfStock')}</span>
        ) : discount > 0 ? (
          <span className="s2-product-badge">{discount}% {t('product.off')}</span>
        ) : null}
      </Link>
      <div className="s2-product-body">
        <Link to={`/product/${product.slug}`} className="s2-product-name">
          {displayName}
        </Link>
        <div className="s2-product-foot">
          <div className="s2-product-price">
            <span className="now">
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
            aria-label={soldOut ? t('common.outOfStock') : t('common.addToCart')}
          >
            <ShoppingBag size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </article>
  );
}
