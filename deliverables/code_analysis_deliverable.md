# Penetration Test: Code Analysis Deliverable
## ShopHub E-Commerce Platform - Security Architecture Review

---

# Penetration Test Scope & Boundaries

**Primary Directive:** This analysis is strictly limited to the **network-accessible attack surface** of the ShopHub e-commerce application. All findings below have been verified against the scope criteria defined here.

### In-Scope: Network-Reachable Components
- All Express.js API endpoints served via Nginx reverse proxy on port 80/443
- React SPA frontend served as static assets by Nginx
- Payment gateway callback/webhook endpoints (Razorpay, Paytm)
- File upload endpoints and uploaded file serving
- Google OAuth authentication flow
- Guest checkout and order tracking endpoints
- Admin dashboard API endpoints (authenticated but network-reachable)

### Out-of-Scope: Locally Executable Only
- `deploy.sh` - VPS deployment script (requires SSH/CLI access)
- `setup-db.sql` - Database initialization script (requires MySQL CLI)
- `server/ecosystem.config.cjs` - PM2 process manager config (requires CLI)
- `package.json` root scripts - Build/install commands
- Development proxy configuration in `client/vite.config.js`

---

## 1. Executive Summary

ShopHub is a full-stack e-commerce platform built on Node.js/Express (backend) with React/Vite (frontend), MySQL/Sequelize (database), and Nginx (reverse proxy). The application processes payments through Razorpay and Paytm gateways, supports Google OAuth authentication, and implements a role-based access control system with customer, staff, and admin roles. The application is deployed on a single VPS (Hostinger) using PM2 for process management.

The security posture reveals several critical concerns that require immediate attention. The most severe findings include: (1) **unverified payment webhooks** that could allow payment fraud by spoofing gateway callbacks, (2) a **CORS misconfiguration** that falls back to allowing all origins with credentials in production if `CLIENT_URL` is unset, (3) **Content Security Policy completely disabled** in Helmet configuration which removes browser-level XSS protections, and (4) **SQL injection risk via unvalidated ORDER BY parameters** in product listing and review endpoints. The payment webhook endpoint at `/api/payment/webhook/:gateway` accepts any POST request without signature verification and always returns success, creating a direct path to payment fraud.

On the positive side, the application demonstrates several sound security practices: bcrypt password hashing with 12 salt rounds, HttpOnly/Secure/SameSite cookie configuration, server-side price recalculation preventing client-side amount manipulation, rate limiting on authentication endpoints, and proper user-data isolation in order access controls. However, these strengths are undermined by the critical gaps identified above. The JWT token expiration of 7 days without any refresh or revocation mechanism creates an extended attack window if tokens are compromised. The `.env` file containing payment credentials, email passwords, and OAuth secrets is properly gitignored and not tracked in version control, but the development environment contains live test credentials that should be rotated.

---

## 2. Architecture & Technology Stack

### Framework & Language

The backend is built on **Express.js v5.2.1** running on **Node.js 20** with ES modules (`"type": "module"` in package.json). The frontend is a **React 19.2.4** single-page application built with **Vite 5.4.21**. The database layer uses **Sequelize v6.37.8** ORM connecting to **MySQL** via the `mysql2` driver. From a security perspective, Express 5.x is a relatively recent major version which may have less community battle-testing than Express 4.x. The use of Sequelize ORM provides inherent SQL injection protection through parameterized queries for standard operations, but raw queries or `Sequelize.literal()` calls would bypass this protection. No raw SQL queries were found in the codebase, which is positive.

Key security-relevant dependencies include: `helmet v8.1.0` (security headers, but CSP is disabled), `express-rate-limit v8.3.1` (rate limiting), `cors v2.8.6`, `hpp v0.2.3` (HTTP parameter pollution prevention, unmaintained since 2016), `cookie-parser v1.4.7`, `bcryptjs v3.0.3` (password hashing), `jsonwebtoken v9.0.3`, `multer v2.1.1` (file uploads), `nodemailer v8.0.3` (email), `razorpay v2.9.6`, and `paytmchecksum v1.5.1`. Notably, `xss-clean v0.1.4` (unmaintained since 2018) and `express-mongo-sanitize v2.2.0` (designed for MongoDB, not MySQL) are installed but provide limited value for this stack. No input validation library (joi, yup, zod) is present - all validation uses basic regex patterns.

### Architectural Pattern

The application follows a **monolithic client-server architecture** with clear separation between frontend SPA and backend API. Nginx acts as the reverse proxy, serving static frontend assets from `/var/www/shophub/client/dist` and proxying `/api/*` and `/uploads/*` requests to the Express server on `http://127.0.0.1:3000`. The trust boundary between client and server is enforced through JWT authentication via HttpOnly cookies with Bearer token fallback. A critical architectural concern is that the backend also stores the JWT in the response body for localStorage storage on the client, creating a dual-storage pattern where XSS could extract the localStorage token even though the cookie is HttpOnly.

