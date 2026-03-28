# Authorization Analysis Report
## ShopHub E-Commerce Platform — Authorization Analysis

---

## 1. Executive Summary

- **Analysis Status:** Complete
- **Key Outcome:** Six externally-exploitable authorization vulnerabilities were identified and recorded across all three vulnerability classes (Horizontal, Vertical, Context/Workflow). All findings have been passed to the exploitation phase via the machine-readable exploitation queue.
- **Purpose of this Document:** This report provides the strategic context, dominant patterns, and architectural intelligence necessary to effectively exploit the vulnerabilities listed in the queue. It is intended to be read alongside the JSON deliverable.

**Findings Summary:**

| ID | Type | Endpoint(s) | Confidence | Impact |
|----|------|-------------|------------|--------|
| AUTHZ-VULN-01 | Horizontal | `GET /api/orders/:id/invoice` | High | Download any guest's invoice (PII/financial) |
| AUTHZ-VULN-02 | Horizontal | `POST /api/orders/:id/cancel` | High | Cancel any guest order, trigger refund |
| AUTHZ-VULN-03 | Vertical | 20+ admin endpoints | High | Staff account → full admin access |
| AUTHZ-VULN-04 | Context/Workflow | `POST /api/coupons/apply` + create-order | High | Unlimited coupon reuse as guest |
| AUTHZ-VULN-05 | Context/Workflow | `POST /api/payment/verify` | Med | Unauthenticated order lookup without email check |
| AUTHZ-VULN-06 | Context/Workflow | `POST /api/payment/paytm-callback` | Med | Unauthenticated callback invocation without HMAC |

---

## 2. Dominant Vulnerability Patterns

### Pattern 1: Weak Guest Authentication via Email Parameter (Horizontal)
- **Description:** Guest order endpoints authenticate callers by comparing a caller-supplied email against the `guestEmail` stored on the order record. Order IDs are sequential integers, making enumeration trivial. There is no rate limiting applied to the invoice or cancellation endpoints.
- **Implication:** An attacker who knows (or can enumerate) a guest email address can access or cancel any guest order by iterating sequential order IDs with the known email.
- **Representative:** AUTHZ-VULN-01 (invoice), AUTHZ-VULN-02 (cancellation)
- **Code Pattern:**
  ```javascript
  // orders.js:32-33
  const isGuest = !req.user && order.guestEmail && req.query.email &&
    order.guestEmail === req.query.email.toLowerCase().trim();
  ```

### Pattern 2: Dead Permission Code — Staff Equals Admin (Vertical)
- **Description:** The `admin` middleware (`auth.js:26`) passes ALL users with `role === 'staff'`, regardless of their assigned `permissions` array. The `requirePermission()` middleware is defined at `auth.js:34-45` but is **never mounted on any route**. Every admin endpoint uses only `protect, admin` which gives staff identical access to admins.
- **Implication:** Any staff account — even one created with `permissions: []` — has unrestricted access to analytics, customer PII, all orders, order status manipulation, coupon management, file uploads, bulk product operations, and fake review creation.
- **Representative:** AUTHZ-VULN-03

### Pattern 3: Missing Ownership Guard on Payment/Workflow Endpoints (Context)
- **Description:** Payment endpoints using `optionalAuth` perform ownership checks only for authenticated users. Guest/unauthenticated callers can interact with any order by supplying its `orderNumber` without additional identity proof (email, token, etc.).
- **Implication:** Attackers can probe order state, attempt payment verification for orders they don't own, and trigger the Paytm callback flow for arbitrary orders.
- **Representative:** AUTHZ-VULN-05, AUTHZ-VULN-06

### Pattern 4: Business-Rule Bypass via Null Identity (Context)
- **Description:** Per-user coupon limits are enforced only when `userId` is non-null. Guest users always have `userId = null`, causing the per-user limit check to be skipped entirely.
- **Implication:** Guests can reuse any coupon with a per-user limit unlimited times by creating multiple guest orders with different (or the same) email addresses.
- **Representative:** AUTHZ-VULN-04

---

## 3. Strategic Intelligence for Exploitation

