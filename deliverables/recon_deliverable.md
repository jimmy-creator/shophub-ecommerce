# Reconnaissance Deliverable: ShopHub E-Commerce Platform

## 0) HOW TO READ THIS
This reconnaissance report provides a comprehensive map of the application's attack surface, with special emphasis on authorization and privilege escalation opportunities for the Authorization Analysis Specialist.

**Key Sections for Authorization Analysis:**
- **Section 4 (API Endpoint Inventory):** Contains authorization details for each endpoint - focus on "Required Role" and "Object ID Parameters" columns to identify IDOR candidates.
- **Section 6.4 (Guards Directory):** Catalog of authorization controls - understand what each guard means before analyzing vulnerabilities.
- **Section 7 (Role & Privilege Architecture):** Complete role hierarchy and privilege mapping - use this to understand the privilege lattice and identify escalation targets.
- **Section 8 (Authorization Vulnerability Candidates):** Pre-prioritized lists of endpoints for horizontal, vertical, and context-based authorization testing.

**How to Use the Network Mapping (Section 6):** The entity/flow mapping shows system boundaries and data sensitivity levels. Pay special attention to flows marked with authorization guards and entities handling PII/sensitive data.

**Priority Order for Testing:** Start with Section 8's High-priority horizontal candidates, then vertical escalation endpoints for each role level, finally context-based workflow bypasses.

---

## 1. Executive Summary

ShopHub is a full-stack e-commerce platform deployed at `https://shophubonline.store`. The application serves as a single-tenant online retail store with product browsing, shopping cart, checkout with multiple payment gateways (Razorpay, Paytm), order management, and an administrative back-office. Live browser testing confirms the store is operational with active product listings across six categories (Electronics, Clothing, Footwear, Accessories, Sports, Home).

**Core Technology Stack:**
- **Backend:** Node.js 20 + Express.js v5.2.1 (ES modules), Sequelize v6.37.8 ORM
- **Frontend:** React 19.2.4 SPA built with Vite 5.4.21
- **Database:** MySQL (localhost, unencrypted)
- **Reverse Proxy:** Nginx (serving static frontend, proxying `/api/*` and `/uploads/*`)
- **Authentication:** JWT (HS256, 7-day expiry) via HttpOnly cookies + localStorage Bearer token (dual-storage)
- **Payments:** Razorpay and Paytm integrations
- **Infrastructure:** Single VPS (Hostinger), PM2 process manager

**Primary Attack Surface Components:**
- 86 network-accessible API endpoints across 18 route files
- Dual-storage JWT authentication with no revocation mechanism
- Three-tier RBAC (customer/staff/admin) with broken staff permission enforcement
- Unauthenticated payment webhook endpoint with no signature verification
- Public file upload serving at `/uploads/*` via Nginx static handler
- Guest checkout and order tracking flows using email as identity

---

## 2. Technology & Service Map

- **Frontend:** React 19.2.4 SPA, React Router v7, Axios (with localStorage token interceptor + `withCredentials: true`), `@react-oauth/google` for Google One-Tap, `react-hot-toast` for notifications
- **Backend:** Node.js 20, Express.js v5.2.1 (ES modules), Sequelize v6.37.8, MySQL2 driver, `jsonwebtoken` v9.0.3 (HS256), `bcryptjs` v3.0.3 (12 rounds), `helmet` v8.1.0 (CSP disabled), `express-rate-limit` v8.3.1, `multer` v2.1.1, `nodemailer` v8.0.3, `razorpay` v2.9.6, `paytmchecksum` v1.5.1, `xss-clean` v0.1.4 (unmaintained), `express-mongo-sanitize` (MongoDB-targeted, irrelevant for MySQL), `hpp` v0.2.3
- **Infrastructure:** Single Hostinger VPS; Nginx reverse proxy on port 80/443 (HTTP→HTTPS via Certbot); PM2 process manager (single instance); no CDN, no Kubernetes, no Docker
- **Database:** MySQL on localhost (unencrypted TCP); Sequelize connection pool (max: 10, idle: 10s)
- **External Services:** Razorpay (payment), Paytm (payment), Google OAuth (authentication), Gmail SMTP (transactional email)
- **Identified Subdomains:** `shophubonline.store` (primary). No subdomains discovered via subfinder.
- **Open Ports & Services:**
  - Port 80/tcp — HTTP (Nginx, redirects to HTTPS)
  - Port 443/tcp — HTTPS (Nginx reverse proxy → Express on 127.0.0.1:3000)
  - Port 3000 — Express.js (internal only, not publicly exposed)
  - MySQL — localhost only (not publicly exposed)

---

## 3. Authentication & Session Management Flow

- **Entry Points:** `/login`, `/register`, `/forgot-password`, `/reset-password?token=&email=`, Google One-Tap button (all pages)
- **API Entry Points:** `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST /api/auth/google`

