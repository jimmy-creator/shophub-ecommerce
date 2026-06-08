/**
 * Barcode label printing — pick products, choose qty + label size,
 * preview a print-ready sheet, print via the browser dialog.
 *
 * Renders Code128 barcodes via jsbarcode (SVG, no canvas, scales for
 * print). Three label sizes target the common cases: small thermal
 * roll (40×25mm), medium roll (50×30mm), large/jewellery (80×50mm).
 *
 * Print CSS hides the rest of the page and lays out labels in a
 * continuous flex-wrap grid so the same template works for both
 * single-column roll printers and Avery-style A4 sheets.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';
import { HiPlus, HiX, HiPrinter } from 'react-icons/hi';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import {
  isSupported as thermalSupported,
  getDevice,
  requestDevice as requestPrinter,
  printLabels as thermalPrintLabels,
} from '../../lib/thermalPrinter';

const LABEL_SIZES = [
  { id: 'small', label: '40 × 25 mm', width: 40, height: 25, barcodeH: 26, fontPt: 8 },
  { id: 'medium', label: '50 × 30 mm', width: 50, height: 30, barcodeH: 30, fontPt: 9 },
  { id: 'large', label: '80 × 50 mm', width: 80, height: 50, barcodeH: 44, fontPt: 11 },
];

function BarcodeSvg({ value, height = 30 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, String(value), {
        format: 'CODE128',
        displayValue: false,
        height,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch {
      /* invalid value — render empty */
    }
  }, [value, height]);
  return <svg ref={ref} style={{ width: '100%', height: 'auto', display: 'block' }} />;
}

const STORE_NAME = import.meta.env.VITE_STORE_NAME || 'Anfal Sports';