The deployment architecture uses PM2 with a single instance (`instances: 1`), meaning there is no horizontal scaling or load balancing. The server communicates with MySQL on localhost (no encryption in transit for database connections), Razorpay/Paytm APIs over HTTPS, Google OAuth verification via the official library, and Gmail SMTP for transactional emails. The Nginx configuration listens on port 80 (HTTP) with manual Certbot SSL setup required post-deployment.

### Critical Security Components

| Component | Location | Security Role |
|-----------|----------|---------------|
| Helmet | `server/src/index.js:49-53` | Security headers (CSP disabled) |
| CORS | `server/src/index.js:55-61` | Origin validation (fallback to `true`) |
| Rate Limiter | `server/src/index.js:67-73` | Global: 100 req/15min (prod) |
| Auth Rate Limiter | `server/src/routes/auth.js:8-14` | Auth: 10 req/15min |
| JWT Auth | `server/src/middleware/auth.js` | Token-based authentication |
| XSS Sanitizer | `server/src/middleware/security.js:1-27` | HTML entity encoding |
| Injection Guard | `server/src/middleware/security.js:29-44` | Blocks `$` and `.` in keys (MongoDB-targeted) |
| HTTPS Redirect | `server/src/middleware/security.js:57-65` | Forces HTTPS in production |
| HPP | `server/src/index.js:63` | HTTP Parameter Pollution prevention |

---

## 3. Authentication & Authorization Deep Dive

### Authentication Mechanisms

The application implements a dual authentication strategy: **JWT-based session tokens** stored in HttpOnly cookies (primary) with Bearer token fallback via localStorage (secondary). Upon successful login or registration, the server generates a JWT containing only the user ID, signed with `JWT_SECRET` and set to expire based on `JWT_EXPIRE` (configured as 7 days in the development environment). The token is delivered both as an HttpOnly cookie and in the JSON response body, allowing the React SPA to store it in localStorage for API requests via the Authorization header.

**Password hashing** uses bcryptjs with **12 salt rounds** (file: `server/src/models/User.js`, line 53), which provides adequate computational cost for password protection. The `beforeCreate` and `beforeUpdate` hooks ensure passwords are always hashed before database persistence. Password requirements enforce minimum 8 characters with at least one uppercase letter, one lowercase letter, and one digit (regex: `/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/`). No special character requirement exists.

**Google OAuth** is implemented via `google-auth-library` (`server/src/routes/googleAuth.js`). The flow accepts a Google ID token from the client, verifies it against the Google Client ID audience, extracts user information, and either logs in an existing user or creates a new account with a randomly generated password. The random password generation uses `Math.random().toString(36).slice(-12) + 'A1!'` which is cryptographically weak - `crypto.randomBytes()` should be used instead. There is **no state or nonce parameter validation** in this OAuth flow since it uses the credential-based (one-tap) flow rather than the authorization code flow, but this means CSRF protection relies entirely on the SameSite cookie policy.

### Authentication API Endpoints

| Endpoint | Method | File | Line | Auth Required | Rate Limited |
|----------|--------|------|------|---------------|--------------|
| `/api/auth/register` | POST | `server/src/routes/auth.js` | 16 | No | Yes (10/15min) |
| `/api/auth/login` | POST | `server/src/routes/auth.js` | 17 | No | Yes (10/15min) |
| `/api/auth/logout` | POST | `server/src/routes/auth.js` | 18 | No | No |
| `/api/auth/forgot-password` | POST | `server/src/routes/auth.js` | 19 | No | Yes (10/15min) |
| `/api/auth/reset-password` | POST | `server/src/routes/auth.js` | 20 | No | Yes (10/15min) |
| `/api/auth/profile` | GET | `server/src/routes/auth.js` | 21 | Yes | No |
| `/api/auth/profile` | PUT | `server/src/routes/auth.js` | 22 | Yes | No |
| `/api/auth/google` | POST | `server/src/routes/googleAuth.js` | 15 | No | No |

### Session Cookie Configuration

**File:** `server/src/controllers/authController.js`, **Lines 6-11:**
```javascript
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
```

The cookie configuration is well-implemented with `httpOnly: true` preventing JavaScript access, `secure` flag conditional on production environment, and `sameSite: 'strict'` providing CSRF protection. The 7-day `maxAge` is excessive for an e-commerce application handling financial transactions - a 1-2 hour expiry with refresh tokens would significantly reduce the attack window for stolen tokens. The same cookie configuration is applied in `server/src/routes/googleAuth.js` for OAuth login.

### Authorization Model

The RBAC system defines three roles: **customer** (default), **staff** (limited admin), and **admin** (full access). Authorization is enforced through four middleware functions in `server/src/middleware/auth.js`:

