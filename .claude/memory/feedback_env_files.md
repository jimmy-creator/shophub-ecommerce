---
name: Per-store .env file gotchas (CRLF + variable names + # quoting + missing placeholders)
description: Common .env pitfalls when bringing up a new store on the VPS — catches silent JWT/login failures, empty theme-color, and "URI malformed" build errors
type: feedback
originSessionId: ce3c80e4-afe7-437a-b643-7dda55e6bace
---
When provisioning a new store's `server/.env` or `client/.env` on the VPS, three gotchas keep biting:

1. **Variable name is `JWT_EXPIRE`, not `JWT_EXPIRES_IN`.** The code at `server/src/middleware/auth.js:72` reads `process.env.JWT_EXPIRE`. If the env file uses the wrong name, jsonwebtoken throws `"expiresIn" should be a number of seconds or string representing a timespan` from the catch block in `authController.js:73`, which silently returns HTTP 500 `{"message":"Login failed"}` without logging the underlying error.
2. **CRLF line endings on the env file** (e.g. when pasted via a Windows clipboard or some editors) make values like `7d` arrive as `7d\r`, which jsonwebtoken rejects the same way. Always run `sed -i 's/\r$//' /var/www/storeN/server/.env` after writing the file. `cat -A` shows hidden chars; the line should end with `$`, not `^M$`.
3. **Values starting with `#` must be quoted** in `client/.env` (and `server/.env`). dotenv treats `#` as the start of an inline comment, so `VITE_THEME_COLOR=#020617` reads as empty — which is why the SEO audit caught `<meta name="theme-color" content="">` on store2's live site even though the env "had" a value. Fix: quote it as `VITE_THEME_COLOR="#020617"`. Affects any hex color, hash-prefixed slug, or comment-style value. Verify with `grep ^VITE_THEME_COLOR /var/www/storeN/client/.env` then check the built `dist/index.html` for the populated tag.

4. **Adding a new `%VITE_*%` placeholder to `client/index.html` requires the var to be set in EVERY store's `client/.env` on the VPS — or the build dies cryptically.** `client/index.html` is shared across stores but each store has its own `.env`. Vite runs `decodeURI()` on attribute values like `href` during HTML AST traversal at build time. If a placeholder `%VITE_FOO%` resolves to nothing, the literal `%VITE_FOO%` lands in the attribute, and `decodeURI("%VI...")` throws because `%V` isn't a valid percent-encoded byte. The error message is `[vite:build-html] URI malformed` with no hint about which placeholder is missing. Most recent occurrence: the SEO commit (`5518a15`) added `VITE_SITE_URL` to canonical/og:url/JSON-LD; store1 and store3 builds failed until `echo 'VITE_SITE_URL=https://<domain>' >> client/.env`. **Whenever index.html gets a new placeholder, ssh into the VPS and add it to all three stores' .env files before pushing the deploy.**

**Why:** Hit on the store3 deploy (2026-05-07, mia2future.online) — login was failing with a generic 500 and empty pm2 logs because the catch block in `authController.js` swallows the error without logging. Took a temporary `console.error(error)` patch to surface the real cause.

**How to apply:** When deploying a new store, after writing `.env`, immediately run `grep -E '^JWT_' /var/www/storeN/server/.env | cat -A` and confirm it shows `JWT_EXPIRE=7d$` (no `^M`, no trailing space). If `pm2 logs` is empty after a 500, the catch block at `authController.js:73` is hiding the error — patch it temporarily with `console.error(error)` to surface it, then revert before going public.