### Session Management Architecture
- JWT tokens are stored in HttpOnly cookies AND returned in the JSON response body for localStorage
- JWT payload contains ONLY the user ID; role is fetched live from DB on every request via `User.findByPk(decoded.id)` in the `protect` middleware (`auth.js:13`)
- Token expiry is 7 days; no server-side revocation mechanism exists
- **Critical for exploitation:** Role cannot be forged via JWT manipulation since role is always loaded from DB. Staff-to-admin escalation (AUTHZ-VULN-03) requires obtaining real staff credentials.

### Role/Permission Model
- Three roles: `customer` (default), `staff`, `admin`
- Role stored only in MySQL `Users.role` ENUM column — not in JWT
- `admin` middleware (`auth.js:26`): `req.user.role === 'admin' || req.user.role === 'staff'` — passes both
- `requirePermission()` middleware (`auth.js:34-45`): defined but **never mounted on any route** (dead code)
- **Critical Finding:** The `permissions` JSON column on the User model is completely unenforced. Staff accounts have identical effective access to admins for all routes guarded by `protect, admin` (which is every admin route except staff management).

### Resource Access Patterns
- Order IDs are sequential integer primary keys (1, 2, 3...)
- Order numbers use format `ORD-${timestamp36}-${random4}` (e.g., `ORD-LT3A1B-X4F2`)
- Guest orders store `guestEmail` and have `userId = null`
- Authenticated user orders store `userId` and have `guestEmail = null`
- **Critical Finding:** Invoice and cancellation endpoints use `id` (sequential PK) for resource lookup, and authenticate guests by comparing a caller-supplied email parameter against the `guestEmail` DB field with no rate limiting.

### Coupon Implementation
- `applyCoupon()` in `orderController.js:108`: per-user limit check wrapped in `if (userId && coupon.perUserLimit)` — skipped when `userId = null`
- Same check in `POST /api/coupons/apply` (coupons.js:40): `if (req.user && coupon.perUserLimit)` — skipped when not authenticated
- Global `usageLimit` still applies (if set), but `perUserLimit` is completely ineffective for guest users
- **Critical Finding:** Multiple guest orders with the same coupon code are allowed unless the global `usageLimit` is exhausted.

### Payment Verification Architecture
- Razorpay: HMAC-SHA256 signature verification is properly implemented in `paymentGateway.js`
- Paytm: No HMAC/checksum verification of the incoming callback request; the endpoint only calls Paytm's order status API after receiving the callback
- Payment verify endpoint (`payment.js:219-222`): The `userId` WHERE filter is only applied for authenticated users. Unauthenticated callers look up orders by `orderNumber` alone, with no email ownership check.
- **Known Code Bug:** `payment.js:240` contains `orderNumber: 'confirmed'` (should be `orderStatus: 'confirmed'`), causing successful payment verification to overwrite the `orderNumber` field to the string `'confirmed'` and leaving `orderStatus` as `'processing'`. This is an application bug, not an authorization vulnerability, but it means the verify endpoint produces inconsistent order state on success.

---

## 4. Detailed Vulnerability Findings

### AUTHZ-VULN-01 — Guest Invoice Download (Horizontal, High Confidence)

**Endpoint:** `GET /api/orders/:id/invoice?email=`
**File:** `server/src/routes/orders.js:24-52`
**Middleware:** `optionalAuth` (no authentication required)

**Vulnerability Trace:**
The handler fetches the order by the sequential integer PK `req.params.id` (no prior auth check). It then attempts to authorize the caller via three conditions. The guest condition (`isGuest`, lines 32-33) requires only that:
1. `req.user` is absent (unauthenticated caller)
2. `req.query.email` matches `order.guestEmail` (case-insensitive)

```javascript
// orders.js:30-35
const isOwner = req.user && order.userId === req.user.id;
const isAdmin = req.user && req.user.role === 'admin';
const isGuest = !req.user && order.guestEmail && req.query.email &&
  order.guestEmail === req.query.email.toLowerCase().trim();
if (!isOwner && !isAdmin && !isGuest) {
  return res.status(403).json({ message: 'Not authorized' });
}
```

**Missing Defense:** No rate limiting on this endpoint (global 100 req/15 min applies but is per-IP, not per-order). Order IDs are sequential integers. An attacker who knows one guest email can enumerate all guest orders for that email. An attacker who knows any order ID can enumerate emails by attempting known/common email patterns.

**Side Effect:** Downloads full invoice PDF containing: order items, pricing, shipping address (name, full address, phone), order number, payment method. Full PII exposure.

**Verdict: VULNERABLE**

---

