/**
 * Shiprocket Checkout integration.
 *
 * Architecture (one direction at a time):
 *   us  -> SR catalog crawl    | GET /products, /products/by-collection, /collections
 *   us  -> SR per-update push  | services/shiprocketSync.js calls SR webhooks on save
 *   us  -> SR init checkout    | POST /init-checkout
 *   SR  -> us order completed  | POST /webhook/order (token-protected via query param)
 *
 * variant_id format:
 *   "<productId>"          for products with no variants in our DB
 *   "<productId>-<idx>"    for products with a `variants` JSON array, idx into it
 *
 * Currency is INR. Weights are in kg (SR expects kg).
 */
import { Router } from 'express';
import { Op } from 'sequelize';
import { Product, Category, Order, User } from '../models/index.js';
import { signedHeaders, SHIPROCKET_BASE } from '../utils/shiprocketAuth.js';
import { sendOrderConfirmation, sendNewOrderNotification } from '../services/emailService.js';

const router = Router();

const SITE_URL = (process.env.SITE_URL || process.env.CLIENT_URL || '').replace(/\/$/, '');
const WEBHOOK_TOKEN = process.env.SHIPROCKET_WEBHOOK_SECRET || '';
const DEFAULT_WEIGHT_KG = 0.1;

function absUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// Pick a numeric value with fallbacks. `??` only catches null/undefined, but
// our variants JSON often stores empty-string prices/weights for "use the
// product default", which would otherwise parse to NaN.
function num(...vals) {
  for (const v of vals) {
    if (v === null || v === undefined || v === '') continue;
    const n = parseFloat(v);
    if (!isNaN(n)) return n;
  }
  return 0;
}

/** Pack a Product into the Shopify-shaped object Shiprocket expects. */
function toShiprocketProduct(p) {
  const obj = p.toJSON ? p.toJSON() : p;
  const baseImage = obj.images?.[0] ? absUrl(obj.images[0]) : '';
  const hasVariants = Array.isArray(obj.variants) && obj.variants.length > 0;

  const variantPayload = hasVariants
    ? obj.variants.map((v, idx) => ({
        id: `${obj.id}-${idx}`,
        title: Object.values(v.options || {}).join(' / ') || `Variant ${idx + 1}`,
        price: num(v.price, obj.price).toFixed(2),
        quantity: parseInt(num(v.stock, obj.stock, 0), 10),
        sku: v.sku || obj.code || `P${obj.id}-V${idx}`,
        updated_at: obj.updatedAt,
        image: { src: baseImage },
        weight: num(v.weight, obj.weight, DEFAULT_WEIGHT_KG),
      }))
    : [{
        id: String(obj.id),
        title: obj.name,
        price: num(obj.price).toFixed(2),
        quantity: parseInt(num(obj.stock, 0), 10),
        sku: obj.code || `P${obj.id}`,
        updated_at: obj.updatedAt,
        image: { src: baseImage },
        weight: num(obj.weight, DEFAULT_WEIGHT_KG),
      }];

  return {
    id: obj.id,
    title: obj.name,
    body_html: obj.description || '',
    vendor: obj.brand || '',
    product_type: obj.category || '',
    updated_at: obj.updatedAt,
    status: obj.active ? 'active' : 'draft',
    variants: variantPayload,
    image: { src: baseImage },
  };
}

function toShiprocketCollection(c) {
  const obj = c.toJSON ? c.toJSON() : c;
  return {
    id: obj.id,
    title: obj.name,
    body_html: '',
    updated_at: obj.updatedAt,
    image: { src: obj.image ? absUrl(obj.image) : '' },
  };
}

function parsePaging(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
  return { page, limit, offset: (page - 1) * limit };
}

// =====================================================================
// Catalog sync — Shiprocket crawls these public read-only endpoints
// =====================================================================

router.get('/products', async (req, res) => {
  try {
    const { page, limit, offset } = parsePaging(req);
    const { rows, count } = await Product.findAndCountAll({
      where: { active: true },
      order: [['id', 'ASC']],
      offset,
      limit,
    });
    res.json({
      products: rows.map(toShiprocketProduct),
      page,
      limit,
      total: count,
      has_more: offset + rows.length < count,
    });
  } catch (err) {
    console.error('[shiprocket] /products:', err.message);
    res.status(500).json({ message: err.message });
  }
});

