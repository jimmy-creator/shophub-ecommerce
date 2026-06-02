import { Router } from 'express';
import { Order, Product, User, Review } from '../models/index.js';
import { protect, admin, requirePermission } from '../middleware/auth.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';

const router = Router();

// Dashboard overview
router.get('/overview', protect, admin, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Total revenue
    const totalRevenue = await Order.sum('totalAmount', {
      where: { paymentStatus: 'paid' },
    }) || 0;

    // This month revenue
    const monthRevenue = await Order.sum('totalAmount', {
      where: { paymentStatus: 'paid', createdAt: { [Op.gte]: thisMonth } },
    }) || 0;

    // Last month revenue (for comparison)
    const lastMonthRevenue = await Order.sum('totalAmount', {
      where: {
        paymentStatus: 'paid',
        createdAt: { [Op.gte]: lastMonth, [Op.lte]: lastMonthEnd },
      },
    }) || 0;

    // Today's revenue
    const todayRevenue = await Order.sum('totalAmount', {
      where: { paymentStatus: 'paid', createdAt: { [Op.gte]: today } },
    }) || 0;

    // Order counts
    const totalOrders = await Order.count();
    const monthOrders = await Order.count({ where: { createdAt: { [Op.gte]: thisMonth } } });
    const todayOrders = await Order.count({ where: { createdAt: { [Op.gte]: today } } });
    const pendingOrders = await Order.count({ where: { orderStatus: 'processing' } });

    // Customers
    const totalCustomers = await User.count({ where: { role: 'customer' } });
    const newCustomers = await User.count({
      where: { role: 'customer', createdAt: { [Op.gte]: thisMonth } },
    });

    // Products
    const totalProducts = await Product.count({ where: { active: true } });
    const lowStock = await Product.count({ where: { active: true, stock: { [Op.lte]: 5 }, stock: { [Op.gt]: 0 } } });
    const outOfStock = await Product.count({ where: { active: true, stock: 0 } });

    // Reviews
    const totalReviews = await Review.count();

    // Revenue growth %
    const revenueGrowth = lastMonthRevenue > 0
      ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : monthRevenue > 0 ? 100 : 0;

    res.json({
      revenue: {
        total: parseFloat(totalRevenue),
        month: parseFloat(monthRevenue),
        today: parseFloat(todayRevenue),
        growth: revenueGrowth,
      },
      orders: {
        total: totalOrders,
        month: monthOrders,
        today: todayOrders,
        pending: pendingOrders,
      },
      customers: {
        total: totalCustomers,
        new: newCustomers,
      },
      products: {
        total: totalProducts,
        lowStock,
        outOfStock,
      },
      reviews: totalReviews,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Revenue chart data (last 30 days or 12 months)
router.get('/revenue-chart', protect, admin, async (req, res) => {
  try {
    const { period = '30days' } = req.query;

    let data;
    if (period === '12months') {
      // Monthly revenue for last 12 months
      data = await Order.findAll({
        where: {
          paymentStatus: 'paid',
          createdAt: { [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 12)) },
        },
        attributes: [
          [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m'), 'period'],
          [sequelize.fn('SUM', sequelize.col('totalAmount')), 'revenue'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
        ],
        group: [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m')],
        order: [[sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m'), 'ASC']],
        raw: true,
      });
    } else {
      // Daily revenue for last 30 days
      data = await Order.findAll({
        where: {
          paymentStatus: 'paid',
          createdAt: { [Op.gte]: new Date(new Date().setDate(new Date().getDate() - 30)) },
        },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('createdAt')), 'period'],
          [sequelize.fn('SUM', sequelize.col('totalAmount')), 'revenue'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
        ],
        group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
        order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
        raw: true,
      });
    }

    let out = data.map((d) => {
      const revenue = parseFloat(d.revenue);
      const orders = parseInt(d.orders);
      return {
        period: typeof d.period === 'string' ? d.period : new Date(d.period).toISOString().slice(0, 10),
        revenue,
        orders,
        aov: orders > 0 ? revenue / orders : 0,
      };
    });

    // Optional ?compare=true: also fetch the prior window of equal length and
    // attach `previousRevenue` aligned by shifted date — for an overlay line.
    if (req.query.compare === 'true') {
      const monthly = period === '12months';
      const prevSince = monthly
        ? new Date(new Date().setMonth(new Date().getMonth() - 24))
        : new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const prevUntil = monthly
        ? new Date(new Date().setMonth(new Date().getMonth() - 12))
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const prev = await Order.findAll({
        where: {
          paymentStatus: 'paid',
          createdAt: { [Op.gte]: prevSince, [Op.lt]: prevUntil },
        },
        attributes: [
          [sequelize.fn(monthly ? 'DATE_FORMAT' : 'DATE',
            sequelize.col('createdAt'),
            ...(monthly ? ['%Y-%m'] : [])), 'period'],
          [sequelize.fn('SUM', sequelize.col('totalAmount')), 'revenue'],
        ],
        group: [sequelize.fn(monthly ? 'DATE_FORMAT' : 'DATE',
          sequelize.col('createdAt'),
          ...(monthly ? ['%Y-%m'] : []))],
        raw: true,
      });

      // Build a map keyed by the prior period shifted forward to align with current.
      const prevMap = new Map();
      for (const p of prev) {
        const periodStr = typeof p.period === 'string' ? p.period : new Date(p.period).toISOString().slice(0, 10);
        let shifted;
        if (monthly) {
          const [y, m] = periodStr.split('-').map(Number);
          const dt = new Date(Date.UTC(y, m - 1 + 12, 1));
          shifted = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
        } else {
          const dt = new Date(periodStr); dt.setDate(dt.getDate() + 30);
          shifted = dt.toISOString().slice(0, 10);
        }
        prevMap.set(shifted, parseFloat(p.revenue));
      }
      out = out.map((d) => ({ ...d, previousRevenue: prevMap.get(d.period) || 0 }));
    }

    res.json(out);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Top selling products
router.get('/top-products', protect, admin, async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { paymentStatus: 'paid' },
      attributes: ['items'],
      raw: true,
    });

    // Aggregate sales by product
    const productSales = {};
    for (const order of orders) {
      const items = order.items || [];
      for (const item of items) {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            id: item.productId,
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.price * item.quantity;
      }
    }

    const sorted = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json(sorted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Order status breakdown
router.get('/order-status', protect, admin, async (req, res) => {
  try {
    const statuses = await Order.findAll({
      attributes: [
        'orderStatus',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['orderStatus'],
      raw: true,
    });

    const result = {};
    statuses.forEach((s) => { result[s.orderStatus] = parseInt(s.count); });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Recent orders
router.get('/recent-orders', protect, admin, async (req, res) => {
  try {
    const orders = await Order.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [{ model: User, attributes: ['name', 'email'] }],
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Payment methods breakdown
router.get('/payment-methods', protect, admin, async (req, res) => {
  try {
    const methods = await Order.findAll({
      attributes: [
        'paymentMethod',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'revenue'],
      ],
      where: { paymentStatus: 'paid' },
      group: ['paymentMethod'],
      raw: true,
    });

    res.json(methods.map((m) => ({
      method: m.paymentMethod,
      count: parseInt(m.count),
      revenue: parseFloat(m.revenue),
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Low stock products list
router.get('/low-stock', protect, admin, async (req, res) => {
  try {
    const threshold = parseInt(process.env.LOW_STOCK_THRESHOLD || '5');
    const products = await Product.findAll({
      where: {
        active: true,
        stock: { [Op.lte]: threshold },
      },
      attributes: ['id', 'name', 'slug', 'stock', 'category', 'images'],
      order: [['stock', 'ASC']],
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Hour-of-day × day-of-week activity grid for the dashboard heatmap.
// One SQL grouped by HOUR + DAYOFWEEK over a rolling N-day window (default 90).
// Sparse output (only buckets with orders) — the client fills the rest with 0.
router.get('/order-patterns', protect, admin, async (req, res) => {
  try {
    const days = Math.max(1, Math.min(365, parseInt(req.query.days) || 90));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await Order.findAll({
      where: { paymentStatus: 'paid', createdAt: { [Op.gte]: since } },
      attributes: [
        [sequelize.fn('HOUR', sequelize.col('createdAt')), 'hour'],
        [sequelize.fn('DAYOFWEEK', sequelize.col('createdAt')), 'day'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'revenue'],
      ],
      group: [
        sequelize.fn('HOUR', sequelize.col('createdAt')),
        sequelize.fn('DAYOFWEEK', sequelize.col('createdAt')),
      ],
      raw: true,
    });

    res.json({
      windowDays: days,
      cells: rows.map((r) => ({
        hour: parseInt(r.hour),
        // MySQL DAYOFWEEK returns 1..7 (Sun..Sat); normalize to 0..6 (Sun=0).
        day: (parseInt(r.day) || 1) - 1,
        orders: parseInt(r.orders),
        revenue: parseFloat(r.revenue || 0),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Operational health time-series: AOV + cancel rate + return rate per period.
// Same period/compare semantics as /revenue-chart so the same toggle controls both.
router.get('/operational-trends', protect, admin, async (req, res) => {
  try {
    const { period = '30days' } = req.query;
    const monthly = period === '12months';
    const since = monthly
      ? new Date(new Date().setMonth(new Date().getMonth() - 12))
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // One aggregate query — totals + status-conditional sums — so AOV and the
    // cancel/return rates come out of the same row per period.
    const periodFn = monthly
      ? sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m')
      : sequelize.fn('DATE', sequelize.col('createdAt'));

    const buildRow = (rows) => rows.map((r) => {
      const totalOrders = parseInt(r.totalOrders) || 0;
      const paidRevenue = parseFloat(r.paidRevenue) || 0;
      const paidCount = parseInt(r.paidCount) || 0;
      const cancelledCount = parseInt(r.cancelledCount) || 0;
      const returnedCount = parseInt(r.returnedCount) || 0;
      return {
        period: typeof r.period === 'string' ? r.period : new Date(r.period).toISOString().slice(0, 10),
        aov: paidCount > 0 ? paidRevenue / paidCount : 0,
        totalOrders,
        cancelRate: totalOrders > 0 ? cancelledCount / totalOrders : 0,
        returnRate: totalOrders > 0 ? returnedCount / totalOrders : 0,
      };
    });

    const attrs = [
      [periodFn, 'period'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalOrders'],
      [sequelize.literal("SUM(CASE WHEN paymentStatus='paid' THEN totalAmount ELSE 0 END)"), 'paidRevenue'],
      [sequelize.literal("SUM(CASE WHEN paymentStatus='paid' THEN 1 ELSE 0 END)"), 'paidCount'],
      [sequelize.literal("SUM(CASE WHEN orderStatus='cancelled' THEN 1 ELSE 0 END)"), 'cancelledCount'],
      [sequelize.literal("SUM(CASE WHEN orderStatus='returned' THEN 1 ELSE 0 END)"), 'returnedCount'],
    ];

    const current = await Order.findAll({
      where: { createdAt: { [Op.gte]: since } },
      attributes: attrs,
      group: [periodFn],
      order: [[periodFn, 'ASC']],
      raw: true,
    });

    let out = buildRow(current);

    if (req.query.compare === 'true') {
      const prevSince = monthly
        ? new Date(new Date().setMonth(new Date().getMonth() - 24))
        : new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const prevUntil = since;

      const previous = await Order.findAll({
        where: { createdAt: { [Op.gte]: prevSince, [Op.lt]: prevUntil } },
        attributes: attrs,
        group: [periodFn],
        raw: true,
      });

      const prevRows = buildRow(previous);
      // Shift each previous row's period forward by 30 days / 12 months and key
      // the map so we can pair it with the equivalent current-period row.
      const prevMap = new Map();
      for (const p of prevRows) {
        let shifted;
        if (monthly) {
          const [y, m] = p.period.split('-').map(Number);
          const dt = new Date(Date.UTC(y, m - 1 + 12, 1));
          shifted = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
        } else {
          const dt = new Date(p.period); dt.setDate(dt.getDate() + 30);
          shifted = dt.toISOString().slice(0, 10);
        }
        prevMap.set(shifted, p);
      }
      out = out.map((d) => {
        const prev = prevMap.get(d.period);
        return {
          ...d,
          previousAov: prev ? prev.aov : 0,
          previousCancelRate: prev ? prev.cancelRate : 0,
          previousReturnRate: prev ? prev.returnRate : 0,
        };
      });
    }

    res.json(out);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Star-rating distribution across all reviews — for the dashboard histogram.
router.get('/rating-distribution', protect, admin, async (req, res) => {
  try {
    const rows = await Review.findAll({
      attributes: [
        [sequelize.fn('FLOOR', sequelize.col('rating')), 'rating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: [sequelize.fn('FLOOR', sequelize.col('rating'))],
      raw: true,
    });
    const byRating = new Map(rows.map((r) => [parseInt(r.rating), parseInt(r.count)]));
    res.json([1, 2, 3, 4, 5].map((rating) => ({ rating, count: byRating.get(rating) || 0 })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
