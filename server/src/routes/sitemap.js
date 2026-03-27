import { Router } from 'express';
import { Product, Category } from '../models/index.js';

const router = Router();

router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = process.env.CLIENT_URL || `https://${req.headers.host}`;

    const products = await Product.findAll({
      where: { active: true },
      attributes: ['slug', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
    });

    const categories = await Category.findAll({
      where: { active: true },
      attributes: ['name'],
    });

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/products', priority: '0.9', changefreq: 'daily' },
      { loc: '/contact', priority: '0.5', changefreq: 'monthly' },
      { loc: '/shipping-info', priority: '0.5', changefreq: 'monthly' },
      { loc: '/return-policy', priority: '0.5', changefreq: 'monthly' },
      { loc: '/login', priority: '0.3', changefreq: 'yearly' },
      { loc: '/register', priority: '0.3', changefreq: 'yearly' },
    ];

    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${page.loc}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Category pages
    for (const cat of categories) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/products?category=${encodeURIComponent(cat.name)}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    // Product pages
    for (const product of products) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/product/${product.slug}</loc>\n`;
      xml += `    <lastmod>${product.updatedAt.toISOString().split('T')[0]}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    res.status(500).send('Error generating sitemap');
  }
});

// robots.txt
router.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.CLIENT_URL || `https://${req.headers.host}`;
  const txt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /checkout
Disallow: /profile
Disallow: /orders

Sitemap: ${baseUrl}/sitemap.xml
`;
  res.set('Content-Type', 'text/plain');
  res.send(txt);
});

export default router;
