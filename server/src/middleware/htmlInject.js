/**
 * Per-URL HTML meta injection.
 *
 * Replaces nginx's static `try_files /index.html` for HTML routes. Reads
 * client/dist/index.html once at boot, then for every non-asset GET request:
 *   - looks up product/category data from the DB
 *   - rewrites <title>, meta description, og:* and twitter:* tags, canonical
 *   - injects per-URL Product / BreadcrumbList JSON-LD before </head>
 *
 * Result: every URL ships unique HTML to crawlers without executing JS.
 *
 * Mount position: AFTER all /api/* routes, AFTER /sitemap.xml + /robots.txt
 * routes, AS the catch-all for non-asset GET. nginx must proxy non-asset
 * routes to this Express server.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Product } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_INDEX = path.resolve(__dirname, '../../../client/dist/index.html');

let TEMPLATE = '';
let SITE_URL = '';
let SITE_TITLE = '';
let STORE_NAME = '';
let DEFAULT_OG = '';
let DEFAULT_DESC = '';

const CURRENCY_CODE = process.env.CURRENCY_CODE || 'INR';
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();   // url → { html, ts }

function pickAttr(html, regex) {
  const m = html.match(regex);
  return m ? m[1] : '';
}

function loadTemplate() {
  if (TEMPLATE) return TEMPLATE;
  try {
    TEMPLATE = fs.readFileSync(DIST_INDEX, 'utf8');
    SITE_URL = pickAttr(TEMPLATE, /<link rel="canonical" href="([^"]+)"/).replace(/\/$/, '');
    SITE_TITLE = pickAttr(TEMPLATE, /<title>([^<]+)<\/title>/);
    STORE_NAME = pickAttr(TEMPLATE, /<meta property="og:site_name" content="([^"]+)"/);
    DEFAULT_OG = pickAttr(TEMPLATE, /<meta property="og:image" content="([^"]+)"/);
    DEFAULT_DESC = pickAttr(TEMPLATE, /<meta name="description" content="([^"]+)"/);
    console.log(`[htmlInject] Template loaded — site=${SITE_URL} store=${STORE_NAME}`);
  } catch (err) {
    console.warn(`[htmlInject] Could not load ${DIST_INDEX} — middleware will fall through. Run "npm run build" in client/ to enable per-URL HTML.`);
  }
  return TEMPLATE;
}

function escapeAttr(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Take the loaded template and rewrite the per-page meta tags.
 * `jsonLd` — optional array of extra JSON-LD blocks to inject before </head>.
 */
function renderHtml({ title, description, image, url, type = 'website', jsonLd = [] }) {
  let html = loadTemplate();
  if (!html) return '';

  const t = escapeAttr(title);
  const d = escapeAttr(description);
  // DEFAULT_OG is already an absolute URL (Vite baked SITE_URL+OG_IMAGE at build time).
  // For per-product `image`, callers pass a relative path so we prepend SITE_URL above.
  const i = escapeAttr(image || DEFAULT_OG);
  const u = escapeAttr(url);

  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${d}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${u}" />`)
    .replace(/<meta property="og:type" content="[^"]*"\s*\/?>/, `<meta property="og:type" content="${type}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${t}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${d}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${u}" />`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${i}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${t}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${d}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${i}" />`);

  if (jsonLd.length) {
    const blocks = jsonLd
      .map(obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/<\/script/gi, '<\\/script')}</script>`)
      .join('\n    ');
    html = html.replace('</head>', `    ${blocks}\n  </head>`);
  }

  return html;
}