**Mechanism (Step-by-Step):**
1. Client submits credentials to `POST /api/auth/login` or `POST /api/auth/register`
2. Server validates credentials (bcrypt compare for login, or creates new user with `role: 'customer'` for register)
3. Server calls `generateToken(user.id)` → `jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRE })` — payload contains ONLY user ID
4. Server sets HttpOnly cookie: `Set-Cookie: token=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
5. Server also returns `{ user, token }` in JSON response body (dual-delivery)
6. Client stores `token` and `user` in `localStorage` (AuthContext.jsx:18-19)
7. Subsequent requests: Axios interceptor reads token from localStorage and sets `Authorization: Bearer <token>` header; cookie is also sent automatically due to `withCredentials: true`
8. Server `protect` middleware: checks `req.cookies.token` first, then `req.headers.authorization` Bearer token; verifies JWT signature; calls `User.findByPk(decoded.id)` for fresh DB lookup; sets `req.user`

**Code Pointers:**
- Token generation: `server/src/middleware/auth.js` lines 62-66
- Cookie options: `server/src/controllers/authController.js` lines 6-11
- Login handler: `server/src/controllers/authController.js` lines 57-77
- Register handler: `server/src/controllers/authController.js` lines 13-55
- Google OAuth: `server/src/routes/googleAuth.js` lines 15-70
- Frontend token storage: `client/src/context/AuthContext.jsx` lines 18-19
- Axios interceptor: `client/src/api/axios.js` lines 8-13

### 3.1 Role Assignment Process

- **Role Determination:** Role is NOT embedded in the JWT. The `protect` middleware fetches the full `User` row from the database on every request (`User.findByPk(decoded.id)` at `auth.js:13`), providing live role data.
- **Default Role:** `customer` — hardcoded in `authController.js:44` for registration; also hardcoded in `googleAuth.js:60` for Google OAuth sign-up. The `role` field in the request body is explicitly ignored.
- **Role Upgrade Path:** Staff accounts can ONLY be created by an admin via `POST /api/staff` (inline `role === 'admin'` check at `staff.js:48`). There is no self-service role upgrade. Admin accounts must be set directly in the database.
- **Code Implementation:** `server/src/controllers/authController.js:44` (registration role), `server/src/routes/staff.js:71` (staff creation), `server/src/models/User.js:26-27` (role ENUM definition with `customer` as default)

### 3.2 Privilege Storage & Validation

- **Storage Location:** Role and permissions are stored exclusively in the MySQL `Users` table (`role` ENUM column, `permissions` JSON column). NOT stored in JWT claims.
- **Validation Points:**
  - `protect` middleware (`auth.js:4-23`): validates JWT, loads live `req.user` from DB
  - `admin` middleware (`auth.js:25-31`): checks `req.user.role === 'admin' || req.user.role === 'staff'` — **CRITICAL FLAW**: passes ALL staff regardless of permissions
  - `requirePermission(...perms)` (`auth.js:34-45`): checks `req.user.permissions` array — **NEVER USED on any route** (dead code)
  - Inline checks in `staff.js` routes (`staff.js:29,48,84,112`): explicit `role !== 'admin'` check for staff management operations
- **Cache/Session Persistence:** No caching. Every request triggers a fresh DB lookup via `User.findByPk()`. Role changes are immediately effective.
- **Code Pointers:** `server/src/middleware/auth.js` (all middleware), `server/src/models/User.js:26-33` (role and permissions schema)

### 3.3 Role Switching & Impersonation

- **Impersonation Features:** None implemented.
- **Role Switching:** None implemented. No sudo mode or temporary privilege elevation.
- **Audit Trail:** `adminLogger` middleware in `security.js:47-54` logs admin actions to stdout only (not to a persistent store). Not confirmed to be mounted on all admin routes.
- **Code Implementation:** N/A (features not implemented)

---

## 4. API Endpoint Inventory

**Network Surface Focus:** All endpoints below are accessible through the deployed application. Nginx proxies `/api/*` to Express on `127.0.0.1:3000`. Static `/uploads/*` files are served directly by Nginx.

**Global middleware applied to all `/api/*` routes (in order):** `rateLimit` (100 req/15min prod) → `sanitizeInput` (body only) → `preventInjection` (body only) → `forceHttps` → `helmet` (CSP disabled) → `cors` → `hpp` → `cookieParser`

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | anon | None | None (authLimiter: 10/15min) | User registration; hardcodes role=customer. `authController.js:13` |
| POST | `/api/auth/login` | anon | None | None (authLimiter: 10/15min) | Credential login; returns JWT in cookie + body. `authController.js:57` |
| POST | `/api/auth/logout` | anon | None | None | Clears token cookie (no server-side revocation). `authController.js:79` |
| POST | `/api/auth/forgot-password` | anon | None | None (authLimiter: 10/15min) | Generates reset token; sends email. `authController.js:100` |
| POST | `/api/auth/reset-password` | anon | None | None (authLimiter: 10/15min) | Consumes reset token; sets new password. `authController.js:128` |
| GET | `/api/auth/profile` | customer | None | protect (JWT + DB lookup) | Returns current user profile. `authController.js:83` |
| PUT | `/api/auth/profile` | customer | None | protect (JWT + DB lookup) | Updates name/phone/address; no length validation. `authController.js:88` |
| POST | `/api/auth/google` | anon | None | None (no rate limit) | Google One-Tap OAuth; finds-or-creates user. `googleAuth.js:15` |
| GET | `/api/products` | anon | None | None | Product listing with pagination/filter/sort. `productController.js:4` |
| GET | `/api/products/categories` | anon | None | None | Returns product categories. `productController.js` |
| GET | `/api/products/search-suggestions` | anon | None | None | Autocomplete search; no rate limit. `products.js:16` |
| GET | `/api/products/:slug/related` | anon | slug | None | Related products by category. `products.js:44` |
| GET | `/api/products/:slug` | anon | slug | None | Product detail by slug. `productController.js` |
| POST | `/api/products` | admin/staff | None | protect + admin | Create product; mass assignment via req.body spread. `productController.js:74` |
| PUT | `/api/products/:id` | admin/staff | id (product) | protect + admin | Update product; unrestricted `product.update(req.body)`. `productController.js:75` |
| DELETE | `/api/products/:id` | admin/staff | id (product) | protect + admin | Delete product. `productController.js:76` |
| GET | `/api/categories` | anon | None | None | Public category listing (active only). `categories.js:8` |
| GET | `/api/categories/all` | admin/staff | None | protect + admin | All categories including inactive. `categories.js:21` |
| POST | `/api/categories` | admin/staff | None | protect + admin | Create category. `categories.js:33` |
| PUT | `/api/categories/:id` | admin/staff | id (category) | protect + admin | Update category. `categories.js:53` |
| DELETE | `/api/categories/:id` | admin/staff | id (category) | protect + admin | Delete category. `categories.js:65` |
| GET | `/api/reviews/product/:productId` | anon | productId | None | Public reviews for a product; ORDER BY injection risk. `reviews.js:10` |
| POST | `/api/reviews` | customer | None | protect | Submit review for purchased product. `reviews.js:50` |
| GET | `/api/reviews/all` | admin/staff | None | protect + admin | All reviews for moderation. `reviews.js:108` |
| POST | `/api/reviews/admin` | admin/staff | None | protect + admin | Create fake/admin review; no rating range check. `reviews.js:131` |
| PUT | `/api/reviews/:id/approve` | admin/staff | id (review) | protect + admin | Approve/reject a review. `reviews.js:161` |
| DELETE | `/api/reviews/:id` | admin/staff | id (review) | protect + admin | Delete a review. `reviews.js:176` |
| POST | `/api/coupons/apply` | anon | None | optionalAuth | Validate coupon code against cart total. `coupons.js:9` |
| GET | `/api/coupons` | admin/staff | None | protect + admin | List all coupons. `coupons.js:99` |
| POST | `/api/coupons` | admin/staff | None | protect + admin | Create coupon; no type allowlist. `coupons.js:109` |
| PUT | `/api/coupons/:id` | admin/staff | id (coupon) | protect + admin | Update coupon; unrestricted `coupon.update(req.body)`. `coupons.js:143` |
| DELETE | `/api/coupons/:id` | admin/staff | id (coupon) | protect + admin | Delete coupon. `coupons.js:157` |
| GET | `/api/payment/gateways` | anon | None | None | Returns available payment gateway list. `payment.js:42` |
| POST | `/api/payment/calculate-shipping` | anon | None | None | Shipping cost estimation; no rate limit. `payment.js:56` |
| POST | `/api/payment/calculate-tax` | anon | None | None | Tax calculation; no rate limit. `payment.js:67` |
| POST | `/api/payment/create-order` | anon | None | optionalAuth | Creates order + initiates payment; guests allowed. `payment.js:94` |
| POST | `/api/payment/verify` | anon | None | optionalAuth | Verifies payment signature; marks order paid. `payment.js:215` |
| POST | `/api/payment/webhook/:gateway` | anon | gateway | None (NO AUTH, NO SIGNATURE VERIFICATION) | Unimplemented stub; logs and returns OK. `payment.js:278` |
| POST | `/api/payment/paytm-callback` | anon | None | None (NO SIGNATURE VERIFICATION) | Paytm callback; ORDERID used in redirect URL without encoding. `payment.js:294` |
| POST | `/api/orders` | customer | None | protect | Create authenticated order. `orderController.js` |
| POST | `/api/orders/guest` | anon | None | None | Guest checkout; email validation only. `orderController.js` |
| GET | `/api/orders/track` | anon | None | None | Track order by orderNumber+email; email enumeration risk. `orderController.js` |
| GET | `/api/orders/my-orders` | customer | None | protect | List current user's orders. `orderController.js` |
| GET | `/api/orders/all` | admin/staff | None | protect + admin | All orders. `orderController.js` |
| GET | `/api/orders/:id/invoice` | anon | id (order, sequential PK) | optionalAuth (owner OR email match) | Download invoice PDF; email query param used for guest auth. `orders.js:24` |
| GET | `/api/orders/:id` | customer | id (order) | protect + ownership check | Get specific order (checks `order.userId === req.user.id`). `orderController.js:258` |
| PUT | `/api/orders/:id/status` | admin/staff | id (order) | protect + admin | Update order/payment status; no allowlist on status values. `orderController.js:288` |
| POST | `/api/orders/:id/cancel` | anon | id (order, sequential PK) | optionalAuth (owner OR email match) | Cancel order; guest auth via email in body. `cancellation.js:9` |
| POST | `/api/orders/:id/refund` | admin/staff | id (order) | protect + admin | Issue refund. `cancellation.js:78` |
| POST | `/api/orders/:id/refund-reject` | admin/staff | id (order) | protect + admin | Reject refund request. `cancellation.js:127` |
| GET | `/api/analytics/overview` | admin/staff | None | protect + admin | Dashboard overview stats. `analytics.js:10` |
| GET | `/api/analytics/revenue-chart` | admin/staff | None | protect + admin | Revenue over time; `period` param (string compare, safe). `analytics.js:96` |
| GET | `/api/analytics/top-products` | admin/staff | None | protect + admin | Best-selling products. `analytics.js:146` |
| GET | `/api/analytics/order-status` | admin/staff | None | protect + admin | Order status breakdown. `analytics.js:183` |
| GET | `/api/analytics/recent-orders` | admin/staff | None | protect + admin | Recent order list. `analytics.js:204` |
| GET | `/api/analytics/payment-methods` | admin/staff | None | protect + admin | Payment method stats. `analytics.js:219` |
| GET | `/api/analytics/low-stock` | admin/staff | None | protect + admin | Low stock product alerts. `analytics.js:243` |
| GET | `/api/customers` | admin/staff | None | protect + admin | All registered customers (PII); search via `Op.like`. `customers.js:10` |
| GET | `/api/customers/guests` | admin/staff | None | protect + admin | Guest customer PII. `customers.js:71` |
| GET | `/api/customers/:id/orders` | admin/staff | id (customer) | protect + admin | Customer's order history. `customers.js:115` |
| GET | `/api/customers/guest-orders` | admin/staff | None | protect + admin | ROUTING BUG: caught by `/:id/orders` with id="guest-orders". `customers.js:128` |
| GET | `/api/staff/permissions` | admin/staff | None | protect + admin (NO inline role===admin check) | Lists available permission slugs. `staff.js:21` |
| GET | `/api/staff` | admin only | None | protect + admin + inline role=admin | List all staff. `staff.js:26` |
| POST | `/api/staff` | admin only | None | protect + admin + inline role=admin | Create staff account. `staff.js:46` |
| PUT | `/api/staff/:id` | admin only | id (staff user) | protect + admin + inline role=admin | Update staff permissions. `staff.js:82` |
| DELETE | `/api/staff/:id` | admin only | id (staff user) | protect + admin + inline role=admin | Delete staff account. `staff.js:110` |
| GET | `/api/bulk-products/export` | admin/staff | None | protect + admin | Full product data CSV export. `bulkProducts.js:13` |
| GET | `/api/bulk-products/template` | admin/staff | None | protect + admin | Download CSV template. `bulkProducts.js:60` |
| POST | `/api/bulk-products/import` | admin/staff | None | protect + admin | CSV product import; any file type accepted; CSV formula injection. `bulkProducts.js:89` |
| POST | `/api/upload` | admin/staff | None | protect + admin | Single image upload; MIME from client header (no magic bytes). `upload.js:41` |
| POST | `/api/upload/multiple` | admin/staff | None | protect + admin | Upload up to 5 images. `upload.js:50` |
| GET | `/api/pincodes/check/:pincode` | anon | pincode | None | Check delivery availability by pincode. `pincodes.js:9` |
| GET | `/api/pincodes` | admin/staff | None | protect + admin | List all delivery pincodes. `pincodes.js:58` |
| POST | `/api/pincodes` | admin/staff | None | protect + admin | Add delivery pincode. `pincodes.js:89` |
| POST | `/api/pincodes/bulk` | admin/staff | None | protect + admin | Bulk pincode add. `pincodes.js:109` |
| PUT | `/api/pincodes/:id` | admin/staff | id (pincode) | protect + admin | Update pincode. `pincodes.js:143` |
| DELETE | `/api/pincodes/:id` | admin/staff | id (pincode) | protect + admin | Delete pincode. `pincodes.js:155` |
| GET | `/api/settings/theme` | anon | None | None | Get current theme setting (public). `settings.js:8` |
| PUT | `/api/settings/theme` | admin/staff | None | protect + admin | Change theme; allowlist validated (safe). `settings.js:18` |
| POST | `/api/abandoned-cart/save` | anon | None | optionalAuth | Save cart data with email; arbitrary JSON stored. `abandonedCart.js:10` |
| POST | `/api/abandoned-cart/recover` | anon | None | optionalAuth | Mark cart recovered; no verification. `abandonedCart.js:51` |
| GET | `/api/abandoned-cart` | admin/staff | None | protect + admin | List abandoned carts with customer emails. `abandonedCart.js:68` |
| POST | `/api/abandoned-cart/:id/send` | admin/staff | id (cart) | protect + admin | Send recovery email. `abandonedCart.js:103` |
| DELETE | `/api/abandoned-cart/:id` | admin/staff | id (cart) | protect + admin | Delete abandoned cart record. `abandonedCart.js:125` |
| GET | `/sitemap.xml` | anon | None | None | XML sitemap; host header injection if CLIENT_URL unset. `sitemap.js:6` |
| GET | `/robots.txt` | anon | None | None | Robots file; same host header injection risk. `sitemap.js:72` |
| GET | `/uploads/*` | anon | filename | None (Nginx static) | Uploaded files served directly; MIME sniffing risk. Nginx static handler |

---

## 5. Potential Input Vectors for Vulnerability Analysis

**Network Surface Focus:** All input vectors below are accessible through the deployed web application's network interface.

### URL Parameters (Path Params)

- **`/api/products/:slug`** — `req.params.slug` → `Product.findOne({ where: { slug } })` (`productController.js`)
- **`/api/products/:id`** (PUT/DELETE) — `req.params.id` → `Product.findByPk(id)` (`productController.js`)
- **`/api/reviews/product/:productId`** — `req.params.productId` → `Review.findAndCountAll({ where: { productId } })` (`reviews.js`)
- **`/api/reviews/:id`** — `req.params.id` → review lookup (`reviews.js`)
- **`/api/orders/:id`** — `req.params.id` → `Order.findByPk(id)` — sequential integer PK, enumerable (`orders.js`, `orderController.js`)
- **`/api/categories/:id`** — `req.params.id` → category operations (`categories.js`)
- **`/api/coupons/:id`** — `req.params.id` → coupon operations (`coupons.js`)
- **`/api/customers/:id`** — `req.params.id` → customer lookup (`customers.js`)
- **`/api/staff/:id`** — `req.params.id` → staff user operations (`staff.js`)
- **`/api/pincodes/check/:pincode`** — `req.params.pincode` → pincode lookup (`pincodes.js`)
- **`/api/pincodes/:id`** — `req.params.id` → pincode operations (`pincodes.js`)
- **`/api/payment/webhook/:gateway`** — `req.params.gateway` → logged without validation (`payment.js:278`)
- **`/api/abandoned-cart/:id`** — `req.params.id` → cart operations (`abandonedCart.js`)
- **`/api/products/:slug/related`** — `req.params.slug` → category lookup for related products (`products.js:44`)

### Query String Parameters

- **`/api/products?sort=`** — `req.query.sort` → **CRITICAL: directly interpolated into Sequelize ORDER BY clause** with no allowlist (`productController.js:39`)
- **`/api/products?order=`** — `req.query.order` → Sequelize ORDER BY direction; only `.toUpperCase()` applied (`productController.js:39`)
- **`/api/products?page=, limit=, category=, search=, minPrice=, maxPrice=, featured=`** — `req.query.*` → Sequelize WHERE/pagination; no upper bound on limit (`productController.js:6-16`)
- **`/api/products/search-suggestions?q=`** — `req.query.q` → `Op.like` query; length ≥ 2 check only (`products.js:16`)
- **`/api/reviews/product/:productId?sort=`** — `req.query.sort` → **CRITICAL: directly interpolated into Sequelize ORDER BY clause** (`reviews.js:20`)
- **`/api/reviews/product/:productId?page=, limit=`** — pagination params; no upper bound (`reviews.js:13`)
- **`/api/orders/track?orderNumber=, email=`** — `req.query.*` → order lookup; email enumeration risk (`orderController.js`)
- **`/api/orders/:id/invoice?email=`** — `req.query.email` → guest order authorization bypass; no rate limit (`orders.js:32-33`)
- **`/api/orders/all?status=, page=, limit=`** — admin order filtering (`orderController.js`)
- **`/api/customers?search=, limit=`** — admin customer search via `Op.like` (`customers.js:10`)
- **`/api/customers/guest-orders?email=`** — admin guest order filter (`customers.js:128`)
- **`/api/analytics/revenue-chart?period=`** — string comparison only; safe (`analytics.js:98`)

### POST Body Fields (JSON)

**Authentication:**
- `POST /api/auth/register`: `{ name, email, password }` — name: max 100 chars; email: no format check beyond length; password: regex validated
- `POST /api/auth/login`: `{ email, password }` — no body sanitization for rate-limited forms
- `POST /api/auth/forgot-password`: `{ email }` — presence check only
- `POST /api/auth/reset-password`: `{ token, email, password }` — non-constant-time token comparison (`authController.js:148`)
- `POST /api/auth/google`: `{ credential }` — Google ID token; no rate limit
- `PUT /api/auth/profile`: `{ name, phone, address }` — **NO length validation** despite registration having it (`authController.js:88`)

**Products:**
- `POST /api/products`: `{ ...req.body }` — **MASS ASSIGNMENT**: entire body spread to `Product.create({ ...req.body, slug })` (`productController.js:90`)
- `PUT /api/products/:id`: `{ ...req.body }` — **MASS ASSIGNMENT**: `product.update(req.body)` (`productController.js:111`)

**Orders / Checkout:**
- `POST /api/payment/create-order` (optionalAuth): `{ items[].productId, items[].quantity, items[].selectedVariant, shippingAddress, gateway, guestEmail, couponCode, shippingMethod }` — `shippingMethod` used as object key `shippingResult[shippingMethod]` (prototype pollution risk); `quantity` not range-validated (`payment.js:94`)
- `POST /api/orders/guest`: `{ items, shippingAddress, paymentMethod, shippingMethod, guestEmail, couponCode }` — guestEmail: permissive regex `/\S+@\S+\.\S+/`; shippingAddress stored as JSON blob (`orderController.js`)
- `POST /api/payment/verify` (optionalAuth): `{ orderNumber, gateway, paymentData }` — `paymentData` passed to gateway without validation (`payment.js:215`)
- `POST /api/payment/paytm-callback`: `{ ORDERID, STATUS, TXNID, ... }` — `ORDERID` used unencoded in redirect URL (`payment.js:326-328`)
- `POST /api/orders/:id/cancel` (optionalAuth): `{ email }` — email used as guest auth; no rate limit (`cancellation.js:9`)

**Payments / Coupons:**
- `POST /api/coupons/apply` (optionalAuth): `{ code, cartTotal, cartCategories }` — `cartTotal` not type-validated; used in arithmetic (`coupons.js:9`)
- `POST /api/coupons` (admin): `{ type, value, minOrderAmount, maxDiscount, applicableCategories, ... }` — no type/range validation; `type` has no allowlist (`coupons.js:109`)
- `PUT /api/coupons/:id` (admin): `{ ...req.body }` — **MASS ASSIGNMENT**: `coupon.update(req.body)` (`coupons.js:149`)

**Admin Operations:**
- `POST /api/reviews/admin`: `{ name, rating, title, comment, ... }` — **no rating range check** (user endpoint validates 1-5; admin skips this check) (`reviews.js:131`)
- `PUT /api/orders/:id/status` (admin): `{ orderStatus, paymentStatus, trackingNumber }` — **no allowlist** on status values; any string stored (`orderController.js:293-299`)
- `POST /api/staff`: `{ name, email, password, permissions[] }` — permissions array: **no validation of permission slug values** (`staff.js:71`)
- `POST /api/abandoned-cart/save` (optionalAuth): `{ email, items, cartTotal }` — arbitrary JSON stored; no format check on email; no authentication required (`abandonedCart.js:10`)
- `POST /api/payment/calculate-tax`: `{ items[].productId, items[].quantity, shippingState }` — quantity not validated (`payment.js:67`)

**File Uploads:**
- `POST /api/upload`: `multipart/form-data; name="image"` — MIME type from client Content-Type header (not magic bytes); extension allowlist: `.jpg,.jpeg,.png,.webp,.gif`; no magic byte check (`upload.js:20-30`)
- `POST /api/bulk-products/import`: `multipart/form-data; name="file"` — **ANY file type accepted** (no fileFilter in multer config); CSV formula injection; no row count limit (`bulkProducts.js:10,89`)

### HTTP Headers Used by Application

- **`Cookie: token=<jwt>`** — Primary authentication token; HttpOnly; `protect` middleware checks this first (`auth.js:7`)
- **`Authorization: Bearer <jwt>`** — Secondary token source; checked if cookie absent (`auth.js:8`)
- **`Host:`** — Used unvalidated in `forceHttps` redirect URL (`security.js:62`) and in sitemap/robots.txt URL construction when `CLIENT_URL` env var absent (`sitemap.js:8,73`)
- **`X-Forwarded-Proto:`** — Used by `forceHttps` middleware for HTTPS detection; bypassed if header absent (`security.js:60-61`)
- **`Content-Type: multipart/form-data`** — MIME type in multipart parts used by multer for file type validation (attacker-controlled)

### Cookie Values

- **`token`** — JWT bearer token; HttpOnly, Secure (production), SameSite=Strict; 7-day expiry; also duplicated in localStorage as `token` (`authController.js:6-11`)

---

## 6. Network & Interaction Map

**Network Surface Focus:** Only network-accessible components are mapped. Local-only components (PM2, MySQL direct access, deploy.sh) are excluded.

### 6.1 Entities

| Title | Type | Zone | Tech | Data | Notes |
|---|---|---|---|---|---|
| UserBrowser | Identity | Internet | Browser (Chrome/Firefox/Safari) | Tokens, PII | End user; accesses via HTTPS on port 443 |
| NginxProxy | Service | Edge | Nginx | Public | Reverse proxy; serves static SPA assets; forwards /api/* and /uploads/* to Express |
| ExpressApp | Service | App | Node.js 20 / Express 5.2.1 | PII, Tokens, Payments, Secrets | Main application backend on 127.0.0.1:3000; not directly internet-facing |
| MySQLDB | DataStore | Data | MySQL (Sequelize ORM) | PII, Tokens, Payments | Stores users, orders, products, sessions data; localhost only, unencrypted |
| UploadsDir | ExternAsset | App | Nginx static file serving | Public | `/var/www/shophub/uploads/`; images uploaded by admin; served without auth |
| RazorpayGateway | ThirdParty | ThirdParty | Razorpay API v2.9.6 | Payments | Payment processing; HMAC-SHA256 verification in SDK wrapper |
| PaytmGateway | ThirdParty | ThirdParty | Paytm Payments API | Payments | Payment processing; checksum generation present, callback verification missing |
| GoogleOAuth | ThirdParty | ThirdParty | Google Auth Library | Tokens | ID token verification with audience check; no PKCE/state parameter |
| GmailSMTP | ThirdParty | ThirdParty | Nodemailer / Gmail SMTP | PII | Transactional email; app password auth; TLS not enforced |
| AdminBrowser | Identity | Internet | Browser | Tokens, Secrets, PII | Admin/staff user; accesses /admin/* SPA routes and /api/admin/* endpoints |

### 6.2 Entity Metadata

| Title | Metadata Key: Value |
|---|---|
| NginxProxy | Hosts: `https://shophubonline.store:443`; Static: `/var/www/shophub/client/dist`; Proxy: `/api/* → 127.0.0.1:3000`, `/uploads/* → 127.0.0.1:3000`; Headers-Set: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`; Headers-Missing: `HSTS`, `CSP`, `Permissions-Policy`; MaxBodySize: `10M` (multer limit: 5MB, mismatch) |
| ExpressApp | Port: `3000` (localhost only); Auth: JWT via HttpOnly cookie + Bearer header; RateLimit: `100 req/15min (prod)`; AuthRateLimit: `10 req/15min`; Helmet: CSP disabled; CORS: origin=CLIENT_URL (falls back to `true` if unset); Sessions: None (stateless JWT); Routes: 86 endpoints across 18 route files |
| MySQLDB | Engine: MySQL; Exposure: localhost only; Encryption: None (unencrypted TCP on localhost); Consumers: ExpressApp; Credentials: `DB_USER`, `DB_PASSWORD` from .env; User: `shophub@localhost` with ALL PRIVILEGES (overly permissive); ORM: Sequelize v6.37.8 with parameterized queries |
| RazorpayGateway | Endpoint: `api.razorpay.com`; Auth: `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`; Verification: HMAC-SHA256 in `paymentGateway.js`; WebhookAuth: NOT IMPLEMENTED |
| PaytmGateway | Endpoint: `secure.paytmpayments.com` (prod) / `securestage.paytmpayments.com` (staging); Auth: `PAYTM_MERCHANT_ID`/`PAYTM_MERCHANT_KEY`; CallbackVerification: MISSING (`paytm-callback` handler has no checksum verification) |
| GoogleOAuth | Issuer: accounts.google.com; TokenType: ID Token; Verification: `OAuth2Client.verifyIdToken` with audience check; AccountLink: email-only (no googleId stored) |
| GmailSMTP | Provider: Gmail; Auth: App Password; TLS: Not enforced; Credentials: `SMTP_EMAIL`/`SMTP_APP_PASSWORD` in .env |
| UploadsDir | Path: `server/uploads/`; Access: Public (no auth); Served-by: Nginx static; FileTypes: jpg/jpeg/png/webp/gif (extension+MIME check; no magic bytes); FileNaming: `12-random-bytes-hex.ext` |

### 6.3 Flows (Connections)

| FROM → TO | Channel | Path/Port | Guards | Touches |
|---|---|---|---|---|
| UserBrowser → NginxProxy | HTTPS | `:443 /*` | tls | Public |
| UserBrowser → NginxProxy | HTTPS | `:443 /api/auth/login` | tls, rateLimit:10/15m | Tokens |
| UserBrowser → NginxProxy | HTTPS | `:443 /api/auth/register` | tls, rateLimit:10/15m | PII |
| UserBrowser → NginxProxy | HTTPS | `:443 /api/auth/profile` | tls, auth:customer | PII |
| UserBrowser → NginxProxy | HTTPS | `:443 /api/products*` | tls | Public |
| UserBrowser → NginxProxy | HTTPS | `:443 /api/payment/create-order` | tls, auth:optional | PII, Payments |
| UserBrowser → NginxProxy | HTTPS | `:443 /api/payment/verify` | tls, auth:optional | Payments |
| UserBrowser → NginxProxy | HTTPS | `:443 /api/payment/webhook/:gateway` | tls (NO AUTH) | Payments |
| UserBrowser → NginxProxy | HTTPS | `:443 /api/orders/:id/invoice` | tls, auth:optional-or-email | PII |
| UserBrowser → NginxProxy | HTTPS | `:443 /uploads/*` | tls | Public |
| AdminBrowser → NginxProxy | HTTPS | `:443 /api/analytics/*` | tls, auth:admin-or-staff | Payments, PII |
| AdminBrowser → NginxProxy | HTTPS | `:443 /api/customers/*` | tls, auth:admin-or-staff | PII |
| AdminBrowser → NginxProxy | HTTPS | `:443 /api/staff/*` | tls, auth:admin-only (inline) | Secrets |
| AdminBrowser → NginxProxy | HTTPS | `:443 /api/bulk-products/import` | tls, auth:admin-or-staff | Public (product data) |
| AdminBrowser → NginxProxy | HTTPS | `:443 /api/upload` | tls, auth:admin-or-staff | Public (files) |
| NginxProxy → ExpressApp | HTTP | `127.0.0.1:3000 /api/*` | localhost-only | PII, Tokens, Payments |
| NginxProxy → UploadsDir | File | `server/uploads/` | None (static serve) | Public |
| ExpressApp → MySQLDB | TCP | `127.0.0.1:3306` | localhost-only | PII, Tokens, Payments, Secrets |
| ExpressApp → RazorpayGateway | HTTPS | `api.razorpay.com` | api-key | Payments |
| ExpressApp → PaytmGateway | HTTPS | `securestage.paytmpayments.com` | api-key | Payments |
| ExpressApp → GoogleOAuth | HTTPS | `oauth2.googleapis.com` | client-id-audience | Tokens |
| ExpressApp → GmailSMTP | SMTP/TLS | `smtp.gmail.com:587` | app-password | PII |
| PaytmGateway → ExpressApp | HTTPS | `:443 /api/payment/paytm-callback` | None (no sig verification) | Payments |
| RazorpayGateway → ExpressApp | HTTPS | `:443 /api/payment/webhook/:gateway` | None (stub, no auth) | Payments |

### 6.4 Guards Directory

| Guard Name | Category | Statement |
|---|---|---|
| auth:customer | Auth | Requires any valid JWT (customer, staff, or admin); `protect` middleware loads `req.user` from DB. `auth.js:4-23` |
| auth:optional | Auth | Accepts valid JWT if present (sets `req.user`); allows guest access if token absent or invalid. `auth.js:48-60` |
| auth:admin-or-staff | Authorization | Requires valid JWT AND `role === 'admin' OR role === 'staff'`; enforced by `admin` middleware. `auth.js:25-31`. NOTE: passes ALL staff regardless of their assigned permissions. |
| auth:admin-only | Authorization | Requires valid JWT AND `role === 'admin'`; enforced by inline `role !== 'admin'` check inside specific staff route handlers. `staff.js:29,48,84,112` |
| ownership:order | ObjectOwnership | Verifies `order.userId === req.user.id` before granting access; enforced in `orderController.js:258-260`. Guests authorized via email match in query/body instead. |
| ownership:guest-email | ObjectOwnership | Guest authorization by matching provided email against `order.guestEmail` (case-insensitive). No rate limit. `orders.js:32-33`, `cancellation.js:16-17` |
| rateLimit:global | RateLimit | 100 requests per 15 minutes per IP (production); 1000 in development. Applied to all `/api/*` routes. `index.js:67-73` |
| rateLimit:auth | RateLimit | 10 requests per 15 minutes per IP; applied only to `/api/auth/register`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`. `auth.js:8-14` |
| tls | Protocol | Nginx terminates TLS; `forceHttps` middleware attempts redirect for HTTP requests reaching Express (unreliable; bypassed if X-Forwarded-Proto header absent). |
| localhost-only | Network | MySQL and internal Express port are bound to 127.0.0.1; not reachable from internet. |
| cors:client-url | Network | CORS `origin` set to `CLIENT_URL` env var value. If `CLIENT_URL` is unset, falls back to `origin: true` (all origins allowed with credentials). `index.js:55-61` |
| permission:required | Authorization | Checks `req.user.permissions` array for specific permission slug. DEAD CODE — never mounted on any route. `auth.js:34-45` |

---

## 7. Role & Privilege Architecture

### 7.1 Discovered Roles

| Role Name | Privilege Level | Scope/Domain | Code Implementation |
|---|---|---|---|
| anon | 0 | Global | No authentication required; guest checkout and public browsing |
| customer | 1 | Global | Default role assigned on registration/Google OAuth; `protect` middleware; `authController.js:44`, `googleAuth.js:60` |
| staff | 4 | Global | Created by admin only via `POST /api/staff`; `admin` middleware passes this role to ALL admin routes (permissions array not enforced); `staff.js:71`, `auth.js:26` |
| admin | 5 | Global | Full application administration; must be set directly in DB; inline `role === 'admin'` checks only on staff management routes; `auth.js:25-31`, `staff.js:29,48,84,112` |

**Staff Permissions (defined but NOT enforced on any route):**
`products`, `orders`, `coupons`, `reviews`, `customers`, `analytics`, `categories`, `settings` — defined in `staff.js:9-18`

### 7.2 Privilege Lattice

```
Privilege Ordering (→ means "can access resources of"):
anon → customer → staff → admin

Staff == Admin for ALL routes EXCEPT staff management:
  - staff = admin for: products, categories, orders, reviews, coupons, analytics, customers,
    bulk-products, upload, pincodes, settings/theme, abandoned-cart
  - staff < admin for: /api/staff/* (GET/POST/PUT/DELETE) — inline role===admin checks

Parallel Isolation:
  - None: staff has flat, undifferentiated access to all admin routes
  - The 'permissions' field on staff users is stored but never enforced by any route

Effective hierarchy:
  anon (0) < customer (1) < staff (4) ≈ admin (5) [staff gets admin for 44/48 route groups]
  admin (5) > staff (4) for staff management routes only
```

**Token Revocation:** No mechanism. A valid JWT remains valid for 7 days after issuance even if the user is deleted, demoted, or logged out. The `localStorage` copy persists through logout (cookie is cleared but Bearer header path remains valid).

### 7.3 Role Entry Points

| Role | Default Landing Page | Accessible Route Patterns | Authentication Method |
|---|---|---|---|
| anon | `/` | `/`, `/products`, `/product/:slug`, `/login`, `/register`, `/forgot-password`, `/track-order`, `/cart`, `/contact`, `/sitemap.xml`, `/robots.txt` | None |
| customer | `/` (redirect from login) | All anon routes + `/profile`, `/orders`, `/checkout`, `/wishlist`, `/api/auth/profile`, `/api/orders/my-orders`, `/api/orders/:id` | JWT via HttpOnly cookie + localStorage Bearer token |
| staff | `/admin` (frontend SPA checks for admin/staff role client-side) | All customer routes + `/admin/*` frontend pages + all `/api/*` admin endpoints EXCEPT `/api/staff` write operations | JWT via HttpOnly cookie + localStorage Bearer token |
| admin | `/admin` | All routes | JWT via HttpOnly cookie + localStorage Bearer token |

**Live Browser Observation:** Navigating to `/admin` without authentication causes the SPA to fire 7 analytics API calls (`/api/analytics/*`) immediately before checking auth state, resulting in 401 responses. This reveals the admin dashboard structure to unauthenticated users via network requests visible in browser DevTools.

### 7.4 Role-to-Code Mapping

| Role | Middleware/Guards | Permission Checks | Storage Location |
|---|---|---|---|
| anon | None | None | N/A |
| customer | `protect` | `req.user` must exist; no role check | MySQL `Users.role` = 'customer'; JWT payload: `{ id }` |
| staff | `protect` + `admin` | `req.user.role === 'admin' \|\| req.user.role === 'staff'` (`auth.js:26`) | MySQL `Users.role` = 'staff'; `permissions` JSON column (unenforced) |
| admin | `protect` + `admin` + optional inline `role === 'admin'` | `req.user.role === 'admin'` (inline in staff.js routes only) | MySQL `Users.role` = 'admin' |

---

## 8. Authorization Vulnerability Candidates

### 8.1 Horizontal Privilege Escalation Candidates

| Priority | Endpoint Pattern | Object ID Parameter | Data Type | Sensitivity |
|---|---|---|---|---|
| High | `GET /api/orders/:id/invoice?email=` | `id` (sequential integer PK) + `email` query param | PII, financial | Invoice PDF with full order details, shipping address, items, pricing; guest auth via guessable email+sequential ID |
| High | `POST /api/orders/:id/cancel` + body `{ email }` | `id` (sequential integer PK) + `email` body field | financial | Guest can cancel any order by combining sequential order ID with known/guessed guest email |
| High | `GET /api/orders/:id` | `id` (sequential integer PK) | financial, PII | Authenticated user order detail; server checks `order.userId === req.user.id` but bypass may exist |
| Medium | `GET /api/reviews/product/:productId` | `productId` | user_data | Review listing; exposes reviewer names and content; may reveal private purchase info via review data |
| Medium | `PUT /api/reviews/:id/approve` | `id` (review) | user_data | Admin approves reviews; no user ownership check (admin-level access required) |
| Medium | `GET /api/customers/:id/orders` | `id` (customer) | PII, financial | Admin endpoint; any staff can enumerate all customer orders by customer ID |
| Low | `GET /api/pincodes/check/:pincode` | pincode | public | Delivery availability; enumeration of valid delivery zones |
| Low | `DELETE /api/abandoned-cart/:id` | `id` (cart) | PII | Admin can delete any abandoned cart record |

### 8.2 Vertical Privilege Escalation Candidates

| Target Role | Endpoint Pattern | Functionality | Risk Level |
|---|---|---|---|
| staff/admin | `GET /api/analytics/*` (7 endpoints) | Full business intelligence — revenue, orders, stock | High |
| staff/admin | `GET /api/customers` | All registered customers with PII | High |
| staff/admin | `GET /api/customers/guests` | Guest customer PII | High |
| staff/admin | `GET /api/orders/all` | All orders with PII and financials | High |
| staff/admin | `POST /api/bulk-products/import` | CSV mass product update (overwrite any product by ID) | High |
| staff/admin | `GET /api/bulk-products/export` | Full product database export | Medium |
| staff/admin | `POST /api/upload` | File upload to server (MIME spoofing risk) | High |
| staff/admin | `PUT /api/orders/:id/status` | Manipulate order/payment status (any string, no allowlist) | High |
| staff/admin | `POST /api/coupons` | Create financial discount codes | High |
| staff/admin | `DELETE /api/coupons/:id` | Delete discount codes | Medium |
| staff/admin | `POST /api/reviews/admin` | Create fake verified reviews; no rating range check | Medium |
| staff/admin | `GET /api/staff/permissions` | List permission slugs (no inline admin-only guard) | Low |
| admin only | `POST /api/staff` | Create staff accounts with arbitrary permissions | High |
| admin only | `PUT /api/staff/:id` | Modify staff permissions | High |
| admin only | `DELETE /api/staff/:id` | Delete staff accounts | High |

**Critical Staff Escalation Note:** The `admin` middleware (`auth.js:26`) passes staff users to ALL endpoints in the table above (except the last three admin-only rows). This means any staff account — even one created with `permissions: []` — has FULL access to analytics, customer PII, order manipulation, file uploads, CSV import, and coupon management. The `requirePermission` middleware exists but is DEAD CODE — never mounted on any route.

### 8.3 Context-Based Authorization Candidates

| Workflow | Endpoint | Expected Prior State | Bypass Potential |
|---|---|---|---|
| Payment flow | `POST /api/payment/verify` | `POST /api/payment/create-order` called first; order exists in DB | Direct invocation with crafted `{ orderNumber, gateway, paymentData }` to mark arbitrary orders as paid |
| Payment webhook | `POST /api/payment/webhook/:gateway` | Should be server-to-server Razorpay/Paytm call | Completely unauthenticated stub; accepts any POST; currently logs and returns OK without updating order state (but if backend logic is ever added, becomes critical) |
| Paytm callback | `POST /api/payment/paytm-callback` | Paytm payment completion | `ORDERID` + `STATUS=TXN_SUCCESS` body fields update order status with no signature verification |
| Order cancellation | `POST /api/orders/:id/cancel` | Order must be in cancellable state | Direct access with any order ID; relies only on email match for guest auth |
| Invoice access | `GET /api/orders/:id/invoice?email=` | User must be authenticated owner OR provide correct guest email | Enumerate sequential order IDs + guess/know guest email address |
| Guest checkout | `POST /api/orders/guest` | Cart populated in browser | Can create orders programmatically without UI cart flow; no rate limit |
| Coupon per-user limit | `POST /api/coupons/apply` + `POST /api/payment/create-order` | Coupon per-user limit tracked by userId | Guests bypass per-user limits because `userId = null` for all guest orders — can use same coupon unlimited times with different emails |
| Password reset | `POST /api/auth/reset-password` | `POST /api/auth/forgot-password` called first; valid token in DB | Non-constant-time token comparison (`authController.js:148`) opens theoretical timing attack |
| Abandoned cart recovery | `POST /api/abandoned-cart/recover` | Recovery email sent by admin | No verification that a recovery email was actually sent; any caller with a cart ID can mark it recovered |

---

## 9. Injection Sources (Command Injection, SQL Injection, LFI/RFI, SSTI, Path Traversal, Deserialization)

**Network Surface Focus:** All sources below are reachable through the deployed web application's network interface.

### 9.1 SQL Injection Sources

#### SQL-01 — ORDER BY Column Injection in Product Listing (CRITICAL)
**Type:** SQL Injection (ORDER BY clause)
**Endpoint:** `GET /api/products?sort=<payload>&order=<payload>` — **No authentication required**
**Data Flow:**
```
INPUT:       req.query.sort   (productController.js:13)
             req.query.order  (productController.js:13)
             ↓ No sanitization (global sanitizeInput only processes req.body)
             ↓ No allowlist validation
INTERMEDIATE: const { sort = 'createdAt', order = 'DESC' } = req.query;  (line 13-14)
SINK:         Product.findAndCountAll({ order: [[sort, order.toUpperCase()]] })  (line 39)
```
Sequelize passes the `sort` value as a raw column identifier and `order` direction in the ORDER BY clause. Column identifiers are backtick-quoted by MySQL dialect, but the `order` direction string is passed with less escaping and no allowlist. Neither value is validated against a whitelist.

**Files:** `server/src/controllers/productController.js:13,39`
**Auth Required:** None (public endpoint)
**Severity:** HIGH

#### SQL-02 — ORDER BY Column Injection in Review Listing (CRITICAL)
**Type:** SQL Injection (ORDER BY clause)
**Endpoint:** `GET /api/reviews/product/:productId?sort=<payload>` — **No authentication required**
**Data Flow:**
```
INPUT:       req.query.sort  (reviews.js:13)
             ↓ No sanitization (global middleware skips req.query)
             ↓ No allowlist validation
INTERMEDIATE: const { page = 1, limit = 10, sort = 'createdAt' } = req.query;  (line 13)
SINK:         Review.findAndCountAll({ order: [[sort, 'DESC']] })  (line 20)
```
Identical pattern to SQL-01. The `sort` query parameter is used directly as the Sequelize column name in ORDER BY without any allowlist.

**Files:** `server/src/routes/reviews.js:13,20`
**Auth Required:** None (public endpoint)
**Severity:** HIGH

### 9.2 Command Injection Sources

**None found.** No usage of `exec()`, `execSync()`, `spawn()`, `execFile()`, `eval()`, or `child_process` was found in any server-side source file. Confirmed negative.

### 9.3 Path Traversal / LFI Sources

**No exploitable path traversal found in file upload paths.** Uploaded file names are generated server-side using `crypto.randomBytes(12).toString('hex')` + validated extension (`upload.js:14-15`). The original filename from the client is never used in filesystem operations.

**CSV import (`bulkProducts.js`):** CSV is parsed from an in-memory Buffer (multer memoryStorage); no filesystem path operations on user-supplied values.

**Invoice generation (`invoiceService.js`):** PDFs generated entirely in-memory using PDFKit buffer mode; no file paths derived from user input.

**Potential concern — MIME type spoofing (not path traversal but related):**
```
INPUT:       Content-Type header in multipart upload (attacker-controlled)
             file.originalname extension (attacker-controlled)
SINK:        File stored at: uploads/<hex>.ext  (upload.js:15)
             Served at: /uploads/<hex>.ext (Nginx static)
```
An attacker can rename an HTML/JS/SVG file with `.jpg` extension and set `Content-Type: image/jpeg` to bypass the MIME check and upload web content to the uploads directory. `upload.js:20-30` — Admin-only endpoint.

### 9.4 SSTI Sources

**None found.** No server-side template engine (EJS, Pug, Handlebars, Nunjucks, Mustache) is used anywhere. Email HTML is built using plain JavaScript template literals — these are not template engines and not subject to SSTI. Confirmed negative.

### 9.5 Deserialization Sources

**No unsafe deserialization found.** Standard `JSON.parse` is used via Express body-parser. No `node-serialize`, `serialize-javascript`, `yaml.load(unsafe)`, or custom deserialization functions were found. The `items` array in order creation is parsed by body-parser and used directly — the individual fields are accessed by property name, not deserialized in an unsafe way. Confirmed negative.

### 9.6 SSRF Sources

**No direct SSRF found.** All server-side HTTP requests go to hardcoded URLs (Razorpay API, Paytm API, Google OAuth, Gmail SMTP). The `gateway` parameter in payment routes selects a pre-configured gateway object by name from a hardcoded enum — no user-supplied URL component reaches any `fetch()` or HTTP call.

**Partial concern — Paytm callback redirect:**
```
INPUT:       req.body.ORDERID  (payment.js:294, from Paytm POST callback)
INTERMEDIATE: res.redirect(`${clientUrl}/order-success?orderNumber=${ORDERID}`)  (line 326-328)
```
`ORDERID` is used unencoded in the redirect URL. The `clientUrl` is from environment variables (trusted), but `ORDERID` could contain query string special characters (`&`, `=`) to manipulate the redirect destination URL parameters. This is more of an open redirect/parameter injection risk than SSRF.

### 9.7 Additional Stored Injection Sources

#### INJ-01 — Stored HTML Injection via Shipping Address in Email Templates (LOW-MEDIUM)
**Type:** Stored HTML Injection (email context)
**Endpoint:** `POST /api/payment/create-order` or `POST /api/orders/guest` — **No authentication required** (guest checkout)
**Data Flow:**
```
INPUT:       req.body.shippingAddress.{fullName, address, city, state, zipCode, phone}
             ↓ sanitizeInput middleware HTML-encodes < and > (req.body only, at request time)
             → stored in Orders table as JSON blob
             ↓ Later retrieved for order confirmation email
SINK:        emailService.js baseTemplate string interpolation:
             `${address.fullName}<br>`    (emailService.js:139)
             `${address.address}<br>`    (emailService.js:140)
             `${address.city}, ${address.state}...`  (emailService.js:141)
```
The `sanitizeInput` middleware encodes `<` and `>` at write-time, partially mitigating HTML tag injection. However, attribute-level injection payloads (e.g., `" onload="alert(1)"`) bypass the angle-bracket filter and may render in HTML email clients. The stored data flows into email HTML without a second encoding pass.

**Files:** `server/src/routes/payment.js:150-163` (storage), `server/src/services/emailService.js:139-142` (sink)
**Auth Required:** None (guest checkout)
**Severity:** LOW-MEDIUM

#### INJ-02 — Host Header Injection in Sitemap/Robots.txt XML (LOW)
**Type:** Host Header Injection
**Endpoint:** `GET /sitemap.xml`, `GET /robots.txt` — **No authentication required**
**Data Flow:**
```
INPUT:       req.headers.host  (sitemap.js:8)
             ↓ No validation
INTERMEDIATE: const baseUrl = process.env.CLIENT_URL || `https://${req.headers.host}`;
SINK:         Reflected in XML/text response body as URL values (sitemap.js:12-70)
```
If the `CLIENT_URL` environment variable is unset, `req.headers.host` is used unvalidated to construct `<loc>` URLs in the sitemap XML. An attacker with control over the `Host` header can inject arbitrary URLs into the sitemap, potentially poisoning search engine caches.

**Files:** `server/src/routes/sitemap.js:8,12-70`
**Auth Required:** None (public endpoint)
**Severity:** LOW

#### INJ-03 — Host Header Injection in HTTPS Redirect (LOW)
**Type:** Host Header Injection / Open Redirect
**Endpoint:** All HTTP requests (if X-Forwarded-Proto is present and non-https)
**Data Flow:**
```
INPUT:       req.headers.host  (security.js:62)
             ↓ No validation
SINK:         res.redirect(301, `https://${req.headers.host}${req.url}`);
```
The `forceHttps` middleware uses the unvalidated `Host` header in a 301 redirect. An attacker can spoof the `Host` header to redirect victims to an attacker-controlled domain. Note: this is only triggered when `X-Forwarded-Proto` is present but not `https`.

**Files:** `server/src/middleware/security.js:62`
**Auth Required:** None
**Severity:** LOW

#### INJ-04 — Mass Assignment via Product Create/Update (MEDIUM, Admin-only)
**Type:** Mass Assignment
**Endpoint:** `POST /api/products`, `PUT /api/products/:id` — **Admin/Staff required**
**Data Flow:**
```
INPUT:       req.body (entire request body object)
             ↓ No field allowlist
SINK:         Product.create({ ...req.body, slug })   (productController.js:90)
              product.update(req.body)                 (productController.js:111)
```
Any field accepted by the Sequelize Product model can be set via the request body, including internal fields like `createdAt`, `updatedAt`, numeric IDs, or model-internal flags.

**Files:** `server/src/controllers/productController.js:90,111`
**Auth Required:** Admin or Staff
**Severity:** MEDIUM (admin attack surface)

#### INJ-05 — Mass Assignment via Coupon Update (MEDIUM, Admin-only)
**Type:** Mass Assignment
**Endpoint:** `PUT /api/coupons/:id` — **Admin/Staff required**
**Data Flow:**
```
INPUT:       req.body
SINK:         coupon.update(req.body)  (coupons.js:149)
```
**Files:** `server/src/routes/coupons.js:149`
**Auth Required:** Admin or Staff
**Severity:** MEDIUM (admin attack surface)

#### INJ-06 — Unvalidated Payment Gateway Parameter (INFORMATIONAL)
**Type:** Input Validation (Gateway Selection)
**Endpoint:** `POST /api/payment/create-order`, `POST /api/payment/verify`
**Data Flow:**
```
INPUT:       req.body.gateway
INTERMEDIATE: const paymentGateway = getPaymentGateway(gateway);  (payment.js:179)
              → lookups a hardcoded enum; throws for unknown gateway names
SINK:         Constrained to: razorpay, cashfree, payu, phonepe, ccavenue, paytm
```
Gateway URLs are hardcoded in `paymentGateway.js`; no user-supplied URL reaches `fetch()`. Not a true injection source, but should be validated to prevent unexpected gateway instantiation behavior.

**Files:** `server/src/routes/payment.js:96,179`
**Auth Required:** None (optionalAuth)
**Severity:** INFORMATIONAL
