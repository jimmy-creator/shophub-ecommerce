/**
 * Customer account balances ("on account" sales and store credit).
 *
 * Computed straight from the documents, so it works whether or not the
 * general ledger has been started:
 *
 *   balance = CustomerAccount.openingBalance
 *           + on-account POS sales        (Order paymentMethod 'pos_credit')
 *           − store-credit refunds        (SalesReturn refundMethod 'store_credit'
 *                                          on that customer's orders)
 *           − receipts                    (CustomerPayment, status posted)
 *
 * Positive = the customer owes the store; negative = the store owes them
 * (store credit they can spend on their next purchase).
 */
import { Op } from 'sequelize';
import {
  User, Order, SalesReturn, CustomerAccount, CustomerPayment, CashAccount,
} from '../models/index.js';

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

const creditPart = (o) => {
  if (Array.isArray(o.paymentBreakdown) && o.paymentBreakdown.length) {
    return o.paymentBreakdown.filter((t) => t.method === 'credit').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  }
  return o.paymentMethod === 'pos_credit' ? parseFloat(o.totalAmount) || 0 : 0;
};

const isLive = (o) => o.paymentStatus === 'paid' && o.orderStatus !== 'cancelled';

// Balances for every customer with an account or a non-zero balance.
export async function customerBalances({ userIds = null, transaction } = {}) {
  const userWhere = userIds ? { userId: userIds } : {};
  const [accounts, creditOrders, creditReturns, payments] = await Promise.all([
    CustomerAccount.findAll({ where: userWhere, transaction }),
    Order.findAll({
      where: { ...userWhere, userId: userIds || { [Op.ne]: null }, paymentMethod: ['pos_credit', 'pos_split'] },
      attributes: ['userId', 'paymentMethod', 'paymentBreakdown', 'totalAmount', 'paymentStatus', 'orderStatus'],
      transaction,
    }),
    SalesReturn.findAll({
      where: { refundMethod: 'store_credit', status: 'completed' },
      include: [{ model: Order, attributes: ['userId'], where: { userId: userIds || { [Op.ne]: null } } }],
      attributes: ['refundAmount'],
      transaction,
    }),
    CustomerPayment.findAll({ where: { ...userWhere, status: 'posted' }, attributes: ['userId', 'amount'], transaction }),
  ]);

  const bal = new Map();
  const add = (uid, v) => bal.set(uid, (bal.get(uid) || 0) + v);
  for (const a of accounts) add(a.userId, parseFloat(a.openingBalance) || 0);
  for (const o of creditOrders) if (isLive(o)) add(o.userId, creditPart(o));
  for (const r of creditReturns) add(r.Order.userId, -(parseFloat(r.refundAmount) || 0));
  for (const p of payments) add(p.userId, -(parseFloat(p.amount) || 0));

  const acctBy = new Map(accounts.map((a) => [a.userId, a]));
  const ids = [...new Set([...acctBy.keys(), ...[...bal.entries()].filter(([, v]) => r3(v) !== 0).map(([k]) => k)])];
  if (!ids.length) return [];
  const users = await User.findAll({ where: { id: ids }, attributes: ['id', 'name', 'email', 'phone'], transaction });
  return users.map((u) => {
    const a = acctBy.get(u.id);
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      hasAccount: !!a,
      allowCredit: a ? !!a.allowCredit : false,
      creditLimit: a ? r3(a.creditLimit) : 0,
      openingBalance: a ? r3(a.openingBalance) : 0,
      notes: a?.notes || null,
      balance: r3(bal.get(u.id) || 0),
    };
  }).sort((x, y) => y.balance - x.balance || x.name.localeCompare(y.name));
}

export async function customerBalance(userId, { transaction } = {}) {
  const [row] = await customerBalances({ userIds: [userId], transaction });
  return row || {
    userId, hasAccount: false, allowCredit: false, creditLimit: 0, openingBalance: 0, balance: 0,
  };
}

/**
 * Can this customer put `amount` on account? Allowed when credit is
 * switched on for them and the new balance stays within the limit
 * (0 = unlimited), or when existing store credit covers the amount.
 */
export async function checkCreditAllowed(userId, amount, { transaction } = {}) {
  const acct = await customerBalance(userId, { transaction });
  const after = r3(acct.balance + amount);
  if (acct.balance < 0 && after <= 0) return acct;   // spending store credit
  if (!acct.allowCredit) throw new Error('This customer is not set up to buy on account');
  if (acct.creditLimit > 0 && after > acct.creditLimit) {
    throw new Error(`Credit limit ${acct.creditLimit.toFixed(3)} exceeded — balance would be ${after.toFixed(3)}`);
  }
  return acct;
}

// Running-balance statement for one customer.
export async function customerStatement(userId) {
  const [acct, orders, returns, payments] = await Promise.all([
    CustomerAccount.findOne({ where: { userId } }),
    Order.findAll({
      where: { userId, paymentMethod: ['pos_credit', 'pos_split'] },
      attributes: ['id', 'orderNumber', 'paymentMethod', 'paymentBreakdown', 'totalAmount', 'paymentStatus', 'orderStatus', 'createdAt'],
    }),
    SalesReturn.findAll({
      where: { refundMethod: 'store_credit', status: 'completed' },
      include: [{ model: Order, attributes: ['orderNumber', 'userId'], where: { userId } }],
      attributes: ['id', 'returnNumber', 'refundAmount', 'createdAt'],
    }),
    CustomerPayment.findAll({
      where: { userId },
      include: [{ model: CashAccount, attributes: ['id', 'name'] }],
      order: [['paymentDate', 'ASC']],
    }),
  ]);
  const rows = [];
  for (const o of orders) {
    const amt = creditPart(o);
    if (!amt || !isLive(o)) continue;
    rows.push({ date: o.createdAt, type: 'sale', reference: o.orderNumber, description: 'Sale on account', debit: r3(amt), credit: 0, refId: o.id });
  }
  for (const r of returns) {
    rows.push({ date: r.createdAt, type: 'return', reference: r.returnNumber, description: `Refund to account (${r.Order.orderNumber})`, debit: 0, credit: r3(r.refundAmount), refId: r.id });
  }
  for (const p of payments) {
    if (p.status !== 'posted') continue;
    // Same-day payments sort by when they were entered; back-dated ones by their date.
    const enteredOn = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.STORE_TZ || 'Asia/Kuwait' }).format(p.createdAt);
    rows.push({ date: enteredOn === p.paymentDate ? p.createdAt : `${p.paymentDate}T12:00:00`, type: 'payment', reference: p.receiptNumber, description: `Payment received${p.CashAccount ? ` — ${p.CashAccount.name}` : ''}`, debit: 0, credit: r3(p.amount), refId: p.id });
  }
  rows.sort((a, b) => new Date(a.date) - new Date(b.date));
  let running = r3(acct?.openingBalance || 0);
  const opening = running;
  for (const row of rows) {
    running = r3(running + row.debit - row.credit);
    row.balance = running;
  }
  return { opening, closing: running, rows, payments };
}
