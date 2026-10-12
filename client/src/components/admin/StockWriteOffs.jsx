/**
 * Stock write-offs (damaged / expired / lost …) and the stock movement log.
 *
 *   write-offs       list + new write-off form
 *   stock-movements  every stock quantity change, filterable
 */
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiPlus, HiTrash } from 'react-icons/hi';
import api from '../../api/axios';

const num = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const muted = { color: 'var(--text-light)' };
const dlbl = { display: 'block', fontSize: 12, marginBottom: 4 };
const filterBar = { display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1.25rem', padding: '1rem', background: 'var(--surface-alt, #f8f9fa)', borderRadius: 8 };
const errMsg = (err) => err.response?.data?.message || err.message;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const today = () => iso(new Date());
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const REASON_LABEL = {
  damaged: 'Damaged', expired: 'Expired', lost: 'Lost / missing', theft: 'Theft', sample: 'Sample / giveaway', other: 'Other',
};
const MOVE_LABEL = {
  sale: 'POS sale', sale_online: 'Online sale', void: 'Sale voided', return: 'Customer return', return_cancel: 'Return cancelled',
  receipt: 'Goods received', purchase_return: 'Returned to supplier', purchase_return_cancel: 'Supplier return cancelled',
  transfer_out: 'Transfer out', transfer_in: 'Transfer in', transfer_cancel: 'Transfer cancelled',
  count: 'Stock count', adjust: 'Manual adjustment', import: 'Import', write_off: 'Write-off', write_off_cancel: 'Write-off cancelled', other: 'Other',
};

export default function StockWriteOffs(props) {
  if (props.tab === 'stock-movements') return <MovementsTab {...props} />;
  return <WriteOffsTab {...props} />;
}

// ─── Write-offs ────────────────────────────────────────────────────
function WriteOffsTab({ currency, locations = [], isAdmin }) {
  const money = (n) => `${currency}${(parseFloat(n) || 0).toFixed(3)}`;
  const [filter, setFilter] = useState({ from: daysAgo(30), to: today(), locationId: '', reason: '' });
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = () => {
    const params = { ...filter };
    Object.keys(params).forEach((k) => !params[k] && delete params[k]);
    api.get('/stock-write-offs', { params }).then((r) => setRows(r.data)).catch((err) => toast.error(errMsg(err)));
  };
  useEffect(() => { load(); }, [filter]);   // eslint-disable-line react-hooks/exhaustive-deps

  const posted = (rows || []).filter((r) => r.status === 'posted');
  const byReason = posted.reduce((m, r) => { m[r.reason] = (m[r.reason] || 0) + parseFloat(r.totalValue); return m; }, {});

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Stock Write-offs</h2>
        <button className="btn btn-primary" onClick={() => setForm({ locationId: locations[0]?.id || '', reason: 'damaged', writeOffDate: today(), notes: '', items: [] })}><HiPlus /> Write off stock</button>
      </div>

      <div style={filterBar}>
        <div><label style={dlbl}>From</label><input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} /></div>
        <div><label style={dlbl}>To</label><input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} /></div>
        <div><label style={dlbl}>Location</label>
          <select value={filter.locationId} onChange={(e) => setFilter({ ...filter, locationId: e.target.value })}>
            <option value="">All</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select></div>
        <div><label style={dlbl}>Reason</label>
          <select value={filter.reason} onChange={(e) => setFilter({ ...filter, reason: e.target.value })}>
            <option value="">All</option>{Object.entries(REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
      </div>

      <div className="dash-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="dash-card"><div className="dash-card-label">Written off (cost)</div><div className="dash-card-value">{money(posted.reduce((s, r) => s + parseFloat(r.totalValue), 0))}</div>
          <div className="dash-card-change" style={muted}>{posted.reduce((s, r) => s + r.totalQty, 0)} units</div></div>
        {Object.entries(byReason).map(([k, v]) => (
          <div key={k} className="dash-card"><div className="dash-card-label">{REASON_LABEL[k]}</div><div className="dash-card-value">{money(v)}</div></div>
        ))}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Date</th><th>No.</th><th>Location</th><th>Reason</th><th style={num}>Units</th><th style={num}>Value (cost)</th><th>By</th><th>Status</th></tr></thead>
          <tbody>
            {!rows && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', ...muted }}>Loading…</td></tr>}
            {rows && rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', ...muted }}>No write-offs in this range</td></tr>}
            {rows?.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer', opacity: r.status === 'cancelled' ? 0.5 : 1 }} onClick={() => api.get(`/stock-write-offs/${r.id}`).then((x) => setDetail(x.data))}>
                <td style={{ whiteSpace: 'nowrap' }}>{r.writeOffDate}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.writeOffNumber}</td>
                <td>{r.Location?.name}</td>
                <td>{REASON_LABEL[r.reason]}{r.notes && <div style={{ fontSize: '0.72rem', ...muted }}>{r.notes}</div>}</td>
                <td style={num}>{r.totalQty}</td>
                <td style={{ ...num, fontWeight: 600 }}>{money(r.totalValue)}</td>
                <td>{r.creator?.name}{r.approver && <div style={{ fontSize: '0.72rem', ...muted }}>approved {r.approver.name}</div>}</td>
                <td>{r.status === 'cancelled' ? 'Cancelled' : 'Posted'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && <WriteOffForm form={form} setForm={setForm} locations={locations} currency={currency} onSaved={() => { setForm(null); load(); }} />}

      {detail && (
        <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="admin-form" style={{ maxWidth: 640 }}>
            <h3>Write-off {detail.writeOffNumber}</h3>
            <p style={{ ...muted, marginTop: 0 }}>{detail.writeOffDate} · {detail.Location?.name} · {REASON_LABEL[detail.reason]} · by {detail.creator?.name}{detail.approver ? ` (approved by ${detail.approver.name})` : ''}</p>
            {detail.notes && <p>{detail.notes}</p>}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Item</th><th style={num}>Qty</th><th style={num}>Unit cost</th><th style={num}>Value</th></tr></thead>
                <tbody>
                  {(detail.items || []).map((it, i) => (
                    <tr key={i}><td>{it.name}{it.sku && <div style={{ fontSize: '0.72rem', ...muted, fontFamily: 'monospace' }}>{it.sku}</div>}</td><td style={num}>{it.quantity}</td><td style={num}>{money(it.unitCost)}</td><td style={num}>{money(it.value)}</td></tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--border, #ddd)', fontWeight: 700 }}><td>Total</td><td style={num}>{detail.totalQty}</td><td></td><td style={num}>{money(detail.totalValue)}</td></tr>
                </tbody>
              </table>
            </div>
            {detail.journals?.length > 0 && <p style={{ fontSize: '0.8rem', ...muted }}>Journals: {detail.journals.map((j) => j.entryNumber).join(', ')}</p>}
            {detail.status === 'cancelled' && <p style={{ color: 'var(--danger)' }}>Cancelled {detail.cancelledAt ? new Date(detail.cancelledAt).toLocaleString() : ''} — stock was put back.</p>}
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              {isAdmin && detail.status === 'posted' && (
                <button className="btn btn-secondary" onClick={async () => {
                  if (!confirm('Cancel this write-off? The stock is put back and the accounting entry reversed.')) return;
                  try { await api.post(`/stock-write-offs/${detail.id}/cancel`); toast.success('Write-off cancelled'); setDetail(null); load(); } catch (err) { toast.error(errMsg(err)); }
                }}>Cancel write-off</button>
              )}
              <button className="btn btn-primary" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WriteOffForm({ form, setForm, locations, currency, onSaved }) {
  const money = (n) => `${currency}${(parseFloat(n) || 0).toFixed(3)}`;
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState(null);   // { userId, pin } when a manager PIN is asked for
  const [managers, setManagers] = useState([]);
  useEffect(() => {
    if (pin && !managers.length) api.get('/cashier/cashiers').then((r) => setManagers(r.data)).catch(() => {});
  }, [pin, managers.length]);

  useEffect(() => {
    if (!q.trim() || !form.locationId) { setResults([]); return; }
    const h = setTimeout(() => {
      api.get('/stock-counts/lookup', { params: { q: q.trim(), locationId: form.locationId } }).then((r) => setResults(r.data)).catch(() => {});
    }, 250);
    return () => clearTimeout(h);
  }, [q, form.locationId]);

  const add = (p, variantIndex = p.variantIndex) => {
    const v = variantIndex != null && p.variants ? p.variants[variantIndex] : null;
    const line = {
      productId: p.productId, variantIndex,
      name: v ? `${p.name} (${Object.values(v.options || {}).join('/')})` : p.name,
      sku: v?.sku || p.sku,
      unitCost: v ? parseFloat(v.costPrice ?? p.costPrice) || 0 : p.costPrice,
      stock: v ? v.stockAtLocation : p.stockAtLocation,
      quantity: 1,
    };
    const existing = form.items.findIndex((i) => i.productId === line.productId && i.variantIndex === line.variantIndex);
    if (existing >= 0) setForm({ ...form, items: form.items.map((it, j) => (j === existing ? { ...it, quantity: it.quantity + 1 } : it)) });
    else setForm({ ...form, items: [...form.items, line] });
    setQ('');
    setResults([]);
  };

  const total = form.items.reduce((s, i) => s + (parseFloat(i.unitCost) || 0) * (parseInt(i.quantity, 10) || 0), 0);

  const submit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await api.post('/stock-write-offs', {
        locationId: form.locationId, reason: form.reason, writeOffDate: form.writeOffDate, notes: form.notes,
        items: form.items.map((i) => ({ productId: i.productId, variantIndex: i.variantIndex, quantity: i.quantity })),
        managerOverride: pin?.userId && pin?.pin ? pin : undefined,
      });
      toast.success('Stock written off');
      onSaved();
    } catch (err) {
      if (err.response?.data?.requires === 'manager_override') {
        setPin((p) => p || { userId: '', pin: '' });
        toast.error(err.response.data.message);
      } else toast.error(errMsg(err));
    } finally { setSaving(false); }
  };

  return (
    <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
      <form className="admin-form" style={{ maxWidth: 760 }} onSubmit={submit}>
        <h3>Write off stock</h3>
        <div className="form-row">
          <div className="form-group"><label>Location *</label>
            <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value, items: [] })} required>
              <option value="">— pick —</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></div>
          <div className="form-group"><label>Reason *</label>
            <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
              {Object.entries(REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="form-group"><label>Date</label><input type="date" value={form.writeOffDate} max={today()} onChange={(e) => setForm({ ...form, writeOffDate: e.target.value })} /></div>
        </div>
        <div className="form-group" style={{ position: 'relative' }}>
          <label>Add item</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={form.locationId ? 'Scan barcode or type a name' : 'Pick a location first'} disabled={!form.locationId}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (results.length === 1 && !results[0].hasVariants) add(results[0]); } }} />
          {results.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, background: 'var(--surface, #fff)', border: '1px solid var(--border-light, #ddd)', borderRadius: 6, maxHeight: 260, overflowY: 'auto', boxShadow: '0 6px 18px rgba(0,0,0,0.12)' }}>
              {results.map((p, i) => (p.hasVariants ? (p.variants || []).map((v, vi) => (
                <button type="button" key={`${i}-${vi}`} onClick={() => add(p, vi)} style={pickBtn}>
                  {p.name} ({Object.values(v.options || {}).join('/')}) <span style={muted}>· {v.stockAtLocation} in stock</span>
                </button>
              )) : (
                <button type="button" key={i} onClick={() => add(p)} style={pickBtn}>
                  {p.name} <span style={muted}>· {p.stockAtLocation} in stock · {money(p.costPrice)}</span>
                </button>
              )))}
            </div>
          )}
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Item</th><th style={num}>In stock</th><th style={{ width: 100 }}>Qty</th><th style={num}>Unit cost</th><th style={num}>Value</th><th></th></tr></thead>
            <tbody>
              {form.items.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1rem', ...muted }}>No items yet</td></tr>}
              {form.items.map((it, i) => (
                <tr key={`${it.productId}-${it.variantIndex}`}>
                  <td>{it.name}{it.sku && <div style={{ fontSize: '0.72rem', ...muted, fontFamily: 'monospace' }}>{it.sku}</div>}</td>
                  <td style={{ ...num, color: it.quantity > it.stock ? 'var(--danger)' : undefined }}>{it.stock}</td>
                  <td><input type="number" min="1" value={it.quantity} onChange={(e) => setForm({ ...form, items: form.items.map((x, j) => (j === i ? { ...x, quantity: parseInt(e.target.value, 10) || 1 } : x)) })} /></td>
                  <td style={num}>{money(it.unitCost)}</td>
                  <td style={num}>{money(it.unitCost * it.quantity)}</td>
                  <td><button type="button" className="icon-btn" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}><HiTrash /></button></td>
                </tr>
              ))}
              {form.items.length > 0 && <tr style={{ fontWeight: 700 }}><td colSpan={4}>Total at cost</td><td style={num}>{money(total)}</td><td></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="form-group" style={{ marginTop: '0.75rem' }}><label>Notes{form.reason === 'other' ? ' *' : ''}</label>
          <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What happened?" /></div>
        {pin && (
          <div className="form-row" style={{ padding: '0.75rem', background: 'rgba(196,120,74,0.1)', borderRadius: 8, marginBottom: '0.75rem' }}>
            <div className="form-group"><label>Manager</label>
              <select value={pin.userId} onChange={(e) => setPin({ ...pin, userId: e.target.value })}>
                <option value="">— pick —</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select></div>
            <div className="form-group"><label>Manager PIN</label><input type="password" inputMode="numeric" value={pin.pin} onChange={(e) => setPin({ ...pin, pin: e.target.value })} /></div>
          </div>
        )}
        <p style={{ ...muted, fontSize: '0.78rem' }}>Stock is taken off at this location now and the cost is charged to Stock Write-offs in the accounts.</p>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving || !form.items.length}>{saving ? 'Saving…' : 'Write off'}</button>
          <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

const pickBtn = { display: 'block', width: '100%', textAlign: 'left', padding: '0.45rem 0.6rem', background: 'none', border: 0, borderBottom: '1px solid var(--border-light, #eee)', cursor: 'pointer', color: 'inherit' };

// ─── Movement log ──────────────────────────────────────────────────
function MovementsTab({ currency, locations = [] }) {
  const money = (n) => { const v = parseFloat(n) || 0; return `${v < 0 ? '−' : ''}${currency}${Math.abs(v).toFixed(3)}`; };
  const [filter, setFilter] = useState({ from: daysAgo(7), to: today(), locationId: '', type: '', page: 1 });
  const [data, setData] = useState(null);
  useEffect(() => {
    const params = { ...filter, limit: 100 };
    Object.keys(params).forEach((k) => params[k] === '' && delete params[k]);
    api.get('/stock-write-offs/movements/list', { params }).then((r) => setData(r.data)).catch((err) => toast.error(errMsg(err)));
  }, [filter]);

  return (
    <div className="admin-section">
      <div className="admin-section-header"><h2>Stock Movements</h2></div>
      <div style={filterBar}>
        <div><label style={dlbl}>From</label><input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value, page: 1 })} /></div>
        <div><label style={dlbl}>To</label><input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value, page: 1 })} /></div>
        <div><label style={dlbl}>Location</label>
          <select value={filter.locationId} onChange={(e) => setFilter({ ...filter, locationId: e.target.value, page: 1 })}>
            <option value="">All</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select></div>
        <div><label style={dlbl}>Type</label>
          <select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value, page: 1 })}>
            <option value="">All</option>{Object.entries(MOVE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>When</th><th>Item</th><th>Location</th><th>Type</th><th style={num}>Change</th><th style={num}>After</th><th style={num}>Value</th><th>By</th></tr></thead>
          <tbody>
            {!data && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', ...muted }}>Loading…</td></tr>}
            {data && data.movements.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', ...muted }}>No stock movements in this range</td></tr>}
            {data?.movements.map((m) => (
              <tr key={m.id}>
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{new Date(m.createdAt).toLocaleString()}</td>
                <td>{m.productName}{m.sku && <div style={{ fontSize: '0.72rem', ...muted, fontFamily: 'monospace' }}>{m.sku}</div>}</td>
                <td>{m.Location?.name}</td>
                <td>{MOVE_LABEL[m.type] || m.type}{(m.reference || m.note) && <div style={{ fontSize: '0.72rem', ...muted }}>{[m.reference, m.note].filter(Boolean).join(' · ')}</div>}</td>
                <td style={{ ...num, fontWeight: 600, color: m.quantityChange < 0 ? 'var(--danger)' : 'var(--success)' }}>{m.quantityChange > 0 ? '+' : ''}{m.quantityChange}</td>
                <td style={num}>{m.quantityAfter ?? ''}</td>
                <td style={num}>{money(m.value)}</td>
                <td>{m.User?.name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.pages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '1rem' }}>
          <button className="btn btn-secondary" disabled={filter.page <= 1} onClick={() => setFilter({ ...filter, page: filter.page - 1 })}>‹ Prev</button>
          <span style={muted}>Page {data.page} of {data.pages} · {data.total} movements</span>
          <button className="btn btn-secondary" disabled={filter.page >= data.pages} onClick={() => setFilter({ ...filter, page: filter.page + 1 })}>Next ›</button>
        </div>
      )}
      <p style={{ ...muted, fontSize: '0.8rem', marginTop: '0.75rem' }}>Only stock changes made after this log was switched on are listed.</p>
    </div>
  );
}
