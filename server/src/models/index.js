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
import SalesReturn from './SalesReturn.js';
import Supplier from './Supplier.js';
import PurchaseOrder from './PurchaseOrder.js';
import PurchaseReceipt from './PurchaseReceipt.js';
import PurchaseReturn from './PurchaseReturn.js';
import SupplierPayment from './SupplierPayment.js';

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

// ── Sales Returns ───────────────────────────────────────────────
Order.hasMany(SalesReturn, { foreignKey: 'orderId' });
SalesReturn.belongsTo(Order, { foreignKey: 'orderId' });
Location.hasMany(SalesReturn, { foreignKey: 'locationId' });
SalesReturn.belongsTo(Location, { foreignKey: 'locationId' });
CashierSession.hasMany(SalesReturn, { foreignKey: 'cashierSessionId' });
SalesReturn.belongsTo(CashierSession, { foreignKey: 'cashierSessionId' });
SalesReturn.belongsTo(User, { as: 'processor', foreignKey: 'processedBy' });

// ── Purchasing (Supplier, POs, GRNs, returns, payments) ─────────
Supplier.hasMany(PurchaseOrder, { foreignKey: 'supplierId' });
PurchaseOrder.belongsTo(Supplier, { foreignKey: 'supplierId' });
Location.hasMany(PurchaseOrder, { foreignKey: 'locationId' });
PurchaseOrder.belongsTo(Location, { foreignKey: 'locationId' });
PurchaseOrder.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });

PurchaseOrder.hasMany(PurchaseReceipt, { foreignKey: 'purchaseOrderId' });
PurchaseReceipt.belongsTo(PurchaseOrder, { foreignKey: 'purchaseOrderId' });
Location.hasMany(PurchaseReceipt, { foreignKey: 'locationId' });
PurchaseReceipt.belongsTo(Location, { foreignKey: 'locationId' });
PurchaseReceipt.belongsTo(User, { as: 'receiver', foreignKey: 'receivedBy' });

Supplier.hasMany(PurchaseReturn, { foreignKey: 'supplierId' });
PurchaseReturn.belongsTo(Supplier, { foreignKey: 'supplierId' });
PurchaseOrder.hasMany(PurchaseReturn, { foreignKey: 'purchaseOrderId' });
PurchaseReturn.belongsTo(PurchaseOrder, { foreignKey: 'purchaseOrderId' });
Location.hasMany(PurchaseReturn, { foreignKey: 'locationId' });
PurchaseReturn.belongsTo(Location, { foreignKey: 'locationId' });
PurchaseReturn.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });

Supplier.hasMany(SupplierPayment, { foreignKey: 'supplierId' });
SupplierPayment.belongsTo(Supplier, { foreignKey: 'supplierId' });
PurchaseOrder.hasMany(SupplierPayment, { foreignKey: 'purchaseOrderId' });
SupplierPayment.belongsTo(PurchaseOrder, { foreignKey: 'purchaseOrderId' });
SupplierPayment.belongsTo(User, { as: 'payer', foreignKey: 'paidBy' });

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
  SalesReturn,
  Supplier, PurchaseOrder, PurchaseReceipt, PurchaseReturn, SupplierPayment,
};
