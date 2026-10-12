import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Append-only log of every ProductStock quantity change.
 *
 * Written by the ProductStock hooks in models/index.js — never by routes
 * directly — so every path that touches stock (POS, returns, GRNs,
 * transfers, counts, imports, write-offs) is covered. `type` and the
 * reference come from the request context (services/stockContext.js).
 *
 * unitCost is the product/variant cost at the moment of the movement,
 * so the movement's value (quantityChange × unitCost) is fixed.
 */
const StockMovement = sequelize.define('StockMovement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  variantIndex: { type: DataTypes.INTEGER, allowNull: true },
  locationId: { type: DataTypes.INTEGER, allowNull: false },
  quantityChange: { type: DataTypes.INTEGER, allowNull: false },
  quantityAfter: { type: DataTypes.INTEGER, allowNull: true },
  // sale | sale_online | void | return | return_cancel | receipt |
  // purchase_return | purchase_return_cancel | transfer_out | transfer_in |
  // transfer_cancel | count | adjust | import | write_off |
  // write_off_cancel | other
  type: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'other' },
  refType: { type: DataTypes.STRING(40), allowNull: true },
  refId: { type: DataTypes.INTEGER, allowNull: true },
  reference: { type: DataTypes.STRING, allowNull: true },
  unitCost: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  note: { type: DataTypes.STRING, allowNull: true },
}, {
  updatedAt: false,
  indexes: [
    { fields: ['productId', 'variantIndex', 'locationId'] },
    { fields: ['locationId', 'createdAt'] },
    { fields: ['type', 'createdAt'] },
    { fields: ['refType', 'refId'] },
    { fields: ['createdAt'] },
  ],
});

export default StockMovement;
