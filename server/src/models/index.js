import User from './User.js';
import Product from './Product.js';
import Order from './Order.js';

// Associations
User.hasMany(Order, { foreignKey: 'userId' });
Order.belongsTo(User, { foreignKey: 'userId' });

export { User, Product, Order };
