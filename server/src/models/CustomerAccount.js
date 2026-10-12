import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Credit terms for a customer (User with role 'customer').
 *
 * A customer can buy "on account" at the POS only when allowCredit is
 * on, and only while their balance stays within creditLimit
 * (0 = no limit). openingBalance is what they already owed when the
 * account was set up.
 *
 * Balance = openingBalance + on-account sales − store-credit refunds
 *           − receipts (see services/customerCredit.js).
 */
const CustomerAccount = sequelize.define('CustomerAccount', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  allowCredit: { type: DataTypes.BOOLEAN, defaultValue: true },
  creditLimit: { type: DataTypes.DECIMAL(12, 3), defaultValue: 0 },
  openingBalance: { type: DataTypes.DECIMAL(12, 3), defaultValue: 0 },
  notes: { type: DataTypes.TEXT, allowNull: true },
});

export default CustomerAccount;
