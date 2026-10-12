import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Chart of Accounts — one row per general-ledger account.
 *
 * `type` drives the sign convention and which statement the account
 * lands on: asset/expense are debit-normal, liability/equity/income are
 * credit-normal. Group accounts (isGroup) are headings only — journals
 * never post to them.
 *
 * `systemKey` marks accounts the auto-posting engine needs (e.g.
 * 'INVENTORY', 'COGS', 'AP'), plus one per cash account ('cash:<id>')
 * and expense category ('expcat:<id>'). System accounts can be renamed
 * and re-coded but not deleted or re-typed.
 */
const Account = sequelize.define('Account', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  nameAr: { type: DataTypes.STRING, allowNull: true },
  type: {
    type: DataTypes.ENUM('asset', 'liability', 'equity', 'income', 'expense'),
    allowNull: false,
  },
  parentId: { type: DataTypes.INTEGER, allowNull: true },
  isGroup: { type: DataTypes.BOOLEAN, defaultValue: false },
  systemKey: { type: DataTypes.STRING(40), allowNull: true, unique: true },
  description: { type: DataTypes.STRING, allowNull: true },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  indexes: [
    { fields: ['type'] },
    { fields: ['parentId'] },
  ],
});

export default Account;
