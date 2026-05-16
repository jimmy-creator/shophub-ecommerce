/**
 * POS sales terminal.
 *
 * Two-pane layout: product search/scan on the left, cart + payment on the
 * right. Search input is permanently autofocused so a USB barcode scanner
 * (which emits keystrokes + Enter) goes straight into the cart.
 *
 *   - Enter on the search box triggers an exact-code lookup; if there's
 *     exactly one match it's added directly.
 *   - Variant products show a chooser modal before being added.
 *   - "Close shift" lives in the top bar; receipt printing fires after
 *     a successful sale via the PosReceipt component.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { CurrencySymbol } from '../utils/currency';
import PosReceipt from '../components/PosReceipt';

const CURRENCY = import.meta.env.VITE_CURRENCY_CODE || 'KWD';

export default function Pos() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState([]);            // {productId, variantIndex, name, price, quantity, stockAtLocation}
  const [variantPicker, setVariantPicker] = useState(null);  // product-search-result with hasVariants
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [showCustomer, setShowCustomer] = useState(false);
  const [payOpen, setPayOpen] = useState(null);    // 'cash' | 'card' | null
  const [tendered, setTendered] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [closeForm, setCloseForm] = useState(null);

  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.get('/cashier/me')
      .then((res) => setMe(res.data))
      .catch(() => navigate('/pos/login'))
      .finally(() => setLoading(false));
  }, [navigate]);

  // Keep the scanner-input focused — bounce focus back if the user clicks elsewhere
  // (unless a modal is open).
  useEffect(() => {
    if (variantPicker || payOpen || receipt || closeForm) return;
    const interval = setInterval(() => {
      if (document.activeElement !== searchRef.current && !document.activeElement?.matches?.('input, textarea, button')) {
        searchRef.current?.focus();
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [variantPicker, payOpen, receipt, closeForm]);

  const runSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get('/pos/products', { params: { q } });
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced typed search (250ms) — barcode scanner triggers immediate on Enter.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, runSearch]);

  if (loading) return <div style={{ minHeight: '100vh', background: '#0f172a', color: '#94a3b8', display: 'grid', placeItems: 'center' }}>Loading…</div>;
  if (!me) return null;

  const { user, session } = me;

  const addToCart = (item) => {
    if (item.hasVariants) {
      setVariantPicker(item);
      return;
    }
    if (item.stockAtLocation < 1) {
      toast.error('Out of stock at this location');
      return;
    }
    setCart((prev) => {
      const key = `${item.productId}:${item.variantIndex ?? 'b'}`;
      const idx = prev.findIndex((c) => `${c.productId}:${c.variantIndex ?? 'b'}` === key);
      if (idx >= 0) {
        const next = [...prev];
        const newQty = next[idx].quantity + 1;
        if (newQty > item.stockAtLocation) {
          toast.error(`Only ${item.stockAtLocation} in stock`);
          return prev;
        }
        next[idx] = { ...next[idx], quantity: newQty };
        return next;
      }
      return [...prev, {
        productId: item.productId,
        variantIndex: item.variantIndex,
        name: item.name,
        price: item.price,
        quantity: 1,
        stockAtLocation: item.stockAtLocation,
      }];
    });
    setQuery('');
    setResults([]);
    searchRef.current?.focus();
  };

  const pickVariant = (variantIndex) => {
    const v = variantPicker.variants[variantIndex];
    setVariantPicker(null);
    addToCart({
      productId: variantPicker.productId,
      variantIndex,
      name: `${variantPicker.name} (${Object.values(v.options || {}).join('/')})`,
      code: v.sku,
      price: parseFloat(v.price ?? variantPicker.price) || 0,
      stockAtLocation: v.stockAtLocation || 0,
      hasVariants: false,
    });
  };

  const setQty = (idx, qty) => {
    setCart((prev) => {
      const next = [...prev];
      const max = next[idx].stockAtLocation;
      const q = Math.max(1, Math.min(qty, max));
      next[idx] = { ...next[idx], quantity: q };
      return next;
    });
  };
  const removeLine = (idx) => setCart((prev) => prev.filter((_, i) => i !== idx));

  const subTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const total = +subTotal.toFixed(3);

  // ─── On Enter in search box ──────────────────────────────────────
  const onSearchKey = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (results.length === 1) addToCart(results[0]);
    else if (results.length === 0 && query.trim()) toast.error('No match');
  };

  const submitSale = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const body = {
        items: cart.map((c) => ({ productId: c.productId, variantIndex: c.variantIndex, quantity: c.quantity })),
        customer: (customer.name || customer.phone || customer.email) ? customer : undefined,
        payment: {
          method: payOpen,
          amountTendered: payOpen === 'cash' ? parseFloat(tendered) : total,
        },
      };
      const { data } = await api.post('/pos/sale', body);
      setReceipt(data);
      // Reset
      setCart([]);
      setCustomer({ name: '', phone: '', email: '' });
      setTendered('');
      setPayOpen(null);
      setShowCustomer(false);
      searchRef.current?.focus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sale failed');
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    await api.post('/cashier/logout').catch(() => {});
    navigate('/pos/login');
  };

  const submitClose = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/cashier/shift/close', closeForm);
      const v = data.variance;
      toast.success(`Shift closed · variance ${v >= 0 ? '+' : ''}${v}`);
      navigate('/pos/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const fmt = (n) => `${CURRENCY} ${(parseFloat(n) || 0).toFixed(3)}`;
  const cashChange = payOpen === 'cash' && tendered ? +(parseFloat(tendered) - total).toFixed(3) : 0;

  return (
    <div className="pos-app">
      {/* ─── Top bar ────────────────────────────── */}
      <header className="pos-topbar">
        <div>
          <strong>{session.Location?.name || `Location #${session.locationId}`}</strong>
          <span className="topbar-sep">·</span>
          <span style={{ color: '#94a3b8' }}>{user.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCloseForm({ closingCash: '', notes: '' })} className="topbar-btn topbar-btn-warn">
            Close shift
          </button>
          <button onClick={signOut} className="topbar-btn">Sign out</button>
        </div>
      </header>

      <div className="pos-grid">
        {/* ─── Left: search + results ────────────── */}
        <section className="pos-left">
          <div className="search-bar">
            <input
              ref={searchRef}
              type="text"
              autoFocus
              placeholder="Scan barcode or search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              className="search-input"
            />
            {searching && <span className="search-spinner">…</span>}
          </div>

          <div className="results-list">
            {results.length === 0 && query.trim() && !searching && (
              <div className="results-empty">No matches for "{query}"</div>
            )}
            {results.length === 0 && !query.trim() && (
              <div className="results-empty">Start scanning or type to search</div>
            )}
            {results.map((r, i) => (
              <button
                key={`${r.productId}-${r.variantIndex ?? 'b'}-${i}`}
                className="result-item"
                onClick={() => addToCart(r)}
                disabled={!r.hasVariants && r.stockAtLocation < 1}
              >
                <div className="result-main">
                  <div className="result-name">{r.name}</div>
                  <div className="result-meta">
                    {r.code && <span>SKU {r.code}</span>}
                    {r.hasVariants
                      ? <span className="badge">{r.variants.length} variants</span>
                      : <span className={r.stockAtLocation < 1 ? 'stock-out' : 'stock-ok'}>
                          {r.stockAtLocation} in stock
                        </span>}
                  </div>
                </div>
                <div className="result-price">{fmt(r.price)}</div>
              </button>
            ))}
          </div>
        </section>

        {/* ─── Right: cart + checkout ────────────── */}
        <aside className="pos-right">
          <div className="cart-header">
            <h2>Cart</h2>
            {cart.length > 0 && <button className="link-btn" onClick={() => setCart([])}>Clear</button>}
          </div>

          <div className="cart-list">
            {cart.length === 0 && <div className="cart-empty">No items yet</div>}
            {cart.map((c, i) => (
              <div key={i} className="cart-line">
                <div className="cart-line-info">
                  <div className="cart-line-name">{c.name}</div>
                  <div className="cart-line-price">{fmt(c.price)} ea</div>
                </div>
                <div className="cart-line-controls">
                  <button onClick={() => setQty(i, c.quantity - 1)}>−</button>
                  <span>{c.quantity}</span>
                  <button onClick={() => setQty(i, c.quantity + 1)}>+</button>
                  <button onClick={() => removeLine(i)} className="cart-remove">✕</button>
                </div>
                <div className="cart-line-total">{fmt(c.price * c.quantity)}</div>
              </div>
            ))}
          </div>

          <div className="cart-customer">
            <button className="link-btn" onClick={() => setShowCustomer((s) => !s)}>
              {showCustomer ? '− Walk-in (no details)' : '+ Add customer (optional)'}
            </button>
            {showCustomer && (
              <div className="customer-fields">
                <input placeholder="Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
                <input placeholder="Phone" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
                <input placeholder="Email" type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
              </div>
            )}
          </div>

          <div className="cart-totals">
            <div className="total-row">
              <span>Total</span>
              <strong>{fmt(total)}</strong>
            </div>
          </div>

          <div className="pay-buttons">
            <button
              disabled={cart.length === 0}
              onClick={() => { setPayOpen('cash'); setTendered(total.toFixed(3)); }}
              className="pay-btn pay-btn-cash">
              Cash
            </button>
            <button
              disabled={cart.length === 0}
              onClick={() => setPayOpen('card')}
              className="pay-btn pay-btn-card">
              Card
            </button>
          </div>
        </aside>
      </div>

      {/* ─── Variant picker ─────────────────── */}
      {variantPicker && (
        <div className="modal-backdrop" onClick={() => setVariantPicker(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{variantPicker.name}</h3>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 1rem' }}>Choose a variant</p>
            <div className="variant-list">
              {variantPicker.variants.map((v, i) => {
                const stock = v.stockAtLocation || 0;
                return (
                  <button
                    key={i}
                    className="variant-btn"
                    onClick={() => pickVariant(i)}
                    disabled={stock < 1}>
                    <span>{Object.values(v.options || {}).join(' / ')}</span>
                    <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span className={stock < 1 ? 'stock-out' : 'stock-ok'} style={{ fontSize: 12 }}>
                        {stock < 1 ? 'Out of stock' : `${stock} in stock`}
                      </span>
                      <span style={{ color: '#cbd5e1' }}>{fmt(v.price ?? variantPicker.price)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button className="link-btn" onClick={() => setVariantPicker(null)} style={{ marginTop: '0.75rem' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ─── Payment modal ──────────────────── */}
      {payOpen && (
        <div className="modal-backdrop" onClick={() => !submitting && setPayOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{payOpen === 'cash' ? 'Cash payment' : 'Card payment'}</h3>
            <div className="pay-total">{fmt(total)}</div>
            {payOpen === 'cash' && (
              <>
                <label className="modal-label">Amount tendered (<CurrencySymbol />)</label>
                <input
                  type="number" step="0.001" min={total}
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  className="modal-input"
                  autoFocus
                />
                <div className="pay-change">
                  Change: <strong>{fmt(Math.max(0, cashChange))}</strong>
                </div>
                <div className="quick-cash">
                  {[total, Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10].map((v, i) => (
                    <button key={i} onClick={() => setTendered(v.toFixed(3))}>{fmt(v)}</button>
                  ))}
                </div>
              </>
            )}
            {payOpen === 'card' && (
              <p style={{ color: '#94a3b8', fontSize: 14 }}>
                Charge the customer on the card terminal, then confirm below.
              </p>
            )}
            <div className="modal-actions">
              <button onClick={() => setPayOpen(null)} disabled={submitting} className="modal-btn modal-btn-secondary">Cancel</button>
              <button
                onClick={submitSale}
                disabled={submitting || (payOpen === 'cash' && cashChange < 0)}
                className="modal-btn modal-btn-primary">
                {submitting ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Close-shift modal ──────────────── */}
      {closeForm && (
        <div className="modal-backdrop" onClick={() => setCloseForm(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitClose}>
            <h3>Close shift</h3>
            <label className="modal-label">Closing cash count (<CurrencySymbol />)</label>
            <input
              type="number" step="0.001" min={0}
              value={closeForm.closingCash}
              onChange={(e) => setCloseForm({ ...closeForm, closingCash: e.target.value })}
              required autoFocus
              className="modal-input"
            />
            <label className="modal-label" style={{ marginTop: '0.75rem' }}>Notes (optional)</label>
            <textarea
              rows={2}
              value={closeForm.notes}
              onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
              className="modal-input"
              style={{ resize: 'vertical' }}
            />
            <div className="modal-actions">
              <button type="button" onClick={() => setCloseForm(null)} className="modal-btn modal-btn-secondary">Cancel</button>
              <button type="submit" className="modal-btn modal-btn-primary">Confirm close</button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Receipt overlay ──────────────────── */}
      {receipt && (
        <div className="modal-backdrop">
          <PosReceipt payload={receipt} currency={CURRENCY} onClose={() => setReceipt(null)} />
        </div>
      )}

      <style>{`
        .pos-app {
          min-height: 100vh; background: #0f172a; color: #f8fafc;
          display: flex; flex-direction: column;
          font-family: -apple-system, 'SF Pro Text', 'Segoe UI', Roboto, Arial, sans-serif;
        }
        .pos-topbar {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0.75rem 1.25rem; background: #1e293b; border-bottom: 1px solid #334155;
        }
        .topbar-sep { margin: 0 0.5rem; color: #475569; }
        .topbar-btn {
          background: transparent; border: 1px solid #334155; color: #cbd5e1;
          padding: 0.5rem 0.9rem; border-radius: 8px; font-family: inherit; cursor: pointer;
          font-size: 0.85rem;
        }
        .topbar-btn:hover { background: #334155; }
        .topbar-btn-warn { border-color: #c4784a; color: #fbbf24; }
        .topbar-btn-warn:hover { background: #c4784a; color: #fff; }

        .pos-grid {
          flex: 1; display: grid; grid-template-columns: 1fr 420px;
          gap: 0; min-height: 0;
        }
        @media (max-width: 900px) {
          .pos-grid { grid-template-columns: 1fr; }
        }

        .pos-left, .pos-right { padding: 1rem 1.25rem; display: flex; flex-direction: column; min-height: 0; }
        .pos-right { background: #1e293b; border-left: 1px solid #334155; }

        .search-bar { position: relative; margin-bottom: 1rem; }
        .search-input {
          width: 100%; padding: 1rem 1.25rem; background: #0f172a; border: 2px solid #c4784a;
          color: #f8fafc; border-radius: 12px; font-size: 1.2rem; font-family: inherit;
        }
        .search-input:focus { outline: none; border-color: #d4885a; box-shadow: 0 0 0 4px rgba(196,120,74,0.15); }
        .search-spinner { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; }

        .results-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; }
        .results-empty { padding: 2rem; text-align: center; color: #64748b; font-size: 0.9rem; }
        .result-item {
          display: flex; justify-content: space-between; align-items: center;
          background: #1e293b; border: 1px solid #334155; border-radius: 10px;
          padding: 0.85rem 1rem; cursor: pointer; text-align: left;
          font-family: inherit; color: #f8fafc;
        }
        .result-item:hover:not(:disabled) { background: #334155; border-color: #475569; }
        .result-item:disabled { opacity: 0.4; cursor: not-allowed; }
        .result-name { font-size: 0.95rem; font-weight: 500; }
        .result-meta { display: flex; gap: 0.75rem; font-size: 0.75rem; color: #94a3b8; margin-top: 0.2rem; }
        .stock-ok { color: #4ade80; }
        .stock-out { color: #f87171; }
        .badge { background: #c4784a; color: #fff; padding: 0 6px; border-radius: 4px; font-size: 0.7rem; }
        .result-price { font-weight: 600; font-size: 1rem; }

        .cart-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
        .cart-header h2 { font-size: 1.1rem; margin: 0; color: #cbd5e1; }
        .link-btn { background: transparent; border: none; color: #c4784a; cursor: pointer; font-size: 0.85rem; padding: 0; font-family: inherit; }
        .link-btn:hover { color: #d4885a; text-decoration: underline; }

        .cart-list { flex: 1; overflow-y: auto; min-height: 100px; }
        .cart-empty { padding: 2rem 0; text-align: center; color: #64748b; font-size: 0.85rem; }
        .cart-line {
          display: grid; grid-template-columns: 1fr auto auto; gap: 0.5rem;
          align-items: center; padding: 0.65rem 0; border-bottom: 1px solid #334155;
        }
        .cart-line-name { font-size: 0.85rem; }
        .cart-line-price { font-size: 0.7rem; color: #94a3b8; }
        .cart-line-controls { display: flex; align-items: center; gap: 0.3rem; }
        .cart-line-controls button {
          width: 26px; height: 26px; border: 1px solid #334155; background: #0f172a;
          color: #f8fafc; border-radius: 6px; cursor: pointer; font-family: inherit;
        }
        .cart-line-controls button:hover { background: #334155; }
        .cart-line-controls span { min-width: 24px; text-align: center; font-size: 0.85rem; }
        .cart-remove { color: #f87171 !important; }
        .cart-line-total { font-size: 0.85rem; font-weight: 600; min-width: 70px; text-align: right; }

        .cart-customer { margin: 0.75rem 0; }
        .customer-fields { display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.5rem; }
        .customer-fields input {
          background: #0f172a; border: 1px solid #334155; color: #f8fafc;
          padding: 0.5rem 0.75rem; border-radius: 6px; font-family: inherit; font-size: 0.85rem;
        }

        .cart-totals { padding: 0.75rem 0; border-top: 1px solid #334155; }
        .total-row { display: flex; justify-content: space-between; font-size: 1.3rem; }
        .total-row strong { color: #c4784a; }

        .pay-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.75rem; }
        .pay-btn {
          padding: 1rem; border: none; border-radius: 10px; font-size: 1rem; font-weight: 600;
          color: #fff; cursor: pointer; font-family: inherit;
        }
        .pay-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .pay-btn-cash { background: #16a34a; }
        .pay-btn-cash:hover:not(:disabled) { background: #15803d; }
        .pay-btn-card { background: #2563eb; }
        .pay-btn-card:hover:not(:disabled) { background: #1d4ed8; }

        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100;
          display: grid; place-items: center; padding: 1rem;
        }
        .modal {
          background: #1e293b; border: 1px solid #334155; border-radius: 14px;
          padding: 1.5rem; max-width: 480px; width: 100%;
        }
        .modal h3 { margin: 0 0 1rem; color: #f8fafc; }
        .pay-total { font-size: 2rem; font-weight: 700; color: #c4784a; text-align: center; margin: 0.5rem 0 1rem; }
        .modal-label { display: block; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 0.3rem; }
        .modal-input {
          width: 100%; padding: 0.75rem 1rem; background: #0f172a; border: 1px solid #334155;
          color: #f8fafc; border-radius: 8px; font-size: 1.1rem; font-family: inherit;
        }
        .pay-change { margin-top: 0.75rem; font-size: 1.1rem; text-align: center; color: #cbd5e1; }
        .pay-change strong { color: #4ade80; }
        .quick-cash { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4rem; margin-top: 0.75rem; }
        .quick-cash button {
          padding: 0.6rem 0.3rem; background: #0f172a; border: 1px solid #334155;
          color: #cbd5e1; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 0.85rem;
        }
        .quick-cash button:hover { background: #334155; }

        .modal-actions { display: flex; gap: 0.5rem; margin-top: 1.25rem; }
        .modal-btn {
          flex: 1; padding: 0.85rem; border-radius: 10px; font-size: 1rem; font-weight: 600;
          cursor: pointer; font-family: inherit; border: none;
        }
        .modal-btn-primary { background: #c4784a; color: #fff; }
        .modal-btn-primary:hover:not(:disabled) { background: #b56a3e; }
        .modal-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .modal-btn-secondary { background: transparent; border: 1px solid #334155; color: #cbd5e1; }
        .modal-btn-secondary:hover:not(:disabled) { background: #334155; }

        .variant-list { display: flex; flex-direction: column; gap: 0.4rem; }
        .variant-btn {
          display: flex; justify-content: space-between; padding: 0.85rem 1rem;
          background: #0f172a; border: 1px solid #334155; color: #f8fafc;
          border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 0.95rem;
        }
        .variant-btn:hover:not(:disabled) { background: #334155; border-color: #c4784a; }
        .variant-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
