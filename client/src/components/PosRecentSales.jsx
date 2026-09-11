/**
 * Recent-sales picker — every POS sale at this location for the last 30 days,
 * so a customer returning an older purchase can be served by whoever is on
 * the till.
 *
 * Void and Edit only appear on sales from the *current* shift: both post
 * their reversal against the current drawer, so applying them to an older
 * sale would move cash between shifts. Older rows offer reprint only, and
 * are refunded through the Return flow instead (which is location-scoped
 * server-side and books the refund correctly).
 */
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiPrinter, HiChevronDown, HiChevronUp } from 'react-icons/hi';
import api from '../api/axios';

const RECENT_DAYS = 30;

// Time alone is ambiguous once the list spans days.
const whenLabel = (iso) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })} ${time}`;
};

const methodLabel = (m) => (
  m === 'pos_cash' ? 'Cash'
    : m === 'pos_knet' ? 'KNET'
      : m === 'pos_split' ? 'Split'
        : 'Card'
);

// Expanded row: the sale's lines and money breakdown, from the list payload
// (recent-sales already returns items and paymentBreakdown) — no extra fetch.
function SaleDetails({ sale, fmt }) {
  const items = sale.items || [];
  const subTotal = items.reduce((n, it) => n + (parseFloat(it.price) || 0) * it.quantity, 0);
  const row = { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: 12 };
  const money = { fontFamily: 'monospace', whiteSpace: 'nowrap' };
  return (
    <div style={{
      marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--pos-line)',
      display: 'grid', gap: '0.3rem',
    }}>
      {items.map((it, i) => (
        <div key={i} style={row}>
          <span>
            {it.quantity} × {it.name}
            {it.sku && <span style={{ color: 'var(--pos-text-3)' }}> · {it.sku}</span>}
            {it.lineDiscount && (
              <span style={{ color: 'var(--pos-warn)' }}> · −{fmt(it.lineDiscount.amount)}</span>
            )}
          </span>
          <span style={money}>{fmt((parseFloat(it.price) || 0) * it.quantity)}</span>
        </div>
      ))}

      <div style={{ ...row, color: 'var(--pos-text-2)', marginTop: '0.3rem' }}>
        <span>Subtotal</span><span style={money}>{fmt(subTotal)}</span>
      </div>
      {parseFloat(sale.discount || 0) > 0 && (
        <div style={{ ...row, color: 'var(--pos-warn)' }}>
          <span>Discount</span><span style={money}>−{fmt(sale.discount)}</span>
        </div>
      )}
      <div style={{ ...row, fontWeight: 600 }}>
        <span>Total</span><span style={money}>{fmt(sale.totalAmount)}</span>
      </div>

      {(sale.paymentBreakdown || []).map((t, i) => (
        <div key={i} style={{ ...row, color: 'var(--pos-text-2)' }}>
          <span>{t.method}{t.reference ? ` · ${t.reference}` : ''}</span>
          <span style={money}>{fmt(t.amount)}</span>
        </div>
      ))}
      {parseFloat(sale.refundAmount || 0) > 0 && (
        <div style={{ ...row, color: 'var(--pos-warn)' }}>
          <span>Refunded</span><span style={money}>−{fmt(sale.refundAmount)}</span>
        </div>
      )}
      {sale.shippingAddress?.phone && (
        <div style={{ ...row, color: 'var(--pos-text-3)' }}>
          <span>Customer</span>
          <span>{sale.shippingAddress.fullName} · {sale.shippingAddress.phone}</span>
        </div>
      )}
    </div>
  );
}

export default function PosRecentSales({ currency = 'KWD', sessionId, onClose, onNeedOverride, onEdit, onPrint }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);   // row expanded to show its lines

  const fmt = (n) => `${currency} ${(parseFloat(n) || 0).toFixed(3)}`;

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/pos/recent-sales', { params: { days: RECENT_DAYS } });
      setSales(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load sales');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const postVoid = async (orderId, managerOverride) => {
    const { data } = await api.post(`/pos/sales/${orderId}/void`, {
      managerOverride: managerOverride || undefined,
    });
    toast.success(`Sale voided · refunded ${fmt(data.salesReturn.refundAmount)}`);
    load();
  };

  const startVoid = async (sale) => {
    try {
      await postVoid(sale.id);
    } catch (err) {
      if (err.response?.data?.requires === 'manager_override' && onNeedOverride) {
        onNeedOverride({
          reason: err.response.data.message,
          retry: (override) => postVoid(sale.id, override),
        });
      } else {
        toast.error(err.response?.data?.message || 'Void failed');
      }
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Recent sales — last {RECENT_DAYS} days</h3>
          <button onClick={onClose} className="link-btn">Close</button>
        </div>

        {loading && <p style={{ color: 'var(--pos-text-2)', padding: '1rem 0' }}>Loading…</p>}
        {!loading && sales.length === 0 && (
          <p style={{ color: 'var(--pos-text-2)', padding: '1rem 0' }}>
            No sales at this location in the last {RECENT_DAYS} days.
          </p>
        )}

        {!loading && sales.length > 0 && (
          <div style={{ marginTop: '0.75rem', maxHeight: '60vh', overflowY: 'auto' }}>
            {sales.map((s) => {
              const fullyVoid = parseFloat(s.refundAmount || 0) >= parseFloat(s.totalAmount);
              const remaining = +(parseFloat(s.totalAmount) - parseFloat(s.refundAmount || 0)).toFixed(3);
              // Void/edit reverse against the current drawer, so the server
              // refuses them outside this shift — don't offer the buttons.
              const thisShift = sessionId != null && s.cashierSessionId === sessionId;
              return (
                <div key={s.id} style={{
                  padding: '0.75rem', border: '1px solid var(--pos-line)', borderRadius: 8,
                  marginBottom: '0.4rem', background: fullyVoid ? 'var(--pos-panel)66' : 'var(--pos-bg)',
                  opacity: fullyVoid ? 0.5 : 1,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--pos-text-2)' }}>{s.orderNumber}</div>
                      <div style={{ fontSize: 13 }}>
                        {(s.items || []).length} items · {whenLabel(s.createdAt)} · {methodLabel(s.paymentMethod)}
                      </div>
                      {s.shippingAddress?.fullName && s.shippingAddress.fullName !== 'Walk-in' && (
                        <div style={{ fontSize: 12, color: 'var(--pos-label)' }}>{s.shippingAddress.fullName}</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>{fmt(s.totalAmount)}</div>
                      {parseFloat(s.refundAmount || 0) > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--pos-warn)' }}>
                          {fullyVoid ? 'VOIDED' : `−${fmt(s.refundAmount)} refunded`}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => setOpenId(openId === s.id ? null : s.id)}
                        title={openId === s.id ? 'Hide details' : 'View details'}
                        style={{
                          padding: '0.4rem 0.55rem', background: 'var(--pos-panel)', color: 'var(--pos-label)',
                          border: '1px solid var(--pos-line)', borderRadius: 6, cursor: 'pointer',
                          fontFamily: 'inherit', display: 'grid', placeItems: 'center',
                        }}>
                        {openId === s.id ? <HiChevronUp size={14} /> : <HiChevronDown size={14} />}
                      </button>
                      {onPrint && (
                        <button
                          onClick={async () => {
                            try {
                              const { data } = await api.get(`/pos/sales/${s.id}/receipt`);
                              onPrint(data);
                            } catch (err) {
                              toast.error(err.response?.data?.message || 'Could not load receipt');
                            }
                          }}
                          title="Reprint receipt"
                          style={{
                            padding: '0.4rem 0.55rem', background: 'var(--pos-panel)', color: 'var(--pos-label)',
                            border: '1px solid var(--pos-line)', borderRadius: 6, cursor: 'pointer',
                            fontFamily: 'inherit', display: 'grid', placeItems: 'center',
                          }}>
                          <HiPrinter size={14} />
                        </button>
                      )}
                      {!fullyVoid && thisShift && onEdit && (
                        <button
                          onClick={() => onEdit(s.orderNumber)}
                          style={{
                            padding: '0.4rem 0.7rem', background: 'var(--pos-panel)', color: 'var(--pos-label)',
                            border: '1px solid var(--pos-line)', borderRadius: 6, cursor: 'pointer',
                            fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600,
                          }}>
                          Edit
                        </button>
                      )}
                      {!fullyVoid && thisShift && (
                        <button
                          onClick={() => {
                            // Mirrors the server's rail mapping in pos.js /sales/:id/void.
                            const rail = s.paymentMethod === 'pos_knet' ? 'to KNET'
                              : s.paymentMethod === 'pos_card' ? 'to card'
                              : 'in cash';
                            if (!confirm(`Void sale ${s.orderNumber}? Refund ${fmt(remaining)} ${rail}, return all items to stock.`)) return;
                            startVoid(s);
                          }}
                          style={{
                            padding: '0.4rem 0.7rem', background: '#7f1d1d', color: 'var(--pos-on-accent)',
                            border: 'none', borderRadius: 6, cursor: 'pointer',
                            fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600,
                          }}>
                          Void
                        </button>
                      )}
                    </div>
                    </div>

                  {openId === s.id && <SaleDetails sale={s} fmt={fmt} />}
                </div>
              );
            })}
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--pos-text-3)', marginTop: '0.5rem' }}>
          Voiding requires a manager PIN. Void and Edit apply to this shift&rsquo;s sales only —
          for anything older, reprint here and refund it through Return.
        </p>
      </div>
    </div>
  );
}
