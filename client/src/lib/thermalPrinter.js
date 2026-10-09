/**
 * Direct ESC/POS printing over WebUSB — supports two independent
 * printers: the receipt printer at the counter (80mm thermal, often
 * with a cash-drawer port) and the barcode/label printer in the back
 * room.
 *
 * navigator.usb.getDevices() returns every device the browser has
 * authorised but doesn't say which one is "receipt" or "barcode", so
 * we persist a {vendorId, productId, serialNumber} fingerprint per
 * role in localStorage and match against it at print time.
 *
 * Encoder: @point-of-sale/receipt-printer-encoder
 * Transport: navigator.usb
 *
 * Public API is now role-keyed:
 *   isSupported()                  WebUSB available?
 *   isEnabled(kind)                cashier has direct print on for this role?
 *   setEnabled(kind, v)
 *   getColumns(kind)               paper width in columns
 *   setColumns(kind, n)
 *   getDevice(kind)                lookup the paired physical device
 *   requestDevice(kind)            open OS picker + store fingerprint
 *   forget(kind)
 *   testPrint(kind)
 *   printSale(payload, ccy, kick)  -> receipt
 *   printReturn(payload, ccy)      -> receipt
 *   printReport(report, ccy)       -> receipt
 *   printLabels(labels, opts)      -> barcode
 *   kickDrawer()                   -> receipt
 *
 *  kind ∈ 'receipt' | 'barcode'
 */
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { renderSaleReceiptCanvas, renderReportCanvas, renderReturnCanvas } from './posReceiptCanvas.js';
import { barcodeForProduct } from '../components/BarcodeLabelSheet.jsx';

const KINDS = ['receipt', 'barcode'];
const DEFAULTS = { receipt: 48, barcode: 32 };

const key = (kind, suffix) => `pos_${kind}_${suffix}`;

export function isSupported() {
  return typeof navigator !== 'undefined' && !!navigator.usb;
}

export function isEnabled(kind) {
  return localStorage.getItem(key(kind, 'enabled')) === 'true';
}

export function setEnabled(kind, v) {
  if (v) localStorage.setItem(key(kind, 'enabled'), 'true');
  else localStorage.removeItem(key(kind, 'enabled'));
}

export function getColumns(kind) {
  return parseInt(localStorage.getItem(key(kind, 'columns')), 10) || DEFAULTS[kind] || 48;
}

export function setColumns(kind, n) {
  localStorage.setItem(key(kind, 'columns'), String(parseInt(n, 10) || DEFAULTS[kind]));
}

// Receipt language: 'en' (default), 'ar' (Arabic only), 'bi' (bilingual
// — print English then Arabic on each item line). Stored per-browser.
export function getReceiptLocale() {
  return localStorage.getItem('pos_receipt_locale') || 'en';
}
export function setReceiptLocale(loc) {
  if (['en', 'ar', 'bi'].includes(loc)) localStorage.setItem('pos_receipt_locale', loc);
}

// "د.ك" for Arabic receipts, the configured KWD/etc. otherwise.
function pickCurrency(defaultCurrency, loc) {
  if (loc === 'ar' || loc === 'bi') {
    return (typeof window !== 'undefined' && import.meta.env.VITE_CURRENCY_SYMBOL_AR)
      || 'د.ك';
  }
  return defaultCurrency;
}

function getFingerprint(kind) {
  try { return JSON.parse(localStorage.getItem(key(kind, 'device')) || 'null'); }
  catch { return null; }
}
function setFingerprint(kind, device) {
  const fp = {
    vendorId: device.vendorId,
    productId: device.productId,
    serialNumber: device.serialNumber || null,
  };
  localStorage.setItem(key(kind, 'device'), JSON.stringify(fp));
}
function clearFingerprint(kind) {
  localStorage.removeItem(key(kind, 'device'));
}

// ── Device handling ────────────────────────────────────────────────
// USB classes Chrome refuses to claim over WebUSB (audio, HID, mass
// storage, smart card, video, A/V, wireless). Composite POS devices often
// put one of these first, so interface 0 can't be assumed to be the printer.
const PROTECTED_CLASSES = new Set([0x01, 0x03, 0x08, 0x0b, 0x0e, 0x10, 0xe0]);

