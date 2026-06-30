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
const I18N_ON = process.env.FEATURE_I18N === 'true';
const MULTILOC = process.env.FEATURE_MULTILOC === 'true';   // store4: hide-from-online products
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();   // url → { html, status, ts }

// Arabic equivalents for site-level meta. The built index.html only carries the
// English strings (Vite bakes them in), so Arabic site copy comes from env with
// sensible defaults. Per-product Arabic uses nameAr/descriptionAr (renderProduct).
const STORE_NAME_AR = process.env.STORE_NAME_AR || 'أنفال سبورتس';
const SITE_TITLE_AR = process.env.SITE_TITLE_AR || 'أنفال سبورتس — متجر اللوازم الرياضية في الكويت';
const DEFAULT_DESC_AR = process.env.DEFAULT_DESC_AR || 'متجر أنفال سبورتس للوازم الرياضية في الكويت — أحذية وملابس ومضارب وكرات ومعدّات لياقة وإكسسوارات.';

const storeNameFor = (locale) => (locale === 'ar' ? STORE_NAME_AR : STORE_NAME);
const defaultDescFor = (locale) => (locale === 'ar' ? DEFAULT_DESC_AR : DEFAULT_DESC);

// LocalBusiness signals. Address is the known registered showroom; telephone and
// social profiles are env-driven and omitted when unset so we never publish
// placeholder contact data.
const STORE_TELEPHONE = process.env.STORE_TELEPHONE || '';
const STORE_SAMEAS = (process.env.STORE_SAMEAS || '').split(',').map(s => s.trim()).filter(Boolean);

// Known client-side routes (mirror of the <Route> table in client/src/App.jsx).
// Anything not here and not a real product is a genuine 404 — stops the SPA
// catch-all from returning soft-404 home shells for arbitrary URLs. The staff
// base is deliberately omitted so the secret path 404s to crawlers.
const KNOWN_ROUTES = new Set([
  '/cart', '/checkout', '/login', '/register', '/orders', '/profile', '/admin',
  '/order-success', '/wishlist', '/forgot-password', '/reset-password',
  '/wholesale', '/wholesale/request', '/wholesale/my-quotes',
]);

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

// Convert /ar/foo to /foo (or '/' for the Arabic home), so we can run
// the same route lookup whatever the locale.
function stripLocalePrefix(p) {
  if (p === '/ar') return '/';
  if (p.startsWith('/ar/')) return p.slice(3);
  return p;
}

/**
 * Take the loaded template and rewrite the per-page meta tags.
 * `jsonLd` — optional array of extra JSON-LD blocks to inject before </head>.
 * `locale` — 'en' | 'ar'. Drives <html lang/dir>, hreflang alternates,
 * and rtl-direction for SEO crawlers.
 * `alternates` — { en, ar } URLs for the same logical page so we can
 * emit <link rel="alternate" hreflang="...">.
 */
