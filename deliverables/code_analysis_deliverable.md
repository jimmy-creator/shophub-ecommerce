# Code Analysis Deliverable - ShopHub E-Commerce Platform

**Assessment Date:** 2026-03-27
**Application:** ShopHub E-Commerce Platform (Indian market, GST-compliant)
**Architecture:** React 19 SPA + Express 5 REST API + MySQL (Sequelize ORM)
**Deployment:** Nginx reverse proxy + PM2 process manager on VPS

---

# Penetration Test Scope & Boundaries

**Primary Directive:** This analysis is strictly limited to the **network-accessible attack surface** of the ShopHub e-commerce application. All findings have been validated against the scope definition below.

### In-Scope: Network-Reachable Components
Components whose execution can be initiated by a network request the deployed application server receives:
- All Express API endpoints under `/api/` (approximately 75+ routes across 14 route files)
- Static file serving at `/uploads/` (user-uploaded images served by Nginx)
- React SPA served at `/` with client-side routing (16+ routes)
- Payment gateway webhook endpoints (Razorpay, Paytm server-to-server callbacks)
- SEO endpoints (`/sitemap.xml`, `/robots.txt`)
- Nginx reverse proxy layer (security headers, path blocking, caching)

### Out-of-Scope: Locally Executable Only
- `deploy.sh` - Bash deployment script for VPS setup (requires SSH access)
- `setup-db.sql` - Database initialization script (requires MySQL CLI access)
- `server/ecosystem.config.cjs` - PM2 process manager configuration (local execution)
- `server/src/seed.js` - Database seeding script (CLI execution via `node`)
- `server/src/services/lowStockJob.js` and `server/src/services/abandonedCartJob.js` - Cron jobs started internally by the server process (not directly network-triggered, but noted as they process data from network-originated requests)
- Build tools: Vite dev server, nodemon
- CI/CD scripts or IDE tooling

---

## 1. Executive Summary

ShopHub is a full-stack e-commerce platform targeting the Indian market with GST compliance, multiple payment gateways (Razorpay, Paytm, COD, Bank Transfer), and comprehensive order management. The application follows a standard SPA + REST API architecture with React 19 on the frontend and Express 5 on the backend, connected to MySQL via Sequelize ORM. The security posture reflects a moderately mature implementation with several strong foundations (bcrypt password hashing at 12 rounds, httpOnly cookies with SameSite=strict, Sequelize ORM preventing SQL injection, rate limiting on auth endpoints) but contains critical gaps that significantly increase the attack surface.

The most concerning findings center on three areas: (1) **Client-side token security** - JWT tokens are stored in both httpOnly cookies AND localStorage simultaneously, meaning any XSS vulnerability immediately leads to token theft; (2) **CORS misconfiguration** - in production, if the `CLIENT_URL` environment variable is not set, the CORS policy falls back to allowing ALL origins with credentials, which is a critical bypass; and (3) **Content Security Policy is completely disabled** (`contentSecurityPolicy: false` in Helmet configuration), removing the primary defense-in-depth against XSS attacks. Together, these three issues create a compounding vulnerability chain where XSS exploitation becomes both more likely (no CSP) and more impactful (localStorage token theft).

Additional high-severity concerns include: exposed secrets in the `.env` file (Gmail SMTP credentials, payment gateway test keys, weak JWT secret), HTML injection in email templates where user-controlled data (product names, addresses, review content) is interpolated without escaping, CSV formula injection in the bulk product export/import functionality, Host header injection in sitemap generation, and payment webhook endpoints that lack signature verification. The application lacks CSRF token protection (relying solely on SameSite cookies), has no Content-Security-Policy, missing HSTS headers, and the `requirePermission()` middleware for granular staff access control is defined but never actually applied to any routes.

## 2. Architecture & Technology Stack

### Framework & Language

The application is built on **Node.js** with **Express.js 5.2.1** (notably the v5 beta, not the stable v4.x line) for the backend API server, and **React 19.2.4** with **Vite 5.4.21** for the frontend SPA. The choice of Express 5 introduces potential instability risks as it is not yet a stable release. The backend uses ES modules (`import/export` syntax). Key security-relevant dependencies include:

| Package | Version | Security Role |
|---------|---------|---------------|
| helmet | 8.1.0 | Security headers (CSP disabled) |
| cors | 2.8.6 | Cross-origin resource sharing |
| express-rate-limit | 8.3.1 | Rate limiting (100/15min prod) |
| jsonwebtoken | 9.0.3 | JWT generation and verification |
| bcryptjs | 3.0.3 | Password hashing (12 rounds) |
| multer | 2.1.1 | File upload handling |
| hpp | 0.2.3 | HTTP Parameter Pollution prevention |
| xss-clean | 0.1.4 | XSS sanitization |
| sequelize | 6.37.8 | MySQL ORM (parameterized queries) |
| razorpay | 2.9.6 | Payment gateway SDK |
| paytm-pg-node-sdk (PaytmChecksum) | 1.5.1 | Payment checksum verification |
| nodemailer | 8.0.3 | Email sending (SMTP) |
| pdfkit | 0.18.0 | Invoice PDF generation |
| csv-parser / csv-writer | 3.2.0 / 1.6.0 | Bulk product CSV import/export |
| @react-oauth/google | 0.13.4 | Google OAuth (client-side) |

### Architectural Pattern

The application follows a **monolithic SPA + REST API** pattern with clear separation between the `client/` (React) and `server/` (Express) directories. The deployment uses Nginx as a reverse proxy, terminating SSL via Let's Encrypt Certbot, and forwarding `/api/*` requests to the Express server on port 3000 while serving the React build from `/client/dist/`. PM2 manages the Node.js process with a 500MB memory limit and auto-restart.

**Trust boundaries** exist at three layers: (1) Nginx → Express (trusts `X-Forwarded-*` headers via `trust proxy: 1`), (2) Express → MySQL (Sequelize ORM with connection pooling, max 10 connections), (3) Client → Express (JWT-based authentication via cookies and Authorization header). The critical trust assumption is that the Nginx layer correctly sets proxy headers - if an attacker can bypass Nginx and reach Express directly, the `trust proxy` setting could be exploited for IP spoofing to bypass rate limiting.

### Critical Security Components

**Middleware Stack** (applied in order in `/repos/ecom/server/src/index.js`):
1. HTTPS enforcement (`forceHttps`) - redirects HTTP to HTTPS in production
2. Helmet.js - security headers (**CSP disabled**, CORP set to cross-origin)
3. CORS - origin-based with credentials (**falls back to wildcard if CLIENT_URL not set**)
4. HPP - HTTP Parameter Pollution prevention
5. Rate limiting - 100 requests/15 min globally on `/api/`, 10/15 min on auth endpoints
6. Body parsing - JSON and URL-encoded with 2MB limit
7. Cookie parser
8. Custom XSS sanitization - HTML entity escaping (`<` → `&lt;`, `>` → `&gt;`)
9. Custom NoSQL injection prevention - blocks `$` and `.` in object keys

The database layer uses **MySQL** with Sequelize ORM, which provides parameterized queries by default. No raw SQL queries or `Sequelize.literal()` usage was found. The database connection does **not** enforce SSL/TLS, and the setup script (`setup-db.sql`) grants `ALL PRIVILEGES` to the application user.