async function pickEndpoint(device) {
  if (!device.opened) await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  // Prefer the printer class (0x07), then any other claimable interface
  // with an OUT endpoint (vendor-specific 0xFF on most cheap printers).
  const candidates = [];
  for (const iface of device.configuration.interfaces) {
    for (const alt of iface.alternates) {
      if (PROTECTED_CLASSES.has(alt.interfaceClass)) continue;
      const out = alt.endpoints.find((e) => e.direction === 'out');
      if (out) candidates.push({ iface, alt, out });
    }
  }
  candidates.sort((a, b) => (b.alt.interfaceClass === 0x07) - (a.alt.interfaceClass === 0x07));
  const pick = candidates[0];
  if (!pick) {
    const classes = device.configuration.interfaces
      .map((i) => '0x' + i.alternates[0].interfaceClass.toString(16).padStart(2, '0')).join(', ');
    throw new Error(`"${device.productName || 'This device'}" has no printer interface the browser can use (classes: ${classes}). Check you picked the printer, not the screen or scanner.`);
  }
  const { iface, alt, out } = pick;
  if (!iface.claimed) await device.claimInterface(iface.interfaceNumber);
  if (iface.alternate?.alternateSetting !== alt.alternateSetting) {
    await device.selectAlternateInterface(iface.interfaceNumber, alt.alternateSetting);
  }
  return { device, endpoint: out.endpointNumber, interface: iface.interfaceNumber };
}

function matches(device, fp) {
  if (!fp) return false;
  if (device.vendorId !== fp.vendorId) return false;
  if (device.productId !== fp.productId) return false;
  // serialNumber is the strongest match but many cheap printers report
  // empty/identical serials; fall back to vendor+product if so.
  if (fp.serialNumber && device.serialNumber && device.serialNumber !== fp.serialNumber) return false;
  return true;
}

export async function getDevice(kind) {
  if (!isSupported()) return null;
  const fp = getFingerprint(kind);
  if (!fp) return null;
  const devs = await navigator.usb.getDevices();
  const found = devs.find((d) => matches(d, fp));
  if (!found) return null;
  return pickEndpoint(found);
}

export async function requestDevice(kind) {
  if (!isSupported()) throw new Error('WebUSB not supported in this browser');
  // If the OTHER kind is paired to a device, exclude it from the picker
  // so the user can't accidentally re-pick it for this role.
  const otherKind = kind === 'receipt' ? 'barcode' : 'receipt';
  const otherFp = getFingerprint(otherKind);
  const exclusionFilters = otherFp
    ? [{ vendorId: otherFp.vendorId, productId: otherFp.productId }]
    : [];
  const device = await navigator.usb.requestDevice({
    filters: [],
    exclusionFilters,
  }).catch(async () => {
    // Older browsers reject `exclusionFilters` — retry without.
    return navigator.usb.requestDevice({ filters: [] });
  });
  // Only remember the device once we've actually claimed a printer
  // interface on it, so a wrong pick doesn't leave a broken pairing.
  const handle = await pickEndpoint(device);
  setFingerprint(kind, device);
  setEnabled(kind, true);
  return handle;
}

export async function forget(kind) {
  setEnabled(kind, false);
  const fp = getFingerprint(kind);
  clearFingerprint(kind);
  if (!isSupported() || !fp) return;
  const devs = await navigator.usb.getDevices();
  const target = devs.find((d) => matches(d, fp));
  if (target) {
    // Only revoke the authorisation if no other kind still claims it.
    const otherFp = getFingerprint(KINDS.find((k) => k !== kind));
    if (!otherFp || !matches(target, otherFp)) {
      try { await target.forget(); } catch { /* old browsers */ }
    }
  }
}

// ── Low-level send ─────────────────────────────────────────────────
async function send(kind, bytes) {
  const handle = await getDevice(kind);
  if (!handle) throw new Error(`No ${kind} printer paired`);
  await handle.device.transferOut(handle.endpoint, bytes);
}

