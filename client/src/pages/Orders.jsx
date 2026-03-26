import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HiDownload } from 'react-icons/hi';
import api from '../api/axios';

const statusColors = {
  processing: '#f59e0b',
  confirmed: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#10b981',
  cancelled: '#ef4444',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders/my-orders')
      .then((res) => setOrders(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="orders-page"><div className="container">
      <div className="skeleton-line skeleton-pulse" style={{ height: '2rem', width: '40%', marginBottom: '2rem' }} />
      {[1,2,3].map((i) => <div key={i} className="skeleton-order skeleton-pulse" />)}
    </div></div>
  );

  return (
    <div className="orders-page">
      <div className="container">
        <h1>My Orders</h1>
        {orders.length === 0 ? (
          <div className="empty-state">
            <h2>No orders yet</h2>
            <p>Start shopping to see your orders here!</p>
            <Link to="/products" className="btn btn-primary">Shop Now</Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <div>
                    <h3>Order #{order.orderNumber}</h3>
                    <p className="order-date">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: statusColors[order.orderStatus] }}
                  >
                    {order.orderStatus}
                  </span>
                </div>
                <div className="order-items">
                  {order.items.map((item, i) => (
                    <div key={i} className="order-item">
                      <span>{item.name} x {item.quantity}</span>
                      <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="order-footer">
                  <span>Payment: {order.paymentMethod}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                      className="invoice-btn"
                      onClick={() => {
                        window.open(`/api/orders/${order.id}/invoice`, '_blank');
                      }}
                    >
                      <HiDownload /> Invoice
                    </button>
                    <span className="order-total">
                      Total: ₹{parseFloat(order.totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