1. **`protect`** (lines 4-23): Validates JWT from cookie or Authorization header, loads user from database
2. **`admin`** (lines 25-31): Checks `role === 'admin' || role === 'staff'` - **SECURITY ISSUE: Staff have same access as admin for any endpoint using only this middleware**
3. **`requirePermission(...perms)`** (lines 34-45): Checks staff permissions array, but admins bypass all checks
4. **`optionalAuth`** (lines 48-60): Sets `req.user` if token valid, allows guest access if not

**Critical Authorization Weakness:** Most admin routes use only `protect, admin` without `requirePermission()`, meaning **any staff member can access all admin functionality** regardless of their assigned permissions. The `requirePermission` middleware is defined but underutilized. Staff permissions include: `products`, `orders`, `coupons`, `reviews`, `customers`, `analytics`, `categories`, `settings` - but these are rarely enforced on routes.

**Privilege Escalation Prevention:** Registration forces `role: 'customer'` (file: `server/src/controllers/authController.js`, line 44), preventing role injection during signup. Staff accounts can only be created by admins via `/api/staff` POST endpoint. The staff management routes properly verify `req.user.role === 'admin'` (not just the `admin` middleware), providing stronger isolation.

### Password Reset Flow

The forgot-password flow generates a cryptographically secure token via `crypto.randomBytes(32).toString('hex')` with 1-hour expiry. The token is stored in the database as plaintext (should be hashed). Email enumeration is prevented by returning a generic success message regardless of whether the email exists. The reset URL is constructed as `${CLIENT_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`, exposing the token in the URL (visible in browser history, server logs, and referrer headers).

---

## 4. Data Security & Storage

### Database Security

