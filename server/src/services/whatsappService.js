/**
 * WhatsApp notifications via Kapso (https://docs.kapso.ai) — a proxy over the
 * WhatsApp Cloud API.
 *
 * Thin, OPTIONAL service: every send no-ops silently when unconfigured, so
 * existing email/order flows never break if Kapso isn't set up. Mirrors the
 * structure and conventions of emailService.js (env-gated, try/catch wrapped,
 * returns null on failure, never throws).
 *
 * Proactive messages (order confirmation, cart recovery) MUST use a
 * Meta-approved template — free-form sendText only works inside the 24h
 * customer-service window. See docs/whatsapp-templates.md.
 *
 * Env is read at CALL time (not import time) so it's correct regardless of
 * dotenv load order, and so the service is trivially unit-testable.
 */
import crypto from 'crypto';

const DEFAULT_API_URL = 'https://api.kapso.ai/meta/whatsapp/v24.0';

const cfg = () => ({
  apiUrl: (process.env.KAPSO_API_URL || DEFAULT_API_URL).replace(/\/$/, ''),
  apiKey: process.env.KAPSO_API_KEY || '',
  phoneNumberId: process.env.KAPSO_PHONE_NUMBER_ID || '',
  webhookSecret: process.env.KAPSO_WEBHOOK_SECRET || '',
  countryCode: (process.env.WHATSAPP_COUNTRY_CODE || '965').replace(/\D/g, ''),
  templateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'en_US',
  debug: process.env.WHATSAPP_DEBUG === 'true',
  isProd: process.env.NODE_ENV === 'production',
});

// Template names live in env so the owner can create + name them in Kapso
// without a code change. A blank name → that send no-ops (deploy-before-templates).
const TEMPLATE_ENV = {
  orderConfirmation: 'WHATSAPP_TEMPLATE_ORDER_CONFIRMATION',
  abandonedCart: 'WHATSAPP_TEMPLATE_ABANDONED_CART',
};
const templateName = (key) => process.env[TEMPLATE_ENV[key]] || '';

// ---- currency formatting (mirrors emailService) ----
function symbolFor(code) {
  return { INR: '₹', USD: '$', AED: 'AED ', KWD: 'KWD ', SAR: 'SAR ' }[code] || `${code} `;
}
function formatPrice(amount) {
  const code = process.env.CURRENCY_CODE || 'INR';
  const symbol = process.env.CURRENCY_SYMBOL || symbolFor(code);
  const dRaw = parseInt(process.env.CURRENCY_DECIMALS, 10);
  const decimals = Number.isFinite(dRaw) && dRaw >= 0 && dRaw <= 4 ? dRaw : 2;
  return `${symbol}${(parseFloat(amount) || 0).toFixed(decimals)}`;
}

// ---- log hygiene ----
// Strip control chars from any interpolated log value (prevents log injection).
function clean(s) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001F\u007F]/g, ' ');
}
// Mask a phone for logs: keep only the last 4 digits.
function maskPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 4 ? `***${d.slice(-4)}` : '***';
}

export function isEnabled() {
  const c = cfg();
  return Boolean(c.apiKey && c.phoneNumberId);
}

/**
 * Normalize a raw phone to a WhatsApp MSISDN (digits only, no +).
 * Strips non-digits; a bare 10-digit national number gets the country code
 * prepended. Numbers that already include a country code pass through.
 */
export function normalizePhone(raw) {
  const digits = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `${cfg().countryCode}${digits}`;
  return digits;
}

/** Validate an inbound sender MSISDN before we trust/use it. Returns '' if bad. */
export function isValidMsisdn(s) {
  const d = String(s == null ? '' : s).replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15 ? d : '';
}

// Low-level POST to the Kapso send endpoint. Never throws.
async function send(payload, phoneForLog) {
  const c = cfg();
  if (!isEnabled()) {
    if (c.debug) console.log(`[WhatsApp skipped] not configured — would send to ${maskPhone(phoneForLog)}`);
    return null;
  }
  try {
    const res = await fetch(`${c.apiUrl}/${c.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': c.apiKey },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[WhatsApp failed] ${res.status} → ${maskPhone(phoneForLog)}: ${clean(errText).slice(0, 300)}`);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    const id = data?.messages?.[0]?.id || '';
    console.log(`[WhatsApp sent] → ${maskPhone(phoneForLog)} (${clean(id)})`);
    return data;
  } catch (err) {
    console.error(`[WhatsApp error] → ${maskPhone(phoneForLog)}: ${clean(err.message)}`);
    return null;
  }
}

