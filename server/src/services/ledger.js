/**
 * General ledger: chart-of-accounts seeding, journal posting, and the
 * auto-posting engine that turns existing business documents into
 * double-entry journals.
 *
 * ── How auto-posting works ──────────────────────────────────────────
 * The POS, returns, purchasing and finance routes keep writing their own
 * documents exactly as before. syncLedger() runs on a timer (and before
 * every ledger report) and, for each document changed since the last run:
 *
 *   1. builds the lines the document *should* have in the ledger now
 *      (empty if it was cancelled),
 *   2. sums what is *already* posted for that document,
 *   3. posts the difference as a new journal.
 *
 * So a bill edit, a cancelled expense or a re-run all self-correct, and
 * running it twice posts nothing the second time.
 *
 * Cash lines always come from the document's CashTransactions, so every
 * cash/bank/KNET GL account matches its Cash Accounts balance exactly.
 * If a document's other side doesn't add up to its cash (e.g. a POS
 * tender whose cash account was missing), the difference goes to the
 * Suspense account for the accountant to review instead of being lost.
 *
 * Only documents created after the accounting start (acct_start_at) are
 * posted; everything before it is summed into the opening entry.
 */
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import {
  Account, JournalEntry, JournalLine, Counter, Setting,
  CashAccount, CashTransaction, ExpenseCategory, Expense, CashTransfer,
  Order, SalesReturn, Product, ProductStock,
  Supplier, PurchaseOrder, PurchaseReceipt, PurchaseReturn, SupplierPayment,
  StockCount, StockMovement, FixedAsset, AssetDepreciation,
} from '../models/index.js';
import { customerBalances } from './customerCredit.js';

export const STORE_TZ = process.env.STORE_TZ || 'Asia/Kuwait';

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

// 'YYYY-MM-DD' of a moment in the store's timezone.
export function localDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TZ }).format(new Date(d));
}

