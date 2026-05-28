import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { CurrencySymbol } from '../utils/currency';
import { STAFF_BASE } from '../App';
import { usePosTheme } from '../lib/usePosTheme';
import { HiSun, HiMoon } from 'react-icons/hi';

/**
 * POS login terminal screen.
 *
 * Three-step flow:
 *   1. Pick the Location (this terminal's store)
 *   2. Pick your cashier name from the list
 *   3. Enter your PIN
 *      - if you already have an open shift: resumed immediately
 *      - else: prompts for opening cash before opening a new shift
 *
 * Lives at a non-obvious /<staff-base>/login path (see STAFF_BASE in App.jsx)
 * outside the regular admin auth flow. Once authenticated the cashier stays
 * logged in until they close the shift.
 */
export default function PosLogin() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = usePosTheme();
  const [step, setStep] = useState('loading');     // loading | location | cashier | pin | opening
  const [locations, setLocations] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [locationId, setLocationId] = useState(() => parseInt(localStorage.getItem('pos.locationId') || '', 10) || null);
  const [cashier, setCashier] = useState(null);    // {id, name, homeLocationId}
  const [pin, setPin] = useState('');
  const [openingCash, setOpeningCash] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pinRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get('/locations').catch(() => api.get('/cashier/cashiers').then(() => ({ data: [] }))),
      api.get('/cashier/cashiers'),
    ]).then(([locRes, cashRes]) => {
      // /api/locations is admin-protected so an unauth'd POS terminal can't list them.
      // Fallback: derive locations from the cashiers' homeLocation field.
      let locs = Array.isArray(locRes?.data) ? locRes.data : [];
      if (locs.length === 0) {
        const seen = new Map();
        for (const c of cashRes.data) {
          if (c.homeLocation && !seen.has(c.homeLocation.id)) seen.set(c.homeLocation.id, c.homeLocation);
        }
        locs = Array.from(seen.values());
      }
      setLocations(locs);
      setCashiers(cashRes.data);
      if (locationId && locs.find((l) => l.id === locationId)) {
        setStep('cashier');
      } else {
        setStep('location');
      }
    }).catch(() => {
      toast.error('Could not load POS data');
      setStep('location');
    });
  }, []);     // eslint-disable-line react-hooks/exhaustive-deps

  const pickLocation = (l) => {
    setLocationId(l.id);
    localStorage.setItem('pos.locationId', String(l.id));
    setStep('cashier');
  };

  const pickCashier = (c) => {
    setCashier(c);
    setPin('');
    setStep('pin');
    setTimeout(() => pinRef.current?.focus(), 50);
  };

  const tryLogin = async (withOpeningCash) => {
    setSubmitting(true);
    try {
      const body = { userId: cashier.id, pin, locationId };
      if (withOpeningCash !== undefined) body.openingCash = withOpeningCash;
      const { data } = await api.post('/cashier/login', body);
      toast.success(data.resumed ? 'Shift resumed' : 'Shift opened');
      navigate(STAFF_BASE);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data;
      if (status === 409 && detail?.requires === 'openingCash') {
        setStep('opening');
      } else {
        toast.error(detail?.message || 'Login failed');
        setPin('');
        pinRef.current?.focus();
      }
    } finally { setSubmitting(false); }
  };

  const themeClass = `pos-shell${theme === 'light' ? ' pos-light' : ''}`;
  const ThemeToggle = () => (
    <button className="pos-theme-toggle" onClick={toggleTheme} aria-label="Toggle theme"
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
      {theme === 'light' ? <HiMoon /> : <HiSun />}
    </button>
  );

  if (step === 'loading') {
    return <div className={themeClass}><p className="pos-loading">Loading…</p></div>;
  }

  return (
    <div className={themeClass}>
      <ThemeToggle />
      <div className="pos-card">
        <div className="pos-header">
          <h1>POS Terminal</h1>
          {locationId && <p className="pos-meta">📍 {locations.find((l) => l.id === locationId)?.name || `Location #${locationId}`}</p>}
        </div>

        {step === 'location' && (
          <>
            <h2>Choose your store</h2>
            <div className="pos-list">
              {locations.length === 0 ? (
                <p className="pos-loading">No locations set up. Ask an admin to create one in admin → Locations.</p>
              ) : locations.map((l) => (
                <button key={l.id} className="pos-tile" onClick={() => pickLocation(l)}>
                  <span className="pos-tile-name">{l.name}</span>
                  {l.code && <span className="pos-tile-meta">{l.code}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'cashier' && (
          <>
            <h2>Who's at the till?</h2>
            <div className="pos-list">
              {cashiers.length === 0 ? (
                <p className="pos-loading">No cashier accounts yet. Ask an admin to add one in admin → Cashiers.</p>
              ) : cashiers.map((c) => (
                <button key={c.id} className="pos-tile" onClick={() => pickCashier(c)}>
                  <span className="pos-tile-name">{c.name}</span>
                  {c.homeLocation && <span className="pos-tile-meta">{c.homeLocation.name}</span>}
                </button>
              ))}
            </div>
            <button className="pos-link" onClick={() => setStep('location')}>← Change location</button>
          </>
        )}

        {step === 'pin' && (
          <>
            <h2>Hi {cashier.name}, enter your PIN</h2>
            <form onSubmit={(e) => { e.preventDefault(); tryLogin(); }}>
              <input
                ref={pinRef}
                type="password"
                inputMode="numeric"
                pattern="\d*"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••"
                className="pos-pin-input"
                autoFocus
              />
              <button type="submit" className="pos-btn-primary" disabled={submitting || pin.length < 4}>
                {submitting ? 'Checking…' : 'Sign in'}
              </button>
            </form>
            <button className="pos-link" onClick={() => { setCashier(null); setStep('cashier'); }}>← Different cashier</button>
          </>
        )}

        {step === 'opening' && (
          <>
            <h2>Open new shift</h2>
            <p className="pos-loading">
              No open shift for {cashier.name}. Count the cash in the drawer and enter the opening amount.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); tryLogin(parseFloat(openingCash) || 0); }}>
              <label className="pos-label">
                Opening cash (<CurrencySymbol />)
                <input
                  type="number" step="0.001" min={0}
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  placeholder="0.000"
                  className="pos-cash-input"
                  autoFocus
                />
              </label>
              <button type="submit" className="pos-btn-primary" disabled={submitting || openingCash === ''}>
                {submitting ? 'Opening…' : 'Open shift'}
              </button>
            </form>
            <button className="pos-link" onClick={() => setStep('pin')}>← Back</button>
          </>
        )}
      </div>

      <style>{`
        .pos-shell {
          /* Same POS palette as the register (.pos-app). Defined here too
             because the login screen renders outside the .pos-app subtree. */
          --pos-bg: #0a0f1e;
          --pos-panel: #1e293b;
          --pos-line: #334155;
          --pos-line-2: #475569;
          --pos-text: #f3f4f6;
          --pos-text-2: #94a3b8;
          --pos-label: #cbd5e1;
          --pos-accent: #d97757;
          --pos-accent-soft: rgba(217,119,87,0.12);
          --pos-on-accent: #fff;

          min-height: 100vh;
          background: var(--pos-bg);
          color: var(--pos-text);
          display: grid;
          place-items: center;
          padding: 2rem 1rem;
          font-family: -apple-system, 'SF Pro Text', 'Segoe UI', Roboto, Arial, sans-serif;
        }
        .pos-shell.pos-light {
          --pos-bg: #eef2f7;
          --pos-panel: #ffffff;
          --pos-line: #e2e8f0;
          --pos-line-2: #cbd5e1;
          --pos-text: #0f172a;
          --pos-text-2: #475569;
          --pos-label: #334155;
          --pos-accent: #c4784a;
          --pos-accent-soft: rgba(196,120,74,0.14);
          --pos-on-accent: #fff;
        }
        .pos-shell.pos-light .pos-card { box-shadow: 0 10px 40px -16px rgba(15,23,42,0.25); }
        .pos-theme-toggle {
          position: fixed; top: 16px; right: 16px;
          display: grid; place-items: center; width: 36px; height: 36px;
          border-radius: 9px; border: 1px solid var(--pos-line);
          background: var(--pos-panel); color: var(--pos-text-2);
          cursor: pointer; font-size: 16px;
        }
        .pos-theme-toggle:hover { color: var(--pos-accent); }
        .pos-card {
          background: var(--pos-panel);
          border: 1px solid var(--pos-line);
          border-radius: 18px;
          padding: 2.5rem;
          width: 100%;
          max-width: 500px;
          box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.6);
        }
        .pos-header h1 {
          font-size: 1.4rem;
          margin: 0 0 0.4rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--pos-label);
        }
        .pos-meta {
          margin: 0 0 1.5rem;
          font-size: 0.85rem;
          color: var(--pos-text-2);
        }
        .pos-card h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0 0 1.25rem;
        }
        .pos-loading { color: var(--pos-text-2); font-size: 0.95rem; margin: 0 0 1rem; }
        .pos-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        .pos-tile {
          background: var(--pos-bg);
          border: 1px solid var(--pos-line);
          border-radius: 12px;
          padding: 1.25rem 1rem;
          color: var(--pos-text);
          font-family: inherit;
          text-align: left;
          cursor: pointer;
          display: flex; flex-direction: column; gap: 0.3rem;
          transition: all 0.15s;
        }
        .pos-tile:hover { background: var(--pos-panel); border-color: var(--pos-line-2); transform: translateY(-1px); }
        .pos-tile-name { font-size: 1.05rem; font-weight: 600; }
        .pos-tile-meta { font-size: 0.78rem; color: var(--pos-text-2); }
        .pos-pin-input {
          width: 100%;
          font-size: 2.5rem;
          letter-spacing: 0.8em;
          text-align: center;
          padding: 1rem;
          background: var(--pos-bg);
          border: 1px solid var(--pos-line);
          border-radius: 10px;
          color: var(--pos-text);
          font-family: inherit;
          margin-bottom: 1rem;
        }
        .pos-cash-input {
          display: block;
          width: 100%;
          font-size: 1.5rem;
          padding: 0.75rem 1rem;
          background: var(--pos-bg);
          border: 1px solid var(--pos-line);
          border-radius: 10px;
          color: var(--pos-text);
          font-family: inherit;
          margin-top: 0.4rem;
          margin-bottom: 1rem;
        }
        .pos-label { font-size: 0.9rem; color: var(--pos-label); }
        .pos-btn-primary {
          width: 100%;
          background: var(--pos-accent);
          color: var(--pos-on-accent);
          border: none;
          border-radius: 10px;
          padding: 0.85rem;
          font-size: 1rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.15s;
        }
        .pos-btn-primary:hover:not(:disabled) { background: var(--pos-accent); }
        .pos-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .pos-link {
          background: none;
          border: none;
          color: var(--pos-text-2);
          font-size: 0.85rem;
          margin-top: 1rem;
          cursor: pointer;
          font-family: inherit;
          padding: 0;
        }
        .pos-link:hover { color: var(--pos-label); }
      `}</style>
    </div>
  );
}
