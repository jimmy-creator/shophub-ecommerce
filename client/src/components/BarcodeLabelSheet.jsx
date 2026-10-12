/* eslint-disable react-refresh/only-export-components */
/**
 * Shared barcode-label rendering + browser-print sheet.
 *
 * Used by BOTH the admin Barcode Labels screen and the POS "Print label"
 * modal so the printed output is identical. The print target is portaled to
 * <body>; in print, #root is hidden so only the labels lay out (no blank
 * trailing pages). Call window.print() to print.
 *
 * Direct USB printing draws each label onto a canvas at the printer's
 * resolution (drawLabelCanvas) and sends it as an image: the label prints at
 * its real size, and Arabic comes out shaped correctly — sent as ESC/POS text
 * it depends on the printer's code page and usually prints as garbage.
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';

// Every label is an exact size (never grows) with equal margins on all
// sides: store name, then English | Arabic names side by side (2 lines
// each), then the barcode filling whatever height is left, then the price
// footer. padX/padY/gap/storeGap/colGap in mm, the rest in pt.
export const LABEL_SIZES = [
  { id: 'small', label: '40 × 25 mm', width: 40, height: 25, padX: 2, padY: 1.5, gap: 0.7, storeGap: 0.6, colGap: 1.5, storePt: 5, namePt: 5.5, digitsPt: 5, pricePt: 8.5, wasPt: 5.5 },
  { id: 'medium', label: '50 × 30 mm', width: 50, height: 30, padX: 2.5, padY: 1.8, gap: 0.9, storeGap: 0.9, colGap: 2, storePt: 5.5, namePt: 6.5, digitsPt: 6, pricePt: 10, wasPt: 6.5 },
  { id: 'l6040', label: '60 × 40 mm', width: 60, height: 40, padX: 2.5, padY: 2, gap: 1.1, storeGap: 1.2, colGap: 2.5, storePt: 6.5, namePt: 8, digitsPt: 7, pricePt: 12, wasPt: 7.5 },
  { id: 'large', label: '80 × 50 mm', width: 80, height: 50, padX: 3, padY: 2.5, gap: 1.4, storeGap: 1.5, colGap: 3, storePt: 7.5, namePt: 10, digitsPt: 8, pricePt: 14, wasPt: 9 },
];

export const STORE_NAME = import.meta.env.VITE_STORE_NAME || 'Anfal Sports';

// Bars stretch to fill their box (preserveAspectRatio none) — scaling is
// uniform across the width, so the code still scans.
export function BarcodeSvg({ value }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, String(value), {
        format: 'CODE128',
        displayValue: false,
        height: 60,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
      ref.current.setAttribute('preserveAspectRatio', 'none');
    } catch {
      /* invalid value — render empty */
    }
  }, [value]);
  return <svg ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// Barcodes start at 8012001: the numeric value is the product ID plus this
// base (id 1 → 8012001, id 46 → 8012046). The POS reverses it by subtracting
// BARCODE_ID_BASE to resolve a scanned code back to the product by ID.
export const BARCODE_ID_BASE = 8012000;
export const barcodeForProduct = (product) =>
  product.productId ? String(product.productId + BARCODE_ID_BASE) : '';

// The price printed on the sticker: the admin screen's editable sellPrice,
// otherwise the product's current price (POS).
const stickerPrice = (product) => parseFloat(product.sellPrice ?? product.price) || 0;
// Compare price only makes sense struck through above the selling price.
const comparePriceOf = (product) => {
  const compare = parseFloat(product.comparePrice);
  return compare > stickerPrice(product) ? compare : null;
};

// ── Label as an image, for direct USB printing ──────────────────────
// 203dpi thermal heads: 8 dots per mm. ESC/POS wants both sides in
// multiples of 8, and most heads are at most 576 dots (72mm) wide.
const DOTS_PER_MM = 8;
const MAX_DOTS = 576;
const ptToDots = (pt) => Math.round((pt * 203) / 72);
const FONT = "Arial, 'Segoe UI', 'Noto Sans Arabic', 'Geeza Pro', sans-serif";

// Lines of `text` that fit `maxWidth`, at most `maxLines` (last one ellipsised).
function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

