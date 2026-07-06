import { Router } from 'express';
import {
  getProducts,
  getProduct,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js';
import { protect, admin, requirePermission } from '../middleware/auth.js';

const router = Router();

router.get('/', getProducts);
router.get('/admin/all', protect, admin, requirePermission('products'), async (req, res) => {
  try {
    const { Product } = await import('../models/index.js');
    const { page = 1, limit = 10000, search } = req.query;
    const { Op } = await import('sequelize');
    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
      ];
    }
    const offset = (page - 1) * limit;
    const { count, rows } = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });
    res.json({ products: rows, total: count, totalPages: Math.ceil(count / limit), currentPage: parseInt(page) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.patch('/:id/toggle-active', protect, admin, requirePermission('products'), async (req, res) => {
  try {
    const { Product } = await import('../models/index.js');
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await product.update({ active: !product.active });
    res.json({ id: product.id, active: product.active });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Bulk-toggle online visibility (store4 / multi-location). Show or hide many
// products from the online storefront in one call; POS sale is unaffected.
router.patch('/bulk/online-visibility', protect, admin, requirePermission('products'), async (req, res) => {
  try {
    const { ids, hideOnline } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No products selected' });
    }
    const { Product } = await import('../models/index.js');
    const [count] = await Product.update(
      { hideOnline: !!hideOnline },
      { where: { id: ids } }
    );
    res.json({ count, hideOnline: !!hideOnline });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Bulk set active/unlisted status for many products in one call.
router.patch('/bulk/active', protect, admin, requirePermission('products'), async (req, res) => {
  try {
    const { ids, active } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No products selected' });
    }
    const { Product } = await import('../models/index.js');
    const [count] = await Product.update(
      { active: !!active },
      { where: { id: ids } }
    );
    res.json({ count, active: !!active });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Bulk delete many products in one call.
router.post('/bulk/delete', protect, admin, requirePermission('products'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No products selected' });
    }
    const { Product } = await import('../models/index.js');
    const count = await Product.destroy({ where: { id: ids } });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.get('/categories', getCategories);
router.get('/search-suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const { Product } = await import('../models/index.js');
    const { Op } = await import('sequelize');

    const products = await Product.findAll({
      where: {
        active: true,
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { category: { [Op.like]: `%${q}%` } },
          { brand: { [Op.like]: `%${q}%` } },
        ],
      },
      attributes: ['id', 'name', 'slug', 'price', 'category', 'images'],
      limit: 6,
      order: [['featured', 'DESC'], ['ratings', 'DESC']],
    });

    res.json(products);
  } catch (error) {
    res.status(500).json([]);
  }
});
// Related products by category
router.get('/:slug/related', async (req, res) => {
  try {
    const { Product } = await import('../models/index.js');
    const { Op } = await import('sequelize');

    const product = await Product.findOne({
      where: { slug: req.params.slug, active: true },
    });
    if (!product) return res.json([]);

    const related = await Product.findAll({
      where: {
        active: true,
        id: { [Op.ne]: product.id },
        [Op.or]: [
          { category: product.category },
          { brand: product.brand },
        ],
      },
      limit: 8,
      order: [['ratings', 'DESC'], ['featured', 'DESC']],
    });

    res.json(related);
  } catch (error) {
    res.status(500).json([]);
  }
});

router.get('/:slug', getProduct);
router.post('/', protect, admin, requirePermission('products'), createProduct);
router.put('/:id', protect, admin, requirePermission('products'), updateProduct);
router.delete('/:id', protect, admin, requirePermission('products'), deleteProduct);

export default router;