async function renderProduct(slug, requestUrl) {
  const product = await Product.findOne({ where: { slug, active: true } });
  if (!product) return null;

  const title = `${product.name} | ${STORE_NAME}`;
  const description = (product.description || `${product.name} at ${product.price}`).replace(/\s+/g, ' ').slice(0, 160);
  const image = product.images?.[0] ? (SITE_URL + product.images[0]) : (SITE_URL + DEFAULT_OG);

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: (product.description || '').slice(0, 5000),
    image: product.images?.length ? product.images.map(img => SITE_URL + img) : image,
    sku: product.code || product.slug,
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    offers: {
      '@type': 'Offer',
      price: parseFloat(product.price),
      priceCurrency: CURRENCY_CODE,
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: requestUrl,
    },
    ...(product.numReviews > 0 && product.ratings ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: parseFloat(product.ratings),
        reviewCount: product.numReviews,
      },
    } : {}),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Products', item: `${SITE_URL}/products` },
      ...(product.category
        ? [{ '@type': 'ListItem', position: 3, name: product.category, item: `${SITE_URL}/products?category=${encodeURIComponent(product.category)}` }]
        : []),
      { '@type': 'ListItem', position: product.category ? 4 : 3, name: product.name, item: requestUrl },
    ],
  };

  return renderHtml({ title, description, image, url: requestUrl, type: 'product', jsonLd: [productSchema, breadcrumb] });
}

function renderCategory(category, requestUrl) {
  return renderHtml({
    title: `${category} | ${STORE_NAME}`,
    description: `Shop ${category} at ${STORE_NAME}. ${DEFAULT_DESC}`.slice(0, 160),
    url: requestUrl,
  });
}

function renderProductsList(requestUrl) {
  return renderHtml({
    title: `All Products | ${STORE_NAME}`,
    description: `Browse the full ${STORE_NAME} catalogue. ${DEFAULT_DESC}`.slice(0, 160),
    url: requestUrl,
  });
}

function renderHome(requestUrl) {
  return renderHtml({
    title: SITE_TITLE || STORE_NAME || 'Home',
    description: DEFAULT_DESC,
    url: requestUrl,
  });
}

const STATIC_TITLES = {
  '/about': 'About Us',
  '/contact': 'Contact Us',
  '/shipping-policy': 'Shipping Policy',
  '/refund-policy': 'Refund Policy',
  '/return-policy': 'Return Policy',
  '/privacy-policy': 'Privacy Policy',
  '/terms': 'Terms of Service',
};

export default async function htmlInject(req, res, next) {
  if (req.method !== 'GET') return next();
  const accept = req.get('Accept') || '';
  if (!accept.includes('text/html')) return next();

  // Skip API and asset paths defensively (nginx should already not proxy these here)
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/assets/') ||
    req.path.startsWith('/images/') ||
    req.path.startsWith('/uploads/') ||
    req.path === '/sitemap.xml' ||
    req.path === '/robots.txt' ||
    req.path === '/favicon.ico' ||
    req.path === '/favicon.svg'
  ) {
    return next();
  }

  if (!loadTemplate()) return next();

  const xfproto = req.get('x-forwarded-proto');
  const proto = xfproto || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  const requestUrl = `${proto}://${host}${req.originalUrl}`;
  const cacheKey = req.originalUrl;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return res.type('text/html').send(cached.html);
  }

  try {
    let html;
    if (req.path.startsWith('/product/')) {
      const slug = decodeURIComponent(req.path.slice('/product/'.length));
      html = await renderProduct(slug, requestUrl);
    } else if (req.path === '/products') {
      html = req.query.category
        ? renderCategory(String(req.query.category), requestUrl)
        : renderProductsList(requestUrl);
    } else if (req.path === '/') {
      html = renderHome(requestUrl);
    } else if (STATIC_TITLES[req.path]) {
      html = renderHtml({
        title: `${STATIC_TITLES[req.path]} | ${STORE_NAME}`,
        description: DEFAULT_DESC,
        url: requestUrl,
      });
    }

    if (!html) {
      // Unknown route or missing product — fall back to home shell so the SPA router still renders something.
      html = renderHome(requestUrl);
    }

    cache.set(cacheKey, { html, ts: Date.now() });
    res.type('text/html').send(html);
  } catch (err) {
    console.error('[htmlInject] error rendering', req.originalUrl, err.message);
    next();
  }
}

/** Optional: clear the cache for a URL (or all). Useful when products are updated. */
export function invalidateCache(urlOrAll) {
  if (urlOrAll === undefined || urlOrAll === '*') {
    cache.clear();
  } else {
    cache.delete(urlOrAll);
  }
}

// Eager-load at module import so config issues surface at startup, not on first request.
loadTemplate();
