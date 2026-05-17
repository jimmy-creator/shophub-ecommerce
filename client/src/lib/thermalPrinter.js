/**
 * Direct ESC/POS printing over WebUSB.
 *
 * The browser persists the USB authorisation after the first
 * `requestDevice()`, so subsequent sessions can re-grab the same
 * device with `getDevices()` — no re-pairing needed.
 *
 * Encoder: @point-of-sale/receipt-printer-encoder (browser-native
 * ESC/POS byte generator, no Node deps).
 * Transport: navigator.usb.
 *
 * Cashier opts in via PosPrinterSettings. If disabled OR no device
 * paired OR the browser doesn't support WebUSB, callers fall back to
 * `window.print()` automatically.
 *
 * Public API:
 *   isSupported()             — WebUSB available in this browser?
 *   isEnabled()               — cashier has direct print on?
 *   setEnabled(bool)          — toggle the preference
 *   getPairedDevice()         — try to get the previously-paired printer
 *   requestDevice()           — open the OS picker for first pairing
 *   forget()                  — drop the pairing (and disable)
 *   testPrint()               — small "OK" receipt to confirm
 *   printSale(payload)        — printed sale receipt
 *   printReturn(payload)      — return receipt (refund)
 *   printReport(report)       — X/Z report
 *   kickDrawer()              — pulse the cash-drawer port
 */
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

const STORAGE_KEY = 'pos_thermal_enabled';
const COLUMNS = 32;   // 58mm = 32 cols, 80mm = 48 cols. Most KW thermal carts ship 48.
                      // Override per-paper-width via setColumns() if needed.
let columns = parseInt(localStorage.getItem('pos_thermal_columns'), 10) || 48;

export function isSupported() {
  return typeof navigator !== 'undefined' && !!navigator.usb;
}

export function isEnabled() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setEnabled(v) {
  if (v) localStorage.setItem(STORAGE_KEY, 'true');
  else localStorage.removeItem(STORAGE_KEY);
}

export function getColumns() { return columns; }
export function setColumns(n) {
  columns = parseInt(n, 10) || 48;
  localStorage.setItem('pos_thermal_columns', String(columns));
}

// ── Device handling ────────────────────────────────────────────────
async function pickEndpoint(device) {
  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  const iface = device.configuration.interfaces[0];
  await device.claimInterface(iface.interfaceNumber);
  const alt = iface.alternate || iface.alternates[0];
  const out = alt.endpoints.find((e) => e.direction === 'out');
  if (!out) throw new Error('Printer has no OUT endpoint');
  return { device, endpoint: out.endpointNumber, interface: iface.interfaceNumber };
}

export async function getPairedDevice() {
  if (!isSupported()) return null;
  const devs = await navigator.usb.getDevices();
  if (devs.length === 0) return null;
  return pickEndpoint(devs[0]);
}

export async function requestDevice() {
  if (!isSupported()) throw new Error('WebUSB not supported in this browser');
  // Empty filter = show all USB devices so the user can pick anything.
  const device = await navigator.usb.requestDevice({ filters: [] });
  setEnabled(true);
  return pickEndpoint(device);
}

export async function forget() {
  setEnabled(false);
  if (!isSupported()) return;
  const devs = await navigator.usb.getDevices();
  for (const d of devs) {
    try { await d.forget(); } catch { /* old browsers lack forget() */ }
  }
}

// ── Low-level send ─────────────────────────────────────────────────
async function send(bytes) {
  const handle = await getPairedDevice();
  if (!handle) throw new Error('No printer paired');
  await handle.device.transferOut(handle.endpoint, bytes);
}

// ── Receipt templates ──────────────────────────────────────────────
const fmt = (currency, n) => `${currency} ${(parseFloat(n) || 0).toFixed(3)}`;