// ── Receipt templates ──────────────────────────────────────────────
// The sale receipt is fully bilingual (EN/AR), which ESC/POS text mode can't
// shape — so it's drawn to a canvas and sent as a raster image. The same
// canvas renders the on-screen preview, guaranteeing identical output.
async function buildSale(payload) {
  const cols = getColumns('receipt');
  const enc = new ReceiptPrinterEncoder({ language: 'esc-pos', columns: cols });
  const canvas = await renderSaleReceiptCanvas(payload);
  enc.initialize()
    .image(canvas, canvas.width, canvas.height, 'threshold', 210)
    .newline()
    .cut('partial');
  return enc.encode();
}

async function buildReturn(payload, currency = 'KWD') {
  const cols = getColumns('receipt');
  const loc = getReceiptLocale();
  const enc = new ReceiptPrinterEncoder({ language: 'esc-pos', columns: cols });
  const canvas = await renderReturnCanvas(payload, pickCurrency(currency, loc), loc);
  enc.initialize()
    .image(canvas, canvas.width, canvas.height, 'threshold', 210)
    .newline()
    .cut('partial');
  return enc.encode();
}

// Same raster approach as the sale receipt: the report is drawn in the
// on-screen slip's layout, so paper and browser print look the same.
async function buildReport(report, currency = 'KWD') {
  const cols = getColumns('receipt');
  const enc = new ReceiptPrinterEncoder({ language: 'esc-pos', columns: cols });
  const canvas = await renderReportCanvas(report, currency);
  enc.initialize()
    .image(canvas, canvas.width, canvas.height, 'threshold', 210)
    .newline()
    .cut('partial');
  return enc.encode();
}

// ── Public print entrypoints ───────────────────────────────────────
export async function testPrint(kind) {
  const cols = getColumns(kind);
  const enc = new ReceiptPrinterEncoder({ language: 'esc-pos', columns: cols });
  enc.initialize()
    .align('center').bold(true).line('TEST PRINT').bold(false)
    .line(kind === 'barcode' ? 'Label printer' : 'Receipt printer')
    .line(new Date().toLocaleString())
    .rule();
  if (kind === 'barcode') {
    enc.align('center').barcode('TEST1234', 'code128', { height: 60, text: false })
      .line('TEST1234');
  } else {
    enc.align('left').line('Direct print is working.');
  }
  enc.newline().newline().cut('partial');
  await send(kind, enc.encode());
}

export async function printSale(payload, currency, openDrawer = false) {
  await send('receipt', await buildSale(payload));
  if (openDrawer) await kickDrawer();
}

export async function printReturn(payload, currency) {
  await send('receipt', await buildReturn(payload, currency));
}

export async function printReport(report, currency) {
  await send('receipt', await buildReport(report, currency));
}

// Cash drawer pulse via the receipt printer.
export async function kickDrawer() {
  const cols = getColumns('receipt');
  const enc = new ReceiptPrinterEncoder({ language: 'esc-pos', columns: cols });
  const bytes = enc.initialize().pulse(0, 60, 120).encode();
  await send('receipt', bytes);
}

// Barcode-label printer entrypoint.
export async function printLabels(labels, { currency = 'KWD' } = {}) {
  const cols = getColumns('barcode');
  const enc = new ReceiptPrinterEncoder({ language: 'esc-pos', columns: cols });
  enc.initialize();
  const storeName = import.meta.env.VITE_STORE_NAME || 'Anfal Sports';
  for (const label of labels) {
    const show = label.show || { brand: true, name: true, barcode: true, sku: true, price: true };
    // Numeric barcode = product id + 8012000 (matches BarcodeLabelSheet).
    const value = barcodeForProduct(label);
    enc.initialize();
    if (show.brand && storeName) {
      enc.align('center').bold(true).line(storeName.toUpperCase()).bold(false);
    }
    if (show.name && label.name) {
      enc.align('center').line(label.name);
    }
    if (show.barcode && (label.code || label.productId)) {
      enc.align('center').barcode(value, 'code128', { height: 60, text: false });
    }
    if (show.sku) {
      enc.align('center').size('small').line(value).size('normal');
    }
    if (show.price && label.price != null) {
      enc.align('center').bold(true)
        .line(`${currency} ${(parseFloat(label.price) || 0).toFixed(3)}`)
        .bold(false);
    }
    enc.newline().cut('partial');
  }
  await send('barcode', enc.encode());
}