### AUTHZ-VULN-02 — Guest Order Cancellation (Horizontal, High Confidence)

**Endpoint:** `POST /api/orders/:id/cancel`
**File:** `server/src/routes/cancellation.js:9-75`
**Middleware:** `optionalAuth` (no authentication required)

**Vulnerability Trace:**
Same guest authentication pattern as AUTHZ-VULN-01. The `isGuest` check (lines 16-17) requires only that `req.body.email` matches `order.guestEmail`:

```javascript
// cancellation.js:15-21
const isOwner = req.user && order.userId === req.user.id;
const isGuest = !req.user && order.guestEmail && req.body.email &&
  order.guestEmail === req.body.email.toLowerCase().trim();
if (!isOwner && !isGuest) {
  return res.status(403).json({ message: 'Not authorized' });
}
```

**Missing Defense:** Same as AUTHZ-VULN-01 — sequential order IDs, no rate limiting on endpoint, email-only guest auth.

**Side Effect:** Cancels order (sets `orderStatus='cancelled'`), restores product stock, and if order was paid (`paymentStatus='paid'`), automatically sets `refundStatus='pending'` and `paymentStatus='refunded'` — directly initiating a refund workflow. Full financial impact.

**Verdict: VULNERABLE**

---

### AUTHZ-VULN-03 — Staff Account Grants Full Admin Access (Vertical, High Confidence)

**Endpoint:** 20+ admin endpoints (see below)
**File:** `server/src/middleware/auth.js:25-31` (flawed guard)
**Middleware:** `protect, admin` (staff passes through unchecked)

**Vulnerability Trace:**
The `admin` middleware at `auth.js:26` passes ALL users with role `staff`, regardless of their assigned `permissions` array:

```javascript
// auth.js:25-31
export const admin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'staff')) {
    next();  // ALL staff pass — permissions are not checked
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};
```

The `requirePermission()` middleware at `auth.js:34-45` correctly checks specific permission slugs, but it is **never mounted on any route file** in the codebase. Every admin endpoint uses `protect, admin` only.

**Missing Defense:** `requirePermission('analytics')`, `requirePermission('orders')`, etc. — dead code, never invoked.

**Affected Endpoints (all use `protect, admin` only):**

| Endpoint | Side Effect |
|----------|-------------|
| `GET /api/analytics/*` (7 endpoints) | Full business intelligence: revenue, orders, stock levels |
| `GET /api/customers` | All registered customers with PII (name, email, phone, address) |
| `GET /api/customers/guests` | All guest customers with PII |
| `GET /api/customers/:id/orders` | Any customer's full order history |
| `GET /api/orders/all` | All orders with full PII and financial data |
| `PUT /api/orders/:id/status` | Set any order's status/payment status to arbitrary string |
| `POST /api/coupons` | Create financial discount codes |
| `PUT /api/coupons/:id` | Modify existing coupons (mass assignment via req.body) |
| `DELETE /api/coupons/:id` | Delete coupons |
| `POST /api/reviews/admin` | Create fake "verified" reviews for any product |
| `GET /api/bulk-products/export` | Export full product database as CSV |
| `POST /api/bulk-products/import` | Bulk update/create products via CSV (any product by ID) |
| `POST /api/upload`, `/upload/multiple` | Upload files to server |
| `GET /api/abandoned-cart` | All abandoned cart records with customer emails |
| `POST /api/reviews/:id/approve` | Approve or hide any customer review |
| `DELETE /api/reviews/:id` | Delete any review |
| `GET /api/pincodes` | List delivery pincodes |
| `POST/PUT/DELETE /api/pincodes/*` | Modify delivery configuration |
| `GET /api/categories/all` | All categories including inactive |
| `POST/PUT/DELETE /api/categories/*` | Create/modify/delete product categories |

**Note on `PUT /api/orders/:id/status`:** The handler has no allowlist on `orderStatus` or `paymentStatus` values (`orderController.js:282-285`):
```javascript
await order.update({
  ...(orderStatus && { orderStatus }),
  ...(paymentStatus && { paymentStatus }),
  ...(trackingNumber && { trackingNumber }),
});
```
A staff user could set `paymentStatus: 'paid'` on any unpaid order, bypassing payment entirely.

**Verdict: VULNERABLE**

---

### AUTHZ-VULN-04 — Guest Coupon Per-User Limit Bypass (Context/Workflow, High Confidence)

