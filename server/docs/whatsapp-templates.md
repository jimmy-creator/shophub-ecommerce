# WhatsApp message templates (Kapso / Meta)

Proactive WhatsApp messages (order confirmation, cart recovery) must use a
**Meta-approved template** — free-form text only works inside the 24-hour
customer-service window (i.e. replying to a message the customer just sent).

Create each template in the Kapso dashboard, submit it for Meta approval, then
set its **name** in the matching env var. Until a template name is set (or
approved), that send simply no-ops — the app deploys safely without them.

## Conventions

- Templates are referenced by **name + language**, never a numeric ID.
- Placeholders are **positional**: `{{1}}`, `{{2}}`, … The app passes parameters
  in order; they must line up exactly with the body below.
- Category: **UTILITY** (these are transactional, not marketing).
- Language must match `WHATSAPP_TEMPLATE_LANG` (default `en_US`).

---

## 1. Order confirmation

- **Env var:** `WHATSAPP_TEMPLATE_ORDER_CONFIRMATION` (suggested name: `order_confirmation`)
- **Fired from:** every order-confirmed path — online payment verify (Razorpay,
  Paytm, Nomod), COD (logged-in + guest), and the Shiprocket checkout webhook.
- **Parameters (in order):**
  1. `{{1}}` — customer first name
  2. `{{2}}` — order number
  3. `{{3}}` — formatted order total (already includes the currency symbol)

**Body:**
```
Hi {{1}}, thanks for your order! 🎉

Your order {{2}} has been confirmed and is now being processed.
Order total: {{3}}

We'll message you again when it ships. Reply here if you have any questions.
```

**Sample values:** `{{1}}=Ahmad`, `{{2}}=ANF-10234`, `{{3}}=KWD 12.500`

---

## 2. Abandoned-cart recovery

- **Env var:** `WHATSAPP_TEMPLATE_ABANDONED_CART` (suggested name: `abandoned_cart`)
- **Fired from:** the abandoned-cart job, **logged-in users with a phone only**
  (guests stay email-only).
- **Parameters (in order):**
  1. `{{1}}` — customer first name
  2. `{{2}}` — recovery URL (link back to the cart)

**Body:**
```
Hi {{1}}, you left some items in your cart 🛒

Your selection is still saved — complete your purchase here:
{{2}}

Need help? Just reply to this message.
```

**Sample values:** `{{1}}=Sara`, `{{2}}=https://anfalsports.com/cart`

> Tip: if you put `{{2}}` (the URL) in a body parameter as above, no button is
> required. If you'd rather use a URL button, switch it to a dynamic URL button
> template and adjust the component — the service currently sends body params only.

---

## After approval

Set the env vars and reload:

```
WHATSAPP_TEMPLATE_ORDER_CONFIRMATION=order_confirmation
WHATSAPP_TEMPLATE_ABANDONED_CART=abandoned_cart
WHATSAPP_TEMPLATE_LANG=en_US
```

A template with **no** placeholders is also valid — the app sends it with empty
`components`. Useful for a first smoke test before wiring real parameters.
