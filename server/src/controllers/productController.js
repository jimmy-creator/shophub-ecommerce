import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { Product, ProductStock, getOnlineLocationId } from '../models/index.js';

// Multi-location stores (store4) keep a separate online inventory pool and can
// hide products from the storefront. Other stores leave these paths untouched.
const MULTILOC = process.env.FEATURE_MULTILOC === 'true';

// Overlay the online store's separate stock (the isOnlineDefault location's
// ProductStock) onto a list of plain product objects, replacing the aggregate
// `stock` and each `variants[i].stock`. Products/variants with no row read 0.
// No-op (returns input unchanged) when no online location is configured yet,
// so the live store isn't emptied before setup.
async function applyOnlineStock(products) {
  if (!products.length) return products;
  const onlineLocId = await getOnlineLocationId();
  if (!onlineLocId) return products;

  const rows = await ProductStock.findAll({
    where: { productId: { [Op.in]: products.map((p) => p.id) }, locationId: onlineLocId },
  });
  const qty = new Map(); // `${productId}:${variantIndex ?? 'base'}` -> quantity
  for (const r of rows) qty.set(`${r.productId}:${r.variantIndex ?? 'base'}`, r.quantity);

  for (const p of products) {
    if (Array.isArray(p.variants) && p.variants.length) {
      p.variants = p.variants.map((v, i) => ({ ...v, stock: qty.get(`${p.id}:${i}`) || 0 }));
      p.stock = p.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    } else {
      p.stock = qty.get(`${p.id}:base`) || 0;
    }
  }
  return products;
}

export const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      minPrice,
      maxPrice,
      sort = 'createdAt',
      order = 'DESC',
      featured,
    } = req.query;

    const where = { active: true };
    if (MULTILOC) where.hideOnline = false;
    const and = [];

    if (category) {
      // Match the primary `category` OR any entry in the `categories` array.
      // escape() embeds a safe SQL literal, e.g. JSON_CONTAINS(categories, '"Footwear"').
      const catJson = sequelize.escape(JSON.stringify(category));
      and.push({
        [Op.or]: [
          { category },
          sequelize.literal(`JSON_CONTAINS(categories, ${catJson})`),
        ],
      });
    }
    if (featured) where.featured = true;
    if (search) {
      and.push({
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
        ],
      });
    }
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = minPrice;
      if (maxPrice) where.price[Op.lte] = maxPrice;
    }
    if (and.length) where[Op.and] = and;

    const offset = (page - 1) * limit;
    const { count, rows } = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sort, order.toUpperCase()]],
    });

    let products = rows;
    if (MULTILOC) products = await applyOnlineStock(rows.map((r) => r.toJSON()));

    res.json({
      products,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProduct = async (req, res) => {
  try {
    const where = { slug: req.params.slug, active: true };
    if (MULTILOC) where.hideOnline = false;
    const product = await Product.findOne({ where });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (MULTILOC) {
      const [overlaid] = await applyOnlineStock([product.toJSON()]);
      return res.json(overlaid);
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    // Union of every category any active product belongs to — primary plus the
    // `categories` array — so secondary memberships still show up as filters.
    const catWhere = { active: true };
    if (MULTILOC) catWhere.hideOnline = false;
    const rows = await Product.findAll({
      attributes: ['category', 'categories'],
      where: catWhere,
      raw: true,
    });
    const set = new Set();
    for (const r of rows) {
      if (r.category) set.add(r.category);
      let cats = r.categories;
      if (typeof cats === 'string') {
        try { cats = JSON.parse(cats); } catch { cats = []; }
      }
      if (Array.isArray(cats)) cats.forEach((c) => c && set.add(c));
    }
    res.json([...set].sort((a, b) => a.localeCompare(b)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin
export const createProduct = async (req, res) => {
  try {
    const slug = req.body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const code = req.body.code?.trim() || null;
    const product = await Product.create({ ...req.body, slug, code });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (req.body.name && req.body.name !== product.name) {
      req.body.slug = req.body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    if ('code' in req.body) {
      req.body.code = req.body.code?.trim() || null;
    }

    await product.update(req.body);
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await product.destroy();
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
