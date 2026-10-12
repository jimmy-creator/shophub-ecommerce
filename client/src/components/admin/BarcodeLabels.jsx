/**
 * Barcode label printing — pick products, choose qty + label size,
 * preview a print-ready sheet, print via the browser dialog.
 *
 * Renders Code128 barcodes via jsbarcode (SVG for the browser dialog).
 * Label sizes: small thermal roll (40×25mm), medium roll (50×30mm), the
 * shop's 60×40mm, large/jewellery (80×50mm).
 *
 * Print CSS hides the rest of the page and lays out labels in a
 * continuous flex-wrap grid so the same template works for both
 * single-column roll printers and Avery-style A4 sheets.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { HiPlus, HiX, HiPrinter } from 'react-icons/hi';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import {
  isSupported as thermalSupported,
  getDevice,
  requestDevice as requestPrinter,
  printLabelImages as thermalPrintLabelImages,
} from '../../lib/thermalPrinter';
import {
  LABEL_SIZES, Label, BarcodeLabelStyles, BarcodeLabelSheet, drawLabelCanvas, BARCODE_ID_BASE,
} from '../BarcodeLabelSheet';

const round3 = (n) => Math.round(parseFloat(n) * 1000) / 1000;

export default function BarcodeLabels({ currency = 'KWD' }) {
  const [allProducts, setAllProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [queue, setQueue] = useState([]);                // [{ productId, name, code, price, qty }]
  const [sizeId, setSizeId] = useState('l6040');
  const [layout, setLayout] = useState('roll');   // 'roll' (one per row, label-printer) | 'sheet' (multi-col, A4)
  const [show, setShow] = useState({ store: true, name: true, nameAr: true, barcode: true, compare: true, price: true, sku: false });
  const searchRef = useRef(null);
  const queueRef = useRef(null);
  const scrollToRow = useRef(null);   // productId to bring into view after the next render

  // A long queue: keep the product just added/scanned on screen.
  useEffect(() => {
    if (scrollToRow.current == null) return;
    queueRef.current?.querySelector(`[data-row="${scrollToRow.current}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    scrollToRow.current = null;
  }, [queue]);

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
    scrollToRow.current = p.id;
    setQueue((prev) => {
      const idx = prev.findIndex((q) => q.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      // sellPrice is the shop price printed on the sticker; it starts at the
      // current selling price and may be set higher or lower.
      return [...prev, {
        productId: p.id, name: p.name, nameAr: p.nameAr, code: p.code,
        price: p.price, comparePrice: p.comparePrice, qty: 1,
        sellPrice: (parseFloat(p.price) || 0).toFixed(3),
      }];
    });
    setSearch('');
    searchRef.current?.focus();
  };

  // Scanner: types the barcode then Enter. A label barcode (product id +
  // BARCODE_ID_BASE) or an exact code match is added straight away (+1
  // label each scan); otherwise a lone search hit.
  const onSearchKey = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = search.trim().toLowerCase();
    if (!q) return;
    const n = /^\d+$/.test(q) ? parseInt(q, 10) - BARCODE_ID_BASE : 0;
    const exact = allProducts.find((p) => p.code?.toLowerCase() === q)
      || (n > 0 && allProducts.find((p) => p.id === n));
    if (exact) addProduct(exact);
    else if (hits.length === 1) addProduct(hits[0]);
    else if (hits.length === 0) { toast.error(`No product for "${search.trim()}"`); setSearch(''); }
  };
  const setQty = (i, q) => setQueue((prev) => {
    const next = [...prev];
    next[i] = { ...next[i], qty: Math.max(1, parseInt(q || 1, 10)) };
    return next;
  });
  const removeRow = (i) => setQueue((prev) => prev.filter((_, idx) => idx !== i));
  const setRow = (i, patch) => setQueue((prev) => {
    const next = [...prev];
    next[i] = { ...next[i], ...patch };
    return next;
  });
  // Rows whose sticker price differs from what the product is sold at now —
  // these get saved to the product before printing so the POS and website
  // charge exactly what the sticker says.
  const priceChanges = show.price ? queue.filter((q) => round3(q.sellPrice) !== round3(q.price)) : [];

  const applyPrices = async () => {
    if (!show.price) return true;
    const bad = queue.find((q) => !(round3(q.sellPrice) > 0));
    if (bad) {
      toast.error(`${bad.name}: enter a selling price above 0`);
      return false;
    }
    // A compare price at or below the new price would show online as a
    // struck-through "discount" that isn't one, so it is cleared.
    const patchFor = (q) => {
      const price = round3(q.sellPrice);
      return parseFloat(q.comparePrice) > price ? { price } : { price, comparePrice: null };
    };
    try {
      for (const q of priceChanges) {
        await api.put(`/products/${q.productId}`, patchFor(q));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update prices — nothing printed');
      return false;
    }
    if (priceChanges.length) {
      const saved = new Map(priceChanges.map((q) => [q.productId, patchFor(q)]));
      setQueue((prev) => prev.map((q) => (saved.has(q.productId) ? { ...q, ...saved.get(q.productId) } : q)));
      setAllProducts((prev) => prev.map((p) => (saved.has(p.id) ? { ...p, ...saved.get(p.id) } : p)));
      toast.success(`Selling price updated for ${priceChanges.length} product${priceChanges.length === 1 ? '' : 's'}`);
    }
    return true;
  };

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

  const doPrint = async () => {
    if (!(await applyPrices())) return;
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
    if (!(await applyPrices())) return;
    setUsbBusy(true);
    try {
      const images = flatLabels.map((q) => drawLabelCanvas(q, size, show, currency));
      await thermalPrintLabelImages(images);
      toast.success(`Sent ${images.length} labels to printer`);
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
              { key: 'store', label: 'Store name' },
              { key: 'name', label: 'Product name' },
              { key: 'nameAr', label: 'Arabic name' },
              { key: 'barcode', label: 'Barcode' },
              { key: 'compare', label: 'Compare price' },
              { key: 'price', label: 'Selling price' },
              { key: 'sku', label: 'SKU' },
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
          ref={searchRef}
          autoFocus
          placeholder="Scan a barcode, or search by name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onSearchKey}
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
      <div className="bc-queue no-print" ref={queueRef}>
        {queue.length === 0 && (
          <p style={{ color: 'var(--text-light)', padding: '1rem 0' }}>
            Scan barcodes or search products above to queue them — each scan adds one label. Each row's qty is how many labels of that product will print.
          </p>
        )}
        {queue.map((q, i) => (
          <div key={i} className="bc-queue-row" data-row={q.productId}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500 }}>{q.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-light)', fontFamily: 'monospace' }}>
                {q.code || `#${q.productId}`}
              </div>
            </div>
            {show.price && (
              <label className="bc-price-input">Selling price ({currency})
                <input type="number" step="0.001" min={0} value={q.sellPrice}
                  onChange={(e) => setRow(i, { sellPrice: e.target.value })} />
              </label>
            )}
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
        {priceChanges.length > 0 && (
          <p className="bc-price-notice">
            Printing will change the selling price of {priceChanges.length} product{priceChanges.length === 1 ? '' : 's'} to
            the sticker price — the POS and website will charge it from then on.
          </p>
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

      {/* Print target — shared sheet, portaled to <body> so only the labels
          lay out when printing (#root hidden). Identical output to the POS. */}
      <BarcodeLabelSheet labels={flatLabels} size={size} show={show} currency={currency} layout={layout} />
      <BarcodeLabelStyles size={size} layout={layout} />

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
          display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
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
        .bc-price-input { display: flex; flex-direction: column; font-size: 11px; color: var(--text-light); gap: 2px; }
        .bc-price-input input { width: 100px; }
        .bc-price-notice {
          margin-top: 0.75rem; padding: 0.6rem 0.8rem; font-size: 0.85rem;
          border: 1px solid var(--border-light); border-left: 3px solid var(--copper);
          border-radius: 6px; background: var(--bg-card);
        }

        /* Preview area on screen (label visuals come from BarcodeLabelStyles) */
        .bc-preview {
          margin-top: 0.5rem;
          padding: 8px; background: #e5e7eb; border-radius: 6px;
        }
      `}</style>
    </div>
  );
}

const lblStyle = { display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'var(--text-light)' };
