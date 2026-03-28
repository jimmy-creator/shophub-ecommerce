# Injection Analysis Report (SQLi & Command Injection)

## 1. Executive Summary

- **Analysis Status:** Complete
- **Key Outcome:** After systematic white-box analysis of every injection source identified in the reconnaissance deliverable, **no externally exploitable SQL injection or Command Injection vulnerabilities were confirmed**. All data entry points that reach database sinks do so through Sequelize ORM's parameterized query layer. No `child_process` / shell execution sinks exist anywhere in the server-side codebase. The exploitation queue is empty.
- **Purpose of this Document:** This report provides the detailed source-to-sink traces, confirmed defense mechanisms, and the rationale behind each "safe" verdict. It serves as the permanent record of injection-surface coverage for this engagement.

**Technology Note:** The application is built on Node.js 20 + Express.js v5.2.1 with Sequelize v6.37.8 ORM against a MySQL database. The Sequelize ORM provides two layers of structural protection: (1) parameterized query binding for all WHERE-clause values, and (2) backtick-quoted identifier escaping (with full backtick-stripping) for ORDER BY column names, combined with a built-in direction whitelist (`["ASC","DESC","ASC NULLS LAST","DESC NULLS LAST","ASC NULLS FIRST","DESC NULLS FIRST","NULLS FIRST","NULLS LAST"]`). These mechanisms, verified in the node_modules source at `sequelize/lib/dialects/mysql/query-generator.js` and `sequelize/lib/utils.js`, neutralise the ORDER BY column-injection patterns flagged as CRITICAL by the reconnaissance agent.

---

## 2. Dominant Vulnerability Patterns

### Pattern A — ORM-First Architecture (Defense)
- **Description:** Every database operation in the codebase uses Sequelize ORM methods (`findOne`, `findAll`, `findByPk`, `findAndCountAll`, `create`, `update`, `count`). No raw SQL strings or `sequelize.query()` calls that accept user input were found.
- **Implication:** Classic string-concatenation SQLi is structurally absent. All WHERE-clause values are bound as query parameters by the MySQL2 driver before execution.
- **Representative finding:** All 86 endpoints analyzed — confirmed Sequelize parameterization throughout.

### Pattern B — Middleware Gap: req.query and req.params Are Never Sanitized
- **Description:** The `sanitizeInput` middleware (`security.js:22-27`) and `preventInjection` middleware (`security.js:29-44`) both operate exclusively on `req.body`. The Express v5 comment in the source code itself ("query and params are read-only in Express 5") confirms the deliberate omission of req.query/req.params sanitization.
- **Implication:** Any user input arriving via URL query strings or path parameters flows to handlers with zero sanitization. For Sequelize WHERE-clause bindings this is safe (the driver handles escaping), but for ORDER BY identifiers this creates a structural dependency on Sequelize's internal quoting — which in v6.37.8 is adequate but fragile.
- **Representative finding:** SQL-01 (`sort`/`order` in `productController.js:13,39`) and SQL-02 (`sort` in `reviews.js:13,20`) are the clearest examples of zero-sanitized query params reaching a DB sink. Both are ultimately safe due to Sequelize internals, but they represent a code quality risk.

### Pattern C — No Shell Execution Sinks
- **Description:** A comprehensive grep across `server/src/` for `child_process`, `exec(`, `execSync`, `spawn(`, `execFile`, `eval(`, `Function(`, and `vm.runIn` returned **zero matches**.
- **Implication:** Command injection is structurally impossible — there are no sink functions that could execute attacker-controlled strings as shell commands.
- **Representative finding:** Section 9.2 of the recon deliverable confirmed negative; this analysis independently verified.

---

## 3. Strategic Intelligence for Exploitation

- **No SQL Injection or Command Injection vulnerabilities were confirmed.** The exploitation queue is empty. There is no actionable intelligence to provide for these vulnerability classes.

- **Key Defensive Architecture:**
  - Sequelize v6.37.8 ORM with MySQL dialect — all queries parameterized at driver level
  - `preventInjection` middleware blocks NoSQL-style `$`-prefixed keys in req.body (irrelevant to MySQL but present)
  - `xss-clean` library (unmaintained, req.body only) + custom `sanitizeInput` middleware
  - `hpp` (HTTP Parameter Pollution prevention) applied globally
  - Rate limiting: 100 req/15min global, 10 req/15min on auth endpoints

