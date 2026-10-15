/**
 * Fixed assets — register, monthly straight-line depreciation, disposal.
 * Self-contained: loads its own data, Admin.jsx just renders it.
 */
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiPlus, HiPencil, HiTrash } from 'react-icons/hi';
import api from '../../api/axios';

const num = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const muted = { color: 'var(--text-light)' };
const errMsg = (err) => err.response?.data?.message || err.message;
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const lastMonth = () => { const d = new Date(); d.setDate(0); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export default function FixedAssets({ currency, locations = [] }) {
  const money = (n) => { const v = parseFloat(n) || 0; return `${v < 0 ? '−' : ''}${currency}${Math.abs(v).toFixed(3)}`; };
  const [assets, setAssets] = useState(null);
  const [runs, setRuns] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [status, setStatus] = useState('active');
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [dispose, setDispose] = useState(null);
  const [run, setRun] = useState(null);

  const load = () => {
    api.get('/fixed-assets', { params: status ? { status } : {} }).then((r) => setAssets(r.data)).catch((err) => toast.error(errMsg(err)));
    api.get('/fixed-assets/depreciation').then((r) => setRuns(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, [status]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    api.get('/fixed-assets/accounts').then((r) => setAccounts(r.data)).catch(() => {});
    api.get('/finance/cash-accounts?active=true').then((r) => setCashAccounts(r.data)).catch(() => {});
  }, []);

  const totals = (assets || []).reduce((t, a) => ({ cost: t.cost + parseFloat(a.cost), acc: t.acc + a.accumulated, book: t.book + a.bookValue, monthly: t.monthly + (a.status === 'active' && a.remaining > 0 ? a.monthly : 0) }), { cost: 0, acc: 0, book: 0, monthly: 0 });
  const openDetail = (id) => api.get(`/fixed-assets/${id}`).then((r) => setDetail(r.data)).catch((err) => toast.error(errMsg(err)));

  const previewRun = async (upto) => {
    try {
      const { data } = await api.post('/fixed-assets/depreciation?preview=true', { upto });
      setRun({ upto, preview: data.periods });
    } catch (err) { toast.error(errMsg(err)); }
  };

  const saveAsset = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form };
      if (form.id) await api.put(`/fixed-assets/${form.id}`, body);
      else await api.post('/fixed-assets', body);
      toast.success(form.id ? 'Saved' : 'Asset registered');
      setForm(null);
      load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Fixed Assets</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => previewRun(lastMonth())}>Run depreciation</button>
          <button className="btn btn-primary" onClick={() => setForm({
            name: '', description: '', serialNumber: '', supplier: '', locationId: '',
            assetAccountId: accounts[0]?.id || '', acquisitionDate: today(), cost: '', salvageValue: 0,
            usefulLifeMonths: 60, depreciationStartDate: '', acquisitionMethod: 'cash', cashAccountId: '', openingAccumulatedDep: '',
          })}><HiPlus /> Add asset</button>
        </div>
      </div>

      <div className="dash-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="dash-card"><div className="dash-card-label">Cost</div><div className="dash-card-value">{money(totals.cost)}</div></div>
        <div className="dash-card"><div className="dash-card-label">Accumulated depreciation</div><div className="dash-card-value">{money(totals.acc)}</div></div>
        <div className="dash-card"><div className="dash-card-label">Book value</div><div className="dash-card-value">{money(totals.book)}</div></div>
        <div className="dash-card"><div className="dash-card-label">Monthly charge</div><div className="dash-card-value">{money(totals.monthly)}</div>
          <div className="dash-card-change" style={muted}>Last run: {runs[0]?.period || 'never'}</div></div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {[['active', 'In use'], ['disposed', 'Disposed'], ['', 'All']].map(([k, label]) => (
          <button key={k} className={`btn ${status === k ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setStatus(k)}>{label}</button>
        ))}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Asset</th><th>Account</th><th>Acquired</th><th style={num}>Cost</th><th style={num}>Life</th><th style={num}>Accumulated</th><th style={num}>Book value</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {!assets && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', ...muted }}>Loading…</td></tr>}
            {assets && assets.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', ...muted }}>No assets — add furniture, equipment, computers or vehicles the business owns</td></tr>}
            {assets?.map((a) => (
              <tr key={a.id} style={{ opacity: a.status === 'disposed' ? 0.6 : 1 }}>
                <td><button type="button" onClick={() => openDetail(a.id)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', fontWeight: 500, textAlign: 'left' }}>{a.name}</button>
                  <div style={{ fontSize: '0.72rem', ...muted }}>{a.assetNumber}{a.Location ? ` · ${a.Location.name}` : ''}</div></td>
                <td style={{ fontSize: '0.85rem' }}>{a.assetAccount?.name}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{a.acquisitionDate}</td>
                <td style={num}>{money(a.cost)}</td>
                <td style={num}>{a.usefulLifeMonths} mo</td>
                <td style={num}>{money(a.accumulated)}</td>
                <td style={{ ...num, fontWeight: 600 }}>{money(a.bookValue)}</td>
                <td>{a.status === 'disposed' ? `Disposed ${a.disposalDate}` : a.remaining <= 0 ? 'Fully depreciated' : 'In use'}</td>
                <td><div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                  {a.status === 'active' && (
                    <>
                      <button className="icon-btn" title="Edit" onClick={() => setForm({ ...a, locationId: a.locationId || '', serialNumber: a.serialNumber || '', supplier: a.supplier || '', description: a.description || '' })}><HiPencil /></button>
                      <button className="btn btn-secondary" style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }} onClick={() => setDispose({ id: a.id, name: a.name, bookValue: a.bookValue, disposalDate: today(), proceeds: '', cashAccountId: '', notes: '' })}>Dispose</button>
                      {!a.lastDepreciatedPeriod && (
                        <button className="icon-btn" title="Delete (entered by mistake)" onClick={async () => {
                          if (!confirm(`Delete ${a.name}? Its purchase entry is reversed.`)) return;
                          try { await api.delete(`/fixed-assets/${a.id}`); toast.success('Deleted'); load(); } catch (err) { toast.error(errMsg(err)); }
                        }}><HiTrash /></button>
                      )}
                    </>
                  )}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {runs.length > 0 && (
        <div style={{ marginTop: '1.5rem', maxWidth: 560 }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Depreciation posted</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Month</th><th style={num}>Assets</th><th style={num}>Amount</th><th>Journal</th></tr></thead>
              <tbody>
                {runs.map((r) => <tr key={r.period}><td>{r.period}</td><td style={num}>{r.assets}</td><td style={num}>{money(r.total)}</td><td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.entryNumber || '—'}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {form && (
        <div className="admin-form-overlay">
          <form className="admin-form" style={{ maxWidth: 620 }} onSubmit={saveAsset}>
            <h3>{form.id ? `Edit ${form.name}` : 'Add fixed asset'}</h3>
            <div className="form-row">
              <div className="form-group"><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Display shelves" /></div>
              <div className="form-group"><label>Location</label>
                <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                  <option value="">— None —</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Serial no.</label><input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></div>
              <div className="form-group"><label>Supplier</label><input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
            </div>
            {!form.id && (
              <>
                <div className="form-row">
                  <div className="form-group"><label>Category (account) *</label>
                    <select value={form.assetAccountId} onChange={(e) => setForm({ ...form, assetAccountId: e.target.value })} required>
                      <option value="">— pick —</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Acquired on *</label><input type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} required /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Cost ({currency}) *</label><input type="number" step="0.001" min="0.001" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} required /></div>
                  <div className="form-group"><label>How was it paid?</label>
                    <select value={form.acquisitionMethod} onChange={(e) => setForm({ ...form, acquisitionMethod: e.target.value })}>
                      <option value="cash">Paid now from a cash/bank account</option>
                      <option value="payable">Bought on credit (to pay later)</option>
                      <option value="opening">Already owned before accounting started</option>
                    </select>
                  </div>
                </div>
                {form.acquisitionMethod === 'cash' && (
                  <div className="form-group"><label>Paid from *</label>
                    <select value={form.cashAccountId} onChange={(e) => setForm({ ...form, cashAccountId: e.target.value })} required>
                      <option value="">— account —</option>
                      {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
                {form.acquisitionMethod === 'opening' && (
                  <div className="form-group"><label>Depreciation already taken ({currency})</label>
                    <input type="number" step="0.001" min="0" value={form.openingAccumulatedDep} onChange={(e) => setForm({ ...form, openingAccumulatedDep: e.target.value })} placeholder="0" />
                  </div>
                )}
              </>
            )}
            <div className="form-row">
              <div className="form-group"><label>Useful life (months) *</label><input type="number" min="1" value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: e.target.value })} required /></div>
              <div className="form-group"><label>Salvage value ({currency})</label><input type="number" step="0.001" min="0" value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: e.target.value })} /></div>
            </div>
            <div className="form-group"><label>Depreciate from</label><input type="date" value={form.depreciationStartDate || ''} onChange={(e) => setForm({ ...form, depreciationStartDate: e.target.value })} />
              <div style={{ fontSize: '0.75rem', ...muted }}>Defaults to the 1st of the month after purchase.</div></div>
            {form.cost > 0 && form.usefulLifeMonths > 0 && (
              <p style={{ fontSize: '0.85rem' }}>Monthly depreciation: <strong>{money((parseFloat(form.cost) - (parseFloat(form.salvageValue) || 0)) / parseInt(form.usefulLifeMonths, 10))}</strong></p>
            )}
            <div className="form-group"><label>Notes</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">{form.id ? 'Save' : 'Register asset'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {run && (
        <div className="admin-form-overlay">
          <div className="admin-form" style={{ maxWidth: 560 }}>
            <h3>Run depreciation</h3>
            <div className="form-group"><label>Up to and including</label>
              <input type="month" value={run.upto} max={lastMonth()} onChange={(e) => e.target.value && previewRun(e.target.value)} />
            </div>
            {run.preview.length === 0 ? <p style={muted}>Nothing to post — every month up to {run.upto} is already depreciated.</p> : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Month</th><th>Assets</th><th style={num}>Amount</th></tr></thead>
                  <tbody>
                    {run.preview.map((p) => (
                      <tr key={p.period}><td>{p.period}</td><td style={{ fontSize: '0.8rem' }}>{p.assets.map((a) => a.name).join(', ')}</td><td style={num}>{money(p.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" disabled={!run.preview.length} onClick={async () => {
                try { await api.post('/fixed-assets/depreciation', { upto: run.upto }); toast.success('Depreciation posted'); setRun(null); load(); } catch (err) { toast.error(errMsg(err)); }
              }}>Post {run.preview.length} month{run.preview.length === 1 ? '' : 's'}</button>
              <button className="btn btn-secondary" onClick={() => setRun(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {dispose && (
        <div className="admin-form-overlay">
          <form className="admin-form" style={{ maxWidth: 480 }} onSubmit={async (e) => {
            e.preventDefault();
            try {
              const { data } = await api.post(`/fixed-assets/${dispose.id}/dispose`, dispose);
              toast.success(data.gain > 0 ? `Disposed — gain ${money(data.gain)}` : data.gain < 0 ? `Disposed — loss ${money(-data.gain)}` : 'Disposed');
              setDispose(null);
              load();
            } catch (err) { toast.error(errMsg(err)); }
          }}>
            <h3>Dispose of {dispose.name}</h3>
            <p style={muted}>Current book value {money(dispose.bookValue)}. Run depreciation up to the disposal month first so the book value is up to date.</p>
            <div className="form-row">
              <div className="form-group"><label>Date *</label><input type="date" value={dispose.disposalDate} onChange={(e) => setDispose({ ...dispose, disposalDate: e.target.value })} required /></div>
              <div className="form-group"><label>Sold for ({currency})</label><input type="number" step="0.001" min="0" value={dispose.proceeds} onChange={(e) => setDispose({ ...dispose, proceeds: e.target.value })} placeholder="0 if scrapped" /></div>
            </div>
            {parseFloat(dispose.proceeds) > 0 && (
              <div className="form-group"><label>Money received into *</label>
                <select value={dispose.cashAccountId} onChange={(e) => setDispose({ ...dispose, cashAccountId: e.target.value })} required>
                  <option value="">— account —</option>
                  {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group"><label>Notes</label><input value={dispose.notes} onChange={(e) => setDispose({ ...dispose, notes: e.target.value })} /></div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Dispose</button>
              <button type="button" className="btn btn-secondary" onClick={() => setDispose(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <div className="admin-form-overlay">
          <div className="admin-form" style={{ maxWidth: 680 }}>
            <h3>{detail.name} <span style={{ fontSize: '0.8rem', ...muted }}>{detail.assetNumber}</span></h3>
            <div className="dash-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
              <div className="dash-card"><div className="dash-card-label">Cost</div><div className="dash-card-value" style={{ fontSize: '1.05rem' }}>{money(detail.cost)}</div></div>
              <div className="dash-card"><div className="dash-card-label">Accumulated</div><div className="dash-card-value" style={{ fontSize: '1.05rem' }}>{money(detail.accumulated)}</div></div>
              <div className="dash-card"><div className="dash-card-label">Book value</div><div className="dash-card-value" style={{ fontSize: '1.05rem' }}>{money(detail.bookValue)}</div></div>
            </div>
            <p style={{ fontSize: '0.85rem' }}>
              {detail.assetAccount?.name} · acquired {detail.acquisitionDate} · {detail.usefulLifeMonths} months · {money(detail.monthly)}/month from {detail.depreciationStartDate}
              {detail.serialNumber ? ` · S/N ${detail.serialNumber}` : ''}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.4rem' }}>Posted</h4>
                <div className="admin-table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
                  <table className="admin-table"><tbody>
                    {(detail.depreciations || []).length === 0 && <tr><td style={muted}>None yet</td></tr>}
                    {(detail.depreciations || []).map((d) => <tr key={d.id}><td>{d.period}</td><td style={num}>{money(d.amount)}</td></tr>)}
                  </tbody></table>
                </div>
              </div>
              <div>
                <h4 style={{ margin: '0 0 0.4rem' }}>Still to come</h4>
                <div className="admin-table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
                  <table className="admin-table"><tbody>
                    {detail.schedule.length === 0 && <tr><td style={muted}>Nothing left</td></tr>}
                    {detail.schedule.map((s) => <tr key={s.period}><td>{s.period}</td><td style={num}>{money(s.amount)}</td><td style={{ ...num, ...muted }}>{money(s.bookValue)}</td></tr>)}
                  </tbody></table>
                </div>
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