// Same layout as <Label>, drawn at the printer's resolution.
export function drawLabelCanvas(product, size, show, currency) {
  const scale = Math.min(1, MAX_DOTS / (size.width * DOTS_PER_MM));
  const W = Math.floor((size.width * DOTS_PER_MM * scale) / 8) * 8;
  const H = Math.floor((size.height * DOTS_PER_MM * scale) / 8) * 8;
  const mm = (v) => Math.round(v * DOTS_PER_MM * scale);
  const padX = mm(size.padX);
  const padY = mm(size.padY);
  const gap = mm(size.gap);
  const inner = W - padX * 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  const px = (pt) => Math.max(10, Math.round(ptToDots(pt) * scale));
  const font = (pt, bold) => `${bold ? 'bold ' : ''}${px(pt)}px ${FONT}`;
  const spaced = (em, pt) => { ctx.letterSpacing = `${Math.round(px(pt) * em)}px`; };

  // Top block, drawn downwards.
  let y = padY;
  if (show.store) {
    ctx.font = font(size.storePt, true);
    ctx.textAlign = 'center';
    spaced(0.12, size.storePt);
    ctx.fillText(STORE_NAME.toUpperCase(), W / 2, y);
    spaced(0, size.storePt);
    y += px(size.storePt) + mm(size.storeGap) + gap;
  }
  // English | Arabic side by side, two lines each; the block is always two
  // lines tall so the barcode is the same height on every label.
  const en = show.name && product.name ? product.name : '';
  const ar = show.nameAr && product.nameAr ? product.nameAr : '';
  if (en || ar) {
    ctx.font = font(size.namePt, true);
    const lh = Math.round(px(size.namePt) * 1.2);
    const colW = en && ar ? (inner - mm(size.colGap)) / 2 : inner;
    if (en) {
      ctx.textAlign = 'left';
      wrap(ctx, en, colW, 2).forEach((l, i) => ctx.fillText(l, padX, y + i * lh));
    }
    if (ar) {
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      wrap(ctx, ar, colW, 2).forEach((l, i) => ctx.fillText(l, W - padX, y + i * lh));
      ctx.direction = 'ltr';
    }
    y += lh * 2 + gap;
  }

  // Bottom block, drawn upwards from the bottom margin.
  let bottom = H - padY;
  const compare = comparePriceOf(product);
  if (show.price || (show.compare && compare)) {
    const baseline = bottom - Math.round(px(size.pricePt) * 0.2);
    ctx.textBaseline = 'alphabetic';
    if (show.price) {
      ctx.textAlign = 'right';
      ctx.font = font(size.pricePt, true);
      const amount = stickerPrice(product).toFixed(3);
      ctx.fillText(amount, W - padX, baseline);
      const aw = ctx.measureText(amount).width;
      ctx.font = font(size.pricePt * 0.62, true);
      ctx.fillText(currency, W - padX - aw - mm(0.6), baseline);
    }
    if (show.compare && compare) {
      ctx.textAlign = 'left';
      ctx.font = font(size.wasPt, false);
      const txt = `${currency} ${compare.toFixed(3)}`;
      ctx.fillText(txt, padX, baseline);
      ctx.fillRect(padX, baseline - Math.round(px(size.wasPt) * 0.3), ctx.measureText(txt).width, Math.max(2, Math.round(scale * 2)));
    }
    ctx.textBaseline = 'top';
    bottom -= px(size.pricePt) + mm(0.8);
    // Hairline over the price.
    const rule = Math.max(2, mm(0.25));
    bottom -= rule;
    ctx.fillRect(padX, bottom, inner, rule);
    bottom -= gap;
  }
  ctx.textAlign = 'center';
  if (show.sku && product.code) {
    ctx.font = font(size.digitsPt, false);
    bottom -= px(size.digitsPt);
    ctx.fillText(product.code, W / 2, bottom);
    bottom -= gap;
  }

  // Barcode fills whatever is left in the middle, with its digits under it.
  const value = barcodeForProduct(product);
  if (show.barcode && value) {
    ctx.font = font(size.digitsPt, false);
    spaced(0.14, size.digitsPt);
    bottom -= px(size.digitsPt);
    ctx.fillText(value, W / 2, bottom);
    spaced(0, size.digitsPt);
    bottom -= mm(0.6);
    const barH = bottom - y;
    if (barH > 16) {
      const bc = document.createElement('canvas');
      try {
        // Whole dots per module keeps every bar the same width; 88% of the
        // inner width leaves a quiet zone either side for the scanner.
        JsBarcode(bc, value, { format: 'CODE128', displayValue: false, height: barH, width: 1, margin: 0 });
        const module = Math.max(1, Math.floor((inner * 0.88) / bc.width));
        JsBarcode(bc, value, { format: 'CODE128', displayValue: false, height: barH, width: module, margin: 0 });
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bc, Math.round((W - bc.width) / 2), y);
      } catch {
        // Not encodable as Code128 — the digits still print.
      }
    }
  }
  return canvas;
}

