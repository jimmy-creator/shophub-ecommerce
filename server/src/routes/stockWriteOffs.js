/**
 * Stock write-offs and the stock movement log.
 *
 *   GET  /api/stock-write-offs                list (?from&to&locationId&reason&status)
 *   GET  /api/stock-write-offs/:id            detail
 *   POST /api/stock-write-offs                write stock off (manager PIN above threshold)
 *   POST /api/stock-write-offs/:id/cancel     admin: put the stock back, reverse the journal
 *
 *   GET  /api/stock-write-offs/movements/list  movement log (?productId&locationId&type&from&to&page)
 */
import { Router } from 'express';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import {
  StockWriteOff, StockMovement, Product, ProductStock, Location, User, JournalEntry,
  verifyManagerPin, logActivity, recomputeProductStock,
} from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { setStockContext } from '../services/stockContext.js';
import { ensureChart, loadAccountKeys, postJournal, reverseJournal, localDate } from '../services/ledger.js';

const router = Router();

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const REASONS = ['damaged', 'expired', 'lost', 'theft', 'sample', 'other'];

// Write-offs above this value need a manager PIN unless an admin posts them.
const PIN_THRESHOLD = 20;

const canInventory = (req) => req.user.role === 'admin'
  || ['inventory', 'products'].some((p) => (req.user.permissions || []).includes(p));

function requireInventory(req, res, next) {
  if (!canInventory(req)) return res.status(403).json({ message: 'Inventory permission required' });
  next();
}