function nextDay(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ─── Settings ──────────────────────────────────────────────────────
const SETTING_KEYS = {
  startAt: 'acct_start_at',        // ISO timestamp accounting began
  lockDate: 'acct_lock_date',      // YYYY-MM-DD; nothing may post on/before
  syncedAt: 'acct_synced_at',      // ISO watermark of the last sync run
  lastSync: 'acct_last_sync',      // JSON summary of the last run
};

export async function getAcctSettings(transaction) {
  const rows = await Setting.findAll({ where: { key: Object.values(SETTING_KEYS) }, transaction });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  let lastSync = null;
  try { lastSync = map[SETTING_KEYS.lastSync] ? JSON.parse(map[SETTING_KEYS.lastSync]) : null; } catch { /* ignore */ }
  return {
    startAt: map[SETTING_KEYS.startAt] || null,
    lockDate: map[SETTING_KEYS.lockDate] || null,
    syncedAt: map[SETTING_KEYS.syncedAt] || null,
    lastSync,
  };
}

export async function setAcctSetting(name, value, transaction) {
  const key = SETTING_KEYS[name];
  if (value == null) await Setting.destroy({ where: { key }, transaction });
  else await Setting.upsert({ key, value: String(value) }, { transaction });
}

// ─── Chart of accounts ─────────────────────────────────────────────
// [code, name, type, parentCode, isGroup, systemKey]
const DEFAULT_CHART = [
  ['1000', 'Assets', 'asset', null, true, 'GRP_ASSETS'],
  ['1100', 'Cash & Bank', 'asset', '1000', true, 'GRP_CASH'],
  ['1150', 'Online Payments Clearing', 'asset', '1000', false, 'ONLINE_CLEARING'],
  ['1200', 'Accounts Receivable', 'asset', '1000', false, 'AR'],
  ['1300', 'Inventory', 'asset', '1000', false, 'INVENTORY'],
  ['1400', 'Prepayments & Deposits', 'asset', '1000', false, null],
  ['1450', 'VAT Input', 'asset', '1000', false, 'VAT_INPUT'],
  ['1500', 'Fixed Assets', 'asset', '1000', true, 'GRP_FIXED'],
  ['1510', 'Furniture & Fixtures', 'asset', '1500', false, 'FA_FURNITURE'],
  ['1520', 'Shop Equipment', 'asset', '1500', false, 'FA_EQUIPMENT'],
  ['1530', 'Computers & POS Hardware', 'asset', '1500', false, 'FA_COMPUTERS'],
  ['1540', 'Vehicles', 'asset', '1500', false, 'FA_VEHICLES'],
  ['1550', 'Leasehold Improvements', 'asset', '1500', false, 'FA_LEASEHOLD'],
  ['1590', 'Accumulated Depreciation', 'asset', '1500', false, 'ACCUM_DEP'],
  ['2000', 'Liabilities', 'liability', null, true, 'GRP_LIAB'],
  ['2100', 'Accounts Payable', 'liability', '2000', false, 'AP'],
  ['2200', 'Customer Store Credit', 'liability', '2000', false, 'STORE_CREDIT'],
  ['2300', 'VAT Output', 'liability', '2000', false, 'VAT_OUTPUT'],
  ['2400', 'Other Payables', 'liability', '2000', false, 'OTHER_PAYABLES'],
  ['2500', 'Accrued Salaries', 'liability', '2000', false, null],
  ['2900', 'Suspense', 'liability', '2000', false, 'SUSPENSE'],
  ['3000', 'Equity', 'equity', null, true, 'GRP_EQUITY'],
  ['3100', "Owner's Capital", 'equity', '3000', false, 'CAPITAL'],
  ['3200', "Owner's Drawings", 'equity', '3000', false, 'DRAWINGS'],
  ['3300', 'Retained Earnings', 'equity', '3000', false, 'RETAINED'],
  ['3900', 'Opening Balance Equity', 'equity', '3000', false, 'OPENING'],
  ['4000', 'Income', 'income', null, true, 'GRP_INCOME'],
  ['4100', 'Sales', 'income', '4000', false, 'SALES'],
  ['4110', 'Sales Discounts', 'income', '4000', false, 'SALES_DISCOUNT'],
  ['4120', 'Sales Returns', 'income', '4000', false, 'SALES_RETURNS'],
  ['4200', 'Shipping Income', 'income', '4000', false, 'SHIPPING_INCOME'],
  ['4900', 'Other Income', 'income', '4000', false, 'OTHER_INCOME'],
  ['4910', 'Gain / Loss on Asset Disposal', 'income', '4000', false, 'ASSET_DISPOSAL'],
  ['5000', 'Cost of Sales', 'expense', null, true, 'GRP_COS'],
  ['5100', 'Cost of Goods Sold', 'expense', '5000', false, 'COGS'],
  ['5200', 'Inventory Adjustments', 'expense', '5000', false, 'INV_ADJUST'],
  ['5300', 'Stock Write-offs', 'expense', '5000', false, 'WRITE_OFF'],
  ['6000', 'Operating Expenses', 'expense', null, true, 'GRP_EXPENSE'],
  ['6800', 'Depreciation', 'expense', '6000', false, 'DEPRECIATION'],
  ['6900', 'Cash Over / Short', 'expense', '6000', false, 'CASH_OVER_SHORT'],
  ['6990', 'General Expenses', 'expense', '6000', false, 'GENERAL_EXPENSE'],
];

async function nextChildCode(parent, transaction) {
  const kids = await Account.findAll({ where: { parentId: parent.id }, attributes: ['code'], transaction });
  const base = parseInt(parent.code, 10);
  const used = new Set(kids.map((k) => parseInt(k.code, 10)).filter(Number.isFinite));
  // Children of 1100 get 1101.., of 6000 get 6100..; skip codes already taken anywhere.
  let n = base + (base % 1000 === 0 ? 100 : 1);
  for (;;) {
    if (!used.has(n) && !(await Account.count({ where: { code: String(n) }, transaction }))) return String(n);
    n += 1;
  }
}

/**
 * Seed the default chart (first run only) and make sure every cash
 * account and expense category has its own GL account. Safe to call
 * repeatedly — it only creates what is missing.
 */
export async function ensureChart(transaction) {
  if ((await Account.count({ transaction })) === 0) {
    const byCode = new Map();
    for (const [code, name, type, parentCode, isGroup, systemKey] of DEFAULT_CHART) {
      const row = await Account.create({
        code, name, type, isGroup, systemKey,
        parentId: parentCode ? byCode.get(parentCode).id : null,
      }, { transaction });
      byCode.set(code, row);
    }
  }
  const all = await Account.findAll({ attributes: ['id', 'code', 'systemKey'], transaction });
  const have = new Set(all.map((a) => a.systemKey).filter(Boolean));
  const groupCash = all.find((a) => a.systemKey === 'GRP_CASH');
  const groupExp = all.find((a) => a.systemKey === 'GRP_EXPENSE');

  const cashAccounts = await CashAccount.findAll({ attributes: ['id', 'name'], transaction });
  for (const ca of cashAccounts) {
    if (have.has(`cash:${ca.id}`) || !groupCash) continue;
    await Account.create({
      code: await nextChildCode(groupCash, transaction),
      name: ca.name, type: 'asset', parentId: groupCash.id, systemKey: `cash:${ca.id}`,
    }, { transaction });
  }
  const cats = await ExpenseCategory.findAll({ attributes: ['id', 'name'], transaction });
  for (const c of cats) {
    if (have.has(`expcat:${c.id}`) || !groupExp) continue;
    await Account.create({
      code: await nextChildCode(groupExp, transaction),
      name: c.name, type: 'expense', parentId: groupExp.id, systemKey: `expcat:${c.id}`,
    }, { transaction });
  }
}

// systemKey → account id, loaded fresh per call site.
export async function loadAccountKeys(transaction) {
  const rows = await Account.findAll({
    where: { systemKey: { [Op.ne]: null } }, attributes: ['id', 'systemKey'], transaction,
  });
  const map = new Map(rows.map((r) => [r.systemKey, r.id]));
  return (key) => {
    const id = map.get(key);
    if (!id) throw new Error(`Ledger account "${key}" is missing from the chart of accounts`);
    return id;
  };
}

// ─── Posting ───────────────────────────────────────────────────────
async function nextEntryNumber(transaction) {
  const row = await Counter.findByPk('journal_entry', { transaction, lock: transaction.LOCK.UPDATE });
  let next;
  if (!row) {
    next = 1;
    await Counter.create({ name: 'journal_entry', value: next }, { transaction });
  } else {
    next = Number(row.value) + 1;
    row.value = next;
    await row.save({ transaction });
  }
  return `JV-${String(next).padStart(6, '0')}`;
}

/**
 * Post one balanced journal.
 *
 * lines: [{ accountId, debit?, credit?, description?, partyType?, partyId?, locationId? }]
 *   — or `amount` (positive = debit, negative = credit) instead of debit/credit.
 *
 * `strictDate`: manual journals pass true so a date inside a locked period
 * is rejected; automatic postings are moved to the first open day instead.
 *
 * Returns the created entry, or null when accounting hasn't been started
 * (documents from before the start are covered by the opening entry).
 */
export async function postJournal({
  date, kind = 'manual', description = null, reference = null,
  sourceType = null, sourceId = null, locationId = null,
  lines, createdBy = null, reversalOfId = null, strictDate = false,
}, { transaction }) {
  const settings = await getAcctSettings(transaction);
  if (!settings.startAt) return null;

  let entryDate = date || localDate();
  if (settings.lockDate && entryDate <= settings.lockDate) {
    if (strictDate) throw new Error(`The period up to ${settings.lockDate} is locked`);
    entryDate = nextDay(settings.lockDate);
  }

  const clean = [];
  for (const l of lines || []) {
    let debit = r3(l.debit), credit = r3(l.credit);
    if (l.amount != null) {
      const a = r3(l.amount);
      debit = a > 0 ? a : 0;
      credit = a < 0 ? -a : 0;
    }
    if (debit < 0 || credit < 0) throw new Error('Journal amounts cannot be negative');
    if (debit === 0 && credit === 0) continue;
    if (!l.accountId) throw new Error('Every journal line needs an account');
    clean.push({ ...l, debit, credit });
  }
  if (clean.length < 2) throw new Error('A journal needs at least two lines');
  const totalDr = r3(clean.reduce((s, l) => s + l.debit, 0));
  const totalCr = r3(clean.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDr - totalCr) > 0.0005) {
    throw new Error(`Journal does not balance: debits ${totalDr.toFixed(3)} ≠ credits ${totalCr.toFixed(3)}`);
  }

  const accountIds = [...new Set(clean.map((l) => l.accountId))];
  const accts = await Account.findAll({ where: { id: accountIds }, attributes: ['id', 'isGroup', 'name'], transaction });
  if (accts.length !== accountIds.length) throw new Error('Journal uses an unknown account');
  const group = accts.find((a) => a.isGroup);
  if (group) throw new Error(`"${group.name}" is a heading — post to one of its accounts`);

  const entry = await JournalEntry.create({
    entryNumber: await nextEntryNumber(transaction),
    date: entryDate, kind, description, reference,
    sourceType, sourceId, locationId,
    totalAmount: totalDr, reversalOfId, createdBy,
  }, { transaction });
  await JournalLine.bulkCreate(clean.map((l) => ({
    journalEntryId: entry.id,
    accountId: l.accountId,
    debit: l.debit,
    credit: l.credit,
    description: l.description || null,
    date: entryDate,
    locationId: l.locationId ?? locationId ?? null,
    partyType: l.partyType || null,
    partyId: l.partyId ?? null,
    sourceType, sourceId,
  })), { transaction });
  return entry;
}

