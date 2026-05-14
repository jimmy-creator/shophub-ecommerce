---
name: VPS deployment topology
description: Multi-store layout on a single VPS — /var/www/storeN + shared PM2 ecosystem + per-store nginx
type: project
originSessionId: 60c25fb5-8cc3-48a4-8343-68424984cbab
---
The ecom app is deployed as a multi-tenant-by-copy setup on a single VPS (user: root, host srv704687). Layout:

- `/var/www/storeN/` — one directory per store (cloned repo, own .env, own uploads dir). First store is `/var/www/store1`, domain `shophubonline.store`.
- `/var/www/shared/ecosystem.config.cjs` — single PM2 file listing all stores via a `makeStore({ name, port, cwd })` helper. Ports start at 3001 and increment per store. Logs in `/var/log/pm2/`. Confirmed entries (2026-05-07):
  - `makeStore({ name: 'store1', port: 3001, cwd: '/var/www/store1/server' })` — domain `shophubonline.store`, db `ecom_db`
  - `makeStore({ name: 'store2', port: 3002, cwd: '/var/www/store2/server' })` — db `store2_db`
  - `makeStore({ name: 'store3', port: 3003, cwd: '/var/www/store3/server' })` — domain `mia2future.online`, db `store3_db`. Brand: **Kalif** (rebranded 2026-05-11 from Michelle Perfume → originally Mia2Future). Pivoted 2026-05-11 from a perfume-store UI to a flat Farmley-style snack/grocery storefront. Logo at `/images/kalif-logo.png` (deep purple wordmark `#3B277E`, transparent bg). Theme: blanc (white bg + Kalif purple accent — `--success`, `--s2-rose-deep` and `--s2-rose` overridden to purple variants). AED currency. Uses real pincode validation (`isStore3` flag in `Checkout.jsx`). New admin content types (settings-keyed JSON arrays): `/settings/announcements` (marquee strip above the navbar), `/settings/category-cards` (large coloured promo tiles, 2×2 desktop / horizontal-scroll mobile), `/settings/mid-banners`. Banners support a `mobileImage` field rendered via `<picture>` at ≤720px.
- `/etc/nginx/sites-available/storeN.conf` — one nginx file per store. SPA served from `client/dist`, `/api/` + `/uploads/` + `/sitemap.xml` + `/robots.txt` all proxied to the store's Node port. SSL via Let's Encrypt.
- MySQL: one server, one DB per store (`ecom_db` for store1, `store2_db` for store2), separate MySQL users per store to contain SQLi blast radius.
- Image paths in `Products.images` (JSON) are stored as relative paths — confirmed safe across moves.

**Why:** user wants to host many stores on one big VPS cheaply, with strong isolation between them (separate DB users, separate processes, separate env files) without the overhead of per-store Docker containers. PM2 is lighter for identical Node stacks.

**How to apply:** When adding a new store, follow the 6-step recipe: clone → DB+user → .env (new PORT, new DB creds, new JWT_SECRET) → append to shared ecosystem.config.cjs → copy store1.conf as template → certbot. Never share MySQL users across stores. Never reuse ports. Always `nginx -t` before reload. Never delete the old store dir until 24h of clean logs on the new one.

Migrated from `/root/shophub` (old layout, ran as root, port 3000) to `/var/www/store1` (new layout, port 3001) on 2026-04-11.
