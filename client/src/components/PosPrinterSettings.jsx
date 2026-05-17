/**
 * Printer settings panel — pair, test, set paper width, disable.
 *
 * Pairing uses navigator.usb.requestDevice() which requires a user
 * gesture (click). The browser persists the authorisation; this
 * panel re-reads `getPairedDevice()` on mount so the cashier sees
 * the current state.
 */
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  isSupported, isEnabled, setEnabled,
  getPairedDevice, requestDevice, forget,
  testPrint, getColumns, setColumns,
} from '../lib/thermalPrinter';

export default function PosPrinterSettings({ onClose }) {
  const supported = isSupported();
  const [enabled, setEnabledLocal] = useState(isEnabled());
  const [paired, setPaired] = useState(null);
  const [columns, setColumnsLocal] = useState(getColumns());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    getPairedDevice()
      .then((handle) => setPaired(handle?.device || null))
      .catch(() => setPaired(null));
  }, [supported]);

  const handlePair = async () => {
    try {
      const handle = await requestDevice();
      setPaired(handle.device);
      setEnabledLocal(true);
      toast.success(`Paired: ${handle.device.productName || handle.device.serialNumber || 'printer'}`);
    } catch (err) {
      if (err?.name !== 'NotFoundError') {
        toast.error(err.message || 'Pairing cancelled');
      }
    }
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      await testPrint();
      toast.success('Test sent');
    } catch (err) {
      toast.error(err.message || 'Test failed');
    } finally {
      setBusy(false);
    }
  };

  const handleForget = async () => {
    if (!confirm('Forget this printer? You will need to re-pair to use direct print.')) return;
    await forget();
    setPaired(null);
    setEnabledLocal(false);
    toast.success('Printer forgotten');
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Receipt printer</h3>
          <button onClick={onClose} className="link-btn">Close</button>
        </div>

        {!supported && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(251,191,36,0.1)', borderRadius: 8, color: '#fbbf24', fontSize: 13 }}>
            Direct USB printing isn&apos;t available in this browser. Use Chrome
            or Edge on a desktop POS terminal. The system will fall back to
            the browser print dialog.
          </div>
        )}

        {supported && (
          <>
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#0f172a', borderRadius: 8, fontSize: 13 }}>
              <div style={{ color: '#94a3b8' }}>Status</div>
              <div style={{ fontWeight: 600, color: paired && enabled ? '#34d399' : '#fbbf24' }}>
                {paired && enabled && (paired.productName || `Vendor ${paired.vendorId} Product ${paired.productId}`)}
                {paired && !enabled && 'Paired but disabled'}
                {!paired && 'No printer paired — will use browser print dialog'}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.75rem', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => { setEnabled(e.target.checked); setEnabledLocal(e.target.checked); }}
              />
              <span>Use direct USB print</span>
            </label>

            <label className="modal-label" style={{ marginTop: '0.75rem' }}>
              Paper width
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[32, 42, 48].map((c) => (
                <button
                  key={c}
                  onClick={() => { setColumns(c); setColumnsLocal(c); }}
                  style={{
                    flex: 1, padding: '0.6rem',
                    background: columns === c ? '#c4784a' : '#0f172a',
                    border: columns === c ? 'none' : '1px solid #334155',
                    color: columns === c ? '#fff' : '#cbd5e1',
                    borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {c === 32 ? '58mm' : c === 42 ? '76mm' : '80mm'}
                  <div style={{ fontSize: 10, opacity: 0.7 }}>{c} cols</div>
                </button>
              ))}
            </div>

            <div className="modal-actions" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
              <button onClick={handlePair} className="modal-btn modal-btn-primary" style={{ flex: 1 }}>
                {paired ? 'Re-pair' : 'Pair printer'}
              </button>
              {paired && (
                <button onClick={handleTest} disabled={busy} className="modal-btn modal-btn-secondary" style={{ flex: 1 }}>
                  {busy ? 'Sending…' : 'Test print'}
                </button>
              )}
              {paired && (
                <button onClick={handleForget} className="modal-btn modal-btn-secondary" style={{ flex: 1 }}>
                  Forget
                </button>
              )}
            </div>

            <p style={{ fontSize: 11, color: '#64748b', marginTop: '0.75rem' }}>
              Tip: Pairing is per-browser. Re-pair if you move to a different
              terminal. Cash drawer kick fires automatically on cash sales
              when direct print is enabled.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