function renderHtml({ title, description, image, url, type = 'website', jsonLd = [], locale = 'en', alternates = null, noindex = false }) {
  let html = loadTemplate();
  if (!html) return '';

  const t = escapeAttr(title);
  const d = escapeAttr(description);
  // DEFAULT_OG is already an absolute URL (Vite baked SITE_URL+OG_IMAGE at build time).
  // For per-product `image`, callers pass a relative path so we prepend SITE_URL above.
  const i = escapeAttr(image || DEFAULT_OG);
  const u = escapeAttr(url);
  const lang = locale === 'ar' ? 'ar' : 'en';
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  html = html
    .replace(/<html([^>]*)\blang="[^"]*"/, `<html$1 lang="${lang}" dir="${dir}"`)
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
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${i}" />`)
    // og:locale follows the page locale so Facebook/LinkedIn pick the right one.
    .replace(/<meta property="og:locale" content="[^"]*"\s*\/?>/, `<meta property="og:locale" content="${locale === 'ar' ? 'ar_KW' : 'en_US'}" />`);

  // hreflang alternates — emitted next to canonical so crawlers see them.
  if (alternates) {
    const hreflangBlock = [
      `<link rel="alternate" hreflang="en" href="${escapeAttr(alternates.en)}" />`,
      `<link rel="alternate" hreflang="ar" href="${escapeAttr(alternates.ar)}" />`,
      `<link rel="alternate" hreflang="x-default" href="${escapeAttr(alternates.en)}" />`,
    ].join('\n    ');
    html = html.replace(
      /(<link rel="canonical"[^>]*\/?>)/,
      `$1\n    ${hreflangBlock}`,
    );
  }

  if (noindex) {
    html = html.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>');
  }

  if (jsonLd.length) {
    const blocks = jsonLd
      .map(obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/<\/script/gi, '<\\/script')}</script>`)
      .join('\n    ');
    html = html.replace('</head>', `    ${blocks}\n  </head>`);
  }

  return html;
}

async function renderProduct(slug, requestUrl, locale, alternates) {
  // store4: products hidden from the online store must not be prerendered
  // for crawlers either (mirrors the API 404 + sitemap exclusion).
  const where = { slug, active: true };
  if (MULTILOC) where.hideOnline = false;
  const product = await Product.findOne({ where });
  if (!product) return null;

  // Use Arabic name/description when serving the Arabic URL and the
  // product has them; otherwise fall through to the English fields.
  const name = (locale === 'ar' && product.nameAr) ? product.nameAr : product.name;
  const desc = (locale === 'ar' && product.descriptionAr) ? product.descriptionAr : product.description;
  const title = `${name} | ${storeNameFor(locale)}`;
  const description = (desc || `${name} at ${product.price}`).replace(/\s+/g, ' ').slice(0, 160);
  const image = product.images?.[0] ? (SITE_URL + product.images[0]) : (SITE_URL + DEFAULT_OG);

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: (desc || '').slice(0, 5000),
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
      { '@type': 'ListItem', position: product.category ? 4 : 3, name, item: requestUrl },
    ],
  };

  return renderHtml({ title, description, image, url: requestUrl, type: 'product', jsonLd: [productSchema, breadcrumb], locale, alternates });
}

function renderCategory(category, requestUrl, locale, alternates) {
  const title = `${category} | ${storeNameFor(locale)}`;
  const description = (locale === 'ar'
    ? `تسوّق ${category} من ${STORE_NAME_AR}. ${DEFAULT_DESC_AR}`
    : `Shop ${category} at ${STORE_NAME}. ${DEFAULT_DESC}`).slice(0, 160);
  return renderHtml({ title, description, url: requestUrl, locale, alternates });
}

function renderProductsList(requestUrl, locale, alternates) {
  const title = `${locale === 'ar' ? 'كل المنتجات' : 'All Products'} | ${storeNameFor(locale)}`;
  const description = (locale === 'ar'
    ? `تصفّح كامل تشكيلة ${STORE_NAME_AR}. ${DEFAULT_DESC_AR}`
    : `Browse the full ${STORE_NAME} catalogue. ${DEFAULT_DESC}`).slice(0, 160);
  return renderHtml({ title, description, url: requestUrl, locale, alternates });
}

// SportingGoodsStore (LocalBusiness) node — emitted on the homepage so Maps /
// local packs and AI engines have address, currency and contact signals.
function localBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportingGoodsStore',
    name: STORE_NAME || 'Anfal Sports',
    url: SITE_URL || '',
    image: DEFAULT_OG || '',
    priceRange: 'KWD',
    address: {
      '@type': 'PostalAddress',
      name: 'Yaal Mall',
      addressLocality: 'Kuwait City',
      addressCountry: 'KW',
    },
    ...(STORE_TELEPHONE ? { telephone: STORE_TELEPHONE } : {}),
    ...(STORE_SAMEAS.length ? { sameAs: STORE_SAMEAS } : {}),
  };
}

function renderHome(requestUrl, locale, alternates, jsonLd = []) {
  const title = locale === 'ar' ? SITE_TITLE_AR : (SITE_TITLE || STORE_NAME || 'Home');
  return renderHtml({
    title,
    description: defaultDescFor(locale),
    url: requestUrl,
    locale, alternates, jsonLd,
  });
}

const STATIC_TITLES = {
  '/about': { en: 'About Us', ar: 'من نحن' },
  '/contact': { en: 'Contact Us', ar: 'اتصل بنا' },
  '/shipping-info': { en: 'Shipping Information', ar: 'معلومات الشحن' },
  '/shipping-policy': { en: 'Shipping Policy', ar: 'سياسة الشحن' },
  '/refund-policy': { en: 'Refund Policy', ar: 'سياسة الاسترداد' },
  '/return-policy': { en: 'Return Policy', ar: 'سياسة الإرجاع' },
  '/privacy-policy': { en: 'Privacy Policy', ar: 'سياسة الخصوصية' },
  '/terms': { en: 'Terms of Service', ar: 'الشروط والأحكام' },
};

// Genuine 404 shell — noindex so crawlers drop it, canonical points home so we
// don't canonicalize a non-page. The SPA still boots and renders <NotFound>.
function renderNotFound(locale) {
  return renderHtml({
    title: `${locale === 'ar' ? 'الصفحة غير موجودة' : 'Page Not Found'} | ${storeNameFor(locale)}`,
    description: defaultDescFor(locale),
    url: `${SITE_URL}/`,
    locale,
    noindex: true,
  });
}

export default async function htmlInject(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  // Skip only if caller explicitly asked for non-HTML (e.g. an XHR doing
  // Accept: application/json on a non-API path). Default curl + most
  // crawlers send `*/*` which we should treat as "fine, serve HTML".
  const accept = req.get('Accept') || '';
  if (accept && !accept.includes('text/html') && !accept.includes('*/*') && !accept.includes('text/*')) {
    return next();
  }

  // Skip API and asset paths defensively (nginx should already not proxy these here)
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/assets/') ||
    req.path.startsWith('/images/') ||
    req.path.startsWith('/uploads/') ||
    req.path === '/sitemap.xml' ||
    req.path === '/robots.txt' ||
    req.path === '/llms.txt' ||
    req.path === '/favicon.ico' ||
    req.path === '/favicon.svg'
  ) {
    return next();
  }

  // HEAD requests get a cheap 200 — uptime monitors don't need the body
  // or per-URL meta, just confirmation that the SPA shell is reachable.
  if (req.method === 'HEAD') {
    return res.type('text/html').status(200).end();
  }

  if (!loadTemplate()) return next();

  const xfproto = req.get('x-forwarded-proto');
  const proto = xfproto || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  const requestUrl = `${proto}://${host}${req.originalUrl}`;
  const cacheKey = req.originalUrl;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return res.type('text/html').status(cached.status || 200).send(cached.html);
  }

  // Locale-from-URL: /ar/* serves Arabic. Only active on stores that
  // opt in via FEATURE_I18N — otherwise we treat the request as
  // single-locale English with no alternates, so we don't advertise
  // /ar/... URLs to crawlers on stores that don't have an Arabic site.
  const isAr = I18N_ON && (req.path === '/ar' || req.path.startsWith('/ar/'));
  const locale = isAr ? 'ar' : 'en';
  const canonicalPath = I18N_ON ? stripLocalePrefix(req.path) : req.path;
  const origin = `${proto}://${host}`;
  const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  const alternates = I18N_ON ? {
    en: `${origin}${canonicalPath}${qs}`,
    ar: `${origin}/ar${canonicalPath === '/' ? '' : canonicalPath}${qs}`,
  } : null;

  try {
    let html;
    let status = 200;
    if (canonicalPath.startsWith('/product/')) {
      const slug = decodeURIComponent(canonicalPath.slice('/product/'.length));
      html = await renderProduct(slug, requestUrl, locale, alternates);
      if (!html) {
        // Product doesn't exist → real 404, not a soft-404 home shell.
        html = renderNotFound(locale);
        status = 404;
      }
    } else if (canonicalPath === '/products') {
      html = req.query.category
        ? renderCategory(String(req.query.category), requestUrl, locale, alternates)
        : renderProductsList(requestUrl, locale, alternates);
    } else if (canonicalPath === '/') {
      html = renderHome(requestUrl, locale, alternates, [localBusinessSchema()]);
    } else if (STATIC_TITLES[canonicalPath]) {
      const t = STATIC_TITLES[canonicalPath];
      html = renderHtml({
        title: `${locale === 'ar' ? t.ar : t.en} | ${storeNameFor(locale)}`,
        description: defaultDescFor(locale),
        url: requestUrl,
        locale, alternates,
      });
    } else if (KNOWN_ROUTES.has(canonicalPath) || canonicalPath.startsWith('/wholesale/my-quotes/')) {
      // Known client-rendered route (cart, account, wholesale, …) → 200 shell.
      html = renderHome(requestUrl, locale, alternates);
    } else {
      // Genuinely unknown path → real 404 + noindex (no more soft-404 home shells).
      html = renderNotFound(locale);
      status = 404;
    }

    cache.set(cacheKey, { html, status, ts: Date.now() });
    res.type('text/html').status(status).send(html);
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
