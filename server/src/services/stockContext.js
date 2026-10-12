/**
 * Request context for the stock-movement log.
 *
 * The ProductStock hooks (models/index.js) record every quantity change,
 * but a hook only sees the row — not which screen or document caused it.
 * This middleware keeps the current request in AsyncLocalStorage so the
 * hook can read the user and classify the movement from the URL
 * (e.g. POST /api/pos/sale → 'sale'). Code that knows better (the
 * write-off route) calls setStockContext() to name the type and document
 * explicitly.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage();

export function stockContextMiddleware(req, res, next) {
  als.run({ req }, next);
}

// Override the type/reference for stock changes made later in this request.
export function setStockContext(fields) {
  const store = als.getStore();
  if (store) Object.assign(store, fields);
}

// URL → movement type, plus the document id when it is in the path.
const ROUTES = [
  [/^\/api\/pos\/sale\b/, 'sale'],
  [/^\/api\/pos\/sales\/(\d+)\/void/, 'void', 'Order'],
  [/^\/api\/pos\/sales\/(\d+)\/append/, 'sale', 'Order'],
  [/^\/api\/returns\/(\d+)\/cancel/, 'return_cancel', 'SalesReturn'],
  [/^\/api\/returns\b/, 'return'],
  [/^\/api\/purchase-orders\/(\d+)\/receive/, 'receipt', 'PurchaseOrder'],
  [/^\/api\/purchase-returns\/(\d+)\/cancel/, 'purchase_return_cancel', 'PurchaseReturn'],
  [/^\/api\/purchase-returns\b/, 'purchase_return'],
  [/^\/api\/stock-transfers\/(\d+)\/dispatch/, 'transfer_out', 'StockTransfer'],
  [/^\/api\/stock-transfers\/(\d+)\/complete/, 'transfer_in', 'StockTransfer'],
  [/^\/api\/stock-transfers\/(\d+)\/cancel/, 'transfer_cancel', 'StockTransfer'],
  [/^\/api\/stock-transfers\b/, 'transfer_out'],
  [/^\/api\/stock-counts\/(\d+)\/post/, 'count', 'StockCount'],
  [/^\/api\/inventory\b/, 'adjust'],
  [/^\/api\/bulk-products\b/, 'import'],
  [/^\/api\/(payment|orders|shiprocket)\b/, 'sale_online'],
];

export function getStockContext() {
  const store = als.getStore();
  if (!store) return { type: 'other', userId: null };
  const req = store.req;
  let type = store.type;
  let refType = store.refType ?? null;
  let refId = store.refId ?? null;
  if (!type && req) {
    const url = req.originalUrl || '';
    for (const [re, t, rt] of ROUTES) {
      const m = url.match(re);
      if (!m) continue;
      type = t;
      if (rt && m[1] && refId == null) { refType = rt; refId = parseInt(m[1], 10); }
      break;
    }
  }
  return {
    type: type || 'other',
    refType,
    refId,
    reference: store.reference ?? null,
    note: store.note ?? null,
    userId: req?.user?.id ?? null,
  };
}