// Post the mirror image of an entry (used to void manual journals and
// cancel direct postings such as write-offs and receipts).
export async function reverseJournal(entryId, { date, description, createdBy, kind = 'reversal' }, { transaction }) {
  const orig = await JournalEntry.findByPk(entryId, {
    include: [{ model: JournalLine, as: 'lines' }], transaction,
  });
  if (!orig) throw new Error('Journal not found');
  if (orig.reversedById) throw new Error(`${orig.entryNumber} is already reversed`);
  if (orig.reversalOfId) throw new Error(`${orig.entryNumber} is itself a reversal`);
  const rev = await postJournal({
    date: date || localDate(),
    kind,
    description: description || `Reversal of ${orig.entryNumber}${orig.description ? ` — ${orig.description}` : ''}`,
    reference: orig.reference,
    sourceType: orig.sourceType,
    sourceId: orig.sourceId,
    locationId: orig.locationId,
    reversalOfId: orig.id,
    createdBy,
    lines: orig.lines.map((l) => ({
      accountId: l.accountId,
      debit: parseFloat(l.credit),
      credit: parseFloat(l.debit),
      description: l.description,
      partyType: l.partyType, partyId: l.partyId, locationId: l.locationId,
    })),
  }, { transaction });
  if (rev) await orig.update({ reversedById: rev.id }, { transaction });
  return rev;
}

// ─── Opening entry ─────────────────────────────────────────────────
// Value of all stock at current cost (variant cost overrides product cost).
export async function currentStockValue(transaction) {
  const stocks = await ProductStock.findAll({
    attributes: ['quantity', 'variantIndex'],
    include: [{ model: Product, attributes: ['costPrice', 'variants'] }],
    transaction,
  });
  let total = 0;
  for (const s of stocks) {
    const p = s.Product;
    if (!p) continue;
    const v = s.variantIndex != null && Array.isArray(p.variants) ? p.variants[s.variantIndex] : null;
    total += (parseFloat(v?.costPrice ?? p.costPrice ?? 0) || 0) * (s.quantity || 0);
  }
  return r3(total);
}

const grnValue = (grn) => r3((grn.items || []).reduce(
  (s, it) => s + (parseInt(it.quantity, 10) || 0) * (parseFloat(it.landedUnitCost ?? it.unitCost) || 0), 0));

/**
 * Start the ledger: record the start moment and post one opening entry
 * from today's balances — cash accounts, stock at cost, supplier and
 * customer balances, fixed assets at book value — with the difference in
 * Opening Balance Equity. Documents from here on are posted by the sync.
 */
