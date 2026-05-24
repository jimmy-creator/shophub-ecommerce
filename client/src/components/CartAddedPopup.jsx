import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, X, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { CURRENCY, formatPrice } from '../utils/currency';

export default function CartAddedPopup() {
  const { lastAdded, dismissLastAdded, cartCount } = useCart();

  useEffect(() => {
    if (!lastAdded) return;
    const t = setTimeout(dismissLastAdded, 4000);
    return () => clearTimeout(t);
  }, [lastAdded?.ts, dismissLastAdded]);

  if (!lastAdded) return null;

  const { product, quantity, selectedVariant } = lastAdded;
  const img = product.images?.[0];
  const variantText = selectedVariant
    ? Object.entries(selectedVariant).map(([k, v]) => `${k}: ${v}`).join(' · ')
    : null;
  const lineTotal = formatPrice(parseFloat(product.price) * quantity);

  return (
    <div className="cart-added-popup" role="alert">
      <button className="cart-added-close" onClick={dismissLastAdded} aria-label="Close">
        <X size={16} />
      </button>
      <div className="cart-added-head">
        <CheckCircle size={16} />
        <span>Added to cart</span>
      </div>
      <div className="cart-added-body">
        {img && <img src={img} alt="" className="cart-added-img" />}
        <div className="cart-added-info">
          <p className="cart-added-name">{product.name}</p>
          {variantText && <p className="cart-added-variant">{variantText}</p>}
          <p className="cart-added-meta">
            Qty {quantity} · {CURRENCY}{lineTotal}
          </p>
        </div>
      </div>
      <div className="cart-added-actions">
        <Link to="/cart" className="cart-added-btn primary" onClick={dismissLastAdded}>
          <ShoppingBag size={14} /> View Cart ({cartCount})
        </Link>
        <button type="button" className="cart-added-btn" onClick={dismissLastAdded}>
          Continue
        </button>
      </div>
    </div>
  );
}