- **Note on ORDER BY Column Name Injection (SQL-01, SQL-02):**
  The recon report flagged these as CRITICAL. White-box code-level analysis of Sequelize's `quoteIdentifier` in `sequelize/lib/dialects/mysql/query-generator.js` confirms: the MySQL dialect calls `Utils.addTicks(Utils.removeTicks(identifier, "\`"), "\`")`. `removeTicks` strips ALL backtick characters from the input before `addTicks` re-wraps the result. This means `user_input; DROP TABLE users--` becomes the identifier `` `user_input; DROP TABLE users--` `` — MySQL treats the entire string as a column name and returns "Unknown column" rather than executing the injected SQL. Similarly, the ORDER direction is validated against a hardcoded 8-entry whitelist before being passed to `sequelize.literal()`; non-matching values are treated as column names and quoted. **These vectors are SAFE in Sequelize v6.37.8.**

- **Non-SQL/Non-Command Injection Issues Noted (out of scope for this queue):**
  - **Paytm ORDERID URL injection** (`payment.js:326,328`): `ORDERID` from POST body is unencoded in `res.redirect(...)`. An attacker who can forge a Paytm callback (no signature verification) could inject URL query parameters. This is an open-redirect/parameter-injection issue, not SQLi.
  - **Stored HTML injection in emails** (`emailService.js:139-142`): `sanitizeInput` only escapes `<` and `>`, leaving attribute-context injection (e.g., `" onload="...`) possible in HTML email templates for the shipping address fields. This is an email-context XSS issue, not SQLi.
  - **Host Header Injection** (`sitemap.js:8`, `security.js:62`): If `CLIENT_URL` env var is unset, `req.headers.host` is unsanitized in redirect and sitemap URLs.

---

## 4. Vectors Analyzed and Confirmed Secure

All input vectors identified in Section 9 and Section 5 of the recon deliverable were traced. Every path is documented below.

### 4.1 ORDER BY Injection Candidates (Flagged CRITICAL by Recon)

| Source Parameter | Endpoint / File:Line | Sink Call | Slot Type | Defense Mechanism | Verdict |
|---|---|---|---|---|---|
| `req.query.sort` | `GET /api/products` · `productController.js:13,39` | `Product.findAndCountAll({ order: [[sort, order.toUpperCase()]] })` | SQL-ident | Sequelize v6 MySQL `quoteIdentifier`: strips all backticks, re-wraps in backticks → identifier cannot escape quoting context | SAFE |
| `req.query.order` | `GET /api/products` · `productController.js:14,39` | Same ORDER BY clause | SQL-enum | Sequelize direction whitelist (`validOrderOptions`): invalid values treated as column names and quoted; valid values fetched from the whitelist array itself | SAFE |
| `req.query.sort` | `GET /api/reviews/product/:productId` · `reviews.js:13,20` | `Review.findAndCountAll({ order: [[sort, 'DESC']] })` | SQL-ident | Same Sequelize quoteIdentifier mechanism as above | SAFE |

### 4.2 URL Path Parameters

