/**
 * Accounting routes — general ledger, reports and customer accounts.
 *
 *   GET    /api/accounting/status                 start/lock/sync state
 *   POST   /api/accounting/start                  admin: opening entry + start auto-posting
 *   POST   /api/accounting/reset                  admin: wipe journals (body.confirm = 'RESET')
 *   PUT    /api/accounting/lock-date              admin: close periods up to a date
 *   POST   /api/accounting/sync                   post pending documents now (?full=true)
 *
 *   GET    /api/accounting/accounts               chart with balances
 *   POST   /api/accounting/accounts               create
 *   PUT    /api/accounting/accounts/:id           update
 *   DELETE /api/accounting/accounts/:id           delete (unused, non-system only)
 *
 *   GET    /api/accounting/journals               list (filters + paging)
 *   GET    /api/accounting/journals/:id           one entry with lines
 *   POST   /api/accounting/journals               manual journal
 *   POST   /api/accounting/journals/:id/reverse   void a manual journal
 *
 *   GET    /api/accounting/ledger                 one account's lines + running balance
 *   GET    /api/accounting/trial-balance
 *   GET    /api/accounting/pnl
 *   GET    /api/accounting/balance-sheet
 *   GET    /api/accounting/vat-report
 *
 *   GET    /api/accounting/customers              customer balances
 *   GET    /api/accounting/customer-search?q=     find a customer to set up
 *   PUT    /api/accounting/customers/:userId      create/update credit terms
 *   GET    /api/accounting/customers/:userId/statement
 *   POST   /api/accounting/customers/:userId/payments
 *   POST   /api/accounting/customer-payments/:id/cancel
 */
import { Router } from 'express';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import {
  Account, JournalEntry, JournalLine, User, Supplier, Location,
  Order, SalesReturn, PurchaseOrder,
  CustomerAccount, CustomerPayment, CashAccount, writeCashTxn,
} from '../models/index.js';
import { protect } from '../middleware/auth.js';
import {
  getAcctSettings, setAcctSetting, ensureChart, loadAccountKeys, postJournal, reverseJournal,
  startAccounting, resetAccounting, syncLedger, localDate, currentStockValue,
} from '../services/ledger.js';
import { customerBalances, customerStatement } from '../services/customerCredit.js';

const router = Router();

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const DEBIT_NORMAL = new Set(['asset', 'expense']);
const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const canFinance = (req) => req.user.role === 'admin' || (req.user.permissions || []).includes('finance');

function requireFinance(req, res, next) {
  if (!canFinance(req)) return res.status(403).json({ message: 'Finance permission required' });
  next();
}
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  next();
}

// Reports read the ledger — make sure pending documents are posted first.
async function freshen() {
  try { await syncLedger(); } catch (err) { console.error('[accounting/sync]', err.message); }
}

// Σ debit/credit per account (optionally per party) over a line filter.
async function sumLines(where, group = ['accountId']) {
  const rows = await JournalLine.findAll({
    where,
    attributes: [...group,
      [sequelize.fn('SUM', sequelize.col('debit')), 'dr'],
      [sequelize.fn('SUM', sequelize.col('credit')), 'cr']],
    group, raw: true,
  });
  return rows.map((r) => ({ ...r, dr: r3(r.dr), cr: r3(r.cr) }));
}

const balanceOf = (type, dr, cr) => r3(DEBIT_NORMAL.has(type) ? dr - cr : cr - dr);

