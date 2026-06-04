/**
 * Renders a POS sale receipt to a monochrome canvas, sized for 80mm thermal
 * paper (576px @ 203dpi). One renderer feeds BOTH print paths:
 *   - direct WebUSB thermal  → sent as an ESC/POS raster image
 *   - on-screen / browser print → shown as an <img>
 *
 * Why a raster image: the receipt is fully bilingual (EN/AR) and ESC/POS
 * text mode can't shape Arabic. The browser's canvas DOES shape + bidi
 * Arabic natively (via an embedded Noto Sans Arabic web font), so drawing
 * to canvas and printing the bitmap is the only reliable way to match the
 * Arabic layout the store expects.
 *
 * Barcode: Code-39 of the invoice number via JsBarcode.
 */
import JsBarcode from 'jsbarcode';
import arabicFontUrl from '../assets/fonts/NotoSansArabic.ttf?url';
import api from '../api/axios';

const W = 576;          // 80mm printable width in dots @ 203dpi
const PAD = 18;
const AR_FONT = 'NotoArabicReceipt';

// Fixed bilingual labels (English / Arabic). Brand-level text (store name,
// tel, policy) is admin-configurable later; defaults are the confirmed
// Anfal Sports strings.
const LBL = {
  invoiceNo: 'Invoice No. / رقم الفاتورة',
  invoiceDate: 'Invoice Date / تاريخ',
  operator: 'Operator Name',
  rate: ['Rate', 'السعر'],
  qty: ['Qty.', 'الكمية'],
  amount: ['Amount', 'المبلغ'],
  total: ['Total', 'مجموع'],
  items: 'Items / التفاصيل',
  qtyTotal: 'Qty. / كمية',
  paymentInfo: 'Payment Info / معلومات الدفع',
  subTotal: 'Sub Total / المجموع الكلي',
  discount: 'Discount / خصم',
  netTotal: 'Total / صافي المجموع',
};

const DEFAULT_STORE = {
  name: 'ANFAL SPORTS',
  nameAr: 'الأنفال للمستلزمات الرياضية',
  logoUrl: '/images/anfal-logo.png',
  tel: '60035056',
  thanksEn: 'Thanks for shopping with us ....Visit Again!',
  // NOTE: transcribed from the sample receipt — confirm/edit before go-live.
  policyAr: 'يسعدنا أن نقدم لكم المساعدة في استبدال أو استرجاع غير المستخدمة في معرضنا خلال خمسة عشر يوماً بشرط تقديم الفاتورة الأصلية وتكون السلع في حالتها الأصلية وأن لا تكون ملابس داخلية',
};

// Brand-level receipt config (Arabic name, tel, thanks, policy) from admin
// Settings. Fetched once and cached; empty fields fall through to defaults.
let storeCfgPromise = null;
function loadStoreConfig() {
  if (!storeCfgPromise) {
    storeCfgPromise = api.get('/settings/receipt')
      .then(({ data }) => Object.fromEntries(
        Object.entries(data || {}).filter(([, v]) => v !== '' && v != null),
      ))
      .catch(() => ({}));
  }
  return storeCfgPromise;
}

let fontPromise = null;
async function ensureFont() {
  if (typeof FontFace === 'undefined') return;
  if (!fontPromise) {
    const f = new FontFace(AR_FONT, `url(${arabicFontUrl})`);
    fontPromise = f.load().then((loaded) => { document.fonts.add(loaded); })
      .catch(() => { /* fall back to system fonts */ });
  }
  await fontPromise;
}

const money = (n) => (parseFloat(n) || 0).toFixed(3);

// Load an image for the canvas; resolves null on error so a missing/broken
// logo just falls back to the text wordmark.
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Wrap a value in an LTR isolate (U+2066…U+2069) so Latin/numeric text keeps
// its order when it sits next to an Arabic (RTL) label on the same line.
const LRI = String.fromCharCode(0x2066), PDI = String.fromCharCode(0x2069);
const ltr = (s) => `${LRI}${s}${PDI}`;

