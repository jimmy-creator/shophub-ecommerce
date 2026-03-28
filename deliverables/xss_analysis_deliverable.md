# Cross-Site Scripting (XSS) Analysis Report
## Target: https://shophubonline.store
## Analysis Date: 2026-03-28

---

## 1. Executive Summary

- **Analysis Status:** Complete
- **Key Outcome:** No externally exploitable XSS vulnerabilities were identified. Every input vector traced from the reconnaissance deliverable was systematically analyzed and confirmed safe. The application's consistent use of React JSX auto-escaping across all components is the primary defense, and it is applied universally — no `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, or `eval` sink exists anywhere in the frontend codebase. **The exploitation queue is empty.**
- **Purpose of this Document:** This report provides the complete source-to-sink analysis for all XSS candidate surfaces identified in the recon phase, documents the environmental weaknesses that would amplify any future finding, and records the confirmed safe rendering patterns so future analysts understand why paths were ruled out.

**Critical Environmental Notes for Future Analysts:**
- **CSP is globally disabled** (`helmet({ contentSecurityPolicy: false })` at `server/src/index.js:50`). Any future XSS finding would execute without any browser-level mitigation.
- **JWT is stored in `localStorage`** (dual-storage pattern at `AuthContext.jsx:18-19`). Any future XSS would be able to steal the JWT from `localStorage`, enabling full account takeover.
- **`xss-clean` package is installed but never imported or applied** — it is dead code.
- The custom `sanitizeInput` middleware only escapes `<` and `>` (not quotes, backticks, or `javascript:` scheme). Its effectiveness is entirely dependent on React's own escaping layer.

---

## 2. Dominant Vulnerability Patterns

No exploitable XSS patterns were confirmed. The following structural patterns were observed:

**Pattern 1: Universal React JSX Auto-Escaping (Primary Defense)**
- **Description:** The entire frontend is a React 19 SPA. Every piece of user-generated or database-sourced content is rendered exclusively via JSX text interpolation (`{variable}`) or JSX attribute bindings. React's virtual DOM renderer HTML-encodes all text content and attribute values before writing to the actual DOM. This was confirmed across all 35+ JSX component files.
- **Implication:** Standard stored and reflected HTML injection payloads (e.g., `<script>`, `<img onerror=...>`) are rendered as inert text. Attribute injection payloads (e.g., `" onmouseover="alert(1)`) are also neutralized — they appear as visible text content inside HTML tags rather than as executable event handlers.
- **Live Confirmation:** A review was submitted with `title: '" onmouseover="window.__r_xss=1'` (quote-based payload, no angle brackets — bypassing `sanitizeInput`). Browser eval of `window.__r_xss` returned `undefined`, confirming no execution.

**Pattern 2: Server-Side `sanitizeInput` Has a Gap (Partially Mitigated)**
- **Description:** The custom `sanitizeInput` middleware (`server/src/middleware/security.js:2-27`) replaces only `<` and `>` in `req.body`. It does NOT escape double quotes, single quotes, backticks, or `javascript:` URI prefixes. The `xss-clean` package is declared in `package.json` but never imported.
- **Implication:** Payloads containing only quotes (e.g., `" onmouseover=...`) are stored verbatim in the database. However, since React's JSX escaping is the downstream rendering layer, this gap has no current exploitable consequence. If any component ever switches to `dangerouslySetInnerHTML`, this stored data would immediately become exploitable with zero new attacker effort.
- **Risk Rating:** Low current risk, high latent risk.

**Pattern 3: Dynamic Script Injection Sink Exists (Architecturally Dangerous, Not Externally Exploitable)**
- **Description:** `Checkout.jsx` contains a `loadScript()` function (lines 17-29) that creates a `<script>` element, sets `script.src` to a URL built from `payment.baseUrl` and `payment.mid` taken directly from the API response, then appends it to `document.body`. There is zero URL validation or allowlist check on this value client-side.
- **Implication:** Both values originate from server-side environment variables (`PAYTM_ENV`, `PAYTM_MERCHANT_ID`). An external internet attacker has no code path to influence these values through the API. Not currently externally exploitable.
- **Risk Rating:** High architectural risk. If server is compromised or settings become DB-backed, this becomes a critical XSS sink affecting all checkout users with no CSP mitigation.

---

## 3. Strategic Intelligence for Exploitation

