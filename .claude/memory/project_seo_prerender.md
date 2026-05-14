---
name: SEO audit + deferred prerender work
description: 2026-05-08 SEO audit on zayaraelectronics.com — what was fixed, what's deferred, and the planned approach for the per-URL static-HTML problem
type: project
originSessionId: ce3c80e4-afe7-437a-b643-7dda55e6bace
---
SEO audit run 2026-05-08 against `https://zayaraelectronics.com` (store2). Initial score 38/100. Four critical issues identified; three fixed in commit `5518a15`, one deferred at user request.

**Fixed in `5518a15`:**
- `client/index.html` now bakes title, meta description, canonical, full og:* / twitter:* tags, and Organization + WebSite (sitelinks searchbox) JSON-LD using `%VITE_*%` placeholders. Crawlers without JS now see real metadata in the static shell on every URL.
- `client/src/components/SEO.jsx` adds Product JSON-LD (name/sku/brand/offers/aggregateRating/availability) and BreadcrumbList JSON-LD via a new `breadcrumbs` prop. Canonicals now strip query strings to prevent canonical sprawl from UTM/filter params.
- All three stores' `ProductDetail.jsx` pass the full product object plus `Home > Products > [Category] > [Product]` breadcrumbs so each product URL emits rich-snippet structured data once Helmet hydrates.
- New required env: `VITE_SITE_URL` — absolute origin used in `og:url`, canonical, JSON-LD URLs. Each store's `client/.env` on the VPS needs this set to its real domain (e.g. `VITE_SITE_URL=https://zayaraelectronics.com`).

**Follow-up shipped 2026-05-09–10 (still client-side only, but visible-quality wins):**
- Replaced the SERP favicon — Google was using the apple-touch-icon (full wordmark `zayara-logo.png`) which renders as a squashed blur in the SERP circle. New asset is the user-supplied ribbon-style Z mark, padded square and rendered to `client/public/images/zayara-favicon.png` (512×512) and `zayara-favicon-180.png` (180×180). VPS env updates needed: `VITE_FAVICON_URL=/images/zayara-favicon.png`, `VITE_APPLE_TOUCH_ICON=/images/zayara-favicon-180.png`, `VITE_OG_IMAGE=/images/zayara-favicon.png`. Google SERP cache typically refreshes within days–weeks; trigger via Search Console → URL Inspection → Request Indexing.
- ImageMagick gotcha while regenerating PNGs: the built-in MSVG renderer doesn't honor stroke-only paths. Use filled polygons in source SVGs if rendering through `magick` without librsvg.

**Deferred (user said "hold it for now"):**
The site is still pure CSR — every URL serves the same shell HTML. The richer shell now has real Organization / og:* / description, but per-URL uniqueness (per-product titles, per-category descriptions, Product JSON-LD with the actual product data baked in) still requires the JS to execute. Bing/Yandex/social previews will only see the shared shell.

**Planned approach when work resumes (Option A — Express-side meta injection):**
1. Add an Express middleware in `server/src/index.js` that handles non-API HTML routes: `/`, `/products`, `/products?category=:cat`, `/product/:slug`, plus the static policy pages. For each, read `client/dist/index.html` once at boot, then for each request look up the relevant data from MySQL (Product/Category) and string-replace the meta tags + insert per-URL JSON-LD before sending.
2. Update each `/etc/nginx/sites-available/storeN.conf` to proxy non-asset routes to the Node port instead of `try_files`-ing to static. Keep `/assets/`, images, sitemap, robots.txt direct from disk. The nginx change is the high-risk part — get one store right (probably store3 first, lowest traffic) and verify before touching store1/store2.
3. Test path: `curl -A 'facebookexternalhit/1.1' https://store/product/<slug>` should return HTML with the product's title, description, image, and JSON-LD baked in.

**Why Option A vs alternatives:** scales to all 2,572 product URLs without build-time penalty. Option B (build-time prerender with Puppeteer) would take 30-60 min per build at this catalog size and need DB access at build time. Option C (do nothing) leaves social previews and non-Google crawlers blind.

**How to apply:** When picking up this work, start with store3 (smallest user base, lowest blast radius). Don't touch store1/store2 nginx until store3 has been live for 24h with clean logs. The middleware should fall through to a generic 404-page-with-shell-tags response for unknown routes so the SPA router still handles the actual rendering.