function fmtDateTime(d) {
  const p2 = (n) => String(n).padStart(2, '0');
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(h)}:${p2(d.getMinutes())}:${p2(d.getSeconds())}${ampm}`;
}

const methodLabel = (pm) => pm === 'pos_cash' || pm === 'cash' ? 'Cash'
  : pm === 'pos_knet' || pm === 'knet' ? 'KNET'
  : 'Card';

/**
 * @returns {Promise<HTMLCanvasElement>} a B/W receipt bitmap, width 576,
 *   height a multiple of 8 (friendly to ESC/POS raster).
 */
export async function renderSaleReceiptCanvas(payload, { store } = {}) {
  await ensureFont();
  const cfg = { ...DEFAULT_STORE, ...(store || await loadStoreConfig()) };
  const { order, change, amountTendered, location, cashier } = payload;
  const items = order.items || [];
  const breakdown = Array.isArray(order.paymentBreakdown) ? order.paymentBreakdown : null;

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.quantity, 10) || 0), 0);
  const discount = parseFloat(order.discount) || 0;
  const totalQty = items.reduce((s, it) => s + (parseInt(it.quantity, 10) || 0), 0);

  // Draw on a tall scratch canvas, track the final y, then crop.
  const scratch = document.createElement('canvas');
  scratch.width = W;
  scratch.height = 2400;
  const ctx = scratch.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, scratch.height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  ctx.direction = 'ltr';

  const L = PAD;
  const R = W - PAD;
  const CW = W - 2 * PAD;
  let y = PAD;

  const setFont = (size, weight = 'normal') => { ctx.font = `${weight} ${size}px '${AR_FONT}', Arial, sans-serif`; };
  const text = (str, { align = 'left', size = 19, weight = 'normal', gap = 6, x } = {}) => {
    setFont(size, weight);
    ctx.textAlign = align;
    const px = x != null ? x : align === 'center' ? W / 2 : align === 'right' ? R : L;
    ctx.fillText(str, px, y);
    y += size + gap;
  };
  const rule = (thick = 2, before = 6, after = 8) => { y += before; ctx.fillRect(L, y, CW, thick); y += thick + after; };
  const cellRight = (str, rightX, size, weight = 'normal') => {
    setFont(size, weight);
    ctx.textAlign = 'right';
    ctx.fillText(str, rightX, y);
  };

  // ── Header ──────────────────────────────────────────────────────
  const logo = cfg.logoUrl ? await loadImage(cfg.logoUrl) : null;
  if (logo && logo.naturalWidth) {
    const maxW = CW * 0.7, maxH = 150;
    const scale = Math.min(maxW / logo.naturalWidth, maxH / logo.naturalHeight);
    const lw = Math.round(logo.naturalWidth * scale);
    const lh = Math.round(logo.naturalHeight * scale);
    ctx.drawImage(logo, Math.round((W - lw) / 2), y, lw, lh);
    y += lh + 8;
  } else {
    text(cfg.name, { align: 'center', size: 34, weight: 'bold', gap: 4 });
  }
  text(cfg.nameAr, { align: 'center', size: 23, weight: 'bold', gap: 8 });
  const building = [location?.name && ltr(location.name), location?.nameAr].filter(Boolean).join(' ');
  const city = [location?.address && ltr(location.address), location?.addressAr].filter(Boolean).join(' ');
  if (building) text(building, { align: 'center', size: 20 });
  if (city) text(city, { align: 'center', size: 20 });
  text(`Tel. / هاتف ${ltr(location?.phone || cfg.tel)}`, { align: 'center', size: 20, gap: 4 });
  rule();

  // ── Invoice meta ────────────────────────────────────────────────
  text(`${LBL.invoiceNo} ${ltr(`: ${order.orderNumber}`)}`, { size: 20 });
  text(`${LBL.invoiceDate} ${ltr(`: ${fmtDateTime(new Date(order.createdAt || Date.now()))}`)}`, { size: 20 });
  text(`${LBL.operator} ${ltr(`: ${cashier?.name || 'Admin'}`)}`, { size: 20, gap: 4 });
  rule();

  // ── Items table header (4 cols, stacked EN/AR) ──────────────────
  const colRate = 168, colQty = 300, colAmount = 432, colTotal = R;
  const hy = y;
  cellRight(LBL.rate[0], colRate, 18, 'bold');
  cellRight(LBL.qty[0], colQty, 18, 'bold');
  cellRight(LBL.amount[0], colAmount, 18, 'bold');
  cellRight(LBL.total[0], colTotal, 18, 'bold');
  y += 20;
  cellRight(LBL.rate[1], colRate, 17);
  cellRight(LBL.qty[1], colQty, 17);
  cellRight(LBL.amount[1], colAmount, 17);
  cellRight(LBL.total[1], colTotal, 17);
  y += 19;
  void hy;
  rule(1, 4, 8);

  // ── Item rows ───────────────────────────────────────────────────
  for (const it of items) {
    const qty = parseInt(it.quantity, 10) || 0;
    const rate = parseFloat(it.price) || 0;
    text(it.name, { size: 20, gap: 2 });
    if (it.nameAr && it.nameAr !== it.name) {
      ctx.textAlign = 'right'; setFont(18); ctx.fillText(it.nameAr, R, y); y += 22;
    }
    cellRight(money(rate), colRate, 19);
    cellRight(`${qty} EA`, colQty, 19);
    cellRight(money(rate * qty), colAmount, 19);
    cellRight(money(rate * qty), colTotal, 19);
    y += 24;
  }
  rule(1, 2, 0);

  // ── Items / Qty summary (boxed) ─────────────────────────────────
  const boxTop = y;
  y += 8;
  setFont(20, 'bold'); ctx.textAlign = 'left';
  ctx.fillText(`${LBL.items} ${items.length.toFixed(2)}`, L, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${LBL.qtyTotal} ${totalQty}`, R, y);
  y += 26;
  ctx.fillRect(L, boxTop, CW, 1);
  ctx.fillRect(L, y, CW, 1);
  y += 12;

  // ── Payment Info (boxed) ────────────────────────────────────────
  const payTop = y;
  y += 8;
  text(LBL.paymentInfo, { size: 20, weight: 'bold', gap: 4, x: L + 8 });
  if (breakdown) {
    for (const tn of breakdown) {
      setFont(20, 'bold'); ctx.textAlign = 'left';
      ctx.fillText(methodLabel(tn.method), L + 8, y);
      ctx.textAlign = 'right'; ctx.fillText(money(tn.amount), R - 8, y);
      y += 26;
    }
  } else {
    setFont(20, 'bold'); ctx.textAlign = 'left';
    ctx.fillText(methodLabel(order.paymentMethod), L + 8, y);
    ctx.textAlign = 'right'; ctx.fillText(money(amountTendered ?? order.totalAmount), R - 8, y);
    y += 26;
  }
  ctx.lineWidth = 2; ctx.strokeStyle = '#000';
  ctx.strokeRect(L, payTop, CW, y - payTop);
  y += 14;

  // ── Totals ──────────────────────────────────────────────────────
  const totalsRow = (label, value, weight = 'normal', size = 20) => {
    setFont(size, weight); ctx.textAlign = 'left';
    ctx.fillText(label, L, y);
    ctx.textAlign = 'right'; ctx.fillText(value, R, y);
    y += size + 8;
  };
  totalsRow(LBL.subTotal, money(subtotal));
  if (discount > 0) totalsRow(LBL.discount, money(discount));
  totalsRow(LBL.netTotal, money(order.totalAmount), 'bold', 22);
  if (change > 0 && !breakdown) totalsRow('Change / الباقي', money(change));
  y += 6;

  // ── Barcode (Code-39 of invoice no.) ────────────────────────────
  try {
    const bc = document.createElement('canvas');
    JsBarcode(bc, String(order.orderNumber), {
      format: 'CODE39', displayValue: false, height: 70, width: 2, margin: 0, background: '#fff', lineColor: '#000',
    });
    const bw = Math.min(CW, bc.width);
    const bx = (W - bw) / 2;
    ctx.drawImage(bc, bx, y, bw, bc.height);
    y += bc.height + 4;
  } catch { /* invalid chars — skip barcode */ }
  text(`*${order.orderNumber}*`, { align: 'center', size: 20, weight: 'bold', gap: 10 });

  // ── Footer ──────────────────────────────────────────────────────
  text(cfg.thanksEn, { align: 'center', size: 20, weight: 'bold', gap: 8 });
  // wrap the Arabic policy to the content width
  setFont(18); ctx.textAlign = 'center';
  for (const ln of wrapText(ctx, cfg.policyAr, CW)) { ctx.fillText(ln, W / 2, y); y += 24; }
  y += PAD;

  // ── Crop to exact height (multiple of 8 for ESC/POS raster) ──────
  const finalH = Math.ceil(y / 8) * 8;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = finalH;
  const octx = out.getContext('2d');
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, W, finalH);
  octx.drawImage(scratch, 0, 0);
  return out;
}

// Greedy word-wrap by measured width (RTL words measured the same way).
function wrapText(ctx, str, maxW) {
  const words = str.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

export default { renderSaleReceiptCanvas };
