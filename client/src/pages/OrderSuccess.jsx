import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HiCheckCircle, HiXCircle } from 'react-icons/hi';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const orderNumber = searchParams.get('orderNumber');
  const guestEmail = searchParams.get('email');
  const status = searchParams.get('status');
  const isFailed = status === 'failed';
  const isGuest = !user;

  useEffect(() => {
    if (!isFailed) {
      clearCart();
    }

    if (orderNumber) {
      if (isGuest && guestEmail) {
        // Guest: track by order number + email
        api.get(`/orders/track?orderNumber=${orderNumber}&email=${encodeURIComponent(guestEmail)}`)
          .then((res) => setOrder(res.data))
          .catch(console.error)
          .finally(() => setLoading(false));
      } else if (!isGuest) {
        // Logged in: fetch from my orders
        api.get('/orders/my-orders')
          .then((res) => {
            const found = res.data.find((o) => o.orderNumber === orderNumber);
            if (found) setOrder(found);
          })
          .catch(console.error)
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <div className="loading page-loading">Loading...</div>;

  return (
    <div className="order-success-page">
      <div className="container">
        <div className="order-success-card">
          {isFailed ? (
            <>
              <HiXCircle className="order-success-icon failed" />
              <h1>Payment Failed</h1>
              <p>Your payment could not be processed. No amount has been charged.</p>
            </>
          ) : (
            <>
              <HiCheckCircle className="order-success-icon success" />
              <h1>Order Confirmed!</h1>
              <p>Thank you for your purchase. Your order has been placed successfully.</p>
            </>
          )}

          {order && (
            <div className="order-success-details">
              <div className="order-success-row">
                <span>Order Number</span>
                <strong>{order.orderNumber}</strong>
              </div>
              <div className="order-success-row">
                <span>Amount</span>
                <strong>₹{parseFloat(order.totalAmount).toFixed(2)}</strong>
              </div>
              <div className="order-success-row">
                <span>Payment</span>
                <strong style={{ textTransform: 'capitalize' }}>{order.paymentStatus}</strong>
              </div>
              <div className="order-success-row">
                <span>Status</span>
                <strong style={{ textTransform: 'capitalize' }}>{order.orderStatus}</strong>
              </div>
            </div>
          )}

          {!order && orderNumber && (
            <div className="order-success-details">
              <div className="order-success-row">
                <span>Order Number</span>
                <strong>{orderNumber}</strong>
              </div>
            </div>
          )}

          {isGuest && !isFailed && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
              A confirmation has been sent to <strong>{guestEmail}</strong>. Save your order number to track your order.
            </p>
          )}

          <div className="order-success-actions">
            {!isGuest && (
              <Link to="/orders" className="btn btn-primary">View My Orders</Link>
            )}
            <Link to="/products" className="btn btn-secondary">Continue Shopping</Link>
            {isGuest && (
              <Link to="/register" className="btn btn-primary">Create Account</Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
