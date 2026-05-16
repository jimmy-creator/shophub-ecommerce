import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import bcrypt from 'bcryptjs';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('customer', 'admin', 'staff', 'cashier'),
    defaultValue: 'customer',
  },
  permissions: {
    // Staff permissions: ["products","orders","coupons","reviews","customers","analytics","categories","settings"]
    type: DataTypes.JSON,
    defaultValue: null,
  },
  pin: {
    // 4-6 digit PIN for cashier quick-login at the POS terminal.
    // Stored hashed (bcrypt) — never plaintext. Only used for role='cashier'.
    type: DataTypes.STRING,
    allowNull: true,
  },
  homeLocationId: {
    // Cashier's default store. POS suggests this Location when starting
    // a shift, but the cashier can override.
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  resetToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  resetTokenExpiry: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  hooks: {
    beforeCreate: async (user) => {
      user.password = await bcrypt.hash(user.password, 12);
      if (user.pin) user.pin = await bcrypt.hash(user.pin, 10);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
      if (user.changed('pin') && user.pin) {
        user.pin = await bcrypt.hash(user.pin, 10);
      }
    },
  },
});

User.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.comparePin = async function (candidatePin) {
  if (!this.pin) return false;
  return bcrypt.compare(String(candidatePin), this.pin);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  delete values.resetToken;
  delete values.resetTokenExpiry;
  return values;
};

export default User;