| Source Parameter | Endpoint / File:Line | Sink Call | Slot Type | Defense Mechanism | Verdict |
|---|---|---|---|---|---|
| `req.params.slug` | `GET /api/products/:slug` · `productController.js` | `Product.findOne({ where: { slug } })` | SQL-val | Sequelize parameterized binding | SAFE |
| `req.params.id` | `GET /api/products/:id` PUT/DELETE · `productController.js` | `Product.findByPk(id)` | SQL-val | Sequelize `findByPk` parameterized | SAFE |
| `req.params.productId` | `GET /api/reviews/product/:productId` · `reviews.js:12,17` | `Review.findAndCountAll({ where: { productId, approved: true } })` | SQL-val | Sequelize parameterized binding | SAFE |
| `req.params.id` | `GET /api/orders/:id` · `orders.js` | `Order.findByPk(id)` | SQL-val | Sequelize `findByPk` parameterized | SAFE |
| `req.params.id` | `GET /api/orders/:id/invoice` · `orders.js:24` | `Order.findByPk(req.params.id)` | SQL-val | Sequelize `findByPk` parameterized | SAFE |
| `req.params.id` | Various admin endpoints (categories, coupons, reviews, staff, pincodes) | `Model.findByPk(id)` | SQL-val | Sequelize `findByPk` parameterized | SAFE |
| `req.params.pincode` | `GET /api/pincodes/check/:pincode` · `pincodes.js:11,18` | `Pincode.findOne({ where: { pincode, active: true } })` | SQL-val | Sequelize parameterized binding | SAFE |
| `req.params.slug` | `GET /api/products/:slug/related` · `products.js:43,48` | `Product.findOne({ where: { slug, active: true } })` | SQL-val | Sequelize parameterized binding | SAFE |
| `req.params.gateway` | `POST /api/payment/webhook/:gateway` · `payment.js:278` | Logged only; no DB sink | N/A | No DB query performed | SAFE |
| `req.params.id` | `GET /api/abandoned-cart/:id/send`, `DELETE /api/abandoned-cart/:id` | `AbandonedCart.findByPk(id)` | SQL-val | Sequelize `findByPk` parameterized | SAFE |

### 4.3 Query String Parameters (Non-ORDER-BY)

| Source Parameter | Endpoint / File:Line | Sink Call | Slot Type | Defense Mechanism | Verdict |
|---|---|---|---|---|---|
| `req.query.q` | `GET /api/products/search-suggestions` · `products.js:17,27-29` | `Product.findAll({ where: { [Op.or]: [{ name: { [Op.like]: \`%${q}%\` } }, ...] } })` | SQL-val (LIKE) | Sequelize parameterized Op.like — template literal constructs the value string; the bound parameter is the full `%q%` string, not SQL structure | SAFE |
| `req.query.category` | `GET /api/products` · `productController.js:9,20` | `where.category = category` in Sequelize `findAndCountAll` | SQL-val | Sequelize parameterized binding | SAFE |
| `req.query.search` | `GET /api/products` · `productController.js:10,23-26` | `Op.like: \`%${search}%\`` | SQL-val (LIKE) | Sequelize parameterized Op.like | SAFE |
| `req.query.minPrice`, `req.query.maxPrice` | `GET /api/products` · `productController.js:11-12,30-31` | `where.price[Op.gte/lte] = minPrice/maxPrice` | SQL-val | Sequelize parameterized binding; MySQL performs implicit type coercion | SAFE |
| `req.query.page`, `req.query.limit` | `GET /api/products` · `productController.js:7-8,37-38` | `limit: parseInt(limit)`, `offset: (page-1)*limit` | SQL-num | `parseInt()` type cast; NaN would result in 0 offset | SAFE |
| `req.query.featured` | `GET /api/products` · `productController.js:15,21` | `where.featured = true` (hardcoded boolean) | N/A | Truthy check only; `true` literal written to WHERE, user value discarded | SAFE |
| `req.query.orderNumber`, `req.query.email` | `GET /api/orders/track` · `orderController.js` | `Order.findOne({ where: { orderNumber, guestEmail: email.toLowerCase().trim() } })` | SQL-val | Sequelize parameterized binding; email normalized | SAFE |
| `req.query.email` | `GET /api/orders/:id/invoice` · `orders.js:32-33` | Direct string comparison `order.guestEmail === req.query.email.toLowerCase().trim()` — not a DB query | N/A | Used for in-memory comparison only; no DB sink | SAFE |
| `req.query.status` | `GET /api/orders/all` · `orderController.js` | `where.orderStatus = status` | SQL-val | Sequelize parameterized binding | SAFE |
| `req.query.search` | `GET /api/customers` · `customers.js:16-21` | `Op.like: \`%${search}%\`` | SQL-val (LIKE) | Sequelize parameterized Op.like; admin-only endpoint | SAFE |
| `req.query.email` | `GET /api/customers/guest-orders` · `customers.js:134` | `where: { guestEmail: email.toLowerCase().trim(), userId: null }` | SQL-val | Sequelize parameterized; admin-only endpoint | SAFE |
| `req.query.period` | `GET /api/analytics/revenue-chart` · `analytics.js:98,101-116` | If/else string comparison only; not used in any DB query | N/A | String equality check; value never reaches a query | SAFE |
| `req.query.page`, `req.query.limit` | Various review/customer/order list endpoints | `parseInt(limit)`, `offset` arithmetic | SQL-num | `parseInt()` type cast | SAFE |
| `req.query.search` | `GET /api/pincodes` · `pincodes.js:62-67` | `Op.like: \`%${search}%\`` (admin endpoint) | SQL-val (LIKE) | Sequelize parameterized Op.like; admin-only endpoint | SAFE |

