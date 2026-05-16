/**
 * POS endpoints — used by the in-store sales terminal.
 *
 * All endpoints require an open cashier shift (protectCashier middleware
 * attaches req.cashierSessionId + req.cashierLocationId).
 *
 *   GET   /api/pos/products?q=…    barcode/text search, includes per-location stock
 *   POST  /api/pos/sale            create an in-store Order, decrement stock at
 *                                  this location, return the Order for receipt
 *                                  printing
 *   GET   /api/pos/shift-summary   running totals for the current shift
 *                                  (used by the close-shift screen + Z-report)
 */
import { Router } from 'express';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import {
  Product, ProductStock, Order, CashierSession, Location, CashAccount,
  recomputeProductStock, writeCashTxn,
} from '../models/index.js';
import { protectCashier } from '../middleware/auth.js';

const router = Router();

function genOrderNumber() {
  return `POS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

// ─── Search products for the cart panel ────────────────────────────
// Optimised for a barcode-scanner workflow: tries an exact code/SKU
// match first, then a "starts with" name match, capped at 15 results.
router.get('/products', protectCashier, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.json([]);

    // 1. Exact code match (barcode scanned)
    const exact = await Product.findAll({
      where: { active: true, code: q },
      limit: 5,
    });

    // 2. Variant-SKU match — Product.variants is JSON, can't index easily,
    //    so we fetch a small slice and filter in JS. For larger catalogues
    //    consider splitting variants into their own table.
    let variantHits = [];
    if (exact.length === 0) {
      const candidates = await Product.findAll({
        where: { active: true, variants: { [Op.ne]: null } },
        attributes: ['id', 'name', 'code', 'price', 'images', 'variants'],
        limit: 500,
      });
      for (const p of candidates) {
        if (!Array.isArray(p.variants)) continue;
        const idx = p.variants.findIndex((v) => v.sku === q);
        if (idx >= 0) variantHits.push({ product: p, variantIndex: idx });
      }
    }

    // 3. Name search — fuzzy
    const nameHits = (exact.length === 0 && variantHits.length === 0)
      ? await Product.findAll({
          where: {
            active: true,
            [Op.or]: [
              { name: { [Op.like]: `%${q}%` } },
              { code: { [Op.like]: `${q}%` } },
            ],
          },
          limit: 15,
          order: [['name', 'ASC']],
        })
      : [];

    // Stitch results into a single uniform shape and attach per-location stock.
    const candidates = [
      ...exact.map((p) => ({ product: p, variantIndex: null })),
      ...variantHits,
      ...nameHits.map((p) => ({ product: p, variantIndex: null })),
    ];
    if (candidates.length === 0) return res.json([]);

    const productIds = [...new Set(candidates.map((c) => c.product.id))];
    const stocks = await ProductStock.findAll({
      where: { productId: { [Op.in]: productIds }, locationId: req.cashierLocationId },
    });
    const stockKey = (pid, vIdx) => `${pid}:${vIdx ?? 'b'}`;
    const stockMap = new Map(stocks.map((s) => [stockKey(s.productId, s.variantIndex), s.quantity]));

    const results = candidates.map(({ product, variantIndex }) => {
      const obj = product.toJSON();
      const v = variantIndex != null && Array.isArray(obj.variants) ? obj.variants[variantIndex] : null;
      const hasVariants = Array.isArray(obj.variants) && obj.variants.length > 0 && variantIndex == null;
      // Enrich each variant with per-location stock so the client's variant
      // picker can show stock and avoid an extra fetch on selection.
      const variantsWithStock = hasVariants
        ? obj.variants.map((vr, idx) => ({
            ...vr,
            stockAtLocation: stockMap.get(stockKey(obj.id, idx)) || 0,
          }))
        : undefined;
      return {
        productId: obj.id,
        name: obj.name + (v ? ` (${Object.values(v.options || {}).join('/')})` : ''),
        code: v?.sku || obj.code || null,
        price: parseFloat(v?.price ?? obj.price) || 0,
        variantIndex,
        variantOptions: v?.options || null,
        image: obj.images?.[0] || null,
        stockAtLocation: stockMap.get(stockKey(obj.id, variantIndex)) || 0,
        hasVariants,
        variants: variantsWithStock,
      };
    });

    res.json(results);
  } catch (err) {
    console.error('[pos/products]', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── Create a sale ─────────────────────────────────────────────────
router.post('/sale', protectCashier, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { items, customer, payment } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'No items in sale' });
    }
    if (!payment?.method || !['cash', 'card'].includes(payment.method)) {
      await t.rollback();
      return res.status(400).json({ message: 'payment.method must be cash or card' });
    }

    // Validate shift is still open.
    const session = await CashierSession.findByPk(req.cashierSessionId, { transaction: t });
    if (!session || session.status !== 'open') {
      await t.rollback();
      return res.status(403).json({ message: 'Shift is not open' });
    }

    // Resolve each cart line against the product + per-location stock.
    const productIds = [...new Set(items.map((i) => parseInt(i.productId, 10)).filter(Boolean))];
    const products = await Product.findAll({
      where: { id: { [Op.in]: productIds } },
      transaction: t,
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const orderItems = [];
    const stockDecrements = [];   // [{stockRow, qty}]
    let subTotal = 0;

    for (const it of items) {
      const productId = parseInt(it.productId, 10);
      const product = productMap.get(productId);
      if (!product) throw new Error(`Product ${productId} not found`);

      const vIdx = it.variantIndex == null || it.variantIndex === '' ? null : parseInt(it.variantIndex, 10);
      const variant = vIdx != null && Array.isArray(product.variants) ? product.variants[vIdx] : null;
      const qty = parseInt(it.quantity, 10);
      if (!qty || qty < 1) throw new Error(`Invalid quantity for ${product.name}`);

      const stock = await ProductStock.findOne({
        where: { productId, variantIndex: vIdx, locationId: req.cashierLocationId },
        transaction: t,
      });
      const have = stock?.quantity || 0;
      if (have < qty) {
        throw new Error(`Not enough stock for ${product.name} — have ${have}, need ${qty}`);
      }
      stockDecrements.push({ stockRow: stock, qty });

      const unitPrice = parseFloat(variant?.price ?? product.price) || 0;
      const unitCost = parseFloat(variant?.costPrice ?? product.costPrice ?? 0) || 0;
      subTotal += unitPrice * qty;
      orderItems.push({
        productId,
        name: product.name + (variant ? ` (${Object.values(variant.options || {}).join('/')})` : ''),
        category: product.category,
        price: unitPrice,
        costPrice: unitCost,                 // snapshot for COGS
        quantity: qty,
        image: product.images?.[0] || null,
        variant: variant ? { ...variant.options, sku: variant.sku } : null,
        taxable: product.taxable || false,
        taxRate: product.taxable ? parseFloat(product.taxRate || 0) : 0,
        hsnCode: product.hsnCode || null,
      });
    }

    const totalAmount = +subTotal.toFixed(3);
    const orderNumber = genOrderNumber();
    const paymentMethod = payment.method === 'cash' ? 'pos_cash' : 'pos_card';
    const amountTendered = payment.amountTendered != null ? parseFloat(payment.amountTendered) : totalAmount;
    const change = +(amountTendered - totalAmount).toFixed(3);

    if (paymentMethod === 'pos_cash' && change < 0) {
      throw new Error('Amount tendered is less than total');
    }

    // Decrement stock at this location.
    for (const { stockRow, qty } of stockDecrements) {
      await stockRow.update({ quantity: stockRow.quantity - qty }, { transaction: t });
    }

    const order = await Order.create({
      orderNumber,
      userId: null,
      guestEmail: customer?.email?.toLowerCase()?.trim() || null,
      items: orderItems,
      totalAmount,
      shippingAddress: {
        fullName: customer?.name || 'Walk-in',
        phone: customer?.phone || '',
        notes: 'In-store sale (POS)',
      },
      paymentMethod,
      paymentStatus: 'paid',
      orderStatus: 'delivered',
      locationId: req.cashierLocationId,
      cashierSessionId: req.cashierSessionId,
      shippingCharge: 0,
      discount: 0,
      taxAmount: 0,
    }, { transaction: t });

    // Write a CashTransaction against this location's drawer (cash) or
    // card-terminal account, so finance balances reconcile. Missing
    // account is non-fatal — POS keeps working, the sale just doesn't
    // hit the ledger until the account is created.
    const acctType = paymentMethod === 'pos_cash' ? 'drawer' : 'card_terminal';
    const acct = await CashAccount.findOne({
      where: { locationId: req.cashierLocationId, type: acctType, active: true },
      transaction: t,
    });
    if (acct) {
      await writeCashTxn({
        cashAccountId: acct.id,
        amount: totalAmount,
        source: 'sale',
        sourceType: 'Order',
        sourceId: order.id,
        reference: order.orderNumber,
        description: `POS sale (${paymentMethod === 'pos_cash' ? 'cash' : 'card'})`,
        date: order.createdAt,
        createdBy: req.user.id,
        transaction: t,
      });
    }

    await t.commit();

    // Recompute Product.stock for each affected product (outside the txn).
    for (const pid of productIds) await recomputeProductStock(pid);

    const location = await Location.findByPk(req.cashierLocationId, {
      attributes: ['id', 'name', 'code', 'address', 'phone'],
    });

    res.status(201).json({
      order: order.toJSON(),
      change,
      amountTendered,
      location,
      cashier: { id: req.user.id, name: req.user.name },
    });
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    console.error('[pos/sale]', err);
    res.status(400).json({ message: err.message });
  }
});

// ─── Running totals for the current shift ──────────────────────────
router.get('/shift-summary', protectCashier, async (req, res) => {
  try {
    const session = await CashierSession.findByPk(req.cashierSessionId);
    if (!session) return res.status(404).json({ message: 'Shift not found' });

    const orders = await Order.findAll({
      where: { cashierSessionId: session.id },
      attributes: ['id', 'orderNumber', 'totalAmount', 'paymentMethod', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    const summary = orders.reduce((s, o) => {
      const amt = parseFloat(o.totalAmount || 0);
      s.totalSales += amt;
      s.orderCount += 1;
      if (o.paymentMethod === 'pos_cash') s.cashSales += amt;
      else if (o.paymentMethod === 'pos_card') s.cardSales += amt;
      return s;
    }, { totalSales: 0, cashSales: 0, cardSales: 0, orderCount: 0 });

    summary.openingCash = parseFloat(session.openingCash) || 0;
    summary.expectedCash = summary.openingCash + summary.cashSales;
    res.json({ session, summary, recentOrders: orders.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
