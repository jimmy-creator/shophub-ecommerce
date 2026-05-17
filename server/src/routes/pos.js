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
  Product, ProductStock, Order, CashierSession, Location, CashAccount, User, Coupon,
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

// ─── Coupon validation ────────────────────────────────────────────
// Re-validates a code against current cart state. Returns the
// computed discount but does NOT increment usedCount — that happens
// when the sale commits.
async function validateCoupon({ code, subtotal, items, userId, transaction = null }) {
  if (!code) return { coupon: null, discount: 0 };
  const coupon = await Coupon.findOne({
    where: { code: code.toUpperCase().trim(), active: true },
    transaction,
  });
  if (!coupon) throw new Error('Invalid coupon code');
  const now = new Date();
  if (coupon.startDate && now < new Date(coupon.startDate)) throw new Error('Coupon not active yet');
  if (coupon.endDate && now > new Date(coupon.endDate)) throw new Error('Coupon has expired');
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new Error('Coupon usage limit reached');
  if (subtotal < parseFloat(coupon.minOrderAmount || 0)) {
    throw new Error(`Minimum order ${parseFloat(coupon.minOrderAmount).toFixed(3)} required`);
  }
  if (userId && coupon.perUserLimit) {
    const used = await Order.count({ where: { userId, couponCode: coupon.code }, transaction });
    if (used >= coupon.perUserLimit) throw new Error('Customer has already used this coupon');
  }
  if (coupon.applicableCategories?.length && items?.length) {
    const cats = [...new Set(items.map((i) => i.category).filter(Boolean))];
    if (!cats.some((c) => coupon.applicableCategories.includes(c))) {
      throw new Error(`Coupon valid only for: ${coupon.applicableCategories.join(', ')}`);
    }
  }
  if (coupon.applicableProducts?.length && items?.length) {
    const pids = items.map((i) => i.productId);
    if (!pids.some((id) => coupon.applicableProducts.includes(id))) {
      throw new Error('Coupon not valid for the items in this cart');
    }
  }
  let discount = 0;
  if (coupon.type === 'percentage') {
    discount = (subtotal * parseFloat(coupon.value)) / 100;
    if (coupon.maxDiscount) discount = Math.min(discount, parseFloat(coupon.maxDiscount));
  } else {
    discount = parseFloat(coupon.value);
  }
  discount = Math.min(discount, subtotal);
  discount = +discount.toFixed(3);
  return { coupon, discount };
}

router.post('/preview-coupon', protectCashier, async (req, res) => {
  try {
    const { code, items = [], userId } = req.body || {};
    if (!code) return res.status(400).json({ message: 'Coupon code required' });
    const subtotal = items.reduce((s, l) => s + (parseFloat(l.price) || 0) * (parseInt(l.quantity, 10) || 0), 0);
    const { coupon, discount } = await validateCoupon({ code, subtotal, items, userId });
    res.json({
      code: coupon.code,
      type: coupon.type,
      value: parseFloat(coupon.value),
      description: coupon.description,
      discount,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ─── Customer picker (POS) ─────────────────────────────────────────
// Search by phone (digit substring) or name. Cashier types into the
// picker and gets up to 8 matches.
router.get('/customers', protectCashier, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.json([]);
    const digits = q.replace(/\D/g, '');
    const where = { role: 'customer' };
    const ors = [{ name: { [Op.like]: `%${q}%` } }];
    if (digits.length >= 3) ors.push({ phone: { [Op.like]: `%${digits}%` } });
    ors.push({ email: { [Op.like]: `%${q}%` } });
    where[Op.or] = ors;
    const rows = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'phone'],
      limit: 8,
      order: [['name', 'ASC']],
    });
    res.json(rows);
  } catch (err) {
    console.error('[pos/customers]', err);
    res.status(500).json({ message: err.message });
  }
});

// Create a phone-only POS customer.
router.post('/customers', protectCashier, async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const phone = (req.body.phone || '').trim();
    const email = (req.body.email || '').trim().toLowerCase() || null;
    if (!name) return res.status(400).json({ message: 'Name required' });
    if (!phone && !email) return res.status(400).json({ message: 'Phone or email required' });

    // If a customer with this phone already exists, return them rather
    // than creating a duplicate.
    if (phone) {
      const existing = await User.findOne({ where: { role: 'customer', phone } });
      if (existing) return res.json({ ...existing.toJSON(), _existing: true });
    }
    if (email) {
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        if (existing.role !== 'customer') return res.status(400).json({ message: 'Email is registered to a staff account' });
        return res.json({ ...existing.toJSON(), _existing: true });
      }
    }

    const user = await User.create({
      name, phone: phone || null, email,
      role: 'customer',
    });
    res.status(201).json(user.toJSON());
  } catch (err) {
    console.error('[pos/customers/create]', err);
    res.status(400).json({ message: err.message });
  }
});

// ─── Create a sale ─────────────────────────────────────────────────
router.post('/sale', protectCashier, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { items, customer, payment, userId, couponCode, manualDiscount } = req.body || {};
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

    // Resolve linked customer first so the coupon's per-user limit
    // check can see it.
    let linkedUser = null;
    if (userId) {
      linkedUser = await User.findByPk(parseInt(userId, 10), { transaction: t });
      if (!linkedUser || linkedUser.role !== 'customer') {
        throw new Error('Invalid customer');
      }
    }

    // Apply discounts. Manual discount applies to the cart subtotal,
    // then the coupon applies to (subtotal − manual). Final total is
    // capped at 0 in case both stack heavily.
    let manualOff = 0;
    if (manualDiscount && parseFloat(manualDiscount.value) > 0) {
      const v = parseFloat(manualDiscount.value);
      manualOff = manualDiscount.kind === 'percentage'
        ? (subTotal * v) / 100
        : v;
      manualOff = Math.min(manualOff, subTotal);
    }
    let couponOff = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const result = await validateCoupon({
        code: couponCode,
        subtotal: +Math.max(0, subTotal - manualOff).toFixed(3),
        items: orderItems,
        userId: linkedUser?.id,
        transaction: t,
      });
      couponOff = result.discount;
      appliedCoupon = result.coupon;
    }
    const totalDiscount = +(manualOff + couponOff).toFixed(3);
    const totalAmount = +(Math.max(0, subTotal - totalDiscount)).toFixed(3);

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
      userId: linkedUser?.id || null,
      guestEmail: linkedUser ? null : (customer?.email?.toLowerCase()?.trim() || null),
      items: orderItems,
      totalAmount,
      shippingAddress: {
        fullName: linkedUser?.name || customer?.name || 'Walk-in',
        phone: linkedUser?.phone || customer?.phone || '',
        notes: [
          'In-store sale (POS)',
          manualDiscount?.reason ? `Discount reason: ${manualDiscount.reason}` : null,
        ].filter(Boolean).join(' · '),
      },
      paymentMethod,
      paymentStatus: 'paid',
      orderStatus: 'delivered',
      locationId: req.cashierLocationId,
      cashierSessionId: req.cashierSessionId,
      shippingCharge: 0,
      discount: totalDiscount,
      couponCode: appliedCoupon?.code || null,
      taxAmount: 0,
    }, { transaction: t });

    if (appliedCoupon) {
      await appliedCoupon.increment('usedCount', { transaction: t });
    }

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