router.get('/products/by-collection', async (req, res) => {
  try {
    const { page, limit, offset } = parsePaging(req);
    const collectionId = parseInt(req.query.collection_id, 10);
    if (!collectionId) return res.status(400).json({ message: 'collection_id required' });

    const cat = await Category.findByPk(collectionId);
    if (!cat) return res.json({ products: [], page, limit, total: 0, has_more: false });

    const { rows, count } = await Product.findAndCountAll({
      where: { active: true, category: cat.name },
      order: [['id', 'ASC']],
      offset,
      limit,
    });
    res.json({
      products: rows.map(toShiprocketProduct),
      page,
      limit,
      total: count,
      has_more: offset + rows.length < count,
    });
  } catch (err) {
    console.error('[shiprocket] /products/by-collection:', err.message);
    res.status(500).json({ message: err.message });
  }
});

router.get('/collections', async (req, res) => {
  try {
    const { page, limit, offset } = parsePaging(req);
    const { rows, count } = await Category.findAndCountAll({
      where: { active: true },
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
      offset,
      limit,
    });
    res.json({
      collections: rows.map(toShiprocketCollection),
      page,
      limit,
      total: count,
      has_more: offset + rows.length < count,
    });
  } catch (err) {
    console.error('[shiprocket] /collections:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// =====================================================================
// Init checkout — frontend calls us, we proxy to Shiprocket so the key
// never leaves the server.
// =====================================================================

router.post('/init-checkout', async (req, res) => {
  try {
    const { items, redirectUrl } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items provided' });
    }

    // Translate our cart payload into Shiprocket's {variant_id, quantity}.
    // Frontend sends {productId, selectedVariant?, quantity}. We look up the
    // variant by matching options to compute the variant index.
    const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))];
    const products = productIds.length
      ? await Product.findAll({ where: { id: { [Op.in]: productIds } } })
      : [];
    const byId = new Map(products.map((p) => [p.id, p]));

    const resolvedItems = items.map((it) => {
      const product = byId.get(it.productId);
      let variantId = String(it.productId);
      if (product && Array.isArray(product.variants) && product.variants.length > 0 && it.selectedVariant) {
        const idx = product.variants.findIndex((v) =>
          v.options && Object.entries(it.selectedVariant).every(([k, val]) => v.options[k] === val)
        );
        if (idx >= 0) variantId = `${it.productId}-${idx}`;
      }
      return { variant_id: variantId, quantity: parseInt(it.quantity, 10) || 1 };
    });

    const cart_data = { items: resolvedItems };

    const body = {
      cart_data,
      redirect_url: redirectUrl || `${SITE_URL}/order-success`,
      timestamp: new Date().toISOString(),
    };
    const bodyStr = JSON.stringify(body);

    const resp = await fetch(`${SHIPROCKET_BASE}/api/v1/access-token/checkout`, {
      method: 'POST',
      headers: signedHeaders(bodyStr),
      body: bodyStr,
    });
    const data = await resp.json();

    if (!resp.ok) {
      console.error('[shiprocket] init-checkout error:', data);
      return res.status(502).json({ message: data?.message || 'Shiprocket rejected the request', detail: data });
    }

    // SR returns the token nested under result.token per the docs sample.
    const token = data?.result?.token || data?.token;
    if (!token) {
      console.error('[shiprocket] init-checkout missing token:', data);
      return res.status(502).json({ message: 'Shiprocket did not return a token' });
    }

    res.json({ token, raw: data });
  } catch (err) {
    console.error('[shiprocket] init-checkout exception:', err);
    res.status(500).json({ message: err.message });
  }
});

// =====================================================================
// Inbound order webhook — Shiprocket posts here when a customer pays.
// Protected with ?token=SHIPROCKET_WEBHOOK_SECRET since Shiprocket
// doesn't sign their outbound webhooks.
// =====================================================================