The application uses MySQL via Sequelize ORM with connection pooling (max: 10, idle timeout: 10s). Database credentials are loaded from environment variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`) in `server/src/config/database.js`. No SSL/TLS is configured for the database connection, meaning traffic between the application and MySQL travels unencrypted on localhost. The `setup-db.sql` script creates a dedicated user `shophub@localhost` with `ALL PRIVILEGES` on the database - this is overly permissive and should be scoped to specific DML operations.

Sequelize ORM provides parameterized query protection against SQL injection for all standard CRUD operations. No raw SQL queries (`sequelize.query()`) or `Sequelize.literal()` calls were found in the codebase. However, the ORDER BY clause in product listing (`server/src/controllers/productController.js`, line 39) and review listing (`server/src/routes/reviews.js`, line 20) accepts user-supplied sort column names directly from `req.query.sort` without whitelist validation, which could potentially be exploited depending on Sequelize's internal handling of column identifiers.

### Data Flow Security

**PII data** (names, emails, phone numbers, shipping addresses) flows through the application without encryption at rest. The User model stores addresses as plaintext JSON. Order records contain full shipping addresses and guest email addresses. The `toJSON()` method on the User model (lines 67-73) properly excludes `password`, `resetToken`, and `resetTokenExpiry` from API responses, preventing accidental exposure.

**Payment data** is handled through a secure pattern: the server recalculates order totals from database product prices rather than trusting client-submitted amounts (`server/src/routes/payment.js`, line 107 comment: "never trust client-side amounts"). Payment credentials (Razorpay keys, Paytm merchant keys) are stored in environment variables. However, payment gateway responses are logged via `console.log` in `server/src/services/paymentGateway.js` (lines 278, 322) and `server/src/routes/payment.js` (lines 283, 297), potentially exposing transaction details in server logs.

**Sensitive data logging** is a significant concern: admin actions log user emails (`server/src/middleware/security.js`, line 50), webhook payloads are logged (`payment.js`, line 283), and Paytm responses including transaction details are logged (`paymentGateway.js`, lines 278, 322). In a production environment, these logs could be stored indefinitely without encryption.

### Multi-Tenant Data Isolation

The application is single-tenant (one store) but implements user-level data isolation. Order access control (`server/src/controllers/orderController.js`, lines 258-260) properly verifies `order.userId === req.user.id` before granting access. Guest orders are accessible via email matching in query parameters. Admin users can access all records. The `optionalAuth` middleware allows guest checkout without authentication, using email as the identifier - this creates an email enumeration risk on the order tracking endpoint (`/api/orders/track`).

---

## 5. Attack Surface Analysis

### External Entry Points (In-Scope, Network-Accessible)

#### Public Unauthenticated Endpoints

| Endpoint | Method | File | Purpose | Security Concerns |
|----------|--------|------|---------|-------------------|
| `/api/auth/register` | POST | `routes/auth.js:16` | User registration | Account enumeration (mitigated by rate limit) |
| `/api/auth/login` | POST | `routes/auth.js:17` | User login | Brute force (10 req/15min limit) |
| `/api/auth/forgot-password` | POST | `routes/auth.js:19` | Password reset | Email enumeration prevented |
| `/api/auth/reset-password` | POST | `routes/auth.js:20` | Reset confirmation | Token brute force (mitigated by crypto.randomBytes) |
| `/api/auth/google` | POST | `routes/googleAuth.js:15` | Google OAuth | No rate limit, weak random password |
| `/api/products` | GET | `routes/products.js:14` | Product listing | ORDER BY injection via sort param |
| `/api/products/search-suggestions` | GET | `routes/products.js:16` | Autocomplete | Potential slow query DoS |
| `/api/products/:slug` | GET | `routes/products.js:73` | Product detail | Information disclosure |
| `/api/products/:slug/related` | GET | `routes/products.js:44` | Related products | Enumeration |
| `/api/categories` | GET | `routes/categories.js:8` | Category listing | Information disclosure |
| `/api/reviews/product/:productId` | GET | `routes/reviews.js:10` | Product reviews | ORDER BY injection via sort param |
| `/api/coupons/apply` | POST | `routes/coupons.js:9` | Coupon validation | Coupon code enumeration |
| `/api/payment/gateways` | GET | `routes/payment.js:42` | Payment methods | Gateway info disclosure |
| `/api/payment/calculate-shipping` | POST | `routes/payment.js:56` | Shipping cost | No rate limit |
| `/api/payment/calculate-tax` | POST | `routes/payment.js:67` | Tax preview | No rate limit |
| `/api/payment/create-order` | POST | `routes/payment.js:94` | Create order (optionalAuth) | Guest order spam, no rate limit |
| `/api/payment/verify` | POST | `routes/payment.js:215` | Payment verify (optionalAuth) | Signature verification concerns |
| `/api/payment/webhook/:gateway` | POST | `routes/payment.js:278` | Payment webhook | **NO AUTH OR SIGNATURE VERIFICATION** |
| `/api/payment/paytm-callback` | POST | `routes/payment.js:294` | Paytm callback | **No signature verification, open redirect** |
| `/api/orders/guest` | POST | `routes/orders.js:18` | Guest checkout | No auth, email validation only |
| `/api/orders/track` | GET | `routes/orders.js:19` | Order tracking | Email enumeration, no rate limit |
| `/api/orders/:id/invoice` | GET | `routes/orders.js:24` | Invoice download (optionalAuth) | Email in query string |
| `/api/orders/:id/cancel` | POST | `routes/cancellation.js:9` | Cancel order (optionalAuth) | Guest access via email |
| `/api/pincodes/check/:pincode` | GET | `routes/pincodes.js:9` | Delivery check | Enumeration |
| `/api/abandoned-cart/save` | POST | `routes/abandonedCart.js:10` | Save cart (optionalAuth) | Email collection |
| `/api/abandoned-cart/recover` | POST | `routes/abandonedCart.js:51` | Mark recovered (optionalAuth) | No verification |
| `/api/settings/theme` | GET | `routes/settings.js:8` | Get theme | Info disclosure |
| `/sitemap.xml` | GET | `routes/sitemap.js:6` | XML sitemap | Host header injection |
| `/robots.txt` | GET | `routes/sitemap.js:72` | Robots file | Info disclosure |
| `/uploads/*` | GET | Nginx proxy | Uploaded files | MIME type spoofing |

#### Authenticated Admin Endpoints

| Endpoint | Method | File | Protection | Security Concerns |
|----------|--------|------|-----------|-------------------|
| `/api/products` | POST | `routes/products.js:74` | protect, admin | Staff can access (no permission check) |
| `/api/products/:id` | PUT/DELETE | `routes/products.js:75-76` | protect, admin | Staff can access |
| `/api/upload` | POST | `routes/upload.js:41` | protect, admin | MIME spoofing, no magic number check |
| `/api/upload/multiple` | POST | `routes/upload.js:50` | protect, admin | Up to 5 files |
| `/api/orders/all` | GET | `routes/orders.js:21` | protect, admin | All orders exposed |
| `/api/orders/:id/status` | PUT | `routes/orders.js:55` | protect, admin | Status manipulation |
| `/api/orders/:id/refund` | POST | `routes/cancellation.js:78` | protect, admin | Financial operation |
| `/api/analytics/*` | GET | `routes/analytics.js` | protect, admin | No rate limit, no permission check |
| `/api/customers` | GET | `routes/customers.js:10` | protect, admin | PII exposure |
| `/api/customers/guests` | GET | `routes/customers.js:71` | protect, admin | Guest PII exposure |
| `/api/staff/*` | ALL | `routes/staff.js` | protect, admin (role=admin) | Proper admin-only check |
| `/api/coupons` | GET/POST/PUT/DELETE | `routes/coupons.js` | protect, admin | Financial manipulation |
| `/api/reviews/all` | GET | `routes/reviews.js:108` | protect, admin | Review moderation |
| `/api/reviews/admin` | POST | `routes/reviews.js:131` | protect, admin | Fake review creation |
| `/api/categories/all` | GET | `routes/categories.js:21` | protect, admin | Include inactive |
| `/api/categories` | POST/PUT/DELETE | `routes/categories.js` | protect, admin | Category manipulation |
| `/api/bulk-products/export` | GET | `routes/bulkProducts.js:13` | protect, admin | Full data export |
| `/api/bulk-products/import` | POST | `routes/bulkProducts.js:89` | protect, admin | CSV injection, mass assignment |
| `/api/bulk-products/template` | GET | `routes/bulkProducts.js:60` | protect, admin | Template download |
| `/api/pincodes` | GET/POST/PUT/DELETE | `routes/pincodes.js` | protect, admin | Delivery config |
| `/api/settings/theme` | PUT | `routes/settings.js:18` | protect, admin | Theme manipulation |
| `/api/abandoned-cart` | GET | `routes/abandonedCart.js:68` | protect, admin | Customer email exposure |

### Internal Service Communication

The application has no internal microservice communication - it is a monolithic application. The trust relationships are:
1. **Nginx → Express**: Unencrypted HTTP on localhost, Nginx sets `X-Forwarded-*` headers that the application trusts for HTTPS redirect decisions
2. **Express → MySQL**: Unencrypted TCP on localhost via Sequelize connection pool
3. **Express → Payment Gateways**: HTTPS API calls to Razorpay/Paytm with API key authentication
4. **Express → Gmail SMTP**: SMTP with app password authentication (TLS not enforced)

### Input Validation Patterns

Input validation is minimal and relies on three mechanisms: (1) the `sanitizeInput` middleware that HTML-encodes `<` and `>` characters in request bodies only (not query parameters), (2) basic regex validation for emails (`/\S+@\S+\.\S+/`) and passwords, and (3) Sequelize model-level validation (`isEmail: true` on User model). No comprehensive input validation library is used. The `preventInjection` middleware blocks MongoDB-style operators which is irrelevant for the MySQL backend.

### Background Processing

Two background jobs run on schedules: `abandonedCartJob.js` (sends recovery emails for carts abandoned > 1 hour) and `lowStockJob.js` (sends admin alerts for low-stock products). Both are triggered internally via `setInterval` and are not directly network-accessible, but they use the same email service and `CLIENT_URL` environment variable.

---

## 6. Infrastructure & Operational Security

### Secrets Management

Secrets are managed through environment variables loaded from `.env` files. The `.env` file is properly listed in `.gitignore` and is **NOT tracked in git** (verified via `git ls-files`). However, the development `.env` file contains live test credentials for payment gateways (Razorpay test keys, Paytm staging credentials), a Gmail app password, and a weak JWT secret (`dev_secret_change_in_production`). There is no secrets management service (Vault, AWS Secrets Manager). Key secrets in the environment: `JWT_SECRET`, `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`, `PAYTM_MERCHANT_ID`/`PAYTM_MERCHANT_KEY`, `SMTP_EMAIL`/`SMTP_APP_PASSWORD`, `GOOGLE_CLIENT_ID`, `DB_USER`/`DB_PASSWORD`.

### Configuration Security

**Nginx Configuration** (`nginx.conf`): Listens on port 80 (HTTP only), HTTPS requires manual Certbot setup. Security headers present: `X-Frame-Options: SAMEORIGIN` (line 61), `X-Content-Type-Options: nosniff` (line 62), `Referrer-Policy: strict-origin-when-cross-origin` (line 63). **Missing headers:** `Strict-Transport-Security` (HSTS), `Content-Security-Policy`, `Permissions-Policy`. Blocks hidden files and sensitive extensions. `client_max_body_size 10M` mismatches multer's 5MB limit.

**Express Security Headers** (`server/src/index.js:49-53`): Helmet enabled but `contentSecurityPolicy: false` and `crossOriginEmbedderPolicy: false`. No HSTS at application level. Cross-Origin Resource Policy set to `cross-origin`.

**No Kubernetes, Docker, or CDN infrastructure** was identified. Deployment is to a single VPS via SSH with the `deploy.sh` script.

### External Dependencies

| Service | Purpose | Security Implications |
|---------|---------|----------------------|
| Razorpay | Payment processing | HMAC-SHA256 verification implemented in SDK wrapper |
| Paytm | Payment processing | Checksum generation present, callback verification missing |
| Google OAuth | Authentication | Official library with audience verification |
| Gmail SMTP | Transactional email | App password auth, no TLS enforcement |
| MySQL (local) | Data storage | Unencrypted localhost connection |

### Monitoring & Logging

No structured logging framework - all logging via `console.log`. No log aggregation, no security event monitoring, no alerting. The `adminLogger` middleware logs admin actions to stdout only. Production error handling suppresses stack traces but provides no error tracking integration.

---

## 7. Overall Codebase Indexing

The codebase follows a clean monorepo structure with two primary directories: `client/` (React SPA) and `server/` (Express API). The server source code resides entirely within `server/src/`, organized into conventional Express application directories: `config/` (database configuration), `controllers/` (business logic for auth), `middleware/` (auth, security), `models/` (Sequelize models for User, Product, Order, Review, Category, Coupon, AbandonedCart, Pincode, Setting), `routes/` (15 route files defining all API endpoints), and `services/` (email, payment gateway, invoice generation, background jobs). The route files are the primary security surface, containing both endpoint definitions and inline business logic - most routes combine validation, database queries, and response formatting in a single file rather than delegating to separate controller modules.

The client application in `client/src/` uses a pages-based structure with `pages/` for full page components, `components/` for shared UI, `context/` for React context providers (AuthContext, CartContext, WishlistContext, ThemeContext), and `api/` containing the Axios configuration with interceptors. The `App.jsx` file defines all frontend routes using React Router v7. Authentication state is managed through `AuthContext.jsx` which stores the JWT token in both context state and localStorage.

Infrastructure configuration sits at the repository root: `nginx.conf` defines the production reverse proxy, `deploy.sh` provides VPS setup, and `setup-db.sql` initializes MySQL. No Docker containerization, CI/CD pipeline, or automated testing infrastructure is present. Security-relevant code is concentrated in `server/src/middleware/` (auth.js, security.js), `server/src/routes/` (all 15 route files), and `server/src/services/` (payment and email services).

---

## 8. Critical File Paths

### Configuration
- `nginx.conf` - Reverse proxy, security headers, route forwarding
- `server/ecosystem.config.cjs` - PM2 process manager configuration
- `deploy.sh` - VPS deployment script
- `setup-db.sql` - Database initialization and user privileges
- `server/src/config/database.js` - Sequelize/MySQL connection configuration
- `client/vite.config.js` - Vite dev proxy configuration

### Authentication & Authorization
- `server/src/middleware/auth.js` - JWT verification, protect/admin/requirePermission/optionalAuth middleware
- `server/src/controllers/authController.js` - Login, register, password reset, cookie options (lines 6-11)
- `server/src/routes/auth.js` - Auth route definitions with rate limiting
- `server/src/routes/googleAuth.js` - Google OAuth flow
- `server/src/routes/staff.js` - Staff/admin management endpoints

### API & Routing
- `server/src/index.js` - Express app setup, middleware chain, CORS, Helmet, rate limiting
- `server/src/routes/products.js` - Product CRUD endpoints
- `server/src/routes/orders.js` - Order management and invoice access
- `server/src/routes/payment.js` - Payment processing, webhooks, callbacks
- `server/src/routes/cancellation.js` - Order cancellation and refund
- `server/src/routes/coupons.js` - Coupon CRUD and validation
- `server/src/routes/reviews.js` - Review CRUD and moderation
- `server/src/routes/categories.js` - Category management
- `server/src/routes/customers.js` - Customer data access
- `server/src/routes/analytics.js` - Admin analytics dashboard
- `server/src/routes/bulkProducts.js` - CSV import/export
- `server/src/routes/upload.js` - File upload handling
- `server/src/routes/pincodes.js` - Pincode/delivery management
- `server/src/routes/abandonedCart.js` - Abandoned cart tracking
- `server/src/routes/settings.js` - Theme settings
- `server/src/routes/sitemap.js` - Sitemap and robots.txt generation

### Data Models & DB Interaction
- `server/src/models/User.js` - User model with bcrypt hooks, toJSON sanitization
- `server/src/models/Order.js` - Order model with PII fields
- `server/src/models/Product.js` - Product model
- `server/src/models/Review.js` - Review model
- `server/src/models/Category.js` - Category model
- `server/src/models/Coupon.js` - Coupon model
- `server/src/models/AbandonedCart.js` - Abandoned cart with email PII
- `server/src/models/Pincode.js` - Delivery pincode model
- `server/src/models/Setting.js` - Application settings model
- `server/src/controllers/productController.js` - Product business logic with ORDER BY sink
- `server/src/controllers/orderController.js` - Order business logic with auth checks

### Dependency Manifests
- `server/package.json` - Backend dependencies (Express, Sequelize, JWT, bcrypt, Helmet, etc.)
- `client/package.json` - Frontend dependencies (React, Axios, Google OAuth, etc.)
- `package.json` - Root workspace scripts

### Sensitive Data & Secrets Handling
- `server/.env` (untracked) - All application secrets (payment keys, SMTP, JWT, OAuth)
- `server/.env.example` - Secret placeholder template

### Middleware & Input Validation
- `server/src/middleware/security.js` - XSS sanitizer, injection guard, HTTPS redirect, admin logger

### Logging & Monitoring
- `server/src/middleware/security.js:47-54` - Admin action logger (stdout only)
- `server/src/index.js:111-122` - Global error handler

### Services
- `server/src/services/paymentGateway.js` - Razorpay/Paytm integration with HMAC verification
- `server/src/services/emailService.js` - Nodemailer transactional emails
- `server/src/services/invoiceService.js` - PDF invoice generation (pdfkit)
- `server/src/services/abandonedCartJob.js` - Background cart recovery job
- `server/src/services/lowStockJob.js` - Background low stock alert job

### Infrastructure & Deployment
- `nginx.conf` - Production Nginx reverse proxy configuration
- `deploy.sh` - Automated VPS deployment script
- `server/ecosystem.config.cjs` - PM2 process management

### Frontend Security-Relevant
- `client/src/api/axios.js` - Axios instance with auth interceptor, token in localStorage
- `client/src/context/AuthContext.jsx` - Authentication state management
- `client/src/pages/Checkout.jsx` - Dynamic script loading for payment (Paytm)
- `client/src/App.jsx` - All frontend route definitions

---

## 9. XSS Sinks and Render Contexts

### Critical XSS Findings

#### 9.1 Dynamic Script Injection in Checkout (HIGH)
**File:** `client/src/pages/Checkout.jsx`, **Lines 299-301**
**Render Context:** HTML Script Tag `src` Attribute

The checkout page dynamically loads a Paytm payment script by constructing a URL from server response data:
```javascript
const scriptUrl = `${payment.baseUrl}/merchantpgpui/checkoutjs/merchants/${payment.mid}.js`;
const loaded = await loadScript(scriptUrl);
```

The `loadScript()` function (lines 17-29) creates a `<script>` element and appends it to the document body. While `payment.baseUrl` and `payment.mid` originate from server environment variables (`paymentGateway.js`), if an attacker can manipulate the API response (via MITM on non-HTTPS deployments or compromised server), they can inject arbitrary JavaScript. Combined with CSP being disabled (`server/src/index.js:50`), there is no browser-level defense against this.

#### 9.2 Content Security Policy Disabled (CRITICAL)
**File:** `server/src/index.js`, **Lines 49-53**
**Render Context:** Global HTTP Header

```javascript
app.use(helmet({
  contentSecurityPolicy: false,      // CSP DISABLED
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
```

With CSP completely disabled, any XSS vector that bypasses the basic `sanitizeInput` middleware (which only escapes `<>` in request bodies) will succeed without browser mitigation. This is especially dangerous given the dynamic script loading in the checkout flow.

### Injection Sinks

#### 9.3 SQL Injection via ORDER BY Parameter (HIGH)
**File:** `server/src/controllers/productController.js`, **Line 39**
**File:** `server/src/routes/reviews.js`, **Line 20**
**Render Context:** Database Query (ORDER BY clause)

```javascript
// productController.js
const { sort = 'createdAt', order = 'DESC' } = req.query;
order: [[sort, order.toUpperCase()]],

// reviews.js
const { page = 1, limit = 10, sort = 'createdAt' } = req.query;
order: [[sort, 'DESC']],
```

User-supplied `req.query.sort` is passed directly to Sequelize's `order` clause without whitelist validation. While Sequelize typically handles column name escaping, this pattern passes a raw string as a column identifier which may bypass parameterization depending on the Sequelize version and MySQL driver.

#### 9.4 Open Redirect via Paytm Callback (HIGH)
**File:** `server/src/routes/payment.js`, **Lines 326, 328, 333**
**Render Context:** HTTP Redirect Header

```javascript
res.redirect(`${clientUrl}/order-success?orderNumber=${ORDERID}`);
res.redirect(`${clientUrl}/order-success?orderNumber=${ORDERID}&status=failed`);
res.redirect(`${clientUrl}/orders`);
```

The `ORDERID` comes from `req.body.ORDERID` in the Paytm POST callback without sanitization. While `clientUrl` is from environment, the `ORDERID` value is not validated against expected format. If `CLIENT_URL` environment is misconfigured or empty, the fallback `http://localhost:5173` creates unexpected redirect behavior in production.

#### 9.5 Email Template Injection (MEDIUM)
**File:** `server/src/services/emailService.js`, **Lines 85-92, 139-143**
**Render Context:** Email HTML Body

User-supplied shipping address fields (fullName, address, city, state, zipCode, phone) are inserted directly into email HTML templates without HTML encoding beyond the `sanitizeInput` middleware's `<>` escaping. CRLF characters in these fields could lead to email header injection. The `sanitizeInput` middleware does NOT sanitize newline characters (`\r\n`).

#### 9.6 CSV Injection via Bulk Import (MEDIUM)
**File:** `server/src/routes/bulkProducts.js`, **Lines 115-160**
**Render Context:** Model Instantiation / Mass Assignment

CSV import accepts arbitrary column names and passes them to `Product.create()` / `Product.update()` without strict whitelist validation. A malicious CSV could attempt to set internal fields. Additionally, CSV export could be used for formula injection if data containing `=`, `+`, `-`, `@` prefixes is included in product names or descriptions.

#### 9.7 Host Header Injection in HTTPS Redirect (MEDIUM)
**File:** `server/src/middleware/security.js`, **Lines 56-65**
**Render Context:** HTTP Redirect Header

```javascript
return res.redirect(301, `https://${req.headers.host}${req.url}`);
```

The `Host` header is user-controlled and used directly in the redirect URL construction. Behind the Nginx reverse proxy this is typically safe (Nginx sets the Host header), but if the application is accessed directly or Nginx is misconfigured, an attacker can inject an arbitrary host.

### Safe Patterns Observed

- **React rendering**: React's JSX automatically escapes values, preventing XSS in standard rendering patterns
- **No `dangerouslySetInnerHTML`** usage found in any React component
- **No `eval()`, `Function()`, `setTimeout(string)`, `setInterval(string)`** usage found
- **No `document.write()`** usage found
- **window.location** usage in frontend is limited to hardcoded internal paths (safe)
- **localStorage** read/write operations use only JSON.stringify/parse (no eval)

---

## 10. SSRF Sinks

### Payment Gateway SSRF Patterns

#### 10.1 Paytm API Transaction Initiation (MEDIUM)
**File:** `server/src/services/paymentGateway.js`, **Lines 249-271**
**Sink Type:** `fetch()` HTTP Client

```javascript
const url = `${this.baseUrl}/theia/api/v1/initiateTransaction?mid=${this.merchantId}&orderId=${orderId}`;
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(paytmParams),
});
```

The `orderId` parameter originates from user-initiated order creation and is embedded in the URL query string. While `baseUrl` is hardcoded to the Paytm production/staging endpoint, the `orderId` is from the application's order creation flow. The `SERVER_URL` environment variable controls the callback URL (`callbackUrl` at line 249), which could be manipulated if the environment is compromised.

**User-Controlled Data:** `orderId` (indirectly via order creation), `SERVER_URL` (environment)
**Impact:** Limited - baseUrl is hardcoded, but callback URL externalization is a concern

#### 10.2 Paytm Order Status Check (MEDIUM)
**File:** `server/src/services/paymentGateway.js`, **Lines 313-319**

Similar pattern to 10.1 - `fetch()` call to Paytm API with order ID in the request body. Same hardcoded baseUrl limits SSRF risk.

#### 10.3 Razorpay SDK (SAFE)
**File:** `server/src/services/paymentGateway.js`, **Lines 23-82**

Razorpay uses the official SDK (`new Razorpay()`) which encapsulates all HTTP requests. No direct URL construction or fetch calls. Safe pattern.

### Redirect-Based SSRF Chains

#### 10.4 Paytm Callback Redirect (MEDIUM-HIGH)
**File:** `server/src/routes/payment.js`, **Lines 294-335**

```javascript
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
res.redirect(`${clientUrl}/order-success?orderNumber=${ORDERID}`);
```

This is primarily an open redirect vulnerability but could be chained with SSRF if internal services follow redirects. The `CLIENT_URL` controls the redirect destination, and `ORDERID` from the Paytm POST body is included without validation.

#### 10.5 HTTPS Force Redirect with Host Header (MEDIUM)
**File:** `server/src/middleware/security.js`, **Lines 56-65**

```javascript
return res.redirect(301, `https://${req.headers.host}${req.url}`);
```

Uses `req.headers.host` directly in redirect URL construction. If accessed directly (bypassing Nginx), an attacker can set the Host header to any value, creating an open redirect.

### Email-Based SSRF Vectors

#### 10.6 SMTP Configuration (HIGH - Environment Dependent)
**File:** `server/src/services/emailService.js`, **Lines 3-19**

SMTP host and port are configured via environment variables (`SMTP_HOST`, `SMTP_PORT`) without validation. If an attacker compromises the environment, all email traffic can be redirected to an attacker-controlled SMTP server, enabling interception of password reset tokens, order confirmations, and customer data.

#### 10.7 Email Link Injection via CLIENT_URL (MEDIUM)
**Files:**
- `server/src/controllers/authController.js:116-119` (password reset URL)
- `server/src/services/abandonedCartJob.js:24-45` (cart recovery URL)
- `server/src/services/emailService.js:274, 338-340` (link rendering)

All email templates construct URLs using `process.env.CLIENT_URL`. If this environment variable is compromised, users clicking password reset links or cart recovery links are directed to an attacker-controlled domain.

### Components NOT Found (Negative Findings)
- **No headless browser usage** (Puppeteer, Playwright, wkhtmltopdf) - PDF generation uses pdfkit (local rendering only)
- **No URL-based file fetching** - File uploads use multer disk storage with local paths only
- **No image processing with URLs** - No ImageMagick, GraphicsMagick, or FFmpeg usage
- **No link preview/unfurler functionality**
- **No webhook delivery verification** that makes outbound requests
- **No RSS/feed reader functionality**
- **No "import from URL" functionality** - CSV import uses file upload only
- **No JWKS/discovery endpoint fetching** - Google OAuth uses local JWT verification
- **No cloud metadata helpers**
- **No axios, node-fetch, got, request, superagent** usage in server code (only native `fetch()` for Paytm)
