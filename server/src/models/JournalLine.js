import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * One debit or credit line of a JournalEntry.
 *
 * `date`, `sourceType` and `sourceId` are copied from the header so the
 * ledger and trial-balance queries (and the posting engine's "what is
 * already posted for this document" check) run on this table alone.
 *
 * `partyType` + `partyId` tag receivable/payable lines with the customer
 * (User) or Supplier they belong to — that is what customer and supplier
 * statements read.
 */
const JournalLine = sequelize.define('JournalLine', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  journalEntryId: { type: DataTypes.INTEGER, allowNull: false },
  accountId: { type: DataTypes.INTEGER, allowNull: false },
  debit: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
  credit: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
  description: { type: DataTypes.STRING(500), allowNull: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  locationId: { type: DataTypes.INTEGER, allowNull: true },
  partyType: { type: DataTypes.STRING(20), allowNull: true },   // 'customer' | 'supplier'
  partyId: { type: DataTypes.INTEGER, allowNull: true },
  sourceType: { type: DataTypes.STRING(40), allowNull: true },
  sourceId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  indexes: [
    { fields: ['journalEntryId'] },
    { fields: ['accountId', 'date'] },
    { fields: ['partyType', 'partyId'] },
    { fields: ['sourceType', 'sourceId'] },
    { fields: ['date'] },
  ],
});

export default JournalLine;