export function Label({ product, size, show, currency }) {
  const codeForBarcode = barcodeForProduct(product);
  const compare = comparePriceOf(product);
  const en = show.name && product.name;
  const ar = show.nameAr && product.nameAr;
  return (
    <div className="bc-label" style={{
      width: `${size.width}mm`,
      height: `${size.height}mm`,
      padding: `${size.padY}mm ${size.padX}mm`,
      gap: `${size.gap}mm`,
    }}>
      {show.store && (
        <div className="bc-store" style={{ fontSize: `${size.storePt}pt`, marginBottom: `${size.storeGap}mm` }}>
          {STORE_NAME}
        </div>
      )}
      {(en || ar) && (
        <div className="bc-names" style={{ gridTemplateColumns: en && ar ? '1fr 1fr' : '1fr', columnGap: `${size.colGap}mm` }}>
          {en && <div className="bc-name" style={{ fontSize: `${size.namePt}pt` }}>{product.name}</div>}
          {ar && <div className="bc-name-ar" dir="rtl" style={{ fontSize: `${size.namePt}pt` }}>{product.nameAr}</div>}
        </div>
      )}
      {show.barcode && codeForBarcode ? (
        <div className="bc-bars">
          <div className="bc-bars-svg"><BarcodeSvg value={codeForBarcode} /></div>
          <div className="bc-digits" style={{ fontSize: `${size.digitsPt}pt` }}>{codeForBarcode}</div>
        </div>
      ) : <div style={{ flex: 1 }} />}
      {show.sku && product.code && (
        <div className="bc-sku" style={{ fontSize: `${size.digitsPt}pt` }}>
          {product.code}
        </div>
      )}
      {(show.price || (show.compare && compare)) && (
        <div className="bc-foot">
          {show.compare && compare && (
            <span className="bc-compare" style={{ fontSize: `${size.wasPt}pt` }}>
              {currency} {compare.toFixed(3)}
            </span>
          )}
          {show.price && (
            <span className="bc-price" style={{ fontSize: `${size.pricePt}pt` }}>
              <small>{currency}</small>{stickerPrice(product).toFixed(3)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// The shared label + print CSS. Also styles the on-screen preview (admin) since
// .bc-label / .bc-layout-* are defined here.
export function BarcodeLabelStyles({ size, layout }) {
  return (
    <style>{`
      .bc-layout-sheet { display: flex; flex-wrap: wrap; gap: 2mm; }
      .bc-layout-roll { display: flex; flex-direction: column; gap: 1mm; align-items: flex-start; }
      .bc-print-only { display: none; }
      .bc-label {
        background: white; color: black;
        border: 1px solid #cbd5e1;
        display: flex; flex-direction: column;
        font-family: Arial, 'Segoe UI', 'Noto Sans Arabic', 'Geeza Pro', sans-serif;
        overflow: hidden; box-sizing: border-box;
        page-break-inside: avoid;
      }
      .bc-store {
        font-weight: 700; text-align: center; text-transform: uppercase;
        letter-spacing: 0.12em; line-height: 1;
      }
      /* English | Arabic side by side, top-aligned, always two lines tall */
      .bc-names { display: grid; align-items: start; }
      .bc-name, .bc-name-ar {
        font-weight: 700; line-height: 1.2; height: 2.4em;
        overflow: hidden; overflow-wrap: anywhere; display: -webkit-box;
        -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      }
      .bc-name { text-align: left; }
      .bc-name-ar { text-align: right; direction: rtl; }
      .bc-bars { flex: 1 1 0; min-height: 0; display: grid; grid-template-rows: 1fr auto; justify-items: center; }
      .bc-bars-svg { width: 88%; min-height: 0; }
      .bc-digits { text-align: center; letter-spacing: 0.14em; line-height: 1; margin-top: 0.6mm; font-variant-numeric: tabular-nums; }
      .bc-sku { text-align: center; letter-spacing: 0.5px; line-height: 1; }
      .bc-foot {
        display: flex; justify-content: space-between; align-items: baseline; gap: 2mm;
        border-top: 0.25mm solid #000; padding-top: 0.8mm; line-height: 1;
      }
      .bc-compare { text-decoration: line-through; white-space: nowrap; }
      .bc-price { font-weight: 700; white-space: nowrap; margin-left: auto; font-variant-numeric: tabular-nums; }
      .bc-price small { font-size: 0.62em; font-weight: 700; margin-right: 0.6mm; letter-spacing: 0.04em; }

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
        .bc-label { border: none !important; margin: 0 !important; page-break-inside: avoid; }

        .bc-print-only.bc-layout-sheet { display: flex !important; flex-wrap: wrap !important; gap: 0 !important; }
        .bc-print-only.bc-layout-roll { display: block !important; }
        .bc-layout-roll .bc-label { page-break-after: always !important; break-after: page !important; }
        .bc-layout-roll .bc-label:last-child { page-break-after: auto !important; break-after: auto !important; }
      }
      ${layout === 'roll' ? `
      /* Roll printing: one global @page sized to the selected label, so the
         printer feeds one label per page. The label prints 1mm under the page
         height so its content never reaches the page boundary (that boundary
         touch split the price onto the next sticker + spawned phantom pages). */
      @media print {
        @page { size: ${size.width}mm ${size.height}mm; margin: 0; }
        .bc-print-only.bc-layout-roll .bc-label { height: ${size.height - 1}mm !important; }
      }
      ` : ''}
    `}</style>
  );
}

// Portaled, print-only sheet. Render it (hidden on screen) and call
// window.print() to print. `labels` is already flattened (one per sticker).
export function BarcodeLabelSheet({ labels, size, show, currency, layout = 'roll' }) {
  if (!labels?.length) return null;
  return createPortal(
    <div id="bc-print-area" className={`bc-print-only bc-layout-${layout}`} data-w={size.width}>
      {labels.map((q, i) => (
        <Label key={`p${i}`} product={q} size={size} show={show} currency={currency} />
      ))}
    </div>,
    document.body,
  );
}