const gen = (prefix) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// ─── Movement log ──────────────────────────────────────────────────
router.get('/movements/list', protect, requireInventory, async (req, res) => {
  try {
    const where = {};
    if (req.query.productId) where.productId = parseInt(req.query.productId, 10);
    if (req.query.locationId) where.locationId = parseInt(req.query.locationId, 10);
    if (req.query.type) where.type = req.query.type;
    if (isYmd(req.query.from) || isYmd(req.query.to)) {
      where.createdAt = {
        [Op.between]: [
          new Date(`${isYmd(req.query.from) ? req.query.from : '1970-01-01'}T00:00:00`),
          new Date(`${isYmd(req.query.to) ? req.query.to : '2999-12-31'}T23:59:59.999`),
        ],
      };
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const { count, rows } = await StockMovement.findAndCountAll({
      where,
      include: [
        { model: Product, attributes: ['id', 'name', 'code', 'variants'] },
        { model: Location, attributes: ['id', 'name'] },
        { model: User, attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit, offset: (page - 1) * limit,
    });
    const movements = rows.map((m) => {
      const j = m.toJSON();
      const v = j.variantIndex != null && Array.isArray(j.Product?.variants) ? j.Product.variants[j.variantIndex] : null;
      j.productName = j.Product ? `${j.Product.name}${v ? ` (${Object.values(v.options || {}).join('/')})` : ''}` : `#${j.productId}`;
      j.sku = v?.sku || j.Product?.code || null;
      j.value = r3(j.quantityChange * (parseFloat(j.unitCost) || 0));
      delete j.Product;
      return j;
    });
    res.json({ total: count, page, pages: Math.ceil(count / limit), movements });
  } catch (err) {
    console.error('[stock-movements]', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── Write-offs ────────────────────────────────────────────────────
const writeOffIncludes = [
  { model: Location, attributes: ['id', 'name', 'code'] },
  { model: User, as: 'creator', attributes: ['id', 'name'] },
  { model: User, as: 'approver', attributes: ['id', 'name'] },
];

router.get('/', protect, requireInventory, async (req, res) => {
  try {
    const where = {};
    if (isYmd(req.query.from) || isYmd(req.query.to)) {
      where.writeOffDate = { [Op.between]: [isYmd(req.query.from) ? req.query.from : '1970-01-01', isYmd(req.query.to) ? req.query.to : '2999-12-31'] };
    }
    if (req.query.locationId) where.locationId = parseInt(req.query.locationId, 10);
    if (req.query.reason) where.reason = req.query.reason;
    if (req.query.status) where.status = req.query.status;
    const rows = await StockWriteOff.findAll({
      where, include: writeOffIncludes,
      order: [['writeOffDate', 'DESC'], ['id', 'DESC']],
      limit: parseInt(req.query.limit, 10) || 300,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, requireInventory, async (req, res) => {
  try {
    const row = await StockWriteOff.findByPk(req.params.id, { include: writeOffIncludes });
    if (!row) return res.status(404).json({ message: 'Not found' });
    const journals = await JournalEntry.findAll({
      where: { sourceType: 'StockWriteOff', sourceId: row.id },
      attributes: ['id', 'entryNumber', 'date', 'kind'],
    });
    res.json({ ...row.toJSON(), journals });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, requireInventory, async (req, res) => {
  const t = await sequelize.transaction();
  const touched = new Set();
  try {
    const { locationId, reason, notes, items, managerOverride } = req.body || {};
    const loc = await Location.findByPk(locationId, { transaction: t });
    if (!loc) throw new Error('Pick a location');
    if (!REASONS.includes(reason)) throw new Error('Pick a reason');
    if (!notes?.trim() && reason === 'other') throw new Error('Explain the reason in the notes');
    const writeOffDate = isYmd(req.body.writeOffDate) ? req.body.writeOffDate : localDate();
    if (!Array.isArray(items) || !items.length) throw new Error('Add at least one item');

    // Merge repeated lines and price each one at current cost.
    const merged = new Map();
    for (const it of items) {
      const productId = parseInt(it.productId, 10);
      const variantIndex = it.variantIndex == null || it.variantIndex === '' ? null : parseInt(it.variantIndex, 10);
      const quantity = parseInt(it.quantity, 10);
      if (!productId || !(quantity > 0)) throw new Error('Every line needs a product and a quantity above zero');
      const k = `${productId}:${variantIndex ?? 'b'}`;
      if (merged.has(k)) merged.get(k).quantity += quantity;
      else merged.set(k, { productId, variantIndex, quantity });
    }
    const lines = [];
    for (const l of merged.values()) {
      const product = await Product.findByPk(l.productId, { transaction: t });
      if (!product) throw new Error(`Product #${l.productId} not found`);
      const variant = l.variantIndex != null && Array.isArray(product.variants) ? product.variants[l.variantIndex] : null;
      if (l.variantIndex != null && !variant) throw new Error(`${product.name}: variant not found`);
      const stock = await ProductStock.findOne({
        where: { productId: l.productId, variantIndex: l.variantIndex, locationId: loc.id }, transaction: t,
      });
      const name = product.name + (variant ? ` (${Object.values(variant.options || {}).join('/')})` : '');
      if (!stock || stock.quantity < l.quantity) {
        throw new Error(`${name}: only ${stock?.quantity || 0} in stock at ${loc.name}`);
      }
      const unitCost = r3(variant?.costPrice ?? product.costPrice ?? 0);
      lines.push({
        ...l, name, sku: variant?.sku || product.code || null,
        unitCost, value: r3(unitCost * l.quantity), _stock: stock,
      });
    }
    const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
    const totalValue = r3(lines.reduce((s, l) => s + l.value, 0));

    let approver = null;
    if (req.user.role !== 'admin' && totalValue > PIN_THRESHOLD) {
      if (!managerOverride?.userId || !managerOverride?.pin) {
        await t.rollback();
        return res.status(403).json({ message: `Write-offs over ${PIN_THRESHOLD} need a manager PIN`, requires: 'manager_override' });
      }
      try {
        approver = await verifyManagerPin({ userId: managerOverride.userId, pin: managerOverride.pin, transaction: t });
      } catch (err) {
        await t.rollback();
        return res.status(403).json({ message: err.message, requires: 'manager_override' });
      }
    }

    const wo = await StockWriteOff.create({
      writeOffNumber: gen('WO'),
      locationId: loc.id, reason, notes: notes?.trim() || null,
      items: lines.map(({ _stock, ...l }) => l),
      totalQty, totalValue, writeOffDate,
      createdBy: req.user.id, managerOverrideBy: approver?.id || null,
    }, { transaction: t });

    setStockContext({ type: 'write_off', refType: 'StockWriteOff', refId: wo.id, reference: wo.writeOffNumber, note: reason });
    for (const l of lines) {
      await l._stock.update({ quantity: l._stock.quantity - l.quantity }, { transaction: t });
      touched.add(l.productId);
    }

    if (totalValue > 0) {
      await ensureChart(t);
      const key = await loadAccountKeys(t);
      await postJournal({
        date: writeOffDate, kind: 'write_off',
        description: `Stock write-off ${wo.writeOffNumber} (${reason})`,
        reference: wo.writeOffNumber, sourceType: 'StockWriteOff', sourceId: wo.id,
        locationId: loc.id, createdBy: req.user.id,
        lines: [
          { accountId: key('WRITE_OFF'), debit: totalValue },
          { accountId: key('INVENTORY'), credit: totalValue },
        ],
      }, { transaction: t });
    }

    await logActivity({
      userId: req.user.id, action: 'stock_write_off', entityType: 'StockWriteOff', entityId: wo.id,
      details: { writeOffNumber: wo.writeOffNumber, reason, totalQty, totalValue },
      managerOverrideBy: approver?.id || null, locationId: loc.id, reason: notes?.trim() || reason,
      ip: req.ip, transaction: t,
    });

    await t.commit();
    for (const pid of touched) await recomputeProductStock(pid);
    res.status(201).json(await StockWriteOff.findByPk(wo.id, { include: writeOffIncludes }));
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    console.error('[stock-write-offs/create]', err.message);
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/cancel', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const t = await sequelize.transaction();
  const touched = new Set();
  try {
    const wo = await StockWriteOff.findByPk(req.params.id, { transaction: t });
    if (!wo) throw new Error('Write-off not found');
    if (wo.status !== 'posted') throw new Error('Already cancelled');

    setStockContext({ type: 'write_off_cancel', refType: 'StockWriteOff', refId: wo.id, reference: wo.writeOffNumber });
    for (const it of wo.items || []) {
      const row = await ProductStock.findOne({
        where: { productId: it.productId, variantIndex: it.variantIndex ?? null, locationId: wo.locationId }, transaction: t,
      });
      if (row) await row.update({ quantity: row.quantity + it.quantity }, { transaction: t });
      else await ProductStock.create({ productId: it.productId, variantIndex: it.variantIndex ?? null, locationId: wo.locationId, quantity: it.quantity }, { transaction: t });
      touched.add(it.productId);
    }

    const entry = await JournalEntry.findOne({
      where: { sourceType: 'StockWriteOff', sourceId: wo.id, reversalOfId: null, reversedById: null }, transaction: t,
    });
    if (entry) {
      await reverseJournal(entry.id, { createdBy: req.user.id, description: `Cancelled write-off ${wo.writeOffNumber}` }, { transaction: t });
    } else if (parseFloat(wo.totalValue) > 0) {
      // Written off before accounting started — post the stock back in full.
      await ensureChart(t);
      const key = await loadAccountKeys(t);
      await postJournal({
        kind: 'reversal', description: `Cancelled write-off ${wo.writeOffNumber}`,
        reference: wo.writeOffNumber, sourceType: 'StockWriteOff', sourceId: wo.id,
        locationId: wo.locationId, createdBy: req.user.id,
        lines: [
          { accountId: key('INVENTORY'), debit: parseFloat(wo.totalValue) },
          { accountId: key('WRITE_OFF'), credit: parseFloat(wo.totalValue) },
        ],
      }, { transaction: t });
    }

    await wo.update({ status: 'cancelled', cancelledBy: req.user.id, cancelledAt: new Date() }, { transaction: t });
    await logActivity({
      userId: req.user.id, action: 'stock_write_off_cancel', entityType: 'StockWriteOff', entityId: wo.id,
      details: { writeOffNumber: wo.writeOffNumber }, locationId: wo.locationId, ip: req.ip, transaction: t,
    });
    await t.commit();
    for (const pid of touched) await recomputeProductStock(pid);
    res.json({ ok: true });
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(400).json({ message: err.message });
  }
});

export default router;