### 4.4 POST Body Parameters

| Source Parameter | Endpoint / File:Line | Sink Call | Slot Type | Defense Mechanism | Verdict |
|---|---|---|---|---|---|
| `req.body.email`, `req.body.password` | `POST /api/auth/login` · `authController.js:57,65` | `User.findOne({ where: { email: email.toLowerCase().trim() } })` | SQL-val | Sequelize parameterized; email normalized | SAFE |
| `req.body.name`, `req.body.email`, `req.body.password` | `POST /api/auth/register` · `authController.js:13,34,40` | `User.findOne(...)` / `User.create(...)` | SQL-val | Sequelize parameterized; sanitizeInput on req.body | SAFE |
| `req.body.email` | `POST /api/auth/forgot-password` · `authController.js:98,103` | `User.findOne({ where: { email: email.toLowerCase().trim() } })` | SQL-val | Sequelize parameterized | SAFE |
| `req.body.email`, `req.body.token`, `req.body.password` | `POST /api/auth/reset-password` · `authController.js:128,144-146` | `User.findOne({ where: { email: email.toLowerCase().trim() } })` | SQL-val | Sequelize parameterized | SAFE |
| `req.body.name`, `req.body.phone`, `req.body.address` | `PUT /api/auth/profile` · `authController.js:88,91` | `req.user.update({ name, phone, address })` | SQL-val | Sequelize `update()` parameterized; sanitizeInput on req.body | SAFE |
| `req.body.code` | `POST /api/coupons/apply` · `coupons.js:11,18` | `Coupon.findOne({ where: { code: code.toUpperCase().trim() } })` | SQL-val | Sequelize parameterized; code normalized | SAFE |
| `req.body.items[].productId` | `POST /api/payment/create-order` · `payment.js:108-111` | `Product.findAll({ where: { id: { [Op.in]: productIds } } })` | SQL-val | Sequelize Op.in parameterized | SAFE |
| `req.body.guestEmail` | `POST /api/payment/create-order` · `payment.js:159` | `Order.create({ guestEmail: guestEmail.toLowerCase().trim() })` | SQL-val | Sequelize parameterized | SAFE |
| `req.body.couponCode` | `POST /api/payment/create-order` · `payment.js:135-137` | `Coupon.findOne({ where: { code: couponCode.toUpperCase().trim() } })` | SQL-val | Sequelize parameterized | SAFE |
| `req.body.shippingMethod` | `POST /api/payment/create-order` · `payment.js:146-148` | `shippingResult[shippingMethod]?.rate` — object property lookup only | N/A | Optional chaining `?.rate` prevents exploitation; no DB query with this value | SAFE |
| `req.body.orderNumber` | `POST /api/payment/verify` · `payment.js:217,223` | `Order.findOne({ where: { orderNumber } })` | SQL-val | Sequelize parameterized | SAFE |
| `req.body.ORDERID` | `POST /api/payment/paytm-callback` · `payment.js:296,303` | `Order.findOne({ where: { orderNumber: ORDERID } })` | SQL-val | Sequelize parameterized (DB query safe; URL redirect separate issue noted) | SAFE |
| `req.body.email` | `POST /api/orders/:id/cancel` · `cancellation.js:16-17` | In-memory comparison `order.guestEmail === req.body.email.toLowerCase().trim()` | N/A | No DB sink; string comparison only | SAFE |
| `req.body.email`, `req.body.items`, `req.body.cartTotal` | `POST /api/abandoned-cart/save` · `abandonedCart.js:10,21` | `AbandonedCart.create(...)` | SQL-val | Sequelize parameterized; sanitizeInput on req.body | SAFE |
| `req.body.*` (product fields) | `POST /api/products` · `productController.js:90` | `Product.create({ ...req.body, slug })` | SQL-val | Sequelize `create()` parameterized; mass assignment risk (separate class) | SAFE |
| `req.body.*` (CSV row fields) | `POST /api/bulk-products/import` · `bulkProducts.js:126-154,167,179` | `Product.create(productData)` / `product.update(productData)` | SQL-val | Sequelize parameterized; admin-only endpoint | SAFE |

