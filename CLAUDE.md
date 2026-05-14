# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-store e-commerce platform (React + Express + MySQL). Single codebase serves multiple storefronts via the `VITE_LAYOUT` env var, which swaps entire layout directories at build time through a Vite alias (`@layout` → `src/layouts/{store1|store2}`).

**Active stores:** store1 (Leemount) and store2 (Zayara Electronics)

## Commands

```bash
# Install all dependencies (client + server)
npm run install:all

# Run both client (:5173) and server (:3000) concurrently
npm run dev

# Run individually
npm run dev:client    # Vite dev server
npm run dev:server    # Nodemon

# Run a specific store layout locally
VITE_LAYOUT=store2 npm run dev:client

# Build for production (defaults to store1)
npm run build
VITE_LAYOUT=store2 npm run build   # Build store2

# Seed database
npm run seed

# Lint
cd client && npx eslint .
```

No test suite exists. There are some Python security test scripts at the root but no JS test runner.

## Architecture

### Multi-Store Layout System

The `@layout` Vite alias (configured in `client/vite.config.js`) resolves to `src/layouts/{VITE_LAYOUT}/`. Each layout directory contains its own Home, Navbar, Footer, Products, ProductDetail, and themes.js. `App.jsx` imports from `@layout` so the same router serves different UIs depending on build-time config.

Store-specific env vars live in `client/.env` (VITE_STORE_NAME, VITE_SITE_TITLE, etc.). On VPS, each store has its own `/var/www/storeN/` directory with separate `.env` files and PM2 processes.

### Auth Flow

JWT stored in httpOnly cookie only (not localStorage, no Bearer header). The Axios client uses `withCredentials: true`. Auth middleware in `server/src/middleware/auth.js` reads the cookie. Roles: admin, staff (with granular permissions array), customer.

### State Management

React Context only (no Redux): AuthContext, CartContext, WishlistContext, RecentlyViewedContext, ThemeContext. Cart and wishlist persist to localStorage.

### Payment Gateways

`server/src/services/paymentGateway.js` — plugin-style abstraction over Razorpay, Paytm, Stripe, Nomod, COD, and Bank Transfer. Each gateway implements create/verify patterns. Payment route (`server/src/routes/payment.js`) orchestrates order creation, coupon validation, and gateway calls.

### Theme System

CSS variable-based theming. `client/src/themes/shared.js` defines theme objects (colors, fonts, radii). ThemeContext applies them as CSS custom properties and dynamically loads Google Fonts. Admin can change the active theme via Settings.

### Database

Sequelize ORM with MySQL. Models in `server/src/models/`. Key models: User, Product, Order, Review, Category, Coupon, Setting, Pincode, AbandonedCart. Sync behavior: `DB_SYNC_ALTER=true` enables `sync({ alter: true })` — only use in development, never in production (causes duplicate index buildup).

### Background Jobs

`server/src/services/abandonedCartJob.js` and `lowStockJob.js` run as intervals started from the main server process (not separate workers).

## Key Conventions

- Store2 CSS classes are prefixed with `s2-` (e.g., `.s2-btn-primary`). Store1 uses unprefixed classes from `index.css`. When changing button styles, check which class the layout actually uses.
- Product images are processed through Sharp on upload (`server/src/routes/upload.js`) — WebP conversion, resizing.
- Server env: copy `server/.env.example` → `server/.env`. Client env: `client/.env`. The client proxies `/api` and `/uploads` to localhost:3000 in dev.
- Admin panel is a single large component at `client/src/pages/Admin.jsx` with tab-based navigation.
- Email templates are inline HTML in `server/src/services/emailService.js`.

## VPS Deployment

Each store deploys to `/var/www/storeN/`. Typical update flow:
```bash
cd /var/www/store1 && git pull origin main
cd client && npm install && VITE_LAYOUT=store1 npm run build
cd ../server && npm install && pm2 reload store1
```

Nginx config per store proxies API to the store's PM2 process and serves `client/dist/` for static files.
