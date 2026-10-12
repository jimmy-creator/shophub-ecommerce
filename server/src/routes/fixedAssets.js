/**
 * Fixed-asset register, monthly straight-line depreciation and disposal.
 *
 *   GET    /api/fixed-assets                     register with book values
 *   GET    /api/fixed-assets/accounts            fixed-asset GL accounts (for the form)
 *   GET    /api/fixed-assets/depreciation        posted runs, by month
 *   POST   /api/fixed-assets/depreciation        run up to a month (?preview=true to dry-run)
 *   GET    /api/fixed-assets/:id                 one asset + schedule
 *   POST   /api/fixed-assets                     register (and post the purchase)
 *   PUT    /api/fixed-assets/:id                 edit details (cost/life only before any depreciation)
 *   DELETE /api/fixed-assets/:id                 remove a mistaken entry (no depreciation yet)
 *   POST   /api/fixed-assets/:id/dispose         sell / scrap
 */
import { Router } from 'express';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import {
  FixedAsset, AssetDepreciation, Account, Location, CashAccount, JournalEntry, writeCashTxn,
} from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { ensureChart, loadAccountKeys, postJournal, reverseJournal, localDate } from '../services/ledger.js';

const router = Router();

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isPeriod = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const canFinance = (req) => req.user.role === 'admin' || (req.user.permissions || []).includes('finance');
function requireFinance(req, res, next) {
  if (!canFinance(req)) return res.status(403).json({ message: 'Finance permission required' });
  next();
}

const gen = (prefix) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// 'YYYY-MM' helpers
const periodOf = (ymd) => ymd.slice(0, 7);
function addMonths(period, n) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
function lastDay(period) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
function firstOfNextMonth(ymd) {
  return `${addMonths(periodOf(ymd), 1)}-01`;
}

const depreciable = (a) => r3(parseFloat(a.cost) - (parseFloat(a.salvageValue) || 0));
const monthlyCharge = (a) => r3(depreciable(a) / a.usefulLifeMonths);

// Book figures for an asset given its posted depreciation total.
function figures(a, postedDep) {
  const accumulated = r3((parseFloat(a.openingAccumulatedDep) || 0) + postedDep);
  return {
    accumulated,
    bookValue: r3(parseFloat(a.cost) - accumulated),
    remaining: r3(Math.max(0, depreciable(a) - accumulated)),
    monthly: monthlyCharge(a),
  };
}

async function postedTotals(ids, transaction) {
  if (!ids.length) return new Map();
  const rows = await AssetDepreciation.findAll({
    where: { fixedAssetId: ids },
    attributes: ['fixedAssetId', [sequelize.fn('SUM', sequelize.col('amount')), 'total'], [sequelize.fn('MAX', sequelize.col('period')), 'lastPeriod']],
    group: ['fixedAssetId'], raw: true, transaction,
  });
  return new Map(rows.map((r) => [r.fixedAssetId, { total: r3(r.total), lastPeriod: r.lastPeriod }]));
}