**Endpoint:** `POST /api/coupons/apply` + `POST /api/orders/guest` (via `applyCoupon()`)
**File:** `server/src/routes/coupons.js:40-47` and `server/src/controllers/orderController.js:108-111`
**Middleware:** `optionalAuth`

**Vulnerability Trace:**
The per-user coupon limit check is gated behind a null check on `userId` (or `req.user`):

```javascript
// orderController.js:108-111
if (userId && coupon.perUserLimit) {
  const used = await Order.count({ where: { userId, couponCode: coupon.code } });
  if (used >= coupon.perUserLimit) throw new Error('You have already used this coupon');
}

// coupons.js:40-47 (same pattern)
if (req.user && coupon.perUserLimit) {
  const userUsage = await Order.count({
    where: { userId: req.user.id, couponCode: coupon.code },
  });
  if (userUsage >= coupon.perUserLimit) { ... }
}
```

Guest orders are created with `userId: null` (`orderController.js:197`). When `userId` is `null`, the per-user limit check is skipped entirely. There is no email-based or IP-based tracking of guest coupon usage.

**Missing Defense:** Per-user limit check must also apply when `userId` is null, using `guestEmail` as the tracking identifier (at minimum). No such check exists.

**Side Effect:** Guest users can use any coupon with a per-user limit unlimited times, creating multiple guest orders with the same coupon code and any email address (real or fabricated). This directly reduces store revenue.

**Verdict: VULNERABLE**

---

### AUTHZ-VULN-05 — Payment Verify Endpoint Lacks Guest Ownership Check (Context/Workflow, Medium Confidence)

**Endpoint:** `POST /api/payment/verify`
**File:** `server/src/routes/payment.js:215-275`
**Middleware:** `optionalAuth`

**Vulnerability Trace:**
The verify endpoint finds the target order by `orderNumber` only for unauthenticated callers — no email ownership check is performed:

```javascript
// payment.js:219-223
const where = { orderNumber };
if (req.user) {
  where.userId = req.user.id;  // Only authenticated users get ownership filtering
}
const order = await Order.findOne({ where });
```

An unauthenticated attacker who knows an `orderNumber` can probe order state (is it already paid?), and if they possess valid Razorpay or Paytm payment credentials, can trigger payment verification for that order. For Razorpay, this requires a valid HMAC signature (bound to the specific Razorpay order ID for this order). For Paytm, the subsequent `verifyPayment()` call to Paytm's API would reject fabricated transactions.

**Missing Defense:** An email ownership check analogous to the invoice/cancel endpoints should be required when the caller is unauthenticated: `order.guestEmail === req.body.email`.

**Note:** There is also a code bug at `payment.js:240` — `orderNumber: 'confirmed'` should be `orderStatus: 'confirmed'`. Successful payment verification overwrites the order's `orderNumber` field to the string `'confirmed'`.

**Confidence: MEDIUM** — The payment gateway signature/verification acts as an additional guard, but the missing ownership check allows unauthenticated order probing and creates an exploitable surface if payment credentials are obtained out-of-band.

**Verdict: VULNERABLE**

---

### AUTHZ-VULN-06 — Paytm Callback Without Request Signature Verification (Context/Workflow, Medium Confidence)

**Endpoint:** `POST /api/payment/paytm-callback`
**File:** `server/src/routes/payment.js:294-335`
**Middleware:** None (fully public)

**Vulnerability Trace:**
The Paytm callback handler accepts POST requests from any source without verifying the incoming request's authenticity. It trusts the caller-supplied `ORDERID` and `STATUS` values, then calls Paytm's API to confirm the transaction:

```javascript
// payment.js:294-310
router.post('/paytm-callback', async (req, res) => {
  const { ORDERID, STATUS, TXNID } = req.body;  // Fully attacker-controlled
  if (STATUS === 'TXN_SUCCESS') {
    const order = await Order.findOne({ where: { orderNumber: ORDERID } });
    if (order && order.paymentStatus !== 'paid') {
      const paymentGateway = getPaymentGateway('paytm');
      const result = await paymentGateway.verifyPayment({ orderId: ORDERID });
      if (result.verified) {
        await order.update({ paymentStatus: 'paid', orderStatus: 'confirmed' });
      }
    }
  }
});
```

**Missing Defense:** Paytm's documentation requires verifying the incoming callback's checksum (`paytmchecksum.verifySignature()`) BEFORE trusting the request body. The `paytmchecksum` library IS installed but not used here.