function Label({ product, size, show, currency }) {
  const codeForBarcode = product.code || `P${product.productId}`;
  return (
    <div className="bc-label" style={{
      width: `${size.width}mm`,
      height: `${size.height}mm`,
      padding: '1mm 1.2mm',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
    }}>
      {show.brand && (
        <div className="bc-brand" style={{ fontSize: `${Math.max(6, size.fontPt - 1)}pt`, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', lineHeight: 1.05 }}>
          {STORE_NAME}
        </div>
      )}
      {show.name && (
        <div className="bc-name" style={{ fontSize: `${size.fontPt}pt`, lineHeight: 1.1, fontWeight: 600, marginTop: show.brand ? '0.3mm' : 0, WebkitLineClamp: size.id === 'small' ? 1 : 2 }}>
          {product.name}
        </div>
      )}
      {show.barcode && (
        <div style={{ width: '100%', marginTop: '0.6mm' }}>
          <BarcodeSvg value={codeForBarcode} height={size.barcodeH} />
        </div>
      )}
      {show.sku && (
        <div className="bc-sku" style={{ fontSize: `${size.fontPt - 1}pt`, letterSpacing: '1.5px', fontFamily: 'ui-monospace, monospace', marginTop: '0.2mm' }}>
          {codeForBarcode}
        </div>
      )}
      {show.price && (
        <div className="bc-price" style={{ fontSize: `${size.fontPt + 2}pt`, fontWeight: 800, marginTop: '0.4mm' }}>
          {currency} {(parseFloat(product.price) || 0).toFixed(3)}
        </div>
      )}
    </div>
  );
}

export default function BarcodeLabels({ currency = 'KWD' }) {
  const [allProducts, setAllProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [queue, setQueue] = useState([]);                // [{ productId, name, code, price, qty }]
  const [sizeId, setSizeId] = useState('medium');
  const [layout, setLayout] = useState('roll');   // 'roll' (one per row, label-printer) | 'sheet' (multi-col, A4)
  const [show, setShow] = useState({ brand: true, name: true, barcode: true, sku: true, price: true });

  useEffect(() => {
    api.get('/products/admin/all?limit=10000')
      .then((r) => setAllProducts(r.data.products || []))
      .catch(() => {});
  }, []);

  const hits = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allProducts
      .filter((p) => p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, allProducts]);

  const addProduct = (p) => {
    setQueue((prev) => {
      const idx = prev.findIndex((q) => q.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, {
        productId: p.id, name: p.name, code: p.code, price: p.price, qty: 1,
      }];
    });
    setSearch('');
  };
  const setQty = (i, q) => setQueue((prev) => {
    const next = [...prev];
    next[i] = { ...next[i], qty: Math.max(1, parseInt(q || 1, 10)) };
    return next;
  });
  const removeRow = (i) => setQueue((prev) => prev.filter((_, idx) => idx !== i));

  const size = LABEL_SIZES.find((s) => s.id === sizeId);
  const totalLabels = queue.reduce((s, q) => s + q.qty, 0);

  // Flatten queue into one entry per label for the preview.
  const flatLabels = useMemo(() => {
    const out = [];
    for (const q of queue) {
      for (let i = 0; i < q.qty; i += 1) out.push(q);
    }
    return out;
  }, [queue]);

  const doPrint = () => {
    setTimeout(() => window.print(), 100);
  };

  const [usbReady, setUsbReady] = useState(false);
  const [usbBusy, setUsbBusy] = useState(false);
  useEffect(() => {
    if (!thermalSupported()) { setUsbReady(false); return; }
    getDevice('barcode')
      .then((h) => setUsbReady(!!h))
      .catch(() => setUsbReady(false));
  }, []);

  const doPair = async () => {
    try {
      const handle = await requestPrinter('barcode');
      setUsbReady(true);
      toast.success(`Paired: ${handle.device.productName || 'label printer'}`);
    } catch (err) {
      if (err?.name !== 'NotFoundError') {
        toast.error(err.message || 'Pairing cancelled');
      }
    }
  };

  const doUsbPrint = async () => {
    setUsbBusy(true);
    try {
      const payload = flatLabels.map((q) => ({
        productId: q.productId,
        name: q.name,
        code: q.code,
        price: q.price,
        show,
      }));
      await thermalPrintLabels(payload, { currency });
      toast.success(`Sent ${payload.length} labels to printer`);
    } catch (err) {
      toast.error(err.message || 'Direct print failed');
    } finally {
      setUsbBusy(false);
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Barcode Labels</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {thermalSupported() && !usbReady && (
            <button className="btn btn-secondary" onClick={doPair}>
              <HiPrinter /> Connect label printer
            </button>
          )}
          {usbReady && (
            <button className="btn btn-primary" disabled={queue.length === 0 || usbBusy} onClick={doUsbPrint}>
              <HiPrinter /> {usbBusy ? 'Sending…' : `USB · ${totalLabels} label${totalLabels === 1 ? '' : 's'}`}
            </button>
          )}
          <button className="btn btn-secondary" disabled={queue.length === 0} onClick={doPrint}>
            <HiPrinter /> Browser print
          </button>
        </div>
      </div>

      {/* Options panel */}
      <div className="bc-options no-print">
        <div>
          <label style={lblStyle}>Label size</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {LABEL_SIZES.map((s) => (
              <button key={s.id} onClick={() => setSizeId(s.id)}
                style={{
                  padding: '0.5rem 0.85rem', fontSize: '0.85rem',
                  background: sizeId === s.id ? 'var(--bg-dark)' : 'var(--bg-card)',
                  color: sizeId === s.id ? 'var(--text-inverse)' : 'var(--text)',
                  border: '1px solid var(--border-light)', borderRadius: 8,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={lblStyle}>Layout</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'roll', label: 'Roll (1 per row)' },
              { id: 'sheet', label: 'Sheet (A4)' },
            ].map((l) => (
              <button key={l.id} onClick={() => setLayout(l.id)}
                style={{
                  padding: '0.5rem 0.85rem', fontSize: '0.85rem',
                  background: layout === l.id ? 'var(--bg-dark)' : 'var(--bg-card)',
                  color: layout === l.id ? 'var(--text-inverse)' : 'var(--text)',
                  border: '1px solid var(--border-light)', borderRadius: 8,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={lblStyle}>Show on label</label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.85rem' }}>
            {[
              { key: 'brand', label: 'Store name' },
              { key: 'name', label: 'Name' },
              { key: 'barcode', label: 'Barcode' },
              { key: 'sku', label: 'SKU' },
              { key: 'price', label: 'Price' },
            ].map((c) => (
              <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox" checked={show[c.key]}
                  onChange={(e) => setShow({ ...show, [c.key]: e.target.checked })}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Product picker */}
      <div className="bc-picker no-print">
        <label style={lblStyle}>Add products</label>
        <input
          placeholder="Search by name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%' }}
        />
        {hits.length > 0 && (
          <div className="bc-hits">
            {hits.map((p) => (
              <button key={p.id} className="bc-hit" onClick={() => addProduct(p)}>
                <span>{p.name}</span>
                <span style={{ color: 'var(--text-light)', fontSize: 12 }}>
                  {p.code || `#${p.id}`} · {currency} {parseFloat(p.price || 0).toFixed(3)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Queue */}
      <div className="bc-queue no-print">
        {queue.length === 0 && (
          <p style={{ color: 'var(--text-light)', padding: '1rem 0' }}>
            Search products above and click to queue them. Each row's qty is how many labels of that product will print.
          </p>
        )}
        {queue.map((q, i) => (
          <div key={i} className="bc-queue-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500 }}>{q.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-light)', fontFamily: 'monospace' }}>
                {q.code || `#${q.productId}`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={() => setQty(i, q.qty - 1)} className="qty-btn">−</button>
              <input
                type="number" min={1} value={q.qty}
                onChange={(e) => setQty(i, e.target.value)}
                style={{ width: 60, textAlign: 'center' }}
              />
              <button onClick={() => setQty(i, q.qty + 1)} className="qty-btn">+</button>
            </div>
            <button onClick={() => removeRow(i)} className="qty-btn qty-btn-x"><HiX size={14} /></button>
          </div>
        ))}
        {queue.length > 0 && (
          <button onClick={() => setQueue([])} className="link-btn" style={{ marginTop: '0.5rem' }}>
            Clear all
          </button>
        )}
      </div>

      {/* On-screen preview */}
      {queue.length > 0 && (
        <>
          <h3 className="no-print" style={{ marginTop: '1.5rem' }}>Preview</h3>
          <div className={`bc-preview no-print bc-layout-${layout}`} data-w={size.width}>
            {flatLabels.map((q, i) => (
              <Label key={i} product={q} size={size} show={show} currency={currency} />
            ))}
          </div>
        </>
      )}

      {/* Print target — portaled to <body> so it's the ONLY thing that lays out
          when printing (#root is hidden in print). Without this, the rest of
          the admin screen stays in flow and spills blank trailing pages. */}
      {queue.length > 0 && createPortal(
        <div id="bc-print-area" className={`bc-print-only bc-layout-${layout}`} data-w={size.width}>
          {flatLabels.map((q, i) => (
            <Label key={`p${i}`} product={q} size={size} show={show} currency={currency} />
          ))}
        </div>,
        document.body,
      )}

      <style>{`
        .bc-options {
          display: flex; gap: 1.5rem; flex-wrap: wrap;
          padding: 1rem; background: var(--surface-alt, #f8f9fa);
          border-radius: 8px; margin-bottom: 1rem;
        }
        .bc-picker { margin-bottom: 1rem; position: relative; }
        .bc-hits {
          background: white; border: 1px solid var(--border-light);
          border-radius: 6px; margin-top: 4px;
          max-height: 240px; overflow-y: auto;
        }
        .bc-hit {
          display: flex; justify-content: space-between; width: 100%;
          padding: 0.55rem 0.8rem;
          background: transparent; border: none; border-bottom: 1px solid var(--border-light);
          cursor: pointer; text-align: left; font-family: inherit;
        }
        .bc-hit:last-child { border-bottom: none; }
        .bc-hit:hover { background: var(--bg-warm, #f5f1e8); }
        .bc-queue-row {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.6rem 0.8rem;
          border: 1px solid var(--border-light);
          border-radius: 8px; margin-bottom: 6px;
          background: var(--bg-card);
        }
        .qty-btn {
          width: 28px; height: 28px;
          border: 1px solid var(--border-light); background: var(--bg-card);
          border-radius: 6px; cursor: pointer; display: grid; place-items: center;
          font-family: inherit;
        }
        .qty-btn:hover { background: var(--bg-warm, #f5f1e8); }
        .qty-btn-x { color: var(--danger); }

        /* Preview area on screen */
        .bc-preview {
          margin-top: 0.5rem;
          padding: 8px; background: #e5e7eb; border-radius: 6px;
        }
        .bc-layout-sheet { display: flex; flex-wrap: wrap; gap: 2mm; }
        .bc-layout-roll { display: flex; flex-direction: column; gap: 1mm; align-items: flex-start; }
        .bc-print-only { display: none; }
        .bc-label {
          background: white; color: black;
          border: 1px solid #cbd5e1;
          display: flex; flex-direction: column;
          font-family: 'Inter', -apple-system, sans-serif;
          overflow: hidden; box-sizing: border-box;
          page-break-inside: avoid;
        }
        .bc-name {
          overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
          -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }

        @media print {
          /* Collapse the entire app; only the portaled labels remain in flow,
             so the printed page count == the labels (no blank trailing pages). */
          #root { display: none !important; }
          .no-print { display: none !important; }

          .bc-print-only {
            display: block !important;
            position: static !important;
            padding: 0 !important; margin: 0 !important;
            background: #fff !important;
          }
          .bc-label {
            border: none !important;
            margin: 0 !important;
            page-break-inside: avoid;
          }

          /* Sheet layout — multi-column on a normal A4 / Letter page */
          .bc-print-only.bc-layout-sheet {
            display: flex !important; flex-wrap: wrap !important; gap: 0 !important;
          }

          /* Roll layout — one label per "page", paper size = label size */
          .bc-print-only.bc-layout-roll {
            display: block !important;
          }
          .bc-layout-roll .bc-label {
            page-break-after: always !important;
            break-after: page !important;
          }
          .bc-layout-roll .bc-label:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
        ${layout === 'roll' ? `
        /* Roll printing: one global @page sized to the selected label, so the
           printer feeds one label per page. A single unnamed @page is honored
           reliably (named pages + the page: property leak a leading blank A4).
           The label prints 1mm under the page height so its content never
           reaches the page boundary — that boundary touch is what split the
           price onto the next sticker and spawned phantom pages. */
        @media print {
          @page { size: ${size.width}mm ${size.height}mm; margin: 0; }
          .bc-print-only.bc-layout-roll .bc-label {
            height: ${size.height - 1}mm !important;
          }
        }
        ` : ''}
      `}</style>
    </div>
  );
}

const lblStyle = { display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'var(--text-light)' };
