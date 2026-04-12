import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HiDownload } from 'react-icons/hi';
import { XCircle } from 'lucide-react';
import api from '../api/axios';
import { showToast } from '../utils/toast';
import { CURRENCY } from '../utils/currency';

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
  const [cancelModal, setCancelModal] = useState(null); // order id
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const fetchOrders = () => {
    api.get('/orders/my-orders')
      .then((res) => setOrders(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data } = await api.post(`/orders/${cancelModal}/cancel`, {
        reason: cancelReason,
      });
      showToast(data.message);
      if (data.refundInitiated) {
        showToast('Refund has been initiated');
      }
      setCancelModal(null);
      setCancelReason('');
      fetchOrders();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to cancel', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = (status) => ['processing', 'confirmed'].includes(status);

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
                      <span>
                        {item.name}
                        {item.variant && ` (${Object.entries(item.variant).filter(([k]) => k !== 'sku').map(([,v]) => v).join(', ')})`}
                        {' x '}{item.quantity}
                      </span>
                      <span>{CURRENCY}{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Refund info */}
                {order.refundStatus && (
                  <div className="order-refund-info">
                    <span className={`refund-badge ${order.refundStatus}`}>
                      Refund {order.refundStatus}
                    </span>
                    {order.refundAmount > 0 && (
                      <span>{CURRENCY}{parseFloat(order.refundAmount).toFixed(2)}</span>
                    )}
                  </div>
                )}

                {order.cancellationReason && (
                  <div className="order-cancel-reason">
                    Reason: {order.cancellationReason}
                  </div>
                )}

                <div className="order-footer">
                  <span>Payment: {order.paymentMethod}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {canCancel(order.orderStatus) && (
                      <button
                        className="cancel-order-btn"
                        onClick={() => setCancelModal(order.id)}
                      >
                        <XCircle size={14} /> Cancel
                      </button>
                    )}
                    <button
                      className="invoice-btn"
                      onClick={() => window.open(`/api/orders/${order.id}/invoice`, '_blank')}
                    >
                      <HiDownload /> Invoice
                    </button>
                    <span className="order-total">
                      Total: {CURRENCY}{parseFloat(order.totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cancel Modal */}
        {cancelModal && (
          <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCancelModal(null); }}>
            <div className="admin-form" style={{ maxWidth: '450px' }}>
              <h3>Cancel Order</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Are you sure you want to cancel this order? This action cannot be undone.
                {orders.find((o) => o.id === cancelModal)?.paymentStatus === 'paid' && (
                  <strong style={{ display: 'block', marginTop: '0.5rem', color: 'var(--success)' }}>
                    A refund will be initiated automatically.
                  </strong>
                )}
              </p>
              <div className="form-group">
                <label>Reason for cancellation</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{ width: '100%', padding: '0.7rem 1rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.9rem' }}
                >
                  <option value="">Select a reason</option>
                  <option value="Changed my mind">Changed my mind</option>
                  <option value="Found a better price">Found a better price</option>
                  <option value="Ordered by mistake">Ordered by mistake</option>
                  <option value="Delivery too slow">Delivery too slow</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleCancel}
                  disabled={cancelling || !cancelReason}
                  style={{ background: 'var(--danger)' }}
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
                <button className="btn btn-secondary" onClick={() => { setCancelModal(null); setCancelReason(''); }}>
                  Keep Order
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