export async function startAccounting({ userId }) {
  const settings = await getAcctSettings();
  if (settings.startAt) throw new Error('Accounting has already been started');
  if (await JournalEntry.count()) throw new Error('Journals already exist — reset first');

  // Start on a whole second, slightly ahead. MySQL stores createdAt rounded
  // to the second, so a document saved just before the click can land on
  // the click's second; waiting for the boundary means everything stored
  // before it is in this snapshot and everything at/after it is synced.
  const startAt = new Date(Math.ceil((Date.now() + 500) / 1000) * 1000);
  await new Promise((r) => setTimeout(r, startAt.getTime() - Date.now() + 50));

  const t = await sequelize.transaction();
  try {
    await ensureChart(t);
    await setAcctSetting('startAt', startAt.toISOString(), t);
    await setAcctSetting('syncedAt', startAt.toISOString(), t);
    const key = await loadAccountKeys(t);
    const lines = [];

    // Cash: opening balance + every cash transaction stored before the start
    // (the same createdAt boundary the sync uses, so nothing is counted twice).
    const cashAccounts = await CashAccount.findAll({ attributes: ['id', 'name', 'openingBalance'], transaction: t });
    const sums = await CashTransaction.findAll({
      where: { createdAt: { [Op.lt]: startAt } },
      attributes: ['cashAccountId', [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
      group: ['cashAccountId'], raw: true, transaction: t,
    });
    const sumBy = new Map(sums.map((s) => [s.cashAccountId, parseFloat(s.total) || 0]));
    for (const ca of cashAccounts) {
      const bal = r3((parseFloat(ca.openingBalance) || 0) + (sumBy.get(ca.id) || 0));
      if (bal) lines.push({ accountId: key(`cash:${ca.id}`), amount: bal, description: `Opening balance — ${ca.name}` });
    }

    const stock = await currentStockValue(t);
    if (stock) lines.push({ accountId: key('INVENTORY'), amount: stock, description: 'Opening stock at cost' });

    // Suppliers: what we owe for goods actually received (a fully received PO
    // at its PO total, a partial PO at its received value), less payments
    // and returns. A negative balance is an advance paid to the supplier.
    const [suppliers, pos, grns, pays, rets] = await Promise.all([
      Supplier.findAll({ attributes: ['id', 'name', 'openingBalance'], transaction: t }),
      PurchaseOrder.findAll({ where: { status: ['received', 'partial'] }, attributes: ['id', 'supplierId', 'status', 'totalAmount'], transaction: t }),
      PurchaseReceipt.findAll({ attributes: ['purchaseOrderId', 'items'], transaction: t }),
      SupplierPayment.findAll({ attributes: ['supplierId', 'amount'], transaction: t }),
      PurchaseReturn.findAll({ where: { status: 'completed' }, attributes: ['supplierId', 'totalAmount'], transaction: t }),
    ]);
    const grnByPo = new Map();
    for (const g of grns) grnByPo.set(g.purchaseOrderId, (grnByPo.get(g.purchaseOrderId) || 0) + grnValue(g));
    const owed = new Map(suppliers.map((s) => [s.id, parseFloat(s.openingBalance) || 0]));
    const add = (id, v) => owed.set(id, (owed.get(id) || 0) + v);
    for (const po of pos) add(po.supplierId, po.status === 'received' ? parseFloat(po.totalAmount) || 0 : grnByPo.get(po.id) || 0);
    for (const p of pays) add(p.supplierId, -(parseFloat(p.amount) || 0));
    for (const r of rets) add(r.supplierId, -(parseFloat(r.totalAmount) || 0));
    const supName = new Map(suppliers.map((s) => [s.id, s.name]));
    for (const [sid, bal] of owed) {
      const b = r3(bal);
      if (b) lines.push({ accountId: key('AP'), amount: -b, partyType: 'supplier', partyId: sid, description: `Opening balance — ${supName.get(sid) || `Supplier #${sid}`}` });
    }

    // Customers on account.
    const custBals = await customerBalances({ transaction: t });
    for (const c of custBals) {
      if (c.balance) lines.push({ accountId: key('AR'), amount: c.balance, partyType: 'customer', partyId: c.userId, description: `Opening balance — ${c.name}` });
    }

    // Fixed assets at book value.
    const assets = await FixedAsset.findAll({ where: { status: 'active' }, transaction: t });
    for (const a of assets) {
      const dep = r3((parseFloat(a.openingAccumulatedDep) || 0)
        + ((await AssetDepreciation.sum('amount', { where: { fixedAssetId: a.id }, transaction: t })) || 0));
      lines.push({ accountId: a.assetAccountId, amount: parseFloat(a.cost), description: `Opening cost — ${a.name}` });
      if (dep) lines.push({ accountId: key('ACCUM_DEP'), amount: -dep, description: `Opening accumulated depreciation — ${a.name}` });
    }

    const net = r3(lines.reduce((s, l) => s + r3(l.amount), 0));
    if (net) lines.push({ accountId: key('OPENING'), amount: -net, description: 'Opening balance equity' });

    let entry = null;
    if (lines.length >= 2) {
      entry = await postJournal({
        date: localDate(startAt), kind: 'opening', description: 'Opening balances',
        sourceType: 'Opening', sourceId: 0, lines, createdBy: userId,
      }, { transaction: t });
    }
    await t.commit();
    return { startAt, entry };
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    throw err;
  }
}

// Wipe the ledger so it can be started again (setup/testing). Documents,
// stock and cash are untouched — only journals and the start marker go.
export async function resetAccounting() {
  const t = await sequelize.transaction();
  try {
    await JournalLine.destroy({ where: {}, transaction: t });
    await JournalEntry.destroy({ where: {}, transaction: t });
    await AssetDepreciation.update({ journalEntryId: null }, { where: {}, transaction: t });
    for (const k of ['startAt', 'lockDate', 'syncedAt', 'lastSync']) await setAcctSetting(k, null, t);
    await t.commit();
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    throw err;
  }
}

// ─── Auto-posting engine ───────────────────────────────────────────
// Cash transactions that a route posts to the ledger itself (with its own
// journal), so the sync must not post them again.
const DIRECT_CASH_SOURCES = ['CustomerPayment', 'FixedAsset', 'FixedAssetDisposal', 'JournalEntry'];

// Line builder used by the document handlers. amount: + debit, − credit.
function lineBag(locationId) {
  const lines = [];
  return {
    lines,
    add(accountId, amount, extra = {}) {
      const a = r3(amount);
      if (a) lines.push({ accountId, amount: a, locationId: extra.locationId ?? locationId ?? null, ...extra });
    },
  };
}

function cashLegs(bag, ctx, txns) {
  for (const tx of txns || []) {
    bag.add(ctx.key(`cash:${tx.cashAccountId}`), parseFloat(tx.amount), { description: tx.description || null });
  }
}

function itemCost(ctx, it) {
  if (it.costPrice != null && it.costPrice !== '') return parseFloat(it.costPrice) || 0;
  const p = ctx.products.get(it.productId);
  if (!p) return 0;
  let v = null;
  if (Array.isArray(p.variants)) {
    if (it.variantIndex != null) v = p.variants[it.variantIndex];
    else if (it.variant) {
      v = p.variants.find((pv) => pv.options && Object.entries(pv.options).every(([k, val]) => it.variant[k] === val));
    }
  }
  return parseFloat(v?.costPrice ?? p.costPrice ?? 0) || 0;
}

function creditTender(o) {
  if (Array.isArray(o.paymentBreakdown) && o.paymentBreakdown.length) {
    return r3(o.paymentBreakdown.filter((t) => t.method === 'credit').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0));
  }
  return o.paymentMethod === 'pos_credit' ? r3(o.totalAmount) : 0;
}

const HANDLERS = [
  {
    // POS and online sales.
    sourceType: 'Order', model: Order, createdField: 'createdAt',
    date: (o) => localDate(o.createdAt),
    location: (o) => o.locationId,
    build(o, ctx, bag) {
      cashLegs(bag, ctx, ctx.cash.get(o.id));
      if (o.paymentStatus !== 'paid' || o.orderStatus === 'cancelled') return;
      const total = r3(o.totalAmount);
      const discount = r3(o.discount);
      const shipping = r3(o.shippingCharge);
      const tax = r3(o.taxAmount);
      const onAccount = creditTender(o);
      if (onAccount) bag.add(ctx.key('AR'), onAccount, { partyType: 'customer', partyId: o.userId, description: 'Sale on account' });
      if (!o.cashierSessionId) bag.add(ctx.key('ONLINE_CLEARING'), total, { description: `Online payment (${o.paymentMethod})` });
      bag.add(ctx.key('SALES'), -(total - tax - shipping + discount));
      if (discount) bag.add(ctx.key('SALES_DISCOUNT'), discount);
      if (shipping) bag.add(ctx.key('SHIPPING_INCOME'), -shipping);
      if (tax) bag.add(ctx.key('VAT_OUTPUT'), -tax);
      const cogs = r3((o.items || []).reduce((s, it) => s + itemCost(ctx, it) * (parseInt(it.quantity, 10) || 0), 0));
      bag.add(ctx.key('COGS'), cogs);
      bag.add(ctx.key('INVENTORY'), -cogs);
    },
    describe: (o) => `Sale ${o.orderNumber}`,
    reference: (o) => o.orderNumber,
  },
  {
    // Returns and POS voids.
    sourceType: 'SalesReturn', model: SalesReturn, createdField: 'createdAt',
    date: (r) => localDate(r.createdAt),
    location: (r) => r.locationId,
    build(r, ctx, bag) {
      cashLegs(bag, ctx, ctx.cash.get(r.id));
      if (r.status !== 'completed') return;
      const refund = r3(r.refundAmount);
      const order = ctx.orders.get(r.orderId);
      bag.add(ctx.key('SALES_RETURNS'), refund);
      let restock = 0;
      for (const it of r.items || []) {
        if (it.returnToStock === false) continue;
        const orig = (order?.items || []).find((o) => o.productId === it.productId
          && (o.variantIndex ?? null) === (it.variantIndex ?? null))
          || (order?.items || []).find((o) => o.productId === it.productId);
        restock += itemCost(ctx, { ...it, costPrice: orig?.costPrice }) * (parseInt(it.quantity, 10) || 0);
      }
      bag.add(ctx.key('INVENTORY'), restock);
      bag.add(ctx.key('COGS'), -restock);
      if (r.refundMethod === 'store_credit') {
        // A known customer's store credit lives on their account (negative
        // receivable they can spend); a walk-in's is an unassigned liability.
        if (order?.userId) bag.add(ctx.key('AR'), -refund, { partyType: 'customer', partyId: order.userId, description: 'Refund to customer account' });
        else bag.add(ctx.key('STORE_CREDIT'), -refund, { description: 'Store credit issued' });
      }
    },
    describe: (r) => `Return ${r.returnNumber}`,
    reference: (r) => r.returnNumber,
  },
  {
    // Goods received against a PO: stock in, owed to the supplier.
    sourceType: 'PurchaseReceipt', model: PurchaseReceipt, createdField: 'createdAt',
    date: (g) => localDate(g.receivedAt || g.createdAt),
    location: (g) => g.locationId,
    build(g, ctx, bag) {
      const po = ctx.pos.get(g.purchaseOrderId);
      const v = grnValue(g);
      bag.add(ctx.key('INVENTORY'), v);
      bag.add(ctx.key('AP'), -v, { partyType: 'supplier', partyId: po?.supplierId ?? null });
    },
    describe: (g) => `Goods received ${g.grnNumber}`,
    reference: (g) => g.grnNumber,
  },
  {
    // When a PO is fully received, true up the payable to the PO total
    // (header discount/charges not spread over the received lines).
    // updatedAt: a PO raised before the start can still be received after it.
    sourceType: 'PurchaseOrder', model: PurchaseOrder, createdField: 'updatedAt',
    date: (po) => localDate(po.receivedDate || po.updatedAt),
    location: (po) => po.locationId,
    build(po, ctx, bag) {
      if (po.status !== 'received') return;
      const grns = ctx.grnsByPo.get(po.id) || [];
      if (!grns.length || grns.some((g) => new Date(g.createdAt) < ctx.startAt)) return;
      const diff = r3(r3(po.totalAmount) - grns.reduce((s, g) => s + grnValue(g), 0));
      bag.add(ctx.key('INVENTORY'), diff, { description: 'PO total vs received value' });
      bag.add(ctx.key('AP'), -diff, { partyType: 'supplier', partyId: po.supplierId });
    },
    describe: (po) => `PO settlement ${po.poNumber}`,
    reference: (po) => po.poNumber,
  },
  {
    sourceType: 'SupplierPayment', model: SupplierPayment, createdField: 'createdAt',
    date: (p) => localDate(p.paidAt || p.createdAt),
    location: () => null,
    build(p, ctx, bag) {
      cashLegs(bag, ctx, ctx.cash.get(p.id));
      bag.add(ctx.key('AP'), r3(p.amount), { partyType: 'supplier', partyId: p.supplierId });
    },
    describe: (p) => `Supplier payment ${p.paymentNumber}`,
    reference: (p) => p.paymentNumber,
  },
  {
    sourceType: 'PurchaseReturn', model: PurchaseReturn, createdField: 'createdAt',
    date: (r) => localDate(r.createdAt),
    location: (r) => r.locationId,
    build(r, ctx, bag) {
      if (r.status !== 'completed') return;
      const v = r3(r.totalAmount);
      bag.add(ctx.key('AP'), v, { partyType: 'supplier', partyId: r.supplierId });
      bag.add(ctx.key('INVENTORY'), -v);
    },
    describe: (r) => `Purchase return ${r.returnNumber}`,
    reference: (r) => r.returnNumber,
  },
  {
    sourceType: 'Expense', model: Expense, createdField: 'createdAt',
    date: (e) => e.expenseDate,
    location: (e) => e.locationId,
    build(e, ctx, bag) {
      cashLegs(bag, ctx, ctx.cash.get(e.id));
      if (e.status === 'paid') bag.add(ctx.key(`expcat:${e.expenseCategoryId}`), r3(e.amount), { description: e.description });
    },
    describe: (e) => `Expense ${e.expenseNumber} — ${e.description}`,
    reference: (e) => e.expenseNumber,
  },
  {
    sourceType: 'CashTransfer', model: CashTransfer, createdField: 'createdAt',
    date: (tr) => tr.transferDate,
    location: () => null,
    build(tr, ctx, bag) { cashLegs(bag, ctx, ctx.cash.get(tr.id)); },
    describe: (tr) => `Cash transfer ${tr.transferNumber}`,
    reference: (tr) => tr.transferNumber,
  },
  {
    // Stock count variance at the cost logged on each movement.
    // updatedAt: a count sheet started before the start may be posted after it.
    sourceType: 'StockCount', model: StockCount, createdField: 'updatedAt',
    date: (sc) => localDate(sc.postedAt || sc.updatedAt),
    location: (sc) => sc.locationId,
    build(sc, ctx, bag) {
      if (sc.status !== 'posted') return;
      const v = r3((ctx.countMoves.get(sc.id) || []).reduce(
        (s, m) => s + m.quantityChange * (parseFloat(m.unitCost) || 0), 0));
      bag.add(ctx.key('INVENTORY'), v);
      bag.add(ctx.key('INV_ADJUST'), -v);
    },
    describe: (sc) => `Stock count ${sc.countNumber}`,
    reference: (sc) => sc.countNumber,
  },
  {
    // Manual quantity edits and imports — the only stock changes with no
    // document of their own.
    sourceType: 'StockMovement', model: StockMovement, createdField: 'createdAt', noUpdatedAt: true,
    scope: { type: ['adjust', 'import', 'other'] },
    date: (m) => localDate(m.createdAt),
    location: (m) => m.locationId,
    build(m, ctx, bag) {
      const v = r3(m.quantityChange * (parseFloat(m.unitCost) || 0));
      bag.add(ctx.key('INVENTORY'), v);
      bag.add(ctx.key('INV_ADJUST'), -v);
    },
    describe: (m) => `Stock ${m.type} (${m.quantityChange > 0 ? '+' : ''}${m.quantityChange})`,
    reference: (m) => m.reference,
  },
  {
    // Cash movements no document handler covers — manual cash entries, or
    // changes after the start to a document created before it (e.g. an old
    // expense cancelled today). The other side follows the cash source.
    sourceType: 'CashTransaction', model: CashTransaction, createdField: 'createdAt', noUpdatedAt: true,
    date: (tx) => localDate(tx.date || tx.createdAt),
    location: () => null,
    skip: (tx, ctx) => DIRECT_CASH_SOURCES.includes(tx.sourceType)
      || (tx.sourceType && ctx.docCreated.has(`${tx.sourceType}:${tx.sourceId}`)
        && ctx.docCreated.get(`${tx.sourceType}:${tx.sourceId}`) >= ctx.startAt),
    build(tx, ctx, bag) {
      const amt = r3(tx.amount);
      bag.add(ctx.key(`cash:${tx.cashAccountId}`), amt, { description: tx.description });
      const offset = tx.source === 'sale' ? ctx.key('SALES')
        : tx.source === 'return' ? ctx.key('SALES_RETURNS')
        : tx.source === 'expense' ? ctx.expenseAccount(tx.sourceId)
        : tx.source === 'supplier_payment' ? ctx.key('AP')
        : ctx.key('SUSPENSE');
      const party = tx.source === 'supplier_payment' ? { partyType: 'supplier', partyId: ctx.paymentSupplier.get(tx.sourceId) ?? null } : {};
      bag.add(offset, -amt, party);
    },
    describe: (tx) => `Cash ${tx.source}${tx.reference ? ` ${tx.reference}` : ''}`,
    reference: (tx) => tx.reference,
  },
];

const netKey = (l) => `${l.accountId}|${l.partyType || ''}|${l.partyId ?? ''}|${l.locationId ?? ''}`;

// Load everything the handlers need for one batch of documents.
async function buildContext(handler, docs, base) {
  const ids = docs.map((d) => d.id);
  const ctx = { ...base, cash: new Map(), orders: new Map(), pos: new Map(), grnsByPo: new Map(), countMoves: new Map(), products: new Map(), docCreated: new Map(), paymentSupplier: new Map() };

  if (['Order', 'SalesReturn', 'SupplierPayment', 'Expense', 'CashTransfer'].includes(handler.sourceType)) {
    const txns = await CashTransaction.findAll({ where: { sourceType: handler.sourceType, sourceId: ids }, attributes: ['sourceId', 'cashAccountId', 'amount', 'description'] });
    for (const tx of txns) {
      if (!ctx.cash.has(tx.sourceId)) ctx.cash.set(tx.sourceId, []);
      ctx.cash.get(tx.sourceId).push(tx);
    }
  }
  let itemSources = [];
  if (handler.sourceType === 'Order') itemSources = docs;
  if (handler.sourceType === 'SalesReturn') {
    const orders = await Order.findAll({ where: { id: [...new Set(docs.map((r) => r.orderId))] }, attributes: ['id', 'userId', 'items'] });
    for (const o of orders) ctx.orders.set(o.id, o);
    itemSources = [...docs, ...orders];
  }
  if (itemSources.length) {
    const pids = new Set();
    for (const d of itemSources) for (const it of d.items || []) if (it.productId) pids.add(it.productId);
    if (pids.size) {
      const products = await Product.findAll({ where: { id: [...pids] }, attributes: ['id', 'costPrice', 'variants'] });
      for (const p of products) ctx.products.set(p.id, p);
    }
  }
  if (handler.sourceType === 'PurchaseReceipt') {
    const pos = await PurchaseOrder.findAll({ where: { id: [...new Set(docs.map((g) => g.purchaseOrderId))] }, attributes: ['id', 'supplierId'] });
    for (const po of pos) ctx.pos.set(po.id, po);
  }
  if (handler.sourceType === 'PurchaseOrder') {
    const grns = await PurchaseReceipt.findAll({ where: { purchaseOrderId: ids }, attributes: ['purchaseOrderId', 'items', 'createdAt'] });
    for (const g of grns) {
      if (!ctx.grnsByPo.has(g.purchaseOrderId)) ctx.grnsByPo.set(g.purchaseOrderId, []);
      ctx.grnsByPo.get(g.purchaseOrderId).push(g);
    }
  }
  if (handler.sourceType === 'StockCount') {
    const moves = await StockMovement.findAll({ where: { refType: 'StockCount', refId: ids, type: 'count' }, attributes: ['refId', 'quantityChange', 'unitCost'] });
    for (const m of moves) {
      if (!ctx.countMoves.has(m.refId)) ctx.countMoves.set(m.refId, []);
      ctx.countMoves.get(m.refId).push(m);
    }
  }
  if (handler.sourceType === 'CashTransaction') {
    // When was each referenced document created? Decides whether its own
    // handler covers the cash movement.
    const byType = new Map();
    for (const tx of docs) {
      if (!tx.sourceType || !tx.sourceId) continue;
      if (!byType.has(tx.sourceType)) byType.set(tx.sourceType, new Set());
      byType.get(tx.sourceType).add(tx.sourceId);
    }
    const models = { Order, SalesReturn, SupplierPayment, Expense, CashTransfer };
    for (const [type, set] of byType) {
      const M = models[type];
      if (!M) continue;
      const attrs = type === 'Expense' ? ['id', 'createdAt', 'expenseCategoryId'] : type === 'SupplierPayment' ? ['id', 'createdAt', 'supplierId'] : ['id', 'createdAt'];
      const rows = await M.findAll({ where: { id: [...set] }, attributes: attrs });
      for (const r of rows) {
        ctx.docCreated.set(`${type}:${r.id}`, new Date(r.createdAt));
        if (type === 'Expense') ctx.docCreated.set(`expcat-of:${r.id}`, r.expenseCategoryId);
        if (type === 'SupplierPayment') ctx.paymentSupplier.set(r.id, r.supplierId);
      }
    }
    ctx.expenseAccount = (expenseId) => {
      const cat = ctx.docCreated.get(`expcat-of:${expenseId}`);
      return cat ? ctx.key(`expcat:${cat}`) : ctx.key('GENERAL_EXPENSE');
    };
  }

  // What is already posted for these documents, netted per line key.
  const posted = await JournalLine.findAll({
    where: { sourceType: handler.sourceType, sourceId: ids },
    attributes: ['sourceId', 'accountId', 'partyType', 'partyId', 'locationId', 'debit', 'credit'],
  });
  ctx.posted = new Map();
  for (const l of posted) {
    if (!ctx.posted.has(l.sourceId)) ctx.posted.set(l.sourceId, new Map());
    const m = ctx.posted.get(l.sourceId);
    const k = netKey(l);
    m.set(k, r3((m.get(k) || 0) + parseFloat(l.debit) - parseFloat(l.credit)));
  }
  return ctx;
}

// Post the difference between what a document should show and what is posted.
async function reconcileDoc(handler, doc, ctx) {
  if (handler.skip?.(doc, ctx)) return false;
  const loc = handler.location(doc);
  const bag = lineBag(loc);
  handler.build(doc, ctx, bag);

  // Anything the document's lines don't balance goes to Suspense.
  const imbalance = r3(bag.lines.reduce((s, l) => s + l.amount, 0));
  if (imbalance) bag.add(ctx.key('SUSPENSE'), -imbalance, { description: 'Unbalanced document — review' });

  const desired = new Map();
  const meta = new Map();
  for (const l of bag.lines) {
    const k = netKey(l);
    desired.set(k, r3((desired.get(k) || 0) + l.amount));
    if (!meta.has(k)) meta.set(k, l);
  }
  const already = ctx.posted.get(doc.id) || new Map();
  const deltaLines = [];
  for (const k of new Set([...desired.keys(), ...already.keys()])) {
    const delta = r3((desired.get(k) || 0) - (already.get(k) || 0));
    if (Math.abs(delta) < 0.0005) continue;
    const [accountId, partyType, partyId, locationId] = k.split('|');
    deltaLines.push({
      accountId: parseInt(accountId, 10),
      amount: delta,
      partyType: partyType || null,
      partyId: partyId === '' ? null : parseInt(partyId, 10),
      locationId: locationId === '' ? null : parseInt(locationId, 10),
      description: meta.get(k)?.description || null,
    });
  }
  if (!deltaLines.length) return false;

  const isAdjustment = already.size > 0;
  const t = await sequelize.transaction();
  try {
    await postJournal({
      date: isAdjustment ? localDate() : handler.date(doc),
      kind: 'auto',
      description: `${isAdjustment ? 'Adjustment: ' : ''}${handler.describe(doc)}`,
      reference: handler.reference(doc) || null,
      sourceType: handler.sourceType,
      sourceId: doc.id,
      locationId: loc ?? null,
      lines: deltaLines,
    }, { transaction: t });
    await t.commit();
  } catch (err) {
    if (!t.finished) await t.rollback().catch(() => {});
    throw err;
  }
  return true;
}

let running = null;

/**
 * Bring the ledger up to date. Incremental by default (documents changed
 * since the last run, with a few minutes' overlap); `full` re-checks every
 * document since the accounting start. Concurrent callers share one run.
 */
export function syncLedger({ full = false } = {}) {
  if (running) return running;
  running = runSync(full).finally(() => { running = null; });
  return running;
}

async function runSync(full) {
  const settings = await getAcctSettings();
  if (!settings.startAt) return { skipped: 'not-started' };
  const runStarted = new Date();
  const startAt = new Date(settings.startAt);
  const since = full || !settings.syncedAt
    ? startAt
    : new Date(Math.max(startAt.getTime(), new Date(settings.syncedAt).getTime() - 5 * 60 * 1000));

  await ensureChart();
  const key = await loadAccountKeys();
  const base = { key, startAt };
  const summary = { full, posted: 0, checked: 0, errors: [] };

  for (const handler of HANDLERS) {
    const where = { ...(handler.scope || {}), [handler.createdField]: { [Op.gte]: startAt } };
    if (!full) where[handler.noUpdatedAt ? 'createdAt' : 'updatedAt'] = { [Op.gte]: since };
    let lastId = 0;
    for (;;) {
      const docs = await handler.model.findAll({ where: { ...where, id: { [Op.gt]: lastId } }, order: [['id', 'ASC']], limit: 200 });
      if (!docs.length) break;
      lastId = docs[docs.length - 1].id;
      const ctx = await buildContext(handler, docs, base);
      for (const doc of docs) {
        summary.checked += 1;
        try {
          if (await reconcileDoc(handler, doc, ctx)) summary.posted += 1;
        } catch (err) {
          summary.errors.push(`${handler.sourceType} #${doc.id}: ${err.message}`);
          console.error('[ledger/sync]', handler.sourceType, doc.id, err.message);
        }
      }
    }
  }

  // Only move the watermark forward when everything posted, so a failed
  // document is retried on the next run.
  if (!summary.errors.length) await setAcctSetting('syncedAt', runStarted.toISOString());
  summary.finishedAt = new Date().toISOString();
  summary.errors = summary.errors.slice(0, 20);
  await setAcctSetting('lastSync', JSON.stringify(summary));
  return summary;
}

// Background sync every 2 minutes (no-op until accounting is started).
export function startLedgerJob() {
  const tick = () => syncLedger().catch((err) => console.error('[ledger/job]', err.message));
  setTimeout(tick, 30 * 1000);
  setInterval(tick, 2 * 60 * 1000);
}