/**
 * Free-form text. ONLY valid inside the 24h customer-service window (i.e. in
 * reply to an inbound message). For proactive sends use sendTemplate.
 */
export async function sendText(to, body) {
  const phone = normalizePhone(to);
  if (!phone || !body) return null;
  if (cfg().debug) console.log(`[WhatsApp] sendText → ${maskPhone(phone)} bodyLen=${String(body).length}`);
  return send({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: { body: String(body), preview_url: true },
  }, phone);
}

/**
 * Template send (proactive). Templates are referenced by name + language, with
 * positional placeholders — pass `params` in order. No params → empty components.
 */
export async function sendTemplate(to, name, params = []) {
  const phone = normalizePhone(to);
  if (!phone) return null;
  if (!name) {
    if (cfg().debug) console.log(`[WhatsApp] no template configured — skipping send to ${maskPhone(phone)}`);
    return null;
  }
  const components = params.length
    ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: String(text) })) }]
    : [];
  if (cfg().debug) console.log(`[WhatsApp] sendTemplate "${clean(name)}" → ${maskPhone(phone)} params=${params.length}`);
  return send({
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: { name, language: { code: cfg().templateLang }, components },
  }, phone);
}

// ============================================
// HIGH-LEVEL USE-CASE HELPERS
// ============================================

/** Order confirmation. Phone + name come from the order's shipping address. */
export async function sendOrderConfirmation(order) {
  try {
    const addr = (order && order.shippingAddress) || {};
    if (!addr.phone) return null;
    const firstName = (addr.fullName || '').trim().split(/\s+/)[0] || 'there';
    const params = [firstName, order.orderNumber || '', formatPrice(order.totalAmount)];
    return await sendTemplate(addr.phone, templateName('orderConfirmation'), params);
  } catch (err) {
    console.error(`[WhatsApp error] order confirmation: ${clean(err.message)}`);
    return null;
  }
}

/** Abandoned-cart recovery. Caller supplies phone (logged-in users only). */
export async function sendAbandonedCartReminder(phone, firstName, recoveryUrl) {
  try {
    if (!phone) return null;
    const params = [(firstName || 'there'), recoveryUrl];
    return await sendTemplate(phone, templateName('abandonedCart'), params);
  } catch (err) {
    console.error(`[WhatsApp error] abandoned cart: ${clean(err.message)}`);
    return null;
  }
}

// ============================================
// INBOUND WEBHOOK
// ============================================

/**
 * Verify the X-Webhook-Signature header: HMAC-SHA256 of the RAW request body
 * with KAPSO_WEBHOOK_SECRET, timing-safe compared.
 *
 * Fails CLOSED: in production an unset secret or a missing/invalid signature →
 * false. A missing secret is tolerated ONLY in non-production (dev convenience).
 */
export function verifyWebhookSignature(rawBody, signature) {
  const c = cfg();
  if (!c.webhookSecret) {
    // Never `return true` on no secret in prod.
    return c.isProd ? false : true;
  }
  if (!signature || !Buffer.isBuffer(rawBody) || rawBody.length === 0) return false;
  const expected = crypto.createHmac('sha256', c.webhookSecret).update(rawBody).digest('hex');
  const provided = String(signature).replace(/^sha256=/i, '').trim();
  if (!/^[0-9a-fA-F]+$/.test(provided)) return false;
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Log an inbound message — metadata only unless WHATSAPP_DEBUG=true. */
export function logInbound(from, body) {
  const len = String(body == null ? '' : body).length;
  if (cfg().debug) {
    console.log(`[WhatsApp inbound] from=${maskPhone(from)} len=${len} body="${clean(body).slice(0, 500)}"`);
  } else {
    console.log(`[WhatsApp inbound] from=${maskPhone(from)} len=${len}`);
  }
}

export default {
  isEnabled,
  normalizePhone,
  isValidMsisdn,
  sendText,
  sendTemplate,
  sendOrderConfirmation,
  sendAbandonedCartReminder,
  verifyWebhookSignature,
  logInbound,
};
