import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Stock taken out of inventory because it can no longer be sold —
 * damaged, expired, lost, stolen, used as samples, etc.
 *
 * Posting reduces ProductStock at the location and writes a journal
 * (Dr Stock Write-offs, Cr Inventory) at cost. Cancelling puts the
 * stock back and reverses the journal.
 */
const StockWriteOff = sequelize.define('StockWriteOff', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  writeOffNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
  locationId: { type: DataTypes.INTEGER, allowNull: false },
  reason: {
    type: DataTypes.ENUM('damaged', 'expired', 'lost', 'theft', 'sample', 'other'),
    allowNull: false,
    defaultValue: 'damaged',
  },
  // [{ productId, variantIndex, name, sku, quantity, unitCost, value }]
  items: { type: DataTypes.JSON, allowNull: false },
  totalQty: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalValue: { type: DataTypes.DECIMAL(12, 3), defaultValue: 0 },
  notes: { type: DataTypes.TEXT, allowNull: true },
  writeOffDate: { type: DataTypes.DATEONLY, allowNull: false },
  status: {
    type: DataTypes.ENUM('posted', 'cancelled'),
    defaultValue: 'posted',
  },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
  managerOverrideBy: { type: DataTypes.INTEGER, allowNull: true },
  cancelledBy: { type: DataTypes.INTEGER, allowNull: true },
  cancelledAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [
    { fields: ['locationId'] },
    { fields: ['writeOffDate'] },
    { fields: ['status'] },
    { fields: ['reason'] },
  ],
});

export default StockWriteOff;
