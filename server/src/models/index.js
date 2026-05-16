import User from './User.js';
import Product from './Product.js';
import Order from './Order.js';
import Coupon from './Coupon.js';
import Review from './Review.js';
import Setting from './Setting.js';
import Category from './Category.js';
import Pincode from './Pincode.js';
import AbandonedCart from './AbandonedCart.js';
import PriceRequest from './PriceRequest.js';
import Location from './Location.js';
import ProductStock from './ProductStock.js';
import StockTransfer from './StockTransfer.js';
import CashierSession from './CashierSession.js';

// ── Existing associations ────────────────────────────────────────
User.hasMany(Order, { foreignKey: 'userId' });
Order.belongsTo(User, { foreignKey: 'userId' });

Product.hasMany(Review, { foreignKey: 'productId' });
Review.belongsTo(Product, { foreignKey: 'productId' });
Review.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(PriceRequest, { foreignKey: 'userId' });
PriceRequest.belongsTo(User, { foreignKey: 'userId' });
PriceRequest.belongsTo(Order, { foreignKey: 'orderId' });

// ── Multi-location inventory ─────────────────────────────────────
Location.hasMany(ProductStock, { foreignKey: 'locationId' });
ProductStock.belongsTo(Location, { foreignKey: 'locationId' });

Product.hasMany(ProductStock, { foreignKey: 'productId' });
ProductStock.belongsTo(Product, { foreignKey: 'productId' });

// ── Stock transfers ──────────────────────────────────────────────
StockTransfer.belongsTo(Location, { as: 'fromLocation', foreignKey: 'fromLocationId' });
StockTransfer.belongsTo(Location, { as: 'toLocation', foreignKey: 'toLocationId' });
StockTransfer.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });

// ── Cashier shifts ───────────────────────────────────────────────
User.hasMany(CashierSession, { foreignKey: 'userId' });
CashierSession.belongsTo(User, { foreignKey: 'userId' });
Location.hasMany(CashierSession, { foreignKey: 'locationId' });
CashierSession.belongsTo(Location, { foreignKey: 'locationId' });

User.belongsTo(Location, { as: 'homeLocation', foreignKey: 'homeLocationId' });

// ── Order ↔ Location + CashierSession ────────────────────────────
Order.belongsTo(Location, { foreignKey: 'locationId' });
Location.hasMany(Order, { foreignKey: 'locationId' });
Order.belongsTo(CashierSession, { foreignKey: 'cashierSessionId' });
CashierSession.hasMany(Order, { foreignKey: 'cashierSessionId' });

// ── Keep Product.stock in sync with SUM(ProductStock.quantity) ───
// Called explicitly by routes after they mutate ProductStock (and after
// any transaction has committed). An earlier version did this via
// afterCreate/afterUpdate/afterDestroy hooks, but the hook ran inside
// the active transaction context and produced TransactionFinishedError
// cascades — explicit recompute is more predictable.
export async function recomputeProductStock(productId) {
  if (!productId) return;
  try {
    const total = await ProductStock.sum('quantity', { where: { productId } });
    await Product.update({ stock: total || 0 }, { where: { id: productId } });
  } catch (err) {
    console.error('[recomputeProductStock]', productId, err.message);
  }
}

export {
  User, Product, Order, Coupon, Review, Setting, Category,
  Pincode, AbandonedCart, PriceRequest,
  Location, ProductStock, StockTransfer, CashierSession,
};