function buildSale(payload, currency = 'KWD') {
  const { order, change, amountTendered, location, cashier } = payload;
  const breakdown = Array.isArray(order.paymentBreakdown) ? order.paymentBreakdown : null;
  const enc = new ReceiptPrinterEncoder({ language: 'esc-pos', columns });

  enc.initialize()
    .align('center').bold(true).size('normal').line(location?.name || 'Anfal Sports').bold(false);
  if (location?.address) enc.align('center').line(location.address);
  if (location?.phone) enc.align('center').line(`Tel: ${location.phone}`);
  enc.rule();
  enc.align('left')
    .line(`Receipt: ${order.orderNumber}`)
    .line(`Date: ${new Date(order.createdAt || Date.now()).toLocaleString()}`)
    .line(`Cashier: ${cashier?.name || '—'}`);
  if (order.shippingAddress?.fullName && order.shippingAddress.fullName !== 'Walk-in') {
    enc.line(`Customer: ${order.shippingAddress.fullName}`);
  }
  enc.rule();

  const colW = Math.floor(columns * 0.65);
  for (const it of (order.items || [])) {
    const lineTotal = fmt(currency, (parseFloat(it.price) || 0) * (parseInt(it.quantity, 10) || 0));
    enc.table(
      [{ width: colW, marginRight: 1 }, { width: columns - colW - 1, align: 'right' }],
      [[it.name, lineTotal]]
    );
    enc.line(`  ${it.quantity} x ${fmt(currency, it.price)}`);
  }
  enc.rule();

  // Totals
  if (parseFloat(order.discount || 0) > 0) {
    const subtotal = (order.items || []).reduce(
      (s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.quantity, 10) || 0), 0
    );
    enc.table(
      [{ width: colW, marginRight: 1 }, { width: columns - colW - 1, align: 'right' }],
      [
        ['Subtotal', fmt(currency, subtotal)],
        [`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, `-${fmt(currency, order.discount)}`],
      ]
    );
  }
  enc.bold(true)
    .table(
      [{ width: colW, marginRight: 1 }, { width: columns - colW - 1, align: 'right' }],
      [['TOTAL', fmt(currency, order.totalAmount)]]
    )
    .bold(false);

  if (breakdown) {
    for (const tn of breakdown) {
      enc.table(
        [{ width: colW, marginRight: 1 }, { width: columns - colW - 1, align: 'right' }],
        [[`Paid (${tn.method === 'cash' ? 'Cash' : 'Card'})`, fmt(currency, tn.amount)]]
      );
    }
  } else {
    const method = order.paymentMethod === 'pos_cash' ? 'Cash' : 'Card';
    enc.table(
      [{ width: colW, marginRight: 1 }, { width: columns - colW - 1, align: 'right' }],
      [[`Paid (${method})`, fmt(currency, amountTendered ?? order.totalAmount)]]
    );
    if (change > 0) {
      enc.table(
        [{ width: colW, marginRight: 1 }, { width: columns - colW - 1, align: 'right' }],
        [['Change', fmt(currency, change)]]
      );
    }
  }

  enc.rule().align('center').line('Thank you for shopping with us!').newline().newline();
  enc.cut('partial');
  return enc.encode();
}

function buildReturn(payload, currency = 'KWD') {
  const sr = payload.salesReturn;
  const enc = new ReceiptPrinterEncoder({ language: 'esc-pos', columns });
  enc.initialize()
    .align('center').bold(true).line('RETURN RECEIPT').bold(false);
  if (sr.Location?.name) enc.line(sr.Location.name);
  if (sr.Location?.phone) enc.line(`Tel: ${sr.Location.phone}`);
  enc.rule()
    .align('left')
    .line(`Return #: ${sr.returnNumber}`)
    .line(`Original: ${payload.order?.orderNumber || ''}`)
    .line(`Date: ${new Date(sr.createdAt || Date.now()).toLocaleString()}`)
    .line(`Cashier: ${sr.processor?.name || '—'}`);
  if (sr.reason) enc.line(`Reason: ${sr.reason}`);
  enc.rule();

  const colW = Math.floor(columns * 0.65);
  for (const it of (sr.items || [])) {
    enc.table(
      [{ width: colW, marginRight: 1 }, { width: columns - colW - 1, align: 'right' }],
      [[it.name, `-${fmt(currency, it.refundAmount)}`]]
    );
    enc.line(`  ${it.quantity} x ${fmt(currency, it.price)}`);
  }
  enc.rule();
  enc.bold(true).table(
    [{ width: colW, marginRight: 1 }, { width: columns - colW - 1, align: 'right' }],
    [['REFUND TOTAL', `-${fmt(currency, sr.refundAmount)}`]]
  ).bold(false);
  const methodLabel = sr.refundMethod === 'cash' ? 'Cash'
    : sr.refundMethod === 'card' ? 'Card' : 'Store Credit';
  enc.table(
    [{ width: colW, marginRight: 1 }, { width: columns - colW - 1, align: 'right' }],
    [['Method', methodLabel]]
  );
  enc.rule();
  if (sr.refundMethod === 'cash') enc.align('center').line('Cash returned to customer');
  else if (sr.refundMethod === 'card') enc.align('center').line('Refund to original card');
  else enc.align('center').line('Store credit issued');
  enc.newline().newline().cut('partial');
  return enc.encode();
}

function buildReport(report, currency = 'KWD') {
  const enc = new ReceiptPrinterEncoder({ language: 'esc-pos', columns });
  const t = report.type === 'Z' ? 'Z-REPORT' : 'X-REPORT';
  const session = report.session || {};
  const opened = session.openedAt ? new Date(session.openedAt).toLocaleString() : '—';
  const closed = session.closedAt ? new Date(session.closedAt).toLocaleString() : '—';
  const colW = Math.floor(columns * 0.65);
  const row = (l, r) => enc.table(
    [{ width: colW, marginRight: 1 }, { width: columns - colW - 1, align: 'right' }],
    [[l, r]]
  );

  enc.initialize()
    .align('center').bold(true).line(t).bold(false);
  if (report.location?.name) enc.line(report.location.name);
  if (report.location?.phone) enc.line(`Tel: ${report.location.phone}`);
  enc.rule()
    .align('left')
    .line(`Cashier: ${report.cashier?.name || '—'}`)
    .line(`Opened: ${opened}`);
  if (report.type === 'Z') enc.line(`Closed: ${closed}`);
  enc.rule();
  row('Orders', String(report.orderCount));
  row('Cash sales', fmt(currency, report.cashSales));
  row('Card sales', fmt(currency, report.cardSales));
  if (report.cashRefunds > 0 || report.cardRefunds > 0) {
    row('Cash refunds', `-${fmt(currency, report.cashRefunds)}`);
    row('Card refunds', `-${fmt(currency, report.cardRefunds)}`);
  }
  enc.bold(true);
  row('NET SALES', fmt(currency, report.netSales));
  enc.bold(false).rule();
  row('Opening cash', fmt(currency, report.openingCash));
  row('+ Cash sales', fmt(currency, report.cashSales));
  row('- Cash refunds', fmt(currency, report.cashRefunds));
  enc.bold(true);
  row('Expected drawer', fmt(currency, report.expectedCash));
  enc.bold(false);
  if (report.type === 'Z') {
    row('Counted cash', fmt(currency, report.closingCash));
    enc.bold(true);
    const varianceStr = (report.variance >= 0 ? '+' : '') + fmt(currency, report.variance);
    row('VARIANCE', varianceStr);
    enc.bold(false);
  }
  enc.rule().align('center')
    .line(report.type === 'Z' ? '-- END OF SHIFT --' : '-- MID-SHIFT REPORT --')
    .newline().newline().cut('partial');
  return enc.encode();
}

// ── Public print entrypoints ───────────────────────────────────────
export async function testPrint() {
  const enc = new ReceiptPrinterEncoder({ language: 'esc-pos', columns });
  const bytes = enc.initialize()
    .align('center').bold(true).line('TEST PRINT').bold(false)
    .line('Anfal Sports POS')
    .line(new Date().toLocaleString())
    .rule()
    .align('left').line('Direct print is working.')
    .newline().newline().cut('partial').encode();
  await send(bytes);
}

export async function printSale(payload, currency, openDrawer = false) {
  await send(buildSale(payload, currency));
  if (openDrawer) await kickDrawer();
}

export async function printReturn(payload, currency) {
  await send(buildReturn(payload, currency));
}

export async function printReport(report, currency) {
  await send(buildReport(report, currency));
}

// Cash drawer pulse (ESC p m t1 t2) — most thermals expose drawer
// kicker as pin 2; encoder handles the byte sequence.
export async function kickDrawer() {
  const enc = new ReceiptPrinterEncoder({ language: 'esc-pos', columns });
  const bytes = enc.initialize().pulse(0, 60, 120).encode();
  await send(bytes);
}
