import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { CurrencySymbol } from '../utils/currency';

/**
 * POS sales terminal — Phase 5 will fill this in with the cart panel,
 * barcode-scanner-friendly search, and the cash/card payment flow.
 *
 * For Phase 4 it's a stub that shows the current shift state, lets the
 * cashier sign out or close the shift.
 */
export default function Pos() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closeForm, setCloseForm] = useState(null);  // { closingCash, notes }

  useEffect(() => {
    api.get('/cashier/me')
      .then((res) => setMe(res.data))
      .catch(() => navigate('/pos/login'))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) return <div className="pos-shell"><p style={{ color: '#94a3b8' }}>Loading…</p></div>;
  if (!me) return null;

  const { user, session } = me;

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

  return (
    <div className="pos-shell" style={{ alignItems: 'flex-start', paddingTop: '4rem' }}>
      <div className="pos-card" style={{ maxWidth: 720 }}>
        <div className="pos-header">
          <h1>POS · {session.Location?.name || `Location #${session.locationId}`}</h1>
          <p className="pos-meta">Cashier: <strong>{user.name}</strong> · Shift opened {new Date(session.openedAt).toLocaleString()}</p>
        </div>

        <div style={{ padding: '2rem', background: '#0f172a', border: '1px dashed #334155', borderRadius: 12, color: '#cbd5e1', textAlign: 'center', marginBottom: '1.5rem' }}>
          <p style={{ margin: 0, fontSize: '1.1rem' }}>POS sales screen — Phase 5</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Barcode scanner + cart + cash/card payment will live here.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="pos-btn-primary" style={{ flex: 1, minWidth: 180 }}
            onClick={() => setCloseForm({ closingCash: '', notes: '' })}>
            Close shift
          </button>
          <button onClick={signOut} style={{
            flex: 1, minWidth: 180, background: 'transparent', border: '1px solid #334155',
            color: '#cbd5e1', borderRadius: 10, padding: '0.85rem', fontSize: '1rem',
            fontFamily: 'inherit', cursor: 'pointer',
          }}>
            Sign out (keep shift open)
          </button>
        </div>

        {closeForm && (
          <form onSubmit={submitClose} style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}>
            <h3 style={{ margin: '0 0 0.75rem', color: '#f8fafc' }}>Close shift</h3>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
              Closing cash count (<CurrencySymbol />)
            </label>
            <input
              type="number" step="0.001" min={0}
              value={closeForm.closingCash}
              onChange={(e) => setCloseForm({ ...closeForm, closingCash: e.target.value })}
              required autoFocus
              style={{ width: '100%', padding: '0.75rem 1rem', background: '#1e293b', border: '1px solid #334155',
                color: '#f8fafc', borderRadius: 8, fontSize: '1.1rem', fontFamily: 'inherit', marginBottom: '0.75rem' }}
            />
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={closeForm.notes}
              onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
              style={{ width: '100%', padding: '0.6rem', background: '#1e293b', border: '1px solid #334155',
                color: '#f8fafc', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'inherit', marginBottom: '0.75rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="pos-btn-primary" style={{ flex: 1 }}>Confirm close</button>
              <button type="button" onClick={() => setCloseForm(null)} style={{
                background: 'transparent', border: '1px solid #334155', color: '#cbd5e1',
                borderRadius: 10, padding: '0.85rem 1.2rem', fontFamily: 'inherit', cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        .pos-shell {
          min-height: 100vh;
          background: #0f172a;
          color: #f8fafc;
          display: flex;
          justify-content: center;
          padding: 2rem 1rem;
          font-family: -apple-system, 'SF Pro Text', 'Segoe UI', Roboto, Arial, sans-serif;
        }
        .pos-card {
          background: #1e293b; border: 1px solid #334155; border-radius: 18px;
          padding: 2rem; width: 100%;
        }
        .pos-header h1 { font-size: 1.2rem; margin: 0 0 0.4rem; color: #cbd5e1; }
        .pos-meta { margin: 0 0 1.5rem; font-size: 0.85rem; color: #94a3b8; }
        .pos-btn-primary {
          background: #c4784a; color: #fff; border: none; border-radius: 10px;
          padding: 0.85rem; font-size: 1rem; font-weight: 600;
          font-family: inherit; cursor: pointer;
        }
        .pos-btn-primary:hover { background: #b56a3e; }
      `}</style>
    </div>
  );
}
