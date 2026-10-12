import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Money received from a customer against their account balance.
 * Writes a cash transaction into cashAccountId and a journal
 * (Dr cash, Cr Accounts Receivable). Cancelling reverses both.
 */
const CustomerPayment = sequelize.define('CustomerPayment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  receiptNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
  cashAccountId: { type: DataTypes.INTEGER, allowNull: false },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'knet', 'card', 'bank', 'cheque', 'other'),
    defaultValue: 'cash',
  },
  reference: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  paymentDate: { type: DataTypes.DATEONLY, allowNull: false },
  status: {
    type: DataTypes.ENUM('posted', 'cancelled'),
    defaultValue: 'posted',
  },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
}, {
  indexes: [
    { fields: ['userId'] },
    { fields: ['paymentDate'] },
  ],
});

export default CustomerPayment;