**Side Effect:** Any attacker can trigger the Paytm verification flow for any known `orderNumber`. While the `result.verified` check from the Paytm API provides a secondary guard, the missing inbound signature verification means the endpoint can be called by anyone (not just Paytm's servers), and if there is any bug or configuration issue in the Paytm verification call, an order could be marked as paid without actual payment.

**Confidence: MEDIUM** — The Paytm API verification (`result.verified`) provides a secondary guard. However, the missing inbound HMAC validation violates Paytm's security requirements and creates a bypass surface.

**Verdict: VULNERABLE**

---

## 5. Vectors Analyzed and Confirmed Secure

These authorization checks were traced and confirmed to have robust, properly-placed guards. They are **low-priority** for further testing.

| **Endpoint** | **Guard Location** | **Defense Mechanism** | **Verdict** |
|--------------|-------------------|-----------------------|-------------|
| `GET /api/orders/:id` | `orderController.js:245-247` | `protect` + `order.userId !== req.user.id && req.user.role !== 'admin'` check | SAFE |
| `POST /api/auth/register` | `authController.js:44` | Role hardcoded to `customer`; req.body role ignored | SAFE |
| `POST /api/auth/google` | `googleAuth.js:60` | Role hardcoded to `customer` on user creation | SAFE |
| `POST /api/staff` | `staff.js:46` + inline `staff.js:48-50` | `protect + admin` middleware AND inline `role !== 'admin'` check | SAFE |
| `PUT /api/staff/:id` | `staff.js:82` + inline `staff.js:84-86` | `protect + admin` + inline `role !== 'admin'` | SAFE |
| `DELETE /api/staff/:id` | `staff.js:110` + inline `staff.js:112-114` | `protect + admin` + inline `role !== 'admin'` | SAFE |
| `GET /api/staff` | `staff.js:26` + inline `staff.js:29-31` | `protect + admin` + inline `role !== 'admin'` | SAFE |
| `GET /api/orders/my-orders` | `orderController.js:232-234` | `protect` + `where: { userId: req.user.id }` — session-bound query | SAFE |
| `GET /api/auth/profile` | `authController.js:83` | `protect` + uses `req.user` from session | SAFE |
| `PUT /api/auth/profile` | `authController.js:88` | `protect` + updates only `req.user` record | SAFE |
| `GET /api/reviews/product/:productId` | N/A | Public by design; returns only approved reviews | SAFE |
| `POST /api/webhook/:gateway` | `payment.js:278-291` | No side effect currently (stub only — logs and acks) | NOT EXPLOITABLE (stub) |
| `POST /api/settings/theme` | `settings.js:18` | `protect + admin` + allowlisted theme values | SAFE |
| `PUT /api/products/:id` | `products.js:75` | `protect + admin` — product management, not user data | SAFE (admin scope) |

---

## 6. Analysis Constraints and Blind Spots

- **Paytm Verification API Behavior:** The confidence rating for AUTHZ-VULN-06 is MEDIUM because we could not call the live Paytm API to test whether fabricated ORDERID values result in `result.verified = true` or `false`. If the Paytm test environment is lenient, the practical exploitability could be higher.

- **Sequential PK Verification:** The claim that order IDs are sequential integers is based on Sequelize default auto-increment behavior for MySQL. This was not verified against live database state. If a custom PK strategy is used, AUTHZ-VULN-01 and AUTHZ-VULN-02 exploitability would decrease.

- **Staff Credentials Availability:** AUTHZ-VULN-03 requires a staff account. The exploitability analysis assumes staff accounts exist (normal business operation) and that their credentials could be obtained via credential stuffing, phishing, or brute force against the login endpoint (10 req/15 min rate limit). No direct path from `customer` to `staff` role exists in code.

- **Razorpay Test Mode:** If the application is running in Razorpay test mode, the HMAC verification may behave differently from production, potentially affecting AUTHZ-VULN-05 exploitability.

- **Global Rate Limit:** All endpoints are subject to the global rate limiter (100 req/15 min per IP, `index.js:67-73`). For AUTHZ-VULN-01 and AUTHZ-VULN-02, this provides a minor obstacle but is easily defeated with IP rotation or by staying within the limit (100 IDs per 15 minutes is sufficient for meaningful enumeration).

