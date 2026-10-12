/**
 * Accounting tabs — double-entry ledger, reports and customer accounts.
 *
 *   acct-setup         start / sync / lock date
 *   coa                chart of accounts
 *   journals           journal list + manual journal entry
 *   general-ledger     one account's lines with running balance
 *   trial-balance
 *   gl-pnl             profit & loss from the ledger
 *   gl-balance-sheet   balance sheet from the ledger
 *   customer-accounts  on-account customers, receipts, statements
 *   vat-report
 *
 * Each tab loads its own data (unlike FinanceTabs, whose state lives in
 * Admin.jsx) so Admin.jsx only needs to render <AccountingTabs tab=… />.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { HiPlus, HiPencil, HiTrash, HiRefresh, HiChevronDown, HiChevronRight } from 'react-icons/hi';
import api from '../../api/axios';

export default function AccountingTabs(props) {
  const { tab } = props;
  if (tab === 'acct-setup') return <SetupTab {...props} />;
  if (tab === 'coa') return <ChartTab {...props} />;
  if (tab === 'journals') return <JournalsTab {...props} />;
  if (tab === 'general-ledger') return <LedgerTab key={props.tabParams?.accountId || 'gl'} {...props} />;
  if (tab === 'trial-balance') return <TrialBalanceTab {...props} />;
  if (tab === 'gl-pnl') return <PnlTab {...props} />;
  if (tab === 'gl-balance-sheet') return <BalanceSheetTab {...props} />;
  if (tab === 'customer-accounts') return <CustomerAccountsTab {...props} />;
  if (tab === 'vat-report') return <VatTab {...props} />;
  return null;
}

// ─── helpers ───────────────────────────────────────────────────────
const dlbl = { display: 'block', fontSize: 12, marginBottom: 4 };
const filterBar = { display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1.25rem', padding: '1rem', background: 'var(--surface-alt, #f8f9fa)', borderRadius: 8 };
const num = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const muted = { color: 'var(--text-light)' };
const emptyRow = (cols, text) => (
  <tr><td colSpan={cols} style={{ textAlign: 'center', padding: '2rem', ...muted }}>{text}</td></tr>
);
const errMsg = (err) => err.response?.data?.message || err.message;

const iso = (d) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const today = () => iso(new Date());
const monthStart = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); };

function rangeFor(kind) {
  const t = new Date();
  if (kind === 'mtd') return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) };
  if (kind === 'last') return { from: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: iso(new Date(t.getFullYear(), t.getMonth(), 0)) };
  if (kind === 'qtd') return { from: iso(new Date(t.getFullYear(), Math.floor(t.getMonth() / 3) * 3, 1)), to: iso(t) };
  if (kind === 'ytd') return { from: iso(new Date(t.getFullYear(), 0, 1)), to: iso(t) };
  return null;
}

function RangeButtons({ onPick }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[['mtd', 'This month'], ['last', 'Last month'], ['qtd', 'Quarter'], ['ytd', 'Year']].map(([k, label]) => (
        <button key={k} type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem' }} onClick={() => onPick(rangeFor(k))}>{label}</button>
      ))}
    </div>
  );
}

const useMoney = (currency) => (n) => {
  const v = parseFloat(n) || 0;
  return `${v < 0 ? '−' : ''}${currency}${Math.abs(v).toFixed(3)}`;
};
const amt = (n) => (parseFloat(n) ? parseFloat(n).toFixed(3) : '');

// Shared: has accounting been started? Ledger tabs show a hint if not.
function useStatus() {
  const [status, setStatus] = useState(null);
  const load = () => api.get('/accounting/status').then((r) => setStatus(r.data)).catch(() => setStatus(null));
  useEffect(() => { load(); }, []);
  return [status, load];
}

function NotStarted({ setTab }) {
  return (
    <div style={{ padding: '1rem 1.25rem', background: 'rgba(196,120,74,0.1)', borderRadius: 8, marginBottom: '1rem', fontSize: '0.9rem' }}>
      Accounting hasn't been started yet, so the ledger is empty.{' '}
      <button type="button" className="link-btn" style={{ fontWeight: 600, textDecoration: 'underline', background: 'none', border: 0, cursor: 'pointer', color: 'inherit', padding: 0 }} onClick={() => setTab?.('acct-setup')}>
        Go to Accounting setup
      </button>
    </div>
  );
}

const KIND_LABEL = {
  auto: 'Auto', manual: 'Manual', opening: 'Opening', depreciation: 'Depreciation',
  asset: 'Fixed asset', write_off: 'Write-off', receipt: 'Receipt', reversal: 'Reversal',
};
const SOURCE_LABEL = {
  Order: 'Sale', SalesReturn: 'Return', PurchaseReceipt: 'Goods received', PurchaseOrder: 'PO settlement',
  SupplierPayment: 'Supplier payment', PurchaseReturn: 'Purchase return', Expense: 'Expense',
  CashTransfer: 'Cash transfer', StockCount: 'Stock count', StockMovement: 'Stock adjustment',
  CashTransaction: 'Cash entry', StockWriteOff: 'Write-off', FixedAsset: 'Fixed asset',
  FixedAssetDisposal: 'Asset disposal', Depreciation: 'Depreciation', CustomerPayment: 'Customer payment',
  Manual: 'Manual', Opening: 'Opening',
};
const TYPE_LABEL = { asset: 'Asset', liability: 'Liability', equity: 'Equity', income: 'Income', expense: 'Expense' };

// ─── Setup ─────────────────────────────────────────────────────────
function SetupTab({ isAdmin }) {
  const [status, reload] = useStatus();
  const [busy, setBusy] = useState(false);
  const [lockDate, setLockDate] = useState('');
  const [resetText, setResetText] = useState('');
  useEffect(() => { setLockDate(status?.lockDate || ''); }, [status?.lockDate]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try { const r = await fn(); if (okMsg) toast.success(typeof okMsg === 'function' ? okMsg(r.data) : okMsg); reload(); }
    catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  if (!status) return <div className="admin-section"><h2>Accounting setup</h2><p style={muted}>Loading…</p></div>;
  const last = status.lastSync;

  return (
    <div className="admin-section">
      <div className="admin-section-header"><h2>Accounting setup</h2></div>

      {!status.started ? (
        <div style={{ maxWidth: 720 }}>
          <p>
            Starting accounting creates the chart of accounts and one <strong>opening entry</strong> from today's figures:
            cash/bank/KNET balances, stock at cost, what you owe suppliers, customer balances and fixed assets.
            The difference goes to <em>Opening Balance Equity</em>.
          </p>
          <p>
            From then on every POS sale, return, purchase receipt, supplier payment, expense, cash transfer and stock
            adjustment is posted to the ledger automatically (every 2 minutes, and whenever a report is opened).
          </p>
          <p style={muted}>Best done at a quiet moment — before opening or after closing — so no sale is in progress.</p>
          {isAdmin
            ? <button className="btn btn-primary" disabled={busy} onClick={() => run(() => api.post('/accounting/start'), 'Accounting started — opening entry posted')}>{busy ? 'Starting…' : 'Start accounting'}</button>
            : <p style={muted}>Only an admin can start accounting.</p>}
        </div>
      ) : (
        <>
          <div className="dash-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div className="dash-card"><div className="dash-card-label">Started</div><div className="dash-card-value" style={{ fontSize: '1.1rem' }}>{status.startDate}</div></div>
            <div className="dash-card"><div className="dash-card-label">Journals</div><div className="dash-card-value">{status.journalCount}</div></div>
            <div className="dash-card"><div className="dash-card-label">Last sync</div><div className="dash-card-value" style={{ fontSize: '1rem' }}>{last?.finishedAt ? new Date(last.finishedAt).toLocaleString() : '—'}</div>
              {last && <div className="dash-card-change" style={muted}>{last.posted} posted · {last.checked} checked</div>}</div>
            <div className="dash-card"><div className="dash-card-label">Suspense</div>
              <div className="dash-card-value" style={{ color: status.suspense ? 'var(--danger)' : 'var(--success)' }}>{status.suspense.toFixed(3)}</div>
              <div className="dash-card-change" style={muted}>{status.suspense ? 'Documents that did not balance — review the Suspense ledger' : 'Nothing to review'}</div></div>
          </div>

          {last?.errors?.length > 0 && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(192,57,43,0.08)', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem' }}>
              <strong>Last sync could not post:</strong>
              <ul style={{ margin: '0.4rem 0 0 1.2rem' }}>{last.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => api.post('/accounting/sync'), (d) => `Synced — ${d.posted || 0} posted`)}><HiRefresh /> Sync now</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => api.post('/accounting/sync?full=true'), (d) => `Full re-check — ${d.posted || 0} posted, ${d.checked || 0} checked`)}>Re-check everything</button>
          </div>

          <div style={{ maxWidth: 560, padding: '1rem', border: '1px solid var(--border-light, #eee)', borderRadius: 8, marginBottom: '1.5rem' }}>
            <h3 style={{ marginTop: 0 }}>Period lock</h3>
            <p style={{ ...muted, fontSize: '0.85rem' }}>Nothing can be posted on or before the lock date — use it once a month's figures are final. Automatic postings for late documents land on the first open day.</p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div><label style={dlbl}>Locked up to</label><input type="date" value={lockDate} max={today()} onChange={(e) => setLockDate(e.target.value)} disabled={!isAdmin} /></div>
              {isAdmin && <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => api.put('/accounting/lock-date', { lockDate: lockDate || null }), 'Lock date saved')}>Save</button>}
            </div>
          </div>

          {isAdmin && (
            <div style={{ maxWidth: 560, padding: '1rem', border: '1px solid rgba(192,57,43,0.35)', borderRadius: 8 }}>
              <h3 style={{ marginTop: 0, color: 'var(--danger)' }}>Reset accounting</h3>
              <p style={{ ...muted, fontSize: '0.85rem' }}>Deletes every journal so accounting can be started again. Sales, stock, cash accounts and other records are not touched. Type RESET to confirm.</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="RESET" style={{ maxWidth: 140 }} />
                <button className="btn btn-danger" style={{ background: 'var(--danger)', color: '#fff' }} disabled={busy || resetText !== 'RESET'}
                  onClick={() => run(() => api.post('/accounting/reset', { confirm: 'RESET' }), 'Accounting reset').then(() => setResetText(''))}>Reset</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Chart of accounts ─────────────────────────────────────────────
function ChartTab({ currency, setTab }) {
  const money = useMoney(currency);
  const [status] = useStatus();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const load = () => api.get('/accounting/accounts').then((r) => setRows(r.data)).catch((err) => toast.error(errMsg(err)));
  useEffect(() => { load(); }, []);

  // Depth-first order so children sit under their heading.
  const ordered = useMemo(() => {
    if (!rows) return [];
    const kids = new Map();
    for (const r of rows) {
      const k = r.parentId || 0;
      if (!kids.has(k)) kids.set(k, []);
      kids.get(k).push(r);
    }
    const out = [];
    const walk = (pid, depth) => {
      for (const r of (kids.get(pid) || []).sort((a, b) => a.code.localeCompare(b.code))) {
        out.push({ ...r, depth });
        walk(r.id, depth + 1);
      }
    };
    walk(0, 0);
    return out;
  }, [rows]);
  const headings = (rows || []).filter((r) => r.isGroup);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { code: form.code, name: form.name, nameAr: form.nameAr, description: form.description, active: form.active, parentId: form.parentId ? parseInt(form.parentId, 10) : null };
      if (form.id) await api.put(`/accounting/accounts/${form.id}`, body);
      else await api.post('/accounting/accounts', { ...body, type: form.type, isGroup: form.isGroup });
      toast.success('Saved');
      setForm(null);
      load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Chart of Accounts</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
          <button className="btn btn-primary" onClick={() => setForm({ code: '', name: '', nameAr: '', description: '', parentId: '', type: 'expense', isGroup: false, active: true })}><HiPlus /> Add account</button>
        </div>
      </div>
      {status && !status.started && <NotStarted setTab={setTab} />}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th style={{ width: 90 }}>Code</th><th>Account</th><th>Type</th><th style={num}>Balance</th><th></th></tr></thead>
          <tbody>
            {!rows && emptyRow(5, 'Loading…')}
            {rows && ordered.length === 0 && emptyRow(5, 'No accounts')}
            {ordered.filter((r) => showInactive || r.active).map((r) => (
              <tr key={r.id} style={{ opacity: r.active ? 1 : 0.5, background: r.isGroup ? 'var(--surface-alt, #f8f9fa)' : undefined }}>
                <td style={{ fontFamily: 'monospace', fontWeight: r.isGroup ? 700 : 400 }}>{r.code}</td>
                <td style={{ paddingLeft: `${0.75 + r.depth * 1.25}rem`, fontWeight: r.isGroup ? 700 : 400 }}>
                  {r.isGroup ? r.name : (
                    <button type="button" onClick={() => setTab?.('general-ledger', { accountId: r.id })} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }} title="Open ledger">{r.name}</button>
                  )}
                  {r.systemKey && !r.isGroup && <span style={{ marginLeft: 6, fontSize: '0.68rem', ...muted }}>system</span>}
                </td>
                <td>{TYPE_LABEL[r.type]}</td>
                <td style={{ ...num, fontWeight: r.isGroup ? 700 : 500, color: r.balance < 0 ? 'var(--danger)' : undefined }}>{r.balance ? money(r.balance) : ''}</td>
                <td><div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                  <button className="icon-btn" title="Edit" onClick={() => setForm({ ...r, parentId: r.parentId || '', nameAr: r.nameAr || '', description: r.description || '' })}><HiPencil /></button>
                  {!r.systemKey && !r.used && (
                    <button className="icon-btn" title="Delete" onClick={async () => {
                      if (!confirm(`Delete ${r.code} ${r.name}?`)) return;
                      try { await api.delete(`/accounting/accounts/${r.id}`); load(); } catch (err) { toast.error(errMsg(err)); }
                    }}><HiTrash /></button>
                  )}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ ...muted, fontSize: '0.8rem', marginTop: '0.75rem' }}>
        Every cash account and expense category has its own ledger account, created automatically. Balances are shown the
        normal way round for each type (assets and expenses as debits; liabilities, equity and income as credits).
      </p>

      {form && (
        <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
          <form className="admin-form" style={{ maxWidth: 520 }} onSubmit={save}>
            <h3>{form.id ? 'Edit account' : 'New account'}</h3>
            <div className="form-row">
              <div className="form-group"><label>Code *</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
              <div className="form-group"><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            </div>
            <div className="form-group"><label>Arabic name</label><input dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></div>
            <div className="form-group"><label>Under heading</label>
              <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                <option value="">— Top level —</option>
                {headings.filter((h) => h.id !== form.id && (!form.id || h.type === form.type)).map((h) => <option key={h.id} value={h.id}>{h.code} {h.name}</option>)}
              </select>
            </div>
            {!form.id && !form.parentId && (
              <div className="form-group"><label>Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
            {!form.id && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input type="checkbox" checked={form.isGroup} onChange={(e) => setForm({ ...form, isGroup: e.target.checked })} /> Heading (groups other accounts, no postings)
              </label>
            )}
            <div className="form-group"><label>Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            {!form.systemKey && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
              </label>
            )}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">{form.id ? 'Save' : 'Create'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Postable accounts for pickers.
function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  useEffect(() => {
    api.get('/accounting/accounts').then((r) => setAccounts(r.data.filter((a) => !a.isGroup && a.active))).catch(() => {});
  }, []);
  return accounts;
}

// ─── Journals ──────────────────────────────────────────────────────
function JournalsTab({ currency, setTab }) {
  const money = useMoney(currency);
  const [status] = useStatus();
  const [filter, setFilter] = useState({ from: monthStart(), to: today(), kind: '', search: '', page: 1 });
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(new Set());
  const [form, setForm] = useState(null);
  const load = () => {
    const params = { ...filter, limit: 50 };
    Object.keys(params).forEach((k) => params[k] === '' && delete params[k]);
    api.get('/accounting/journals', { params }).then((r) => setData(r.data)).catch((err) => toast.error(errMsg(err)));
  };
  useEffect(() => { load(); }, [filter]);   // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Journals</h2>
        <button className="btn btn-primary" disabled={status && !status.started} onClick={() => setForm({ date: today(), description: '', reference: '', lines: [blankLine(), blankLine()] })}><HiPlus /> New journal</button>
      </div>
      {status && !status.started && <NotStarted setTab={setTab} />}

      <div style={filterBar}>
        <div><label style={dlbl}>From</label><input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value, page: 1 })} /></div>
        <div><label style={dlbl}>To</label><input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value, page: 1 })} /></div>
        <div><label style={dlbl}>Kind</label>
          <select value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value, page: 1 })}>
            <option value="">All</option>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label style={dlbl}>Search</label><input placeholder="JV no., reference, text" value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value, page: 1 })} /></div>
        <RangeButtons onPick={(r) => setFilter({ ...filter, ...r, page: 1 })} />
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th style={{ width: 28 }}></th><th>Date</th><th>No.</th><th>Description</th><th>Source</th><th style={num}>Amount</th><th></th></tr></thead>
          <tbody>
            {!data && emptyRow(7, 'Loading…')}
            {data && data.entries.length === 0 && emptyRow(7, 'No journals in this range')}
            {data?.entries.map((e) => (
              <Fragment key={e.id}>
                <tr style={{ cursor: 'pointer', opacity: e.reversedById ? 0.55 : 1 }} onClick={() => toggle(e.id)}>
                  <td>{open.has(e.id) ? <HiChevronDown /> : <HiChevronRight />}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{e.date}</td>
                  <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{e.entryNumber}</td>
                  <td>{e.description}{e.reference && <div style={{ fontSize: '0.75rem', ...muted }}>{e.reference}</div>}</td>
                  <td><span style={{ fontSize: '0.75rem' }}>{KIND_LABEL[e.kind] || e.kind}{e.sourceType && e.kind === 'auto' ? ` · ${SOURCE_LABEL[e.sourceType] || e.sourceType}` : ''}</span>
                    {e.reversedById && <div style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>reversed</div>}</td>
                  <td style={{ ...num, fontWeight: 600 }}>{money(e.totalAmount)}</td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    {e.kind === 'manual' && !e.reversedById && (
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={async () => {
                        if (!confirm(`Reverse ${e.entryNumber}? A mirror-image journal is posted today.`)) return;
                        try { await api.post(`/accounting/journals/${e.id}/reverse`); toast.success('Reversed'); load(); } catch (err) { toast.error(errMsg(err)); }
                      }}>Reverse</button>
                    )}
                  </td>
                </tr>
                {open.has(e.id) && (
                  <tr><td></td><td colSpan={6} style={{ padding: '0 0 0.75rem' }}>
                    <table className="admin-table" style={{ margin: 0, background: 'var(--surface-alt, #f8f9fa)' }}>
                      <thead><tr><th>Account</th><th>Detail</th><th style={num}>Debit</th><th style={num}>Credit</th></tr></thead>
                      <tbody>
                        {e.lines.map((l) => (
                          <tr key={l.id}>
                            <td style={{ paddingLeft: parseFloat(l.credit) ? '2rem' : undefined }}><span style={{ fontFamily: 'monospace' }}>{l.Account?.code}</span> {l.Account?.name}</td>
                            <td style={{ fontSize: '0.8rem', ...muted }}>{[l.partyName, l.description].filter(Boolean).join(' · ')}</td>
                            <td style={num}>{amt(l.debit)}</td>
                            <td style={num}>{amt(l.credit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ fontSize: '0.75rem', ...muted, marginTop: 4 }}>
                      {e.creator ? `By ${e.creator.name} · ` : ''}{e.Location ? `${e.Location.name} · ` : ''}{new Date(e.createdAt).toLocaleString()}
                    </div>
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.pages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '1rem' }}>
          <button className="btn btn-secondary" disabled={filter.page <= 1} onClick={() => setFilter({ ...filter, page: filter.page - 1 })}>‹ Prev</button>
          <span style={muted}>Page {data.page} of {data.pages} · {data.total} journals</span>
          <button className="btn btn-secondary" disabled={filter.page >= data.pages} onClick={() => setFilter({ ...filter, page: filter.page + 1 })}>Next ›</button>
        </div>
      )}

      {form && <JournalForm form={form} setForm={setForm} currency={currency} onSaved={() => { setForm(null); load(); }} />}
    </div>
  );
}

const blankLine = () => ({ accountId: '', debit: '', credit: '', description: '', partyId: '' });

function JournalForm({ form, setForm, currency, onSaved }) {
  const accounts = useAccounts();
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get('/suppliers').then((r) => setSuppliers(r.data)).catch(() => {});
    api.get('/accounting/customers').then((r) => setCustomers(r.data)).catch(() => {});
  }, []);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const partyOf = (accountId) => {
    const key = byId.get(parseInt(accountId, 10))?.systemKey;
    return key === 'AR' ? 'customer' : key === 'AP' ? 'supplier' : null;
  };

  const totals = form.lines.reduce((t, l) => ({ dr: t.dr + (parseFloat(l.debit) || 0), cr: t.cr + (parseFloat(l.credit) || 0) }), { dr: 0, cr: 0 });
  const diff = Math.round((totals.dr - totals.cr) * 1000) / 1000;
  const setLine = (i, patch) => setForm({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/accounting/journals', {
        date: form.date, description: form.description, reference: form.reference,
        lines: form.lines.filter((l) => l.accountId && (parseFloat(l.debit) || parseFloat(l.credit))).map((l) => ({
          accountId: l.accountId, debit: l.debit || 0, credit: l.credit || 0, description: l.description,
          partyType: partyOf(l.accountId), partyId: l.partyId || null,
        })),
      });
      toast.success('Journal posted');
      onSaved();
    } catch (err) { toast.error(errMsg(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
      <form className="admin-form" style={{ maxWidth: 940 }} onSubmit={save}>
        <h3>New journal</h3>
        <div className="form-row">
          <div className="form-group"><label>Date *</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
          <div className="form-group"><label>Reference</label><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Invoice / voucher no." /></div>
        </div>
        <div className="form-group"><label>Description *</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="e.g. Owner capital deposited to bank" /></div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th style={{ minWidth: 220 }}>Account</th><th>Customer / supplier</th><th>Line note</th><th style={{ width: 120 }}>Debit</th><th style={{ width: 120 }}>Credit</th><th></th></tr></thead>
            <tbody>
              {form.lines.map((l, i) => {
                const party = partyOf(l.accountId);
                return (
                  <tr key={i}>
                    <td><select value={l.accountId} onChange={(e) => setLine(i, { accountId: e.target.value, partyId: '' })} style={{ width: '100%' }}>
                      <option value="">— account —</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                    </select></td>
                    <td>{party === 'supplier' && (
                      <select value={l.partyId} onChange={(e) => setLine(i, { partyId: e.target.value })}><option value="">— supplier —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                    )}{party === 'customer' && (
                      <select value={l.partyId} onChange={(e) => setLine(i, { partyId: e.target.value })}><option value="">— customer —</option>{customers.map((c) => <option key={c.userId} value={c.userId}>{c.name}</option>)}</select>
                    )}</td>
                    <td><input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></td>
                    <td><input type="number" step="0.001" min="0" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} style={{ textAlign: 'right' }} /></td>
                    <td><input type="number" step="0.001" min="0" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} style={{ textAlign: 'right' }} /></td>
                    <td>{form.lines.length > 2 && <button type="button" className="icon-btn" onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}><HiTrash /></button>}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={3}><button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }} onClick={() => setForm({ ...form, lines: [...form.lines, blankLine()] })}><HiPlus /> Add line</button></td>
                <td style={{ ...num, fontWeight: 700 }}>{totals.dr.toFixed(3)}</td>
                <td style={{ ...num, fontWeight: 700 }}>{totals.cr.toFixed(3)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ margin: '0.5rem 0 1rem', fontSize: '0.85rem', color: diff ? 'var(--danger)' : 'var(--success)' }}>
          {diff ? `Out of balance by ${currency}${Math.abs(diff).toFixed(3)}` : totals.dr ? 'Balanced' : ''}
        </div>
        <p style={{ ...muted, fontSize: '0.78rem' }}>Lines on a cash or bank account are also recorded on that Cash Account, so its balance stays in step.</p>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving || !!diff || !totals.dr}>{saving ? 'Posting…' : 'Post journal'}</button>
          <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

// ─── General ledger ────────────────────────────────────────────────
// Opened from another tab with { accountId } — AccountingTabs re-mounts it
// per account (key), so the initial state picks the account up.
function LedgerTab({ currency, setTab, tabParams }) {
  const money = useMoney(currency);
  const [allAccounts, setAllAccounts] = useState([]);
  const [filter, setFilter] = useState({ accountId: tabParams?.accountId || '', from: monthStart(), to: today() });
  const [result, setResult] = useState(null);
  useEffect(() => { api.get('/accounting/accounts').then((r) => setAllAccounts(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (!filter.accountId) return;
    api.get('/accounting/ledger', { params: filter }).then((r) => setResult({ filter, data: r.data })).catch((err) => toast.error(errMsg(err)));
  }, [filter]);
  const data = result?.filter === filter ? result.data : null;

  return (
    <div className="admin-section">
      <div className="admin-section-header"><h2>General Ledger</h2></div>
      <div style={filterBar}>
        <div style={{ minWidth: 260 }}><label style={dlbl}>Account</label>
          <select value={filter.accountId} onChange={(e) => setFilter({ ...filter, accountId: e.target.value })} style={{ width: '100%' }}>
            <option value="">— pick an account —</option>
            {allAccounts.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.isGroup ? '▸ ' : ''}{a.code} {a.name}</option>)}
          </select>
        </div>
        <div><label style={dlbl}>From</label><input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} /></div>
        <div><label style={dlbl}>To</label><input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} /></div>
        <RangeButtons onPick={(r) => setFilter({ ...filter, ...r })} />
      </div>

      {data && (
        <>
          <div className="dash-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div className="dash-card"><div className="dash-card-label">Opening</div><div className="dash-card-value">{money(data.opening)}</div></div>
            <div className="dash-card"><div className="dash-card-label">Debits</div><div className="dash-card-value">{money(data.totalDebit)}</div></div>
            <div className="dash-card"><div className="dash-card-label">Credits</div><div className="dash-card-value">{money(data.totalCredit)}</div></div>
            <div className="dash-card"><div className="dash-card-label">Closing</div><div className="dash-card-value">{money(data.closing)}</div></div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Date</th><th>No.</th><th>Description</th>{data.account.isGroup && <th>Account</th>}<th style={num}>Debit</th><th style={num}>Credit</th><th style={num}>Balance</th></tr></thead>
              <tbody>
                <tr style={{ background: 'var(--surface-alt, #f8f9fa)' }}><td colSpan={data.account.isGroup ? 6 : 5} style={{ fontWeight: 600 }}>Opening balance</td><td style={{ ...num, fontWeight: 600 }}>{money(data.opening)}</td></tr>
                {data.lines.length === 0 && emptyRow(data.account.isGroup ? 7 : 6, 'No postings in this range')}
                {data.lines.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{l.date}</td>
                    <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{l.JournalEntry?.entryNumber}</td>
                    <td>{l.description || l.JournalEntry?.description}{l.JournalEntry?.reference && <div style={{ fontSize: '0.72rem', ...muted }}>{l.JournalEntry.reference}</div>}</td>
                    {data.account.isGroup && <td style={{ fontSize: '0.8rem' }}>{l.Account?.code} {l.Account?.name}</td>}
                    <td style={num}>{amt(l.debit)}</td>
                    <td style={num}>{amt(l.credit)}</td>
                    <td style={{ ...num, fontWeight: 500 }}>{money(l.balance)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border, #ddd)' }}>
                  <td colSpan={data.account.isGroup ? 4 : 3} style={{ fontWeight: 700 }}>Closing balance</td>
                  <td style={{ ...num, fontWeight: 700 }}>{data.totalDebit.toFixed(3)}</td>
                  <td style={{ ...num, fontWeight: 700 }}>{data.totalCredit.toFixed(3)}</td>
                  <td style={{ ...num, fontWeight: 700 }}>{money(data.closing)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {data.truncated && <p style={{ ...muted, fontSize: '0.8rem' }}>Showing the first 5000 lines — narrow the dates to see the rest.</p>}
        </>
      )}
      {!filter.accountId && <p style={muted}>Pick an account to see its postings. <button type="button" onClick={() => setTab?.('coa')} style={{ background: 'none', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer', color: 'inherit' }}>Chart of accounts</button></p>}
    </div>
  );
}

// ─── Trial balance ─────────────────────────────────────────────────
function TrialBalanceTab({ currency, setTab }) {
  const [status] = useStatus();
  const [filter, setFilter] = useState({ from: monthStart(), to: today() });
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/accounting/trial-balance', { params: filter }).then((r) => setData(r.data)).catch((err) => toast.error(errMsg(err)));
  }, [filter]);
  const t = data?.totals;

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Trial Balance</h2>
        {data && <span style={{ fontSize: '0.85rem', fontWeight: 600, color: data.balanced ? 'var(--success)' : 'var(--danger)' }}>{data.balanced ? '✓ Debits equal credits' : '✗ Out of balance'}</span>}
      </div>
      {status && !status.started && <NotStarted setTab={setTab} />}
      <div style={filterBar}>
        <div><label style={dlbl}>From</label><input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} /></div>
        <div><label style={dlbl}>To</label><input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} /></div>
        <RangeButtons onPick={(r) => setFilter(r)} />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th rowSpan={2}>Code</th><th rowSpan={2}>Account</th><th colSpan={2} style={{ textAlign: 'center' }}>Opening</th><th colSpan={2} style={{ textAlign: 'center' }}>This period</th><th colSpan={2} style={{ textAlign: 'center' }}>Closing</th></tr>
            <tr><th style={num}>Debit</th><th style={num}>Credit</th><th style={num}>Debit</th><th style={num}>Credit</th><th style={num}>Debit</th><th style={num}>Credit</th></tr>
          </thead>
          <tbody>
            {!data && emptyRow(8, 'Loading…')}
            {data && data.rows.length === 0 && emptyRow(8, 'No postings')}
            {data?.rows.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setTab?.('general-ledger', { accountId: r.id })}>
                <td style={{ fontFamily: 'monospace' }}>{r.code}</td>
                <td>{r.name}</td>
                <td style={num}>{amt(r.openDebit)}</td><td style={num}>{amt(r.openCredit)}</td>
                <td style={num}>{amt(r.debit)}</td><td style={num}>{amt(r.credit)}</td>
                <td style={{ ...num, fontWeight: 600 }}>{amt(r.closeDebit)}</td><td style={{ ...num, fontWeight: 600 }}>{amt(r.closeCredit)}</td>
              </tr>
            ))}
            {t && (
              <tr style={{ borderTop: '2px solid var(--border, #ddd)', fontWeight: 700 }}>
                <td colSpan={2}>Total ({currency})</td>
                <td style={num}>{t.openDr.toFixed(3)}</td><td style={num}>{t.openCr.toFixed(3)}</td>
                <td style={num}>{t.dr.toFixed(3)}</td><td style={num}>{t.cr.toFixed(3)}</td>
                <td style={num}>{t.closeDr.toFixed(3)}</td><td style={num}>{t.closeCr.toFixed(3)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── P&L (ledger) ──────────────────────────────────────────────────
function PnlTab({ currency, locations = [], setTab }) {
  const money = useMoney(currency);
  const [status] = useStatus();
  const [filter, setFilter] = useState({ from: monthStart(), to: today(), locationId: '' });
  const [data, setData] = useState(null);
  useEffect(() => {
    const params = { ...filter };
    if (!params.locationId) delete params.locationId;
    api.get('/accounting/pnl', { params }).then((r) => setData(r.data)).catch((err) => toast.error(errMsg(err)));
  }, [filter]);

  const section = (title, sec, sign = 1) => (
    <>
      <tr style={{ background: 'var(--surface-alt, #f8f9fa)' }}><td colSpan={2} style={{ fontWeight: 700 }}>{title}</td></tr>
      {sec.accounts.length === 0 && <tr><td colSpan={2} style={{ ...muted, paddingLeft: '1.75rem' }}>None</td></tr>}
      {sec.accounts.map((a) => (
        <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setTab?.('general-ledger', { accountId: a.id })}>
          <td style={{ paddingLeft: '1.75rem' }}><span style={{ fontFamily: 'monospace', ...muted }}>{a.code}</span> {a.name}</td>
          <td style={num}>{money(a.amount * sign)}</td>
        </tr>
      ))}
      <tr><td style={{ fontWeight: 600 }}>Total {title.toLowerCase()}</td><td style={{ ...num, fontWeight: 600 }}>{money(sec.total)}</td></tr>
    </>
  );
  const big = (label, v) => (
    <tr style={{ borderTop: '2px solid var(--border, #ddd)' }}>
      <td style={{ fontWeight: 700 }}>{label}</td>
      <td style={{ ...num, fontWeight: 700, color: v >= 0 ? 'var(--success)' : 'var(--danger)' }}>{money(v)}</td>
    </tr>
  );

  return (
    <div className="admin-section">
      <div className="admin-section-header"><h2>Profit &amp; Loss (ledger)</h2></div>
      {status && !status.started && <NotStarted setTab={setTab} />}
      <div style={filterBar}>
        <div><label style={dlbl}>From</label><input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} /></div>
        <div><label style={dlbl}>To</label><input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} /></div>
        <div><label style={dlbl}>Location</label>
          <select value={filter.locationId} onChange={(e) => setFilter({ ...filter, locationId: e.target.value })}>
            <option value="">All</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <RangeButtons onPick={(r) => setFilter({ ...filter, ...r })} />
      </div>
      {data && (
        <>
          <div className="dash-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div className="dash-card"><div className="dash-card-label">Net sales</div><div className="dash-card-value">{money(data.income.total)}</div></div>
            <div className="dash-card"><div className="dash-card-label">Gross profit</div><div className="dash-card-value" style={{ color: data.grossProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{money(data.grossProfit)}</div><div className="dash-card-change" style={muted}>{data.grossMargin}% margin</div></div>
            <div className="dash-card"><div className="dash-card-label">Expenses</div><div className="dash-card-value">{money(data.expenses.total)}</div></div>
            <div className="dash-card"><div className="dash-card-label">Net profit</div><div className="dash-card-value" style={{ color: data.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{money(data.netProfit)}</div></div>
          </div>
          <div className="admin-table-wrap" style={{ maxWidth: 680 }}>
            <table className="admin-table">
              <tbody>
                {section('Income', data.income)}
                {section('Cost of sales', data.costOfSales)}
                {big('Gross profit', data.grossProfit)}
                {section('Expenses', data.expenses)}
                {big('Net profit', data.netProfit)}
              </tbody>
            </table>
          </div>
          <p style={{ ...muted, fontSize: '0.8rem', maxWidth: 680 }}>Sales discounts and returns show as negative income. Cost of sales includes stock count adjustments and write-offs.</p>
        </>
      )}
    </div>
  );
}

// ─── Balance sheet (ledger) ────────────────────────────────────────
function BalanceSheetTab({ currency, setTab }) {
  const money = useMoney(currency);
  const [status] = useStatus();
  const [asOf, setAsOf] = useState(today());
  const [result, setResult] = useState(null);
  useEffect(() => {
    api.get('/accounting/balance-sheet', { params: { asOf } }).then((r) => setResult({ asOf, data: r.data })).catch((err) => toast.error(errMsg(err)));
  }, [asOf]);
  const data = result?.asOf === asOf ? result.data : null;

  const block = (title, sec) => (
    <div className="admin-table-wrap" style={{ maxWidth: 640, marginBottom: '1.25rem' }}>
      <table className="admin-table">
        <thead><tr><th>{title}</th><th style={num}>Amount</th></tr></thead>
        <tbody>
          {sec.accounts.length === 0 && <tr><td colSpan={2} style={muted}>None</td></tr>}
          {sec.accounts.map((a, i) => (
            <tr key={a.id || `x${i}`} style={{ cursor: a.id ? 'pointer' : undefined }} onClick={() => a.id && setTab?.('general-ledger', { accountId: a.id })}>
              <td><span style={{ fontFamily: 'monospace', ...muted }}>{a.code}</span> {a.name}</td>
              <td style={{ ...num, color: a.amount < 0 ? 'var(--danger)' : undefined }}>{money(a.amount)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid var(--border, #ddd)' }}><td style={{ fontWeight: 700 }}>Total {title.toLowerCase()}</td><td style={{ ...num, fontWeight: 700 }}>{money(sec.total)}</td></tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Balance Sheet (ledger)</h2>
        {data && <span style={{ fontSize: '0.85rem', fontWeight: 600, color: data.balanced ? 'var(--success)' : 'var(--danger)' }}>{data.balanced ? '✓ Balanced' : '✗ Not balanced'}</span>}
      </div>
      {status && !status.started && <NotStarted setTab={setTab} />}
      <div style={filterBar}>
        <div><label style={dlbl}>As of</label><input type="date" value={asOf} max={today()} onChange={(e) => setAsOf(e.target.value)} /></div>
      </div>
      {!data && <p style={muted}>Loading…</p>}
      {data && (
        <>
          <div className="dash-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div className="dash-card"><div className="dash-card-label">Total assets</div><div className="dash-card-value">{money(data.assets.total)}</div></div>
            <div className="dash-card"><div className="dash-card-label">Total liabilities</div><div className="dash-card-value">{money(data.liabilities.total)}</div></div>
            <div className="dash-card"><div className="dash-card-label">Equity</div><div className="dash-card-value">{money(data.equity.total)}</div></div>
          </div>
          {block('Assets', data.assets)}
          {block('Liabilities', data.liabilities)}
          {block('Equity', data.equity)}
          <div className="admin-table-wrap" style={{ maxWidth: 640 }}>
            <table className="admin-table"><tbody>
              <tr><td style={{ fontWeight: 700 }}>Liabilities + equity</td><td style={{ ...num, fontWeight: 700 }}>{money(data.totalLiabilitiesEquity)}</td></tr>
            </tbody></table>
          </div>
          {data.inventoryCheck && Math.abs(data.inventoryCheck.difference) >= 0.001 && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(196,120,74,0.1)', borderRadius: 8, marginTop: '1rem', fontSize: '0.85rem', maxWidth: 640 }}>
              Ledger inventory {money(data.inventoryCheck.ledger)} differs from today's stock valuation {money(data.inventoryCheck.stockValue)} by {money(data.inventoryCheck.difference)}.
              This happens when product cost prices are changed after the stock was bought. Post a journal between Inventory and Inventory Adjustments if you want them to match.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Customer accounts ─────────────────────────────────────────────
function CustomerAccountsTab({ currency }) {
  const money = useMoney(currency);
  const [rows, setRows] = useState(null);
  const [termsForm, setTermsForm] = useState(null);
  const [payForm, setPayForm] = useState(null);
  const [statement, setStatement] = useState(null);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState([]);
  const load = () => api.get('/accounting/customers').then((r) => setRows(r.data)).catch((err) => toast.error(errMsg(err)));
  useEffect(() => {
    load();
    api.get('/finance/cash-accounts?active=true').then((r) => setCashAccounts(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    if (search.trim().length < 2) return undefined;
    const h = setTimeout(() => api.get('/accounting/customer-search', { params: { q: search } }).then((r) => setFound(r.data)).catch(() => {}), 250);
    return () => clearTimeout(h);
  }, [search]);
  const matches = search.trim().length < 2 ? [] : found;
  const openStatement = (userId) => api.get(`/accounting/customers/${userId}/statement`).then((r) => setStatement(r.data)).catch((err) => toast.error(errMsg(err)));

  const owed = (rows || []).filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0);
  const credit = (rows || []).filter((r) => r.balance < 0).reduce((s, r) => s - r.balance, 0);

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Customer Accounts</h2>
        <button className="btn btn-primary" onClick={() => { setTermsForm({ _new: true, allowCredit: true, creditLimit: '', openingBalance: '', notes: '' }); setSearch(''); }}><HiPlus /> Set up customer</button>
      </div>
      <div className="dash-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="dash-card"><div className="dash-card-label">Customers owe</div><div className="dash-card-value">{money(owed)}</div></div>
        <div className="dash-card"><div className="dash-card-label">Store credit held</div><div className="dash-card-value">{money(credit)}</div></div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Customer</th><th>Phone</th><th>On account</th><th style={num}>Credit limit</th><th style={num}>Balance</th><th></th></tr></thead>
          <tbody>
            {!rows && emptyRow(6, 'Loading…')}
            {rows && rows.length === 0 && emptyRow(6, 'No customer accounts yet — set one up to sell on account at the POS')}
            {rows?.map((r) => (
              <tr key={r.userId}>
                <td style={{ fontWeight: 500 }}>{r.name}</td>
                <td>{r.phone || '—'}</td>
                <td>{r.hasAccount ? (r.allowCredit ? 'Allowed' : 'Stopped') : <span style={muted}>Store credit only</span>}</td>
                <td style={num}>{r.hasAccount ? (r.creditLimit ? money(r.creditLimit) : 'No limit') : '—'}</td>
                <td style={{ ...num, fontWeight: 600, color: r.balance > 0 ? 'var(--danger)' : r.balance < 0 ? 'var(--success)' : undefined }}>
                  {money(Math.abs(r.balance))}{r.balance < 0 ? ' credit' : ''}
                </td>
                <td><div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => openStatement(r.userId)}>Statement</button>
                  <button className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => setPayForm({ userId: r.userId, name: r.name, amount: r.balance > 0 ? r.balance.toFixed(3) : '', cashAccountId: '', paymentMethod: 'cash', paymentDate: today(), reference: '', notes: '' })}>Receive payment</button>
                  <button className="icon-btn" title="Credit terms" onClick={() => setTermsForm({ userId: r.userId, name: r.name, allowCredit: r.hasAccount ? r.allowCredit : true, creditLimit: r.creditLimit || '', openingBalance: r.openingBalance || '', notes: r.notes || '', hasAccount: r.hasAccount })}><HiPencil /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {termsForm && (
        <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setTermsForm(null); }}>
          <form className="admin-form" style={{ maxWidth: 480 }} onSubmit={async (e) => {
            e.preventDefault();
            if (!termsForm.userId) { toast.error('Pick a customer'); return; }
            try {
              await api.put(`/accounting/customers/${termsForm.userId}`, {
                allowCredit: termsForm.allowCredit, creditLimit: termsForm.creditLimit || 0,
                openingBalance: termsForm.openingBalance || 0, notes: termsForm.notes,
              });
              toast.success('Saved');
              setTermsForm(null);
              load();
            } catch (err) { toast.error(errMsg(err)); }
          }}>
            <h3>{termsForm.name ? `Credit terms — ${termsForm.name}` : 'Set up customer account'}</h3>
            {termsForm._new && !termsForm.userId && (
              <div className="form-group">
                <label>Find customer</label>
                <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone or email" />
                {matches.length > 0 && (
                  <div style={{ border: '1px solid var(--border-light, #eee)', borderRadius: 6, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                    {matches.map((u) => (
                      <button type="button" key={u.id} onClick={() => setTermsForm({ ...termsForm, userId: u.id, name: u.name })}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.45rem 0.6rem', background: 'none', border: 0, borderBottom: '1px solid var(--border-light, #eee)', cursor: 'pointer', color: 'inherit' }}>
                        {u.name} <span style={muted}>{u.phone || u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p style={{ ...muted, fontSize: '0.78rem' }}>New customers can be added from the POS customer picker.</p>
              </div>
            )}
            {termsForm.userId && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <input type="checkbox" checked={termsForm.allowCredit} onChange={(e) => setTermsForm({ ...termsForm, allowCredit: e.target.checked })} /> Allow buying on account at the POS
                </label>
                <div className="form-row">
                  <div className="form-group"><label>Credit limit ({currency})</label><input type="number" step="0.001" min="0" value={termsForm.creditLimit} onChange={(e) => setTermsForm({ ...termsForm, creditLimit: e.target.value })} placeholder="0 = no limit" /></div>
                  <div className="form-group"><label>Already owes ({currency})</label><input type="number" step="0.001" value={termsForm.openingBalance} onChange={(e) => setTermsForm({ ...termsForm, openingBalance: e.target.value })} placeholder="Opening balance" /></div>
                </div>
                <div className="form-group"><label>Notes</label><textarea rows={2} value={termsForm.notes} onChange={(e) => setTermsForm({ ...termsForm, notes: e.target.value })} /></div>
              </>
            )}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={!termsForm.userId}>Save</button>
              <button type="button" className="btn btn-secondary" onClick={() => setTermsForm(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {payForm && (
        <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPayForm(null); }}>
          <form className="admin-form" style={{ maxWidth: 480 }} onSubmit={async (e) => {
            e.preventDefault();
            try {
              const body = { ...payForm };
              delete body.name; delete body.userId;
              await api.post(`/accounting/customers/${payForm.userId}/payments`, body);
              toast.success('Payment recorded');
              setPayForm(null);
              load();
            } catch (err) { toast.error(errMsg(err)); }
          }}>
            <h3>Receive payment — {payForm.name}</h3>
            <div className="form-row">
              <div className="form-group"><label>Amount ({currency}) *</label><input type="number" step="0.001" min="0.001" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required /></div>
              <div className="form-group"><label>Date</label><input type="date" value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Paid into *</label>
                <select value={payForm.cashAccountId} onChange={(e) => setPayForm({ ...payForm, cashAccountId: e.target.value })} required>
                  <option value="">— account —</option>
                  {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Method</label>
                <select value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}>
                  {['cash', 'knet', 'card', 'bank', 'cheque', 'other'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label>Reference</label><input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Cheque / transfer no." /></div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Record payment</button>
              <button type="button" className="btn btn-secondary" onClick={() => setPayForm(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {statement && (
        <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setStatement(null); }}>
          <div className="admin-form" style={{ maxWidth: 1000, width: '95vw' }}>
            <h3>Statement — {statement.customer.name}</h3>
            <p style={{ ...muted, marginTop: 0 }}>{[statement.customer.phone, statement.customer.email].filter(Boolean).join(' · ')}</p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Date</th><th>Reference</th><th>Detail</th><th style={num}>Charged</th><th style={num}>Paid / credited</th><th style={num}>Balance</th><th></th></tr></thead>
                <tbody>
                  <tr style={{ background: 'var(--surface-alt, #f8f9fa)' }}><td colSpan={5} style={{ fontWeight: 600 }}>Opening balance</td><td style={{ ...num, fontWeight: 600 }}>{money(statement.opening)}</td><td></td></tr>
                  {statement.rows.length === 0 && emptyRow(7, 'No activity')}
                  {statement.rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.date).toLocaleDateString()}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{r.reference}</td>
                      <td style={{ minWidth: 200 }}>{r.description}</td>
                      <td style={num}>{amt(r.debit)}</td>
                      <td style={num}>{amt(r.credit)}</td>
                      <td style={{ ...num, fontWeight: 500 }}>{money(r.balance)}</td>
                      <td>{r.type === 'payment' && (
                        <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }} onClick={async () => {
                          if (!confirm(`Cancel payment ${r.reference}? The money is taken back out of the account it was paid into.`)) return;
                          try { await api.post(`/accounting/customer-payments/${r.refId}/cancel`); toast.success('Payment cancelled'); openStatement(statement.customer.id); load(); } catch (err) { toast.error(errMsg(err)); }
                        }}>Cancel</button>
                      )}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--border, #ddd)' }}><td colSpan={5} style={{ fontWeight: 700 }}>Balance due</td><td style={{ ...num, fontWeight: 700 }}>{money(statement.closing)}</td><td></td></tr>
                </tbody>
              </table>
            </div>
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>Print</button>
              <button type="button" className="btn btn-primary" onClick={() => setStatement(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VAT / tax ─────────────────────────────────────────────────────
function VatTab({ currency }) {
  const money = useMoney(currency);
  const [filter, setFilter] = useState(rangeFor('ytd'));
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/accounting/vat-report', { params: filter }).then((r) => setData(r.data)).catch((err) => toast.error(errMsg(err)));
  }, [filter]);
  const t = data?.totals || {};

  return (
    <div className="admin-section">
      <div className="admin-section-header"><h2>VAT / Tax Report</h2></div>
      <div style={filterBar}>
        <div><label style={dlbl}>From</label><input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} /></div>
        <div><label style={dlbl}>To</label><input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} /></div>
        <RangeButtons onPick={(r) => setFilter(r)} />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Month</th><th style={num}>Sales (ex tax)</th><th style={num}>Output tax</th><th style={num}>Tax on refunds</th><th style={num}>Purchases</th><th style={num}>Input tax</th><th style={num}>Net payable</th></tr></thead>
          <tbody>
            {!data && emptyRow(7, 'Loading…')}
            {data && data.rows.length === 0 && emptyRow(7, 'No sales or purchases in this range')}
            {data?.rows.map((r) => (
              <tr key={r.month}>
                <td>{r.month}</td>
                <td style={num}>{money(r.sales)}</td>
                <td style={num}>{money(r.outputTax)}</td>
                <td style={num}>{money(r.refundTax)}</td>
                <td style={num}>{money(r.purchases)}</td>
                <td style={num}>{money(r.inputTax)}</td>
                <td style={{ ...num, fontWeight: 600 }}>{money(r.netTax)}</td>
              </tr>
            ))}
            {data && data.rows.length > 0 && (
              <tr style={{ borderTop: '2px solid var(--border, #ddd)', fontWeight: 700 }}>
                <td>Total</td>
                <td style={num}>{money(t.sales)}</td><td style={num}>{money(t.outputTax)}</td><td style={num}>{money(t.refundTax)}</td>
                <td style={num}>{money(t.purchases)}</td><td style={num}>{money(t.inputTax)}</td><td style={num}>{money(t.netTax)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ ...muted, fontSize: '0.8rem', marginTop: '0.75rem', maxWidth: 760 }}>
        Output tax comes from the tax charged on paid sales (less the tax share of refunds); input tax from purchase orders
        received in the month. Kuwait does not charge VAT today, so these are expected to be zero unless products or POs
        carry a tax rate.
      </p>
    </div>
  );
}
