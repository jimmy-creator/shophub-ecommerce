/**
 * Printable receipt for in-store POS sales.
 *
 * The receipt is drawn to a canvas (src/lib/posReceiptCanvas.js) so the
 * bilingual EN/AR layout + barcode render identically on both paths:
 *   - direct WebUSB thermal → sent as an ESC/POS raster image (thermalPrinter)
 *   - browser fallback       → the same canvas shown as an <img> and printed
 *
 * The print CSS hides everything outside #pos-receipt so window.print()
 * produces just the receipt image at 80mm — no nav, cart or admin chrome.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isEnabled, printSale } from '../lib/thermalPrinter';
import { renderSaleReceiptCanvas } from '../lib/posReceiptCanvas';

export default function PosReceipt({ payload, currency = 'KWD', onClose }) {
  const printedRef = useRef(false);
  const [imgUrl, setImgUrl] = useState(null);

  useEffect(() => {
    // Print exactly once. React 18 StrictMode runs mount effects twice in dev,
    // which sent the thermal printer two jobs → an extra copy. A ref guard is
    // the right tool here (a cleanup-based flag would suppress onClose, since
    // StrictMode's cleanup fires before the printSale await resolves).
    if (printedRef.current) return;
    printedRef.current = true;
    (async () => {
      // Render the preview image first (same bitmap that prints).
      try {
        const canvas = await renderSaleReceiptCanvas(payload);
        setImgUrl(canvas.toDataURL('image/png'));
      } catch (err) {
        console.warn('[receipt] render failed:', err.message);
      }

      if (isEnabled('receipt')) {
        try {
          const openDrawer = payload.order.paymentMethod === 'pos_cash'
            || payload.order.paymentMethod === 'pos_split';
          await printSale(payload, currency, openDrawer);
          onClose?.();
          return;
        } catch (err) {
          console.warn('[thermal] direct print failed, falling back:', err.message);
        }
      }
      // Browser-print fallback — the <img> is in the DOM by now.
      setTimeout(() => window.print(), 300);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          #pos-receipt {
            margin: 0 !important; padding: 0 !important;
            box-shadow: none !important; background: #fff !important;
          }
          #pos-receipt img { width: 80mm !important; }
          #pos-receipt .no-print { display: none !important; }
          @page { size: 80mm auto; margin: 0; }
        }
        #pos-receipt {
          background: white; padding: 12px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.3);
          max-height: 90vh; overflow: auto;
        }
        #pos-receipt img { width: 320px; max-width: 86vw; display: block; }
        #pos-receipt .actions { display: flex; gap: 8px; justify-content: center; margin-top: 12px; }
        #pos-receipt .actions button {
          padding: 8px 16px; border: 1px solid #444; background: white;
          font-family: inherit; cursor: pointer;
        }
        #pos-receipt .preparing { padding: 40px 24px; text-align: center; color: #666; font-family: sans-serif; }
      `}</style>

      <div id="pos-receipt">
        {imgUrl
          ? <img src={imgUrl} alt="Receipt" />
          : <div className="preparing">Preparing receipt…</div>}
        <div className="actions no-print">
          <button onClick={() => window.print()}>Print again</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
