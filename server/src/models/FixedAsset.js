import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Fixed-asset register entry (furniture, equipment, vehicles, …).
 *
 * Depreciation is straight-line, monthly:
 *   (cost − salvageValue) / usefulLifeMonths per month,
 * starting from depreciationStartDate, until the book value reaches the
 * salvage value. Each posted month is an AssetDepreciation row.
 *
 * `assetAccountId` is the fixed-asset GL account the cost sits in; the
 * accumulated depreciation and depreciation expense accounts are the
 * system ones (ACCUM_DEP, DEPRECIATION).
 *
 * acquisitionMethod:
 *   cash    — paid from cashAccountId (writes a cash transaction)
 *   payable — bought on credit (Cr Other Payables)
 *   opening — owned before accounting started (Cr Opening Balance Equity,
 *             with openingAccumulatedDep already depreciated)
 */
const FixedAsset = sequelize.define('FixedAsset', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  assetAccountId: { type: DataTypes.INTEGER, allowNull: false },
  locationId: { type: DataTypes.INTEGER, allowNull: true },
  serialNumber: { type: DataTypes.STRING, allowNull: true },
  supplier: { type: DataTypes.STRING, allowNull: true },
  acquisitionDate: { type: DataTypes.DATEONLY, allowNull: false },
  cost: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
  salvageValue: { type: DataTypes.DECIMAL(14, 3), defaultValue: 0 },
  usefulLifeMonths: { type: DataTypes.INTEGER, allowNull: false },
  depreciationStartDate: { type: DataTypes.DATEONLY, allowNull: false },
  acquisitionMethod: {
    type: DataTypes.ENUM('cash', 'payable', 'opening'),
    defaultValue: 'cash',
  },
  cashAccountId: { type: DataTypes.INTEGER, allowNull: true },
  openingAccumulatedDep: { type: DataTypes.DECIMAL(14, 3), defaultValue: 0 },
  status: {
    type: DataTypes.ENUM('active', 'disposed'),
    defaultValue: 'active',
  },
  disposalDate: { type: DataTypes.DATEONLY, allowNull: true },
  disposalProceeds: { type: DataTypes.DECIMAL(14, 3), allowNull: true },
  disposalCashAccountId: { type: DataTypes.INTEGER, allowNull: true },
  disposalNotes: { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  indexes: [
    { fields: ['status'] },
    { fields: ['assetAccountId'] },
    { fields: ['locationId'] },
  ],
});

export default FixedAsset;