**Content Security Policy (CSP) Analysis**
- **Current CSP:** None. `helmet({ contentSecurityPolicy: false })` is set in `server/src/index.js:50`. All normal API/page responses carry no CSP header.
- **Exception:** Express's built-in `finalhandler` (404 error pages at unknown `/api/*` routes) adds `Content-Security-Policy: default-src 'none'` automatically. This is irrelevant to exploitability since no XSS vector was found on these error pages.
- **Implication for Future Exploitation:** Any XSS that is discovered would have zero CSP restriction. Inline scripts, remote script loading, and data exfiltration would all work without needing a CSP bypass.

**Cookie Security**
- **Primary JWT cookie:** `token=<jwt>; HttpOnly; Secure; SameSite=Strict` — This cookie is protected by `HttpOnly` and cannot be accessed via `document.cookie`. Direct cookie theft via XSS would NOT work for this token.
- **localStorage JWT (Critical):** The same JWT is also stored in `localStorage` as `token` (`AuthContext.jsx:18`). Since `localStorage` is accessible via JavaScript, any XSS execution could steal the auth token from `localStorage`, achieving complete session takeover.
- **Exploitation Path:** `localStorage.getItem('token')` — single call, no cookie flag bypass needed.

**Input Sanitization Gaps**
- `sanitizeInput` covers only `req.body`, not `req.query` or `req.params`.
- Only `<` and `>` are escaped. Quotes, backticks, and URL scheme values pass through verbatim.
- Any future sink that renders `req.query` content as raw HTML would be instantly exploitable.

**WAF / Rate Limiting**
- No WAF observed (no Cloudflare, no ModSecurity headers).
- Rate limiting is applied (`RateLimit-Limit: 100` per 900s on `/api/*`), but this applies per IP to API endpoints, not to static page fetches. No bot detection or challenge pages observed.

---

## 4. Vectors Analyzed and Confirmed Secure

All input vectors from the reconnaissance deliverable were analyzed. Every path was traced from source to sink. All paths terminate at React JSX auto-escaping before reaching the DOM.

| Source (Parameter/Key) | Endpoint/File Location | Defense Mechanism | Render Context | Verdict |
|---|---|---|---|---|
| `req.body.name` (registration) | `POST /api/auth/register` → `authController.js:44` | `sanitizeInput` escapes `<>`; React JSX text node | HTML_BODY | SAFE |
| `req.body.name` (profile update) | `PUT /api/auth/profile` → `authController.js:88` | `sanitizeInput` escapes `<>`; React JSX text node | HTML_BODY | SAFE |
| `req.body.title`, `req.body.comment` (reviews) | `POST /api/reviews` → `reviews.js:83` | `sanitizeInput` escapes `<>`; React JSX text nodes (`{review.title}`, `{review.comment}` in `ProductDetail.jsx:436-437`) | HTML_BODY | SAFE |
| `req.body.name` (admin review creation) | `POST /api/reviews/admin` → `reviews.js:139` | `sanitizeInput` escapes `<>`; React JSX text node (`{r.name}` in `Admin.jsx:1567`) | HTML_BODY | SAFE |
| `req.query.search` | `GET /api/products?search=` → `Products.jsx:66` | React Router `useSearchParams()`; JSX text in `<h1>` | HTML_BODY | SAFE |
| `req.query.q` (search suggestions) | `GET /api/products/search-suggestions?q=` | Returns JSON array; no HTML reflection; empty array for no matches | N/A (JSON response) | SAFE |
| `req.query.orderNumber`, `req.query.email` | `GET /order-success?orderNumber=&email=` → `OrderSuccess.jsx:95,102` | React Router `useSearchParams()`; JSX text nodes | HTML_BODY | SAFE |
| `req.query.token`, `req.query.email` | `GET /reset-password?token=&email=` → `ResetPassword.jsx` | Not rendered; POST body only | N/A | SAFE |
| `req.params.slug` | `GET /product/:slug` → `ProductDetail.jsx:31` | Not rendered; API lookup key only | N/A | SAFE |
| `product.description` | API: `GET /api/products/:slug` → `ProductDetail.jsx:226` | React JSX text node `{product.description}` | HTML_BODY | SAFE |
| `product.name` | Multiple pages | React JSX text nodes throughout | HTML_BODY | SAFE |
| `product.images[i]` | `ProductDetail.jsx:130,156`; `ProductImage.jsx:114` | `<img src={imageUrl}>` — React attribute; `javascript:` in `<img src>` does not execute in modern browsers | HTML_ATTRIBUTE (src) | SAFE |
| `category.image` | `Home.jsx:76`; `Admin.jsx:1050,1115` | `<img src={c.image}>` only — never in `<a href>`; `javascript:` in `<img src>` does not execute | HTML_ATTRIBUTE (src) | SAFE |
| `category.name` | `Home.jsx:72` (`<Link to=...>`) | Interpolated into path string; React Router handles safely | URL_PARAM | SAFE |
| `req.body.ORDERID` (Paytm callback) | `POST /api/payment/paytm-callback` → `payment.js:326-328` | `sanitizeInput` encodes `<>` before redirect; React renders result as JSX text | HTML_BODY (via redirect) | SAFE |
| `payment.baseUrl`, `payment.mid` | `POST /api/payment/create-order` → `Checkout.jsx:299` (`loadScript()`) | Source is server env vars only; no user input path to these values | Script src (DOM sink) | SAFE (not user-controlled) |
| `order.cancellationReason` | `Orders.jsx:116` | JSX text node; value constrained to hard-coded `<select>` dropdown | HTML_BODY | SAFE |
| `URL path` (Express 404) | Unknown `/api/*` routes → `finalhandler` | Path is URL-encoded in reflection (`%3Cscript%3E`); `Content-Security-Policy: default-src 'none'` on 404 page | HTML_BODY | SAFE |
| `req.query.sort`, `req.query.order` | `GET /api/products?sort=`, `/api/reviews?sort=` | Values used in DB ORDER BY only; never reflected to HTML | Database query | SAFE (SQL/not XSS) |
| `req.headers.host` | `security.js:62` (forceHttps redirect) | HTTP redirect; client follows to its own domain; no HTML reflection | HTTP Header | SAFE (not XSS) |

