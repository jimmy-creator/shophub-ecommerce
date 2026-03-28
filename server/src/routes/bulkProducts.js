import { Router } from 'express';
import { Product } from '../models/index.js';
import { protect, admin, requirePermission } from '../middleware/auth.js';
import multer from 'multer';
import csvParser from 'csv-parser';
import { createObjectCsvStringifier } from 'csv-writer';
import { Readable } from 'stream';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Export all products as CSV
router.get('/export', protect, admin, async (req, res) => {
  try {
    const products = await Product.findAll({
      order: [['id', 'ASC']],
      raw: true,
    });

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'id', title: 'ID' },
        { id: 'name', title: 'Name' },
        { id: 'description', title: 'Description' },
        { id: 'price', title: 'Price' },
        { id: 'comparePrice', title: 'Compare Price' },
        { id: 'category', title: 'Category' },
        { id: 'brand', title: 'Brand' },
        { id: 'stock', title: 'Stock' },
        { id: 'featured', title: 'Featured' },
        { id: 'active', title: 'Active' },
        { id: 'taxable', title: 'Taxable' },
        { id: 'taxRate', title: 'Tax Rate' },
        { id: 'hsnCode', title: 'HSN Code' },
        { id: 'images', title: 'Images' },
      ],
    });

    const records = products.map((p) => ({
      ...p,
      featured: p.featured ? 'Yes' : 'No',
      active: p.active ? 'Yes' : 'No',
      taxable: p.taxable ? 'Yes' : 'No',
      images: Array.isArray(p.images) ? p.images.join('|') : (p.images || ''),
    }));

    const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=products-${new Date().toISOString().split('T')[0]}.csv`,
    });
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Download CSV template
router.get('/template', protect, admin, (req, res) => {
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'name', title: 'Name' },
      { id: 'description', title: 'Description' },
      { id: 'price', title: 'Price' },
      { id: 'comparePrice', title: 'Compare Price' },
      { id: 'category', title: 'Category' },
      { id: 'brand', title: 'Brand' },
      { id: 'stock', title: 'Stock' },
      { id: 'featured', title: 'Featured' },
      { id: 'taxable', title: 'Taxable' },
      { id: 'taxRate', title: 'Tax Rate' },
      { id: 'hsnCode', title: 'HSN Code' },
    ],
  });

  const sample = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords([
    { name: 'Sample Product', description: 'A great product', price: '499.99', comparePrice: '699.99', category: 'Electronics', brand: 'BrandX', stock: '50', featured: 'No', taxable: 'Yes', taxRate: '18', hsnCode: '8471' },
  ]);

  res.set({
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename=product-import-template.csv',
  });
  res.send(sample);
});

// Import products from CSV
router.post('/import', protect, admin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const results = [];
    const errors = [];

    await new Promise((resolve, reject) => {
      const stream = Readable.from(req.file.buffer.toString());
      stream
        .pipe(csvParser())
        .on('data', (row) => results.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (results.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty' });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      const rowNum = i + 2; // +2 for header + 0-index

      try {
        if (!row.Name && !row.name) {
          errors.push(`Row ${rowNum}: Name is required`);
          skipped++;
          continue;
        }

        const name = row.Name || row.name;
        const price = parseFloat(row.Price || row.price);

        if (isNaN(price) || price <= 0) {
          errors.push(`Row ${rowNum}: Invalid price for "${name}"`);
          skipped++;
          continue;
        }

        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        const productData = {
          name,
          slug,
          description: row.Description || row.description || '',
          price,
          comparePrice: parseFloat(row['Compare Price'] || row.comparePrice) || null,
          category: row.Category || row.category || 'Uncategorized',
          brand: row.Brand || row.brand || null,
          stock: parseInt(row.Stock || row.stock) || 0,
          featured: ['yes', 'true', '1'].includes(String(row.Featured || row.featured || '').toLowerCase()),
          active: row.Active !== undefined ? ['yes', 'true', '1'].includes(String(row.Active || row.active || '').toLowerCase()) : true,
          taxable: ['yes', 'true', '1'].includes(String(row.Taxable || row.taxable || '').toLowerCase()),
          taxRate: parseFloat(row['Tax Rate'] || row.taxRate) || 0,
          hsnCode: row['HSN Code'] || row.hsnCode || null,
        };

        // Handle images (pipe-separated)
        const imgField = row.Images || row.images;
        if (imgField) {
          productData.images = imgField.split('|').map((s) => s.trim()).filter(Boolean);
        }

        // Check if product with same ID exists (for updates)
        const existingId = parseInt(row.ID || row.id);
        if (existingId) {
          const existing = await Product.findByPk(existingId);
          if (existing) {
            await existing.update(productData);
            updated++;
            continue;
          }
        }

        // Check by slug for duplicates
        const existingBySlug = await Product.findOne({ where: { slug } });
        if (existingBySlug) {
          await existingBySlug.update(productData);
          updated++;
        } else {
          await Product.create(productData);
          created++;
        }
      } catch (err) {
        errors.push(`Row ${rowNum}: ${err.message}`);
        skipped++;
      }
    }

    res.json({
      message: `Import complete: ${created} created, ${updated} updated, ${skipped} skipped`,
      created,
      updated,
      skipped,
      total: results.length,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