// ─── Register ──────────────────────────────────────────────────────
router.get('/', protect, requireFinance, async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    const assets = await FixedAsset.findAll({
      where,
      include: [
        { model: Account, as: 'assetAccount', attributes: ['id', 'code', 'name'] },
        { model: Location, attributes: ['id', 'name'] },
      ],
      order: [['acquisitionDate', 'DESC'], ['id', 'DESC']],
    });
    const totals = await postedTotals(assets.map((a) => a.id));
    res.json(assets.map((a) => {
      const p = totals.get(a.id) || { total: 0, lastPeriod: null };
      return { ...a.toJSON(), ...figures(a, p.total), lastDepreciatedPeriod: p.lastPeriod };
    }));
  } catch (err) {
    console.error('[fixed-assets]', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/accounts', protect, requireFinance, async (req, res) => {
  try {
    await ensureChart();
    const group = await Account.findOne({ where: { systemKey: 'GRP_FIXED' } });
    if (!group) return res.json([]);
    const rows = await Account.findAll({
      where: { parentId: group.id, isGroup: false, active: true, systemKey: { [Op.or]: [null, { [Op.ne]: 'ACCUM_DEP' }] } },
      attributes: ['id', 'code', 'name'], order: [['code', 'ASC']],
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Depreciation ──────────────────────────────────────────────────
router.get('/depreciation', protect, requireFinance, async (req, res) => {
  try {
    const rows = await AssetDepreciation.findAll({
      attributes: ['period', [sequelize.fn('SUM', sequelize.col('amount')), 'total'], [sequelize.fn('COUNT', sequelize.col('id')), 'assets'], [sequelize.fn('MAX', sequelize.col('journalEntryId')), 'journalEntryId']],
      group: ['period'], order: [['period', 'DESC']], raw: true,
    });
    const ids = rows.map((r) => r.journalEntryId).filter(Boolean);
    const entries = ids.length ? await JournalEntry.findAll({ where: { id: ids }, attributes: ['id', 'entryNumber'] }) : [];
    const num = new Map(entries.map((e) => [e.id, e.entryNumber]));
    res.json(rows.map((r) => ({ period: r.period, total: r3(r.total), assets: parseInt(r.assets, 10), entryNumber: num.get(r.journalEntryId) || null })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Work out every missing month of depreciation up to `upto` (inclusive),
 * per asset, without posting anything. Months already posted are skipped,
 * so repeating a run is harmless.
 */
async function planDepreciation(upto, transaction) {
  const assets = await FixedAsset.findAll({ where: { status: 'active' }, transaction });
  const totals = await postedTotals(assets.map((a) => a.id), transaction);
  const done = await AssetDepreciation.findAll({ where: { fixedAssetId: assets.map((a) => a.id) }, attributes: ['fixedAssetId', 'period'], transaction });
  const donePeriods = new Set(done.map((d) => `${d.fixedAssetId}:${d.period}`));
  const byPeriod = new Map();
  for (const a of assets) {
    let remaining = figures(a, totals.get(a.id)?.total || 0).remaining;
    const monthly = monthlyCharge(a);
    for (let p = periodOf(a.depreciationStartDate); p <= upto && remaining > 0; p = addMonths(p, 1)) {
      if (donePeriods.has(`${a.id}:${p}`)) continue;
      const amount = r3(Math.min(monthly, remaining));
      remaining = r3(remaining - amount);
      if (!byPeriod.has(p)) byPeriod.set(p, []);
      byPeriod.get(p).push({ asset: a, amount });
    }
  }
  return [...byPeriod.entries()].sort(([x], [y]) => x.localeCompare(y));
}

router.post('/depreciation', protect, requireFinance, async (req, res) => {
  const upto = isPeriod(req.body?.upto) ? req.body.upto : null;
  if (!upto) return res.status(400).json({ message: 'Pick the month to depreciate up to' });
  // A month's charge is dated its last day, so only finished months can run.
  if (upto >= periodOf(localDate())) return res.status(400).json({ message: 'Only finished months can be depreciated' });
  const preview = req.query.preview === 'true';
  const t = await sequelize.transaction();
  try {
    const plan = await planDepreciation(upto, t);
    const summary = plan.map(([period, items]) => ({
      period,
      total: r3(items.reduce((s, i) => s + i.amount, 0)),
      assets: items.map((i) => ({ id: i.asset.id, name: i.asset.name, amount: i.amount })),
    }));
    if (preview) {
      await t.rollback();
      return res.json({ preview: true, periods: summary });
    }
    if (!plan.length) {
      await t.rollback();
      return res.json({ periods: [], message: 'Nothing to depreciate' });
    }
    await ensureChart(t);
    const key = await loadAccountKeys(t);
    for (const [period, items] of plan) {
      const total = r3(items.reduce((s, i) => s + i.amount, 0));
      const entry = await postJournal({
        date: lastDay(period), kind: 'depreciation',
        description: `Depreciation ${period}`, reference: `DEP-${period}`,
        sourceType: 'Depreciation', createdBy: req.user.id,
        lines: [
          ...items.map((i) => ({ accountId: key('DEPRECIATION'), debit: i.amount, description: i.asset.name, locationId: i.asset.locationId })),
          { accountId: key('ACCUM_DEP'), credit: total },
        ],
      }, { transaction: t });
      await AssetDepreciation.bulkCreate(items.map((i) => ({
        fixedAssetId: i.asset.id, period, amount: i.amount, journalEntryId: entry?.id || null,
      })), { transaction: t });
    }
    await t.commit();
    res.status(201).json({ periods: summary });
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    console.error('[fixed-assets/depreciation]', err);
    res.status(400).json({ message: err.name === 'SequelizeUniqueConstraintError' ? 'That month was just depreciated — refresh and try again' : err.message });
  }
});

// ─── One asset ─────────────────────────────────────────────────────
router.get('/:id', protect, requireFinance, async (req, res) => {
  try {
    const a = await FixedAsset.findByPk(req.params.id, {
      include: [
        { model: Account, as: 'assetAccount', attributes: ['id', 'code', 'name'] },
        { model: Location, attributes: ['id', 'name'] },
        { model: AssetDepreciation, as: 'depreciations' },
      ],
      order: [[{ model: AssetDepreciation, as: 'depreciations' }, 'period', 'ASC']],
    });
    if (!a) return res.status(404).json({ message: 'Not found' });
    const posted = r3((a.depreciations || []).reduce((s, d) => s + parseFloat(d.amount), 0));
    const f = figures(a, posted);
    // Projected schedule for the months still to come.
    const schedule = [];
    if (a.status === 'active') {
      let remaining = f.remaining;
      const last = a.depreciations?.length ? a.depreciations[a.depreciations.length - 1].period : null;
      let p = last ? addMonths(last, 1) : periodOf(a.depreciationStartDate);
      let book = f.bookValue;
      while (remaining > 0 && schedule.length < 600) {
        const amount = r3(Math.min(f.monthly, remaining));
        remaining = r3(remaining - amount);
        book = r3(book - amount);
        schedule.push({ period: p, amount, bookValue: book });
        p = addMonths(p, 1);
      }
    }
    const journals = await JournalEntry.findAll({
      where: { sourceType: ['FixedAsset', 'FixedAssetDisposal'], sourceId: a.id },
      attributes: ['id', 'entryNumber', 'date', 'kind', 'description'], order: [['id', 'ASC']],
    });
    res.json({ ...a.toJSON(), ...f, schedule, journals });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function assetFields(body) {
  return {
    name: body.name?.trim(),
    description: body.description?.trim() || null,
    serialNumber: body.serialNumber?.trim() || null,
    supplier: body.supplier?.trim() || null,
    locationId: body.locationId ? parseInt(body.locationId, 10) : null,
  };
}

router.post('/', protect, requireFinance, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const b = req.body || {};
    const fields = assetFields(b);
    if (!fields.name) throw new Error('Name is required');
    const cost = r3(b.cost);
    const salvageValue = r3(b.salvageValue);
    const usefulLifeMonths = parseInt(b.usefulLifeMonths, 10);
    if (!(cost > 0)) throw new Error('Cost must be more than zero');
    if (salvageValue < 0 || salvageValue >= cost) throw new Error('Salvage value must be less than the cost');
    if (!(usefulLifeMonths > 0)) throw new Error('Useful life (months) is required');
    if (!isYmd(b.acquisitionDate)) throw new Error('Acquisition date is required');
    const method = ['cash', 'payable', 'opening'].includes(b.acquisitionMethod) ? b.acquisitionMethod : 'cash';
    const assetAccount = await Account.findByPk(b.assetAccountId, { transaction: t });
    if (!assetAccount || assetAccount.type !== 'asset' || assetAccount.isGroup) throw new Error('Pick the fixed-asset account');
    let cashAccount = null;
    if (method === 'cash') {
      cashAccount = await CashAccount.findByPk(b.cashAccountId, { transaction: t });
      if (!cashAccount || !cashAccount.active) throw new Error('Pick the account it was paid from');
    }
    const openingAccumulatedDep = method === 'opening' ? r3(b.openingAccumulatedDep) : 0;
    if (openingAccumulatedDep < 0 || openingAccumulatedDep > cost - salvageValue) throw new Error('Depreciation to date cannot exceed cost less salvage value');
    const depreciationStartDate = isYmd(b.depreciationStartDate) ? b.depreciationStartDate : firstOfNextMonth(b.acquisitionDate);

    const asset = await FixedAsset.create({
      ...fields, assetNumber: gen('FA'),
      assetAccountId: assetAccount.id,
      acquisitionDate: b.acquisitionDate, cost, salvageValue, usefulLifeMonths,
      depreciationStartDate, acquisitionMethod: method,
      cashAccountId: cashAccount?.id || null, openingAccumulatedDep,
      createdBy: req.user.id,
    }, { transaction: t });

    await ensureChart(t);
    const key = await loadAccountKeys(t);
    let credit;
    if (method === 'cash') {
      await writeCashTxn({
        cashAccountId: cashAccount.id, amount: -cost, source: 'other',
        sourceType: 'FixedAsset', sourceId: asset.id, reference: asset.assetNumber,
        description: `Fixed asset: ${asset.name}`, date: new Date(`${b.acquisitionDate}T12:00:00`),
        createdBy: req.user.id, transaction: t,
      });
      credit = [{ accountId: key(`cash:${cashAccount.id}`), credit: cost }];
    } else if (method === 'payable') {
      credit = [{ accountId: key('OTHER_PAYABLES'), credit: cost, description: fields.supplier || null }];
    } else {
      credit = [
        ...(openingAccumulatedDep ? [{ accountId: key('ACCUM_DEP'), credit: openingAccumulatedDep, description: 'Depreciation before registration' }] : []),
        { accountId: key('OPENING'), credit: r3(cost - openingAccumulatedDep) },
      ];
    }
    await postJournal({
      date: b.acquisitionDate, kind: 'asset', description: `Fixed asset purchased: ${asset.name}`,
      reference: asset.assetNumber, sourceType: 'FixedAsset', sourceId: asset.id,
      locationId: asset.locationId, createdBy: req.user.id,
      lines: [{ accountId: assetAccount.id, debit: cost }, ...credit],
    }, { transaction: t });

    await t.commit();
    res.status(201).json(asset);
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, requireFinance, async (req, res) => {
  try {
    const asset = await FixedAsset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Not found' });
    const fields = assetFields(req.body || {});
    if (!fields.name) return res.status(400).json({ message: 'Name is required' });
    const update = { ...fields };
    // Life, salvage and start date drive future charges; changing them is
    // fine until the first month is posted. Cost is fixed by the purchase journal.
    const started = await AssetDepreciation.count({ where: { fixedAssetId: asset.id } });
    const b = req.body;
    const changingSchedule = (b.usefulLifeMonths != null && parseInt(b.usefulLifeMonths, 10) !== asset.usefulLifeMonths)
      || (b.salvageValue != null && r3(b.salvageValue) !== r3(asset.salvageValue))
      || (isYmd(b.depreciationStartDate) && b.depreciationStartDate !== asset.depreciationStartDate);
    if (changingSchedule) {
      if (started) return res.status(400).json({ message: 'Depreciation has been posted — life, salvage and start date are fixed now' });
      const life = parseInt(b.usefulLifeMonths ?? asset.usefulLifeMonths, 10);
      const salvage = r3(b.salvageValue ?? asset.salvageValue);
      if (!(life > 0)) return res.status(400).json({ message: 'Useful life must be at least one month' });
      if (salvage < 0 || salvage >= parseFloat(asset.cost)) return res.status(400).json({ message: 'Salvage value must be less than the cost' });
      Object.assign(update, { usefulLifeMonths: life, salvageValue: salvage });
      if (isYmd(b.depreciationStartDate)) update.depreciationStartDate = b.depreciationStartDate;
    }
    await asset.update(update);
    res.json(asset);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, requireFinance, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const asset = await FixedAsset.findByPk(req.params.id, { transaction: t });
    if (!asset) throw new Error('Not found');
    if (asset.status !== 'active') throw new Error('A disposed asset cannot be deleted');
    if (await AssetDepreciation.count({ where: { fixedAssetId: asset.id }, transaction: t })) {
      throw new Error('Depreciation has been posted — dispose of the asset instead');
    }
    if (asset.acquisitionMethod === 'cash' && asset.cashAccountId) {
      await writeCashTxn({
        cashAccountId: asset.cashAccountId, amount: parseFloat(asset.cost), source: 'other',
        sourceType: 'FixedAsset', sourceId: asset.id, reference: `${asset.assetNumber}-REVERSAL`,
        description: `Deleted fixed asset: ${asset.name}`, date: new Date(), createdBy: req.user.id, transaction: t,
      });
    }
    const entry = await JournalEntry.findOne({ where: { sourceType: 'FixedAsset', sourceId: asset.id, reversalOfId: null, reversedById: null }, transaction: t });
    if (entry) await reverseJournal(entry.id, { createdBy: req.user.id, description: `Deleted fixed asset ${asset.assetNumber}` }, { transaction: t });
    else {
      // Registered before accounting started: it is in the opening entry
      // at cost, so take it out in full.
      await ensureChart(t);
      const key = await loadAccountKeys(t);
      const cost = parseFloat(asset.cost);
      const acc = parseFloat(asset.openingAccumulatedDep) || 0;
      const debit = asset.acquisitionMethod === 'cash' && asset.cashAccountId
        ? [{ accountId: key(`cash:${asset.cashAccountId}`), debit: cost }]
        : asset.acquisitionMethod === 'payable'
          ? [{ accountId: key('OTHER_PAYABLES'), debit: cost }]
          : [...(acc ? [{ accountId: key('ACCUM_DEP'), debit: acc }] : []), { accountId: key('OPENING'), debit: r3(cost - acc) }];
      await postJournal({
        kind: 'reversal', description: `Deleted fixed asset ${asset.assetNumber}`, reference: asset.assetNumber,
        sourceType: 'FixedAsset', sourceId: asset.id, createdBy: req.user.id,
        lines: [...debit, { accountId: asset.assetAccountId, credit: cost }],
      }, { transaction: t });
    }
    await asset.destroy({ transaction: t });
    await t.commit();
    res.json({ ok: true });
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(400).json({ message: err.message });
  }
});

// Sell or scrap: remove cost and accumulated depreciation, book any
// proceeds, and the difference is a gain or loss.
router.post('/:id/dispose', protect, requireFinance, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const asset = await FixedAsset.findByPk(req.params.id, { transaction: t });
    if (!asset) throw new Error('Not found');
    if (asset.status !== 'active') throw new Error('Already disposed');
    const b = req.body || {};
    if (!isYmd(b.disposalDate)) throw new Error('Disposal date is required');
    const proceeds = r3(b.proceeds);
    if (proceeds < 0) throw new Error('Proceeds cannot be negative');
    let cashAccount = null;
    if (proceeds > 0) {
      cashAccount = await CashAccount.findByPk(b.cashAccountId, { transaction: t });
      if (!cashAccount || !cashAccount.active) throw new Error('Pick the account the sale money went into');
    }
    const posted = (await AssetDepreciation.sum('amount', { where: { fixedAssetId: asset.id }, transaction: t })) || 0;
    const { accumulated, bookValue } = figures(asset, r3(posted));
    const gain = r3(proceeds - bookValue);

    await asset.update({
      status: 'disposed', disposalDate: b.disposalDate, disposalProceeds: proceeds,
      disposalCashAccountId: cashAccount?.id || null, disposalNotes: b.notes?.trim() || null,
    }, { transaction: t });
    if (cashAccount) {
      await writeCashTxn({
        cashAccountId: cashAccount.id, amount: proceeds, source: 'other',
        sourceType: 'FixedAssetDisposal', sourceId: asset.id, reference: asset.assetNumber,
        description: `Sale of fixed asset: ${asset.name}`, date: new Date(`${b.disposalDate}T12:00:00`),
        createdBy: req.user.id, transaction: t,
      });
    }
    await ensureChart(t);
    const key = await loadAccountKeys(t);
    await postJournal({
      date: b.disposalDate, kind: 'asset',
      description: `Disposal of ${asset.name}${gain > 0 ? ' (gain)' : gain < 0 ? ' (loss)' : ''}`,
      reference: asset.assetNumber, sourceType: 'FixedAssetDisposal', sourceId: asset.id,
      locationId: asset.locationId, createdBy: req.user.id,
      lines: [
        ...(cashAccount ? [{ accountId: key(`cash:${cashAccount.id}`), debit: proceeds }] : []),
        ...(accumulated ? [{ accountId: key('ACCUM_DEP'), debit: accumulated }] : []),
        { accountId: asset.assetAccountId, credit: parseFloat(asset.cost) },
        ...(gain ? [{ accountId: key('ASSET_DISPOSAL'), amount: -gain }] : []),
      ],
    }, { transaction: t });
    await t.commit();
    res.json({ ok: true, bookValue, proceeds, gain });
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(400).json({ message: err.message });
  }
});

export default router;
