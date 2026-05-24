import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HiTrash, HiMinus, HiPlus, HiShoppingCart } from 'react-icons/hi';
import { useCart } from '../context/CartContext';
import ProductImage from '../components/ProductImage';
import { CurrencySymbol, formatPrice } from '../utils/currency';
import { localizedName } from '../utils/i18nHelpers';

export default function Cart() {
  const { t } = useTranslation();
  const { cart, removeFromCart, updateQuantity, cartTotal } = useCart();

  if (cart.length === 0) {
    return (
      <div className="empty-state">
        <HiShoppingCart className="empty-icon" />
        <h2>{t('cart.empty')}</h2>
        <p>{t('cart.emptyHint')}</p>
        <Link to="/products" className="btn btn-primary">{t('common.shopNow')}</Link>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="container">
        <h1>{t('cart.title')}</h1>
        <div className="cart-layout">
          <div className="cart-items">
            {cart.map((item) => (
              <div key={item.cartKey} className="cart-item">
                <div className="cart-item-image">
                  <ProductImage product={item} size="small" />
                </div>
                <div className="cart-item-details">
                  <Link to={`/product/${item.slug}`}>
                    <h3>{localizedName(item)}</h3>
                  </Link>
                  {item.selectedVariant && (
                    <p className="cart-item-variant">
                      {Object.entries(item.selectedVariant).map(([k, v]) => `${k}: ${v}`).join(' / ')}
                    </p>
                  )}
                  <p className="cart-item-price"><CurrencySymbol /> {formatPrice(item.price)}</p>
                </div>
                <div className="cart-item-quantity">
                  <button onClick={() => updateQuantity(item.cartKey, item.quantity - 1)}>
                    <HiMinus />
                  </button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}>
                    <HiPlus />
                  </button>
                </div>
                <div className="cart-item-total">
                  <CurrencySymbol /> {formatPrice(parseFloat(item.price) * item.quantity)}
                </div>
                <button className="remove-btn" onClick={() => removeFromCart(item.cartKey)}>
                  <HiTrash />
                </button>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <h3>{t('checkout.orderSummary')}</h3>
            <div className="summary-row">
              <span>{t('cart.subtotal')}</span>
              <span><CurrencySymbol /> {formatPrice(cartTotal)}</span>
            </div>
            <div className="summary-row">
              <span>{t('cart.shipping')}</span>
              <span>—</span>
            </div>
            <div className="summary-row total">
              <span>{t('cart.subtotal')}</span>
              <span><CurrencySymbol /> {formatPrice(cartTotal)}</span>
            </div>
            <Link to="/checkout" className="btn btn-primary btn-block">
              {t('cart.proceedToCheckout')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