### 4.5 HTTP Headers

| Source | Endpoint / File:Line | Sink | Defense | Verdict |
|---|---|---|---|---|
| `Cookie: token` (JWT) | All protected endpoints · `auth.js:7` | `User.findByPk(decoded.id)` | `jwt.verify()` validates signature before ID extraction; `findByPk` parameterized | SAFE |
| `Authorization: Bearer` (JWT) | All protected endpoints · `auth.js:8` | `User.findByPk(decoded.id)` | Same JWT verification path | SAFE |
| `req.headers.host` | `GET /sitemap.xml`, `GET /robots.txt` · `sitemap.js:8,73` | `res` XML body (not DB) | Host Header Injection in response body if `CLIENT_URL` unset; NOT SQL/Command injection | OUT OF SCOPE (non-SQLi) |
| `req.headers.host` | All HTTP requests via `forceHttps` · `security.js:62` | `res.redirect(301, ...)` | Host Header Injection in redirect; NOT SQL/Command injection | OUT OF SCOPE (non-SQLi) |
| `Content-Type` (multipart) | `POST /api/upload` · `upload.js:20-30` | File stored to disk | MIME type from client header (no magic-byte check); extension allowlist present. NOT SQL injection | OUT OF SCOPE (non-SQLi) |

### 4.6 Command Injection — Confirmed Negative

A comprehensive search for command execution sinks across the entire `server/src/` directory returned **zero matches** for: `child_process`, `exec(`, `execSync`, `spawn(`, `execFile(`, `eval(`, `new Function(`, `vm.runIn`. The application has no server-side shell execution capability that could constitute a command injection sink.

---

## 5. Analysis Constraints and Blind Spots

- **Sequelize Internal Behavior Dependency (ORDER BY):**
  The safety of SQL-01 and SQL-02 depends on Sequelize v6.37.8 MySQL dialect's internal `quoteIdentifier` implementation (`utils.js:removeTicks + addTicks`). This was verified by reading the node_modules source. A future Sequelize upgrade that changes this behavior could re-expose the risk. The application should add an explicit column-name allowlist for the `sort` parameter in both `productController.js` and `reviews.js` as a defense-in-depth measure, independent of ORM internals.

- **Stored Procedures:**
  No stored procedures were identified. All database logic is in the application layer via Sequelize.

- **MySQL User Privileges:**
  The MySQL user `shophub@localhost` has `ALL PRIVILEGES` (noted in recon). If an injection were found, the blast radius would be maximal (full DB read/write/admin). This amplifies the importance of the column-name allowlist recommendation above.

- **Paytm Callback ORDERID — URL Injection (Not SQL):**
  `payment.js:326,328` reflects `req.body.ORDERID` unencoded into `res.redirect(...)`. This is a URL parameter injection issue (potentially allowing manipulation of frontend state in the order-success page). Since the Paytm callback has no signature verification (`paytm-callback` has no checksum check per recon), an attacker can forge the entire callback. However, this is a redirect/parameter injection issue (not SQL/Command injection) and is logged here for completeness. It falls under the SSRF/redirect specialist's scope.

- **Bulk CSV Import — Formula Injection:**
  `bulkProducts.js:89` accepts any file type with no row count limit. CSV values are safely stored via Sequelize. However, if these values are later exported to a CSV file opened in Excel/Google Sheets, formula injection payloads (e.g., `=CMD|'/C calc'!A0`) in product fields (name, description, brand) could execute. This is a CSV injection issue (not SQL/Command injection) and is out of scope for this phase. Admin-only endpoint.

---

*Analysis completed against target: https://shophubonline.store | Date: 2026-03-28*
