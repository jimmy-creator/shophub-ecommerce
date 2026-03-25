import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  comparePrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  brand: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  images: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  ratings: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0,
  },
  numReviews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  taxable: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  taxRate: {
    // GST rate: 0, 5, 12, 18, 28
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
  },
  hsnCode: {
    // Harmonized System of Nomenclature code (required for GST invoicing)
    type: DataTypes.STRING,
    allowNull: true,
  },
  variantOptions: {
    // e.g. { "Size": ["S","M","L"], "Color": ["Red","Blue"] }
    type: DataTypes.JSON,
    defaultValue: null,
  },
  variants: {
    // e.g. [{ options: {Size:"M",Color:"Red"}, sku:"SKU-M-RED", price:null, stock:10 }]
    type: DataTypes.JSON,
    defaultValue: null,
  },
});

export default Product;