// ─── Status / setup ────────────────────────────────────────────────
router.get('/status', protect, requireFinance, async (req, res) => {
  try {
    const s = await getAcctSettings();
    let suspense = 0;
    if (s.startAt) {
      const key = await loadAccountKeys().catch(() => null);
      if (key) {
        const [row] = await sumLines({ accountId: key('SUSPENSE') }, []);
        suspense = row ? r3(row.cr - row.dr) : 0;
      }
    }
    res.json({
      started: !!s.startAt,
      startAt: s.startAt,
      startDate: s.startAt ? localDate(s.startAt) : null,
      lockDate: s.lockDate,
      syncedAt: s.syncedAt,
      lastSync: s.lastSync,
      journalCount: await JournalEntry.count(),
      accountCount: await Account.count(),
      suspense,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/start', protect, requireAdmin, async (req, res) => {
  try {
    const result = await startAccounting({ userId: req.user.id });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/reset', protect, requireAdmin, async (req, res) => {
  try {
    if (req.body?.confirm !== 'RESET') return res.status(400).json({ message: 'Type RESET to confirm' });
    await resetAccounting();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/lock-date', protect, requireAdmin, async (req, res) => {
  try {
    const { lockDate } = req.body || {};
    if (lockDate && !isYmd(lockDate)) return res.status(400).json({ message: 'lockDate must be YYYY-MM-DD' });
    if (lockDate && lockDate >= localDate()) return res.status(400).json({ message: 'Lock date must be before today' });
    await setAcctSetting('lockDate', lockDate || null);
    res.json({ lockDate: lockDate || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/sync', protect, requireFinance, async (req, res) => {
  try {
    const summary = await syncLedger({ full: req.query.full === 'true' || req.body?.full === true });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Chart of accounts ─────────────────────────────────────────────
router.get('/accounts', protect, requireFinance, async (req, res) => {
  try {
    await ensureChart();
    await freshen();
    const accounts = await Account.findAll({ order: [['code', 'ASC']] });
    const where = {};
    if (isYmd(req.query.asOf)) where.date = { [Op.lte]: req.query.asOf };
    const sums = new Map((await sumLines(where)).map((r) => [r.accountId, r]));
    const lineCounts = new Map((await JournalLine.findAll({
      attributes: ['accountId', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
      group: ['accountId'], raw: true,
    })).map((r) => [r.accountId, parseInt(r.n, 10)]));
    const rows = accounts.map((a) => {
      const s = sums.get(a.id) || { dr: 0, cr: 0 };
      return { ...a.toJSON(), balance: balanceOf(a.type, s.dr, s.cr), used: (lineCounts.get(a.id) || 0) > 0 };
    });
    // Roll child balances up into their group headings.
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const r of rows) {
      if (r.isGroup) continue;
      let p = r.parentId ? byId.get(r.parentId) : null;
      while (p) {
        p.balance = r3(p.balance + (p.type === r.type ? r.balance : -r.balance));
        p = p.parentId ? byId.get(p.parentId) : null;
      }
    }
    res.json(rows);
  } catch (err) {
    console.error('[accounting/accounts]', err);
    res.status(500).json({ message: err.message });
  }
});

function accountBody(body) {
  const out = {};
  if (body.code != null) out.code = String(body.code).trim();
  if (body.name != null) out.name = String(body.name).trim();
  if (body.nameAr !== undefined) out.nameAr = body.nameAr?.trim() || null;
  if (body.description !== undefined) out.description = body.description?.trim() || null;
  if (body.active !== undefined) out.active = !!body.active;
  return out;
}

router.post('/accounts', protect, requireFinance, async (req, res) => {
  try {
    const body = accountBody(req.body || {});
    if (!body.code || !body.name) return res.status(400).json({ message: 'Code and name are required' });
    const parent = req.body.parentId ? await Account.findByPk(req.body.parentId) : null;
    if (req.body.parentId && !parent) return res.status(400).json({ message: 'Parent not found' });
    const type = parent ? parent.type : req.body.type;
    if (!['asset', 'liability', 'equity', 'income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'Type must be asset, liability, equity, income or expense' });
    }
    const row = await Account.create({ ...body, type, parentId: parent?.id || null, isGroup: !!req.body.isGroup });
    res.status(201).json(row);
  } catch (err) {
    res.status(400).json({ message: err.name === 'SequelizeUniqueConstraintError' ? 'That account code is already used' : err.message });
  }
});

router.put('/accounts/:id', protect, requireFinance, async (req, res) => {
  try {
    const row = await Account.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const body = accountBody(req.body || {});
    if (req.body.parentId !== undefined && req.body.parentId !== row.parentId) {
      const parent = req.body.parentId ? await Account.findByPk(req.body.parentId) : null;
      if (req.body.parentId && (!parent || parent.type !== row.type || !parent.isGroup || parent.id === row.id)) {
        return res.status(400).json({ message: 'Parent must be a heading of the same type' });
      }
      body.parentId = parent?.id || null;
    }
    if (row.systemKey && body.active === false) return res.status(400).json({ message: 'System accounts cannot be deactivated' });
    await row.update(body);
    res.json(row);
  } catch (err) {
    res.status(400).json({ message: err.name === 'SequelizeUniqueConstraintError' ? 'That account code is already used' : err.message });
  }
});

router.delete('/accounts/:id', protect, requireFinance, async (req, res) => {
  try {
    const row = await Account.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (row.systemKey) return res.status(400).json({ message: 'System accounts cannot be deleted' });
    if (await JournalLine.count({ where: { accountId: row.id } })) {
      return res.status(400).json({ message: 'Account has postings — deactivate it instead' });
    }
    if (await Account.count({ where: { parentId: row.id } })) {
      return res.status(400).json({ message: 'Move or delete the accounts under this heading first' });
    }
    await row.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Journals ──────────────────────────────────────────────────────
const entryIncludes = [
  { model: JournalLine, as: 'lines', include: [{ model: Account, attributes: ['id', 'code', 'name', 'type'] }] },
  { model: User, as: 'creator', attributes: ['id', 'name'] },
  { model: Location, attributes: ['id', 'name'] },
];

// Attach supplier/customer names to party lines.
async function withPartyNames(entries) {
  const sup = new Set(), cus = new Set();
  for (const e of entries) for (const l of e.lines || []) {
    if (l.partyType === 'supplier' && l.partyId) sup.add(l.partyId);
    if (l.partyType === 'customer' && l.partyId) cus.add(l.partyId);
  }
  const [sups, cuss] = await Promise.all([
    sup.size ? Supplier.findAll({ where: { id: [...sup] }, attributes: ['id', 'name'] }) : [],
    cus.size ? User.findAll({ where: { id: [...cus] }, attributes: ['id', 'name'] }) : [],
  ]);
  const sn = new Map(sups.map((s) => [s.id, s.name])), cn = new Map(cuss.map((c) => [c.id, c.name]));
  return entries.map((e) => {
    const j = e.toJSON();
    j.lines = (j.lines || []).sort((a, b) => b.debit - a.debit || a.id - b.id).map((l) => ({
      ...l,
      partyName: l.partyType === 'supplier' ? sn.get(l.partyId) : l.partyType === 'customer' ? cn.get(l.partyId) : null,
    }));
    return j;
  });
}

router.get('/journals', protect, requireFinance, async (req, res) => {
  try {
    await freshen();
    const where = {};
    if (isYmd(req.query.from) || isYmd(req.query.to)) {
      where.date = { [Op.between]: [isYmd(req.query.from) ? req.query.from : '1970-01-01', isYmd(req.query.to) ? req.query.to : '2999-12-31'] };
    }
    if (req.query.kind) where.kind = req.query.kind;
    if (req.query.sourceType) where.sourceType = req.query.sourceType;
    if (req.query.search) {
      const q = `%${req.query.search.trim()}%`;
      where[Op.or] = [{ entryNumber: { [Op.like]: q } }, { reference: { [Op.like]: q } }, { description: { [Op.like]: q } }];
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const { count, rows } = await JournalEntry.findAndCountAll({
      where, include: entryIncludes, distinct: true,
      order: [['date', 'DESC'], ['id', 'DESC']],
      limit, offset: (page - 1) * limit,
    });
    res.json({ total: count, page, pages: Math.ceil(count / limit), entries: await withPartyNames(rows) });
  } catch (err) {
    console.error('[accounting/journals]', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/journals/:id', protect, requireFinance, async (req, res) => {
  try {
    const row = await JournalEntry.findByPk(req.params.id, { include: entryIncludes });
    if (!row) return res.status(404).json({ message: 'Not found' });
    const [j] = await withPartyNames([row]);
    res.json(j);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// A manual journal line on a cash/bank account is real money moving, so it
// is mirrored into that Cash Account too — the two never drift apart.
async function mirrorCashLines(entry, userId, transaction) {
  const lines = await JournalLine.findAll({
    where: { journalEntryId: entry.id },
    include: [{ model: Account, attributes: ['systemKey'] }],
    transaction,
  });
  for (const l of lines) {
    const m = /^cash:(\d+)$/.exec(l.Account?.systemKey || '');
    if (!m) continue;
    await writeCashTxn({
      cashAccountId: parseInt(m[1], 10),
      amount: r3(parseFloat(l.debit) - parseFloat(l.credit)),
      source: 'adjust', sourceType: 'JournalEntry', sourceId: entry.id,
      reference: entry.entryNumber, description: l.description || entry.description,
      date: new Date(`${entry.date}T12:00:00`), createdBy: userId, transaction,
    });
  }
}

router.post('/journals', protect, requireFinance, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { date, description, reference, lines } = req.body || {};
    if (!isYmd(date)) throw new Error('Date is required');
    if (!description?.trim()) throw new Error('Description is required');
    if (!(await getAcctSettings()).startAt) throw new Error('Start accounting before posting journals');
    const clean = (lines || []).map((l) => ({
      accountId: parseInt(l.accountId, 10),
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
      description: l.description?.trim() || null,
      partyType: ['customer', 'supplier'].includes(l.partyType) && l.partyId ? l.partyType : null,
      partyId: ['customer', 'supplier'].includes(l.partyType) && l.partyId ? parseInt(l.partyId, 10) : null,
      locationId: l.locationId ? parseInt(l.locationId, 10) : null,
    }));
    if (clean.some((l) => l.debit && l.credit)) throw new Error('A line can have a debit or a credit, not both');
    const entry = await postJournal({
      date, kind: 'manual', description: description.trim(), reference: reference?.trim() || null,
      sourceType: 'Manual', lines: clean, createdBy: req.user.id, strictDate: true,
    }, { transaction: t });
    await mirrorCashLines(entry, req.user.id, t);
    await t.commit();
    res.status(201).json(entry);
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(400).json({ message: err.message });
  }
});

router.post('/journals/:id/reverse', protect, requireFinance, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const orig = await JournalEntry.findByPk(req.params.id, { transaction: t });
    if (!orig) throw new Error('Journal not found');
    if (orig.kind !== 'manual') throw new Error('Only manual journals can be reversed here — automatic ones follow their document');
    const date = isYmd(req.body?.date) ? req.body.date : localDate();
    const rev = await reverseJournal(orig.id, { date, createdBy: req.user.id }, { transaction: t });
    await mirrorCashLines(rev, req.user.id, t);
    await t.commit();
    res.status(201).json(rev);
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(400).json({ message: err.message });
  }
});

// ─── General ledger (one account) ──────────────────────────────────
router.get('/ledger', protect, requireFinance, async (req, res) => {
  try {
    await freshen();
    const account = await Account.findByPk(req.query.accountId);
    if (!account) return res.status(400).json({ message: 'Pick an account' });
    // A heading shows the lines of every account under it.
    const all = await Account.findAll({ attributes: ['id', 'parentId'] });
    const ids = new Set([account.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const a of all) if (a.parentId && ids.has(a.parentId) && !ids.has(a.id)) { ids.add(a.id); grew = true; }
    }
    const from = isYmd(req.query.from) ? req.query.from : '1970-01-01';
    const to = isYmd(req.query.to) ? req.query.to : '2999-12-31';
    const base = { accountId: [...ids] };
    if (req.query.partyType && req.query.partyId) {
      base.partyType = req.query.partyType;
      base.partyId = parseInt(req.query.partyId, 10);
    }
    const [open] = await sumLines({ ...base, date: { [Op.lt]: from } }, []);
    const opening = open ? balanceOf(account.type, open.dr, open.cr) : 0;
    const lines = await JournalLine.findAll({
      where: { ...base, date: { [Op.between]: [from, to] } },
      include: [
        { model: JournalEntry, attributes: ['id', 'entryNumber', 'description', 'reference', 'kind', 'sourceType', 'sourceId'] },
        { model: Account, attributes: ['id', 'code', 'name'] },
      ],
      order: [['date', 'ASC'], ['journalEntryId', 'ASC'], ['id', 'ASC']],
      limit: 5000,
    });
    let running = opening, totalDr = 0, totalCr = 0;
    const rows = lines.map((l) => {
      const dr = parseFloat(l.debit), cr = parseFloat(l.credit);
      totalDr += dr; totalCr += cr;
      running = r3(running + (DEBIT_NORMAL.has(account.type) ? dr - cr : cr - dr));
      return { ...l.toJSON(), balance: running };
    });
    res.json({
      account, from, to, opening,
      totalDebit: r3(totalDr), totalCredit: r3(totalCr),
      closing: running, lines: rows, truncated: lines.length === 5000,
    });
  } catch (err) {
    console.error('[accounting/ledger]', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── Trial balance ─────────────────────────────────────────────────
router.get('/trial-balance', protect, requireFinance, async (req, res) => {
  try {
    await freshen();
    const from = isYmd(req.query.from) ? req.query.from : null;
    const to = isYmd(req.query.to) ? req.query.to : localDate();
    const accounts = await Account.findAll({ where: { isGroup: false }, order: [['code', 'ASC']] });
    const before = from ? new Map((await sumLines({ date: { [Op.lt]: from } })).map((r) => [r.accountId, r])) : new Map();
    const during = new Map((await sumLines({ date: { [Op.between]: [from || '1970-01-01', to] } })).map((r) => [r.accountId, r]));
    const rows = [];
    const tot = { openDr: 0, openCr: 0, dr: 0, cr: 0, closeDr: 0, closeCr: 0 };
    for (const a of accounts) {
      const b = before.get(a.id) || { dr: 0, cr: 0 };
      const d = during.get(a.id) || { dr: 0, cr: 0 };
      const openNet = r3(b.dr - b.cr);
      const closeNet = r3(openNet + d.dr - d.cr);
      if (!openNet && !d.dr && !d.cr && !closeNet) continue;
      const row = {
        id: a.id, code: a.code, name: a.name, type: a.type,
        openDebit: openNet > 0 ? openNet : 0, openCredit: openNet < 0 ? -openNet : 0,
        debit: d.dr, credit: d.cr,
        closeDebit: closeNet > 0 ? closeNet : 0, closeCredit: closeNet < 0 ? -closeNet : 0,
      };
      tot.openDr += row.openDebit; tot.openCr += row.openCredit; tot.dr += row.debit; tot.cr += row.credit;
      tot.closeDr += row.closeDebit; tot.closeCr += row.closeCredit;
      rows.push(row);
    }
    for (const k of Object.keys(tot)) tot[k] = r3(tot[k]);
    res.json({ from, to, rows, totals: tot, balanced: Math.abs(tot.closeDr - tot.closeCr) < 0.001 });
  } catch (err) {
    console.error('[accounting/trial-balance]', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── Profit & loss (from the ledger) ───────────────────────────────
router.get('/pnl', protect, requireFinance, async (req, res) => {
  try {
    await freshen();
    const now = localDate();
    const from = isYmd(req.query.from) ? req.query.from : `${now.slice(0, 7)}-01`;
    const to = isYmd(req.query.to) ? req.query.to : now;
    const where = { date: { [Op.between]: [from, to] } };
    if (req.query.locationId) where.locationId = parseInt(req.query.locationId, 10);
    const sums = new Map((await sumLines(where)).map((r) => [r.accountId, r]));
    const accounts = await Account.findAll({ where: { type: ['income', 'expense'] }, order: [['code', 'ASC']] });
    const cosGroup = accounts.find((a) => a.systemKey === 'GRP_COS');
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const underCos = (a) => {
      for (let p = a; p; p = p.parentId ? byId.get(p.parentId) : null) if (cosGroup && p.id === cosGroup.id) return true;
      return false;
    };
    const section = () => ({ accounts: [], total: 0 });
    const income = section(), cos = section(), opex = section();
    for (const a of accounts) {
      if (a.isGroup) continue;
      const s = sums.get(a.id);
      if (!s) continue;
      const amount = balanceOf(a.type, s.dr, s.cr);
      if (!amount) continue;
      const target = a.type === 'income' ? income : underCos(a) ? cos : opex;
      target.accounts.push({ id: a.id, code: a.code, name: a.name, amount });
      target.total = r3(target.total + amount);
    }
    const grossProfit = r3(income.total - cos.total);
    const netProfit = r3(grossProfit - opex.total);
    res.json({
      from, to, locationId: req.query.locationId || null,
      income, costOfSales: cos, grossProfit,
      grossMargin: income.total ? +((grossProfit / income.total) * 100).toFixed(2) : 0,
      expenses: opex, netProfit,
    });
  } catch (err) {
    console.error('[accounting/pnl]', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── Balance sheet (from the ledger) ───────────────────────────────
router.get('/balance-sheet', protect, requireFinance, async (req, res) => {
  try {
    await freshen();
    const asOf = isYmd(req.query.asOf) ? req.query.asOf : localDate();
    const sums = new Map((await sumLines({ date: { [Op.lte]: asOf } })).map((r) => [r.accountId, r]));
    const accounts = await Account.findAll({ where: { isGroup: false }, order: [['code', 'ASC']] });
    const sec = { asset: { accounts: [], total: 0 }, liability: { accounts: [], total: 0 }, equity: { accounts: [], total: 0 } };
    let earnings = 0;
    for (const a of accounts) {
      const s = sums.get(a.id);
      if (!s) continue;
      const amount = balanceOf(a.type, s.dr, s.cr);
      if (a.type === 'income') { earnings += amount; continue; }
      if (a.type === 'expense') { earnings -= amount; continue; }
      if (!amount) continue;
      sec[a.type].accounts.push({ id: a.id, code: a.code, name: a.name, amount, systemKey: a.systemKey });
      sec[a.type].total = r3(sec[a.type].total + amount);
    }
    earnings = r3(earnings);
    if (earnings) {
      sec.equity.accounts.push({ id: null, code: '', name: 'Profit / (loss) to date', amount: earnings });
      sec.equity.total = r3(sec.equity.total + earnings);
    }
    // Ledger inventory vs today's stock valuation — they drift when product
    // costs are changed after the stock was bought.
    let inventoryCheck = null;
    if (asOf === localDate()) {
      const inv = sec.asset.accounts.find((a) => a.systemKey === 'INVENTORY');
      const stock = await currentStockValue();
      inventoryCheck = { ledger: inv?.amount || 0, stockValue: stock, difference: r3((inv?.amount || 0) - stock) };
    }
    res.json({
      asOf,
      assets: sec.asset, liabilities: sec.liability, equity: sec.equity,
      totalLiabilitiesEquity: r3(sec.liability.total + sec.equity.total),
      balanced: Math.abs(sec.asset.total - (sec.liability.total + sec.equity.total)) < 0.001,
      inventoryCheck,
    });
  } catch (err) {
    console.error('[accounting/balance-sheet]', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── VAT / tax report ──────────────────────────────────────────────
// Output tax on sales (net of the tax share of refunds) less input tax on
// purchases received in the period, by month.
router.get('/vat-report', protect, requireFinance, async (req, res) => {
  try {
    const now = localDate();
    const from = isYmd(req.query.from) ? req.query.from : `${now.slice(0, 4)}-01-01`;
    const to = isYmd(req.query.to) ? req.query.to : now;
    const range = [new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59.999`)];
    const [orders, returns, pos] = await Promise.all([
      Order.findAll({
        where: { paymentStatus: 'paid', orderStatus: { [Op.ne]: 'cancelled' }, createdAt: { [Op.between]: range } },
        attributes: ['totalAmount', 'taxAmount', 'createdAt'],
      }),
      SalesReturn.findAll({
        where: { status: 'completed', createdAt: { [Op.between]: range } },
        include: [{ model: Order, attributes: ['totalAmount', 'taxAmount'] }],
        attributes: ['refundAmount', 'createdAt'],
      }),
      PurchaseOrder.findAll({
        where: { status: ['received', 'partial'], [Op.or]: [{ receivedDate: { [Op.between]: range } }, { receivedDate: null, updatedAt: { [Op.between]: range } }] },
        attributes: ['subtotal', 'taxAmount', 'receivedDate', 'updatedAt'],
      }),
    ]);
    const months = new Map();
    const m = (d) => {
      const k = localDate(d).slice(0, 7);
      if (!months.has(k)) months.set(k, { month: k, sales: 0, outputTax: 0, refundTax: 0, purchases: 0, inputTax: 0 });
      return months.get(k);
    };
    for (const o of orders) {
      const row = m(o.createdAt);
      const tax = parseFloat(o.taxAmount) || 0;
      row.sales += (parseFloat(o.totalAmount) || 0) - tax;
      row.outputTax += tax;
    }
    for (const r of returns) {
      const total = parseFloat(r.Order?.totalAmount) || 0;
      const tax = parseFloat(r.Order?.taxAmount) || 0;
      if (total > 0 && tax > 0) m(r.createdAt).refundTax += (parseFloat(r.refundAmount) || 0) * (tax / total);
    }
    for (const po of pos) {
      const row = m(po.receivedDate || po.updatedAt);
      row.purchases += parseFloat(po.subtotal) || 0;
      row.inputTax += parseFloat(po.taxAmount) || 0;
    }
    const rows = [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map((row) => {
      for (const k of ['sales', 'outputTax', 'refundTax', 'purchases', 'inputTax']) row[k] = r3(row[k]);
      row.netTax = r3(row.outputTax - row.refundTax - row.inputTax);
      return row;
    });
    const totals = rows.reduce((t, row) => {
      for (const k of ['sales', 'outputTax', 'refundTax', 'purchases', 'inputTax', 'netTax']) t[k] = r3((t[k] || 0) + row[k]);
      return t;
    }, {});
    res.json({ from, to, rows, totals });
  } catch (err) {
    console.error('[accounting/vat-report]', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── Customer accounts ─────────────────────────────────────────────
router.get('/customers', protect, requireFinance, async (req, res) => {
  try {
    res.json(await customerBalances());
  } catch (err) {
    console.error('[accounting/customers]', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/customer-search', protect, requireFinance, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const like = `%${q}%`;
    const users = await User.findAll({
      where: { role: 'customer', [Op.or]: [{ name: { [Op.like]: like } }, { phone: { [Op.like]: like } }, { email: { [Op.like]: like } }] },
      attributes: ['id', 'name', 'phone', 'email'],
      limit: 20,
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/customers/:userId', protect, requireFinance, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId);
    if (!user || user.role !== 'customer') return res.status(404).json({ message: 'Customer not found' });
    const body = {
      allowCredit: req.body.allowCredit !== false,
      creditLimit: Math.max(0, parseFloat(req.body.creditLimit) || 0),
      notes: req.body.notes?.trim() || null,
    };
    let acct = await CustomerAccount.findOne({ where: { userId: user.id } });
    if (acct) {
      // The opening balance is part of the ledger's opening entry once
      // accounting has started, so it is fixed from then on.
      if (req.body.openingBalance !== undefined && r3(req.body.openingBalance) !== r3(acct.openingBalance)) {
        if ((await getAcctSettings()).startAt) return res.status(400).json({ message: 'Opening balance cannot change after accounting has started — post a journal instead' });
        body.openingBalance = r3(req.body.openingBalance);
      }
      await acct.update(body);
    } else {
      if (r3(req.body.openingBalance) && (await getAcctSettings()).startAt) {
        return res.status(400).json({ message: 'Accounting has started — record an old balance with a journal instead of an opening balance' });
      }
      acct = await CustomerAccount.create({ ...body, userId: user.id, openingBalance: r3(req.body.openingBalance) });
    }
    res.json(acct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/customers/:userId/statement', protect, requireFinance, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId, { attributes: ['id', 'name', 'phone', 'email'] });
    if (!user) return res.status(404).json({ message: 'Customer not found' });
    res.json({ customer: user, ...(await customerStatement(user.id)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const gen = (prefix) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

router.post('/customers/:userId/payments', protect, requireFinance, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(req.params.userId, { transaction: t });
    if (!user) throw new Error('Customer not found');
    const amount = r3(req.body.amount);
    if (!(amount > 0)) throw new Error('Amount must be more than zero');
    const cashAccount = await CashAccount.findByPk(req.body.cashAccountId, { transaction: t });
    if (!cashAccount || !cashAccount.active) throw new Error('Pick the account the money went into');
    const paymentDate = isYmd(req.body.paymentDate) ? req.body.paymentDate : localDate();
    const pay = await CustomerPayment.create({
      receiptNumber: gen('RCPT'),
      userId: user.id, amount, cashAccountId: cashAccount.id,
      paymentMethod: req.body.paymentMethod || 'cash',
      reference: req.body.reference?.trim() || null,
      notes: req.body.notes?.trim() || null,
      paymentDate, createdBy: req.user.id,
    }, { transaction: t });
    await writeCashTxn({
      cashAccountId: cashAccount.id, amount, source: 'other',
      sourceType: 'CustomerPayment', sourceId: pay.id,
      reference: pay.receiptNumber, description: `Payment from ${user.name}`,
      date: new Date(`${paymentDate}T12:00:00`), createdBy: req.user.id, transaction: t,
    });
    await ensureChart(t);
    const key = await loadAccountKeys(t);
    await postJournal({
      date: paymentDate, kind: 'receipt', description: `Payment from ${user.name}`,
      reference: pay.receiptNumber, sourceType: 'CustomerPayment', sourceId: pay.id,
      createdBy: req.user.id,
      lines: [
        { accountId: key(`cash:${cashAccount.id}`), debit: amount },
        { accountId: key('AR'), credit: amount, partyType: 'customer', partyId: user.id },
      ],
    }, { transaction: t });
    await t.commit();
    res.status(201).json(pay);
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(400).json({ message: err.message });
  }
});

router.post('/customer-payments/:id/cancel', protect, requireFinance, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const pay = await CustomerPayment.findByPk(req.params.id, { transaction: t });
    if (!pay) throw new Error('Payment not found');
    if (pay.status !== 'posted') throw new Error('Already cancelled');
    await writeCashTxn({
      cashAccountId: pay.cashAccountId, amount: -parseFloat(pay.amount), source: 'other',
      sourceType: 'CustomerPayment', sourceId: pay.id,
      reference: `${pay.receiptNumber}-REVERSAL`, description: 'Cancelled customer payment',
      date: new Date(), createdBy: req.user.id, transaction: t,
    });
    const entry = await JournalEntry.findOne({
      where: { sourceType: 'CustomerPayment', sourceId: pay.id, reversalOfId: null, reversedById: null }, transaction: t,
    });
    if (entry) {
      await reverseJournal(entry.id, { createdBy: req.user.id, description: `Cancelled ${pay.receiptNumber}` }, { transaction: t });
    } else {
      // Received before accounting started (its effect is in the opening
      // entry), so post the cancellation in full.
      await ensureChart(t);
      const key = await loadAccountKeys(t);
      await postJournal({
        kind: 'reversal', description: `Cancelled ${pay.receiptNumber}`,
        reference: pay.receiptNumber, sourceType: 'CustomerPayment', sourceId: pay.id, createdBy: req.user.id,
        lines: [
          { accountId: key('AR'), debit: parseFloat(pay.amount), partyType: 'customer', partyId: pay.userId },
          { accountId: key(`cash:${pay.cashAccountId}`), credit: parseFloat(pay.amount) },
        ],
      }, { transaction: t });
    }
    await pay.update({ status: 'cancelled' }, { transaction: t });
    await t.commit();
    res.json({ ok: true });
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    res.status(400).json({ message: err.message });
  }
});

export default router;
