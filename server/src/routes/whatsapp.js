/**
 * Kapso inbound webhook.
 *
 * Security (see whatsappService.verifyWebhookSignature):
 *  - HMAC-SHA256 of the RAW request body (captured as req.rawBody by the
 *    express.json `verify` hook in index.js) vs the X-Webhook-Signature header.
 *  - Fails CLOSED in production; rejects with 401 on bad/missing signature.
 *  - Acks 200 immediately, then processes async so Kapso retries aren't blocked.
 *  - Inbound sender is validated as a plausible MSISDN before use, and any
 *    auto-reply is rate-limited per source number.
 */
import { Router } from 'express';
import whatsapp from '../services/whatsappService.js';

const router = Router();

// Per-source-number auto-reply throttle: at most 1 reply / 10 min.
const AUTOREPLY_WINDOW_MS = 10 * 60 * 1000;
const lastAutoReply = new Map(); // msisdn → timestamp

function autoReplyAllowed(from) {
  const now = Date.now();
  if (now - (lastAutoReply.get(from) || 0) < AUTOREPLY_WINDOW_MS) return false;
  lastAutoReply.set(from, now);
  // Opportunistic cleanup so the map can't grow unbounded.
  if (lastAutoReply.size > 1000) {
    for (const [k, t] of lastAutoReply) {
      if (now - t > AUTOREPLY_WINDOW_MS) lastAutoReply.delete(k);
    }
  }
  return true;
}

// Pull inbound text messages out of the WhatsApp Cloud webhook shape, defensively.
// entry[].changes[].value.messages[]  (statuses and other events are ignored).
function extractInboundMessages(body) {
  const out = [];
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const messages = change?.value?.messages;
      if (Array.isArray(messages)) out.push(...messages);
    }
  }
  return out;
}

function processWebhook(body) {
  let messages;
  try {
    messages = extractInboundMessages(body);
  } catch {
    return;
  }
  const autoReply = process.env.WHATSAPP_AUTOREPLY || '';
  const autoReplyOn = autoReply && !['false', 'off', '0'].includes(autoReply.toLowerCase());

  for (const msg of messages) {
    const from = whatsapp.isValidMsisdn(msg?.from);
    if (!from) continue;
    const text = (msg?.type === 'text' && msg?.text?.body) ? msg.text.body : '';
    whatsapp.logInbound(from, text);

    // Auto-reply is safe here (we're inside the 24h window — they just messaged
    // us), but only if enabled and not rate-limited for this number.
    if (autoReplyOn && autoReplyAllowed(from)) {
      whatsapp.sendText(from, autoReply).catch(() => {});
    }
  }
}

router.post('/webhook', (req, res) => {
  const signature = req.get('X-Webhook-Signature') || '';
  if (!whatsapp.verifyWebhookSignature(req.rawBody, signature)) {
    return res.status(401).json({ error: 'invalid signature' });
  }

  // Ack first so Kapso doesn't retry, then process out of band.
  res.status(200).json({ received: true });
  setImmediate(() => {
    try { processWebhook(req.body); } catch { /* never surfaces to the sender */ }
  });
});

export default router;
