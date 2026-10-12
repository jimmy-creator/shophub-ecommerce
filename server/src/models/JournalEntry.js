import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * A balanced double-entry journal (header). Lines live in JournalLine.
 *
 * Entries are never edited or deleted once posted — corrections are new
 * entries. A manual journal is voided by posting its mirror image
 * (reversalOfId points at the original, reversedById back).
 *
 * `sourceType` + `sourceId` tie auto-posted entries to the document that
 * produced them (Order, SalesReturn, PurchaseReceipt, …). One document can
 * have several entries: the original plus later adjustments when the
 * document changes (bill edit, cancellation).
 *
 * `date` is the accounting date in the store's timezone.
 */
const JournalEntry = sequelize.define('JournalEntry', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  entryNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  // auto | manual | opening | depreciation | asset | write_off | receipt | reversal
  kind: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'manual' },
  description: { type: DataTypes.STRING(500), allowNull: true },
  reference: { type: DataTypes.STRING, allowNull: true },
  sourceType: { type: DataTypes.STRING(40), allowNull: true },
  sourceId: { type: DataTypes.INTEGER, allowNull: true },
  locationId: { type: DataTypes.INTEGER, allowNull: true },
  totalAmount: { type: DataTypes.DECIMAL(14, 3), defaultValue: 0 },
  reversalOfId: { type: DataTypes.INTEGER, allowNull: true },
  reversedById: { type: DataTypes.INTEGER, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  indexes: [
    { fields: ['date'] },
    { fields: ['sourceType', 'sourceId'] },
    { fields: ['kind'] },
  ],
});

export default JournalEntry;