router.post('/webhook/order', async (req, res) => {
  try {
    if (!WEBHOOK_TOKEN || req.query.token !== WEBHOOK_TOKEN) {
      console.warn('[shiprocket] webhook token mismatch');
      return res.status(401).json({ message: 'Invalid webhook token' });
    }

    const payload = req.body || {};
    if (payload.status && payload.status !== 'SUCCESS') {
      // Non-success webhooks (failed/cancelled) — ack but don't create order.
      console.log('[shiprocket] webhook non-success:', payload.status, payload.order_id);
      return res.json({ ok: true, skipped: true });
    }

    // Resolve variant_ids back to our products. Variant IDs are either "42"
    // or "42-3" — split on the dash.
    const items = Array.isArray(payload.cart_data?.items) ? payload.cart_data.items : [];
    const orderItems = [];
    for (const it of items) {
      const [pidStr, idxStr] = String(it.variant_id || '').split('-');
      const productId = parseInt(pidStr, 10);
      if (!productId) continue;
      const product = await Product.findByPk(productId);
      if (!product) continue;
      const qty = parseInt(it.quantity, 10) || 1;
      const variantIdx = idxStr != null ? parseInt(idxStr, 10) : null;
      const variant = variantIdx != null && product.variants ? product.variants[variantIdx] : null;
      const unitPrice = variant?.price != null ? parseFloat(variant.price) : parseFloat(product.price);

      orderItems.push({
        productId: product.id,
        name: product.name + (variant ? ` (${Object.values(variant.options || {}).join('/')})` : ''),
        category: product.category,
        price: unitPrice,
        quantity: qty,
        image: product.images?.[0] || null,
        selectedVariant: variant?.options || null,
        sku: variant?.sku || product.code || null,
        taxable: product.taxable || false,
        taxRate: product.taxable ? parseFloat(product.taxRate || 0) : 0,
        hsnCode: product.hsnCode || null,
      });
    }

    if (orderItems.length === 0) {
      console.warn('[shiprocket] webhook had no resolvable items:', payload.order_id);
      return res.status(400).json({ message: 'No matchable items in order' });
    }

    // Map customer info from the payload. SR sends phone + email at top level
    // and may include a shipping_address block (full payload per docs).
    const customerEmail = (payload.email || '').toLowerCase().trim();
    const shippingAddress = payload.shipping_address || payload.address || {
      fullName: payload.name || payload.customer_name || '',
      phone: payload.phone || '',
      line1: payload.address_line_1 || '',
      line2: payload.address_line_2 || '',
      city: payload.city || '',
      state: payload.state || '',
      postalCode: payload.pincode || payload.postal_code || '',
      country: payload.country || 'India',
    };

    // Try to attach to an existing user by email. Guest otherwise.
    let user = null;
    if (customerEmail) user = await User.findOne({ where: { email: customerEmail } });

    const orderNumber = `SR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const paymentMethod = payload.payment_type === 'CASH_ON_DELIVERY' ? 'cod' : 'shiprocket';
    const totalAmount = parseFloat(payload.total_amount_payable || 0)
      || orderItems.reduce((s, i) => s + i.price * i.quantity, 0);

    const order = await Order.create({
      orderNumber,
      userId: user?.id || null,
      guestEmail: user ? null : (customerEmail || null),
      items: orderItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
      paymentStatus: payload.payment_type === 'CASH_ON_DELIVERY' ? 'pending' : 'paid',
      orderStatus: 'confirmed',
      shippingCharge: parseFloat(payload.shipping_amount || 0),
      discount: parseFloat(payload.discount || 0),
      taxAmount: parseFloat(payload.tax_amount || 0),
      trackingNumber: payload.order_id, // Shiprocket's order id; useful to reconcile later
    });

    // Decrement stock for each item (Shiprocket orders are real sales).
    for (const it of orderItems) {
      await Product.increment({ stock: -it.quantity }, { where: { id: it.productId } });
    }

    // Fire emails async — don't block the webhook ack.
    if (customerEmail) {
      sendOrderConfirmation(order.toJSON(), customerEmail).catch((e) =>
        console.error('[shiprocket] order confirmation email failed:', e.message)
      );
    }
    sendNewOrderNotification(order.toJSON()).catch((e) =>
      console.error('[shiprocket] admin notification email failed:', e.message)
    );

    console.log(`[shiprocket] order created: ${orderNumber} (SR:${payload.order_id})`);
    res.json({ ok: true, order_number: orderNumber });
  } catch (err) {
    console.error('[shiprocket] webhook error:', err);
    // Return 200 anyway so SR doesn't retry — log + investigate.
    res.json({ ok: false, error: err.message });
  }
});

export default router;
