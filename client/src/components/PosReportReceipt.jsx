/**
 * X-report (mid-shift snapshot) or Z-report (closed-shift final) — printable
 * on the same 80mm paper as the sales receipt. Same print CSS pattern as
 * PosReceipt: hides everything else, auto-fires window.print().
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { isEnabled, printReport } from '../lib/thermalPrinter';

export default function PosReportReceipt({ report, currency = 'KWD', onClose }) {
  const printedRef = useRef(false);

  useEffect(() => {
    // Print exactly once — see PosReceipt for why a ref guard (not a cleanup
    // flag) is used: StrictMode double-invoked this in dev → an extra copy.
    if (printedRef.current) return;
    printedRef.current = true;
    (async () => {
      if (isEnabled('receipt')) {
        try {
          await printReport(report, currency);
          onClose?.();
          return;
        } catch (err) {
          console.warn('[thermal] direct report print failed, falling back:', err.message);
        }
      }
      setTimeout(() => window.print(), 200);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (n) => `${currency} ${(parseFloat(n) || 0).toFixed(3)}`;
  const t = report.type === 'Z' ? 'Z-REPORT' : 'DAILY REPORT';
  const session = report.session || {};

  // "13th Jul, 2026 09:34 AM"
  const ord = (d) => { const s = ['th', 'st', 'nd', 'rd'], v = d % 100; return d + (s[(v - 20) % 10] || s[v] || s[0]); };
  const fmtDT = (dt) => {
    if (!dt) return '—';
    const d = new Date(dt);
    let h = d.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${ord(d.getDate())} ${d.toLocaleString('en-US', { month: 'short' })}, ${d.getFullYear()} `
      + `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
  };
  const rangeStart = fmtDT(session.openedAt);
  const rangeEnd = fmtDT(report.type === 'Z' ? session.closedAt : report.generatedAt);

  const opening = parseFloat(report.openingCash) || 0;
  const totalSales = parseFloat(report.totalSales) || 0;
  const totalRefund = +((parseFloat(report.cashRefunds) || 0) + (parseFloat(report.cardRefunds) || 0)
    + (parseFloat(report.knetRefunds) || 0) + (parseFloat(report.creditRefunds) || 0)).toFixed(3);
  const registerTotal = +(opening + totalSales - totalRefund).toFixed(3);

  // Portal to <body> + hide #root in print so only the report prints on one
  // page (fixed-position over a tall app paginated → duplicate copies).
  return createPortal(
    <div className="pos-receipt-overlay">
      <style>{`
        .pos-receipt-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100;
          display: grid; place-items: center; padding: 1rem;
        }
        @media print {
          body > #root { display: none !important; }
          .pos-receipt-overlay {
            position: static !important; background: none !important;
            display: block !important; padding: 0 !important; z-index: auto !important;
          }
          #pos-report {
            margin: 0 !important;
            width: 80mm !important;
            padding: 4mm !important;
            box-shadow: none !important;
            background: #fff !important;
            font-family: 'Courier New', monospace !important;
            font-size: 12pt !important;
            line-height: 1.45 !important;
          }
          #pos-report, #pos-report * {
            color: #000 !important; font-weight: 600 !important;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          #pos-report h2 { font-size: 15pt !important; font-weight: 800 !important; }
          #pos-report .total-row, #pos-report .total-row * { font-weight: 800 !important; }
          #pos-report .meta { font-size: 10.5pt !important; }
          #pos-report hr { border-top: 1px solid #000 !important; }
          #pos-report .no-print { display: none !important; }
          @page { size: 80mm auto; margin: 0; }
        }
        #pos-report {
          width: 80mm; margin: 24px auto; padding: 16px;
          background: white; color: #111;
          font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.4;
          box-shadow: 0 4px 24px rgba(0,0,0,0.3);
        }
        #pos-report h2 { font-size: 16px; margin: 0; text-align: center; letter-spacing: 2px; }
        #pos-report .meta { font-size: 11px; text-align: center; margin: 4px 0 8px; }
        #pos-report hr { border: none; border-top: 1px dashed #444; margin: 8px 0; }
        #pos-report table { width: 100%; border-collapse: collapse; }
        #pos-report td { padding: 2px 0; vertical-align: top; }
        #pos-report .right { text-align: right; }
        #pos-report .strong { font-weight: bold; }
        #pos-report .actions { display: flex; gap: 8px; justify-content: center; margin-top: 16px; }
        #pos-report .actions button {
          padding: 8px 16px; border: 1px solid #444; background: white;
          font-family: inherit; cursor: pointer;
        }
      `}</style>

      <div id="pos-report">
        <h2>{t}</h2>
        <div className="meta">
          <div>{report.location?.name || 'Anfal Sports'}</div>
          {report.location?.phone && <div>Tel: {report.location.phone}</div>}
        </div>
        <hr />

        <div className="strong" style={{ textAlign: 'center' }}>Register Details</div>
        <div className="meta">( {rangeStart} — {rangeEnd} )</div>
        <div style={{ fontSize: 11 }}>Cashier: <span className="strong">{report.cashier?.name || '—'}</span></div>
        <hr />

        <table>
          <tbody>
            <tr className="strong"><td>Payment Method</td><td className="right">Sell</td></tr>
            <tr><td>Cash Payment:</td><td className="right">{fmt(report.cashSales)}</td></tr>
            <tr><td>Card Payment:</td><td className="right">{fmt(report.cardSales)}</td></tr>
            <tr><td>KNET:</td><td className="right">{fmt(report.knetSales)}</td></tr>
          </tbody>
        </table>
        <hr />

        <table>
          <tbody>
            <tr className="strong"><td>Total Sales:</td><td className="right">{fmt(totalSales)}</td></tr>
            <tr className="strong"><td>Total Refund:</td><td className="right">{fmt(totalRefund)}</td></tr>
            <tr className="strong"><td>Net Sales:</td><td className="right">{fmt(report.netSales)}</td></tr>
            {report.type === 'Z' && (
              <>
                <tr><td>Expected drawer:</td><td className="right">{fmt(report.expectedCash)}</td></tr>
                <tr><td>Counted cash:</td><td className="right">{fmt(report.closingCash)}</td></tr>
                <tr className="strong" style={{ color: report.variance < 0 ? '#b00' : (report.variance > 0 ? '#080' : '#000') }}>
                  <td>Variance:</td>
                  <td className="right">{report.variance >= 0 ? '+' : ''}{fmt(report.variance)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
        <hr />

        <div style={{ fontSize: 11 }}>
          Total = {fmt(opening)} (opening) + {fmt(totalSales)} (Sale)
          {' '}− {fmt(totalRefund)} (Refund) = <span className="strong">{fmt(registerTotal)}</span>
        </div>

        <hr />
        <div style={{ textAlign: 'center', fontSize: 11 }}>
          {report.type === 'Z' ? '— END OF SHIFT —' : '— MID-SHIFT REPORT —'}
        </div>

        <div className="actions no-print">
          <button onClick={() => window.print()}>Print again</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