---

## 5. Analysis Constraints and Blind Spots

- **Minified/Bundled JavaScript:** The Vite-built production bundle was not reverse-engineered. Analysis was performed on source code. Any dynamic import or code-split chunk not present in the `client/src/` directory tree would not be covered. However, Vite bundles from source, so coverage is complete for the known source tree.
- **Third-Party Libraries:** React component libraries (e.g., `react-hot-toast`, `@react-oauth/google`) are not in scope for source analysis. A supply-chain compromise of these packages could introduce XSS via DOM manipulation. This was not tested.
- **Server-Side Email Templates:** HTML email templates (`emailService.js:85-92, 139-143`) contain unsanitized user data (shipping address fields). These are out of scope for browser XSS analysis but represent a stored HTML injection risk in the email delivery channel.
- **File Upload Path (`/uploads/*`):** Uploaded files are served by Nginx without authentication. If an attacker could upload an HTML file (bypassing the extension allowlist), it would execute in the browser. The current allowlist restricts to image extensions. This was not bypassed in this engagement.
- **Google OAuth Credential Handling:** `POST /api/auth/google` accepts a `credential` JWT from Google. The token is validated via Google's library. No XSS vector was identified in this flow.
- **Abandoned Cart Data:** `POST /api/abandoned-cart/save` stores arbitrary JSON including `email` and `items` with no authentication. Stored values are rendered in the Admin panel (`Admin.jsx:1668-1670`) via JSX text. Confirmed safe due to React rendering.

---

## 6. Complete Source-to-Sink Trace: Dynamic Script Injection (Checkout.jsx)

This path represents the most architecturally significant finding, even though it is not currently externally exploitable.

**Data Flow:**
```
process.env.PAYTM_MERCHANT_ID
  → PaytmGateway constructor (paymentGateway.js:228-231)
  → this.merchantId = process.env.PAYTM_MERCHANT_ID
  → this.baseUrl = hardcoded string based on PAYTM_ENV
  → getCheckoutConfig() (paymentGateway.js:335-346)
  → returns { mid: this.merchantId, baseUrl: this.baseUrl, ... }
  → POST /api/payment/create-order handler (payment.js:200-207)
  → res.json({ payment: { ...checkoutConfig, orderNumber, amount } })
  → Client receives response: data.payment.baseUrl, data.payment.mid
  → Checkout.jsx:299: const scriptUrl = `${payment.baseUrl}/merchantpgpui/checkoutjs/merchants/${payment.mid}.js`
  → Checkout.jsx:301: const loaded = await loadScript(scriptUrl)
  → loadScript() (Checkout.jsx:17-29):
      const script = document.createElement('script')
      script.src = src  // ← DOM SINK: arbitrary URL set on script element
      document.body.appendChild(script)  // ← SCRIPT EXECUTION SINK
```

**Current Protection:** Source values are server environment variables, not user-controlled.
**Missing Protection:** No client-side allowlist; no CSP `script-src` to constrain external script loading.
**Verdict:** NOT externally exploitable in current architecture. Confidence: High.



