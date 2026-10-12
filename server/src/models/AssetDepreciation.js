import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * One month of depreciation posted for one FixedAsset. The unique
 * (fixedAssetId, period) index is what stops a month being depreciated
 * twice if the run is repeated.
 */
const AssetDepreciation = sequelize.define('AssetDepreciation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fixedAssetId: { type: DataTypes.INTEGER, allowNull: false },
  period: { type: DataTypes.STRING(7), allowNull: false },   // 'YYYY-MM'
  amount: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
  journalEntryId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  updatedAt: false,
  indexes: [
    { unique: true, fields: ['fixedAssetId', 'period'], name: 'asset_period_unique' },
    { fields: ['period'] },
  ],
});

export default AssetDepreciation;
