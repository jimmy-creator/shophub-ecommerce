import { Link } from 'react-router-dom';
import { HiTrash, HiMinus, HiPlus, HiShoppingCart } from 'react-icons/hi';
import { useCart } from '../context/CartContext';
import ProductImage from '../components/ProductImage';

export default function Cart() {
  const { cart, removeFromCart, updateQuantity, cartTotal } = useCart();

  if (cart.length === 0) {
    return (
      <div className="empty-state">
        <HiShoppingCart className="empty-icon" />
        <h2>Your cart is empty</h2>
        <p>Add some products to get started!</p>
        <Link to="/products" className="btn btn-primary">Shop Now</Link>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="container">
        <h1>Shopping Cart</h1>
        <div className="cart-layout">
          <div className="cart-items">
            {cart.map((item) => (
              <div key={item.cartKey} className="cart-item">
                <div className="cart-item-image">
                  <ProductImage product={item} size="small" />
                </div>
                <div className="cart-item-details">
                  <Link to={`/product/${item.slug}`}>
                    <h3>{item.name}</h3>
                  </Link>
                  {item.selectedVariant && (
                    <p className="cart-item-variant">
                      {Object.entries(item.selectedVariant).map(([k, v]) => `${k}: ${v}`).join(' / ')}
                    </p>
                  )}
                  <p className="cart-item-price">₹{parseFloat(item.price).toFixed(2)}</p>
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
                  ₹{(parseFloat(item.price) * item.quantity).toFixed(2)}
                </div>
                <button className="remove-btn" onClick={() => removeFromCart(item.cartKey)}>
                  <HiTrash />
                </button>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <h3>Order Summary</h3>
            <div className="summary-row">
              <span>Subtotal</span>
              <span>₹{cartTotal.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Shipping</span>
              <span>{cartTotal >= 50 ? 'Free' : '₹5.99'}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>₹{(cartTotal + (cartTotal >= 50 ? 0 : 5.99)).toFixed(2)}</span>
            </div>
            <Link to="/checkout" className="btn btn-primary btn-block">
              Proceed to Checkout
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
