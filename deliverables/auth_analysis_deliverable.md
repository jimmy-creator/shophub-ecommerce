# Authentication Analysis Report
## ShopHub E-Commerce Platform — `https://shophubonline.store`

---

## 1. Executive Summary

- **Analysis Status:** Complete
- **Key Outcome:** Seven authentication flaws were identified across session management, token handling, rate limiting, identity disclosure, password recovery, and OAuth account linkage. The most critical findings are (1) a **no-revocation JWT lifecycle** where Bearer tokens remain valid after logout, enabling post-logout session hijacking, and (2) **JWT dual-storage** where tokens are returned in the API response body and stored in `localStorage`, defeating the HttpOnly cookie protection. Combined with the application's disabled Content Security Policy (per recon), the token theft surface is materially elevated.
- **Purpose of this Document:** This report provides the strategic context on the application's authentication mechanisms, dominant flaw patterns, and key architectural details necessary to effectively exploit the vulnerabilities listed in the exploitation queue.

---

## 2. Dominant Vulnerability Patterns

### Pattern 1: Token Lifecycle Weakness (No Revocation + Dual Storage)
- **Description:** The JWT token is delivered both as an HttpOnly cookie AND in the JSON response body. The frontend stores the body token in `localStorage` and sends it via `Authorization: Bearer` on all subsequent requests. The server accepts both paths equally. When a user logs out, only the cookie is cleared — the Bearer token in `localStorage` is never invalidated server-side. The token remains cryptographically valid for its full 7-day lifetime.
- **Implication:** Any attacker who obtains the Bearer token (via XSS targeting `localStorage`, via network interception prior to logout, or any other theft vector) can continue to authenticate indefinitely after the victim has logged out. There is no mechanism to revoke or invalidate the stolen token.
- **Representative Findings:** `AUTH-VULN-01`, `AUTH-VULN-02`.

### Pattern 2: Insufficient Abuse Defenses on Authentication Endpoints
- **Description:** While the standard credential-based auth endpoints (`/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/reset-password`) have an auth-specific rate limiter of 10 requests per 15 minutes, the Google OAuth endpoint (`POST /api/auth/google`) is entirely exempt from this limiter. It is only subject to the permissive global limit of 100 requests per 15 minutes.
- **Implication:** The Google OAuth endpoint can receive 10× more requests before any throttling engages compared to credential-based auth. No CAPTCHA or account lockout exists on any endpoint.
- **Representative Finding:** `AUTH-VULN-03`.

### Pattern 3: Identity and Credential Disclosure Flaws
- **Description:** Two distinct disclosure issues exist. First, the registration endpoint returns a distinguishing error message (`"Email already registered"`) for existing emails, directly enabling account enumeration. Second, the password reset token is embedded as a plaintext query parameter in the reset URL, exposing it in browser history, server access logs, and HTTP `Referer` headers.
- **Implication:** The enumeration flaw provides a low-friction oracle for building a list of registered emails at scale (bounded only by the 10/15min auth limiter). The reset token URL exposure creates a window for account takeover if an attacker can observe any of these channels.
- **Representative Findings:** `AUTH-VULN-04`, `AUTH-VULN-05`.

---

## 3. Strategic Intelligence for Exploitation

### Authentication Method
The system uses **JWT (HS256, 7-day expiry)** delivered via two channels simultaneously:
1. **HttpOnly Cookie** (`token=<jwt>; HttpOnly; Secure; SameSite=Strict`) — set on login/register/Google OAuth
2. **JSON Response Body** (`{"user":{...}, "token":"<jwt>"}`) — returned from same endpoints, stored in `localStorage` by the React frontend

The server `protect` middleware at `server/src/middleware/auth.js:5` accepts whichever is present first:
```javascript
let token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
```

This means even if the cookie is cleared (logout), the Bearer token path remains fully functional.

### Session Token Details
- **Cookie name:** `token`
- **Flags:** `HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
- **localStorage key:** `token` (written by `client/src/context/AuthContext.jsx:18`)
- **Axios interceptor:** `client/src/api/axios.js:8-13` reads `localStorage.getItem('token')` and sets `Authorization: Bearer <token>` on all API requests
- **Logout behavior:** `POST /api/auth/logout` clears only the cookie (`Set-Cookie: token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly`). The `localStorage` token is cleared client-side by JavaScript but is **never revoked server-side**.
- **Live confirmation:** Bearer token used post-logout returns HTTP 200 on `GET /api/auth/profile`.

### Rate Limiting Architecture
| Endpoint | Rate Limiter Applied | Limit |
|---|---|---|
| `POST /api/auth/login` | `authLimiter` | 10 req / 15 min |
| `POST /api/auth/register` | `authLimiter` | 10 req / 15 min |
| `POST /api/auth/forgot-password` | `authLimiter` | 10 req / 15 min |
| `POST /api/auth/reset-password` | `authLimiter` | 10 req / 15 min |
| `POST /api/auth/google` | **global limiter only** | **100 req / 15 min** |
| `POST /api/auth/logout` | global limiter only | 100 req / 15 min |

### Password Policy
Enforced **server-side** in `authController.js:22-26`:
- Minimum 8 characters
- At least one uppercase letter, one lowercase letter, one digit
- Regex: `/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/`
- No special character requirement
- No maximum length (opens DoS via bcrypt with >72-byte passwords, though this is a secondary concern)

### JWT Secret
- Algorithm: HS256
- Live test confirmed: the **production JWT secret is NOT the known dev value** (`dev_secret_change_in_production`) — the signature did not match. The production secret is unknown and considered adequate.
- Payload: `{ id, iat, exp }` — no role claims embedded; role is fetched live from DB on every request.

### Google OAuth Architecture
- Uses Google One-Tap credential flow (ID token, not authorization code)
- Server verifies token against `GOOGLE_CLIENT_ID` using `OAuth2Client.verifyIdToken`
- Account lookup is by **email only** — the `sub` (Google ID, immutable) is extracted but **never stored** in the database
- No `email_verified` claim check before proceeding
- No `state`/`nonce` parameters (One-Tap credential flow; CSRF protection relies on `SameSite=Strict` cookie)

### CORS Configuration
- Production `CLIENT_URL` is properly set → `Access-Control-Allow-Origin: https://shophubonline.store` (confirmed live)
- `Access-Control-Allow-Credentials: true`
- **NOT a vulnerability** — CORS is correctly restricted to the application's own origin

### Transport Security (Confirmed Live)
- HTTP → HTTPS redirect confirmed (301)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` present on all API responses (set by Helmet middleware)
- TLS termination at Nginx; `X-Forwarded-Proto: https` passed to Express
- **HSTS is correctly implemented** — not a vulnerability

---

## 4. Detailed Findings

### AUTH-VULN-01 — Session_Management_Flaw: No Token Revocation After Logout

**Severity:** High | **Externally Exploitable:** Yes

**Root Cause (Source → Sink Trace):**
1. **Source — Token Issuance:** `server/src/controllers/authController.js:50-53` — JWT is returned in both the `Set-Cookie` header AND the JSON response body on login/register.
2. **Client Storage:** `client/src/context/AuthContext.jsx:18-19` — Frontend writes the body token to `localStorage`. `client/src/api/axios.js:8-13` — Axios interceptor reads it and sets `Authorization: Bearer <token>` on every request.
3. **Sink — Logout:** `server/src/controllers/authController.js:79` — Logout only clears the cookie: `res.cookie('token', '', { httpOnly: true, expires: new Date(0) })`. No server-side record of the token is invalidated.
4. **Vulnerable Path Remains Open:** `server/src/middleware/auth.js:5` — The `protect` middleware accepts the Bearer token: `let token = req.cookies?.token || req.headers.authorization?.split(' ')[1]`. Since the JWT itself is cryptographically valid (7-day TTL unaffected by logout), any request using the Bearer path succeeds.

**Live Proof:** A Bearer token obtained from registration was used to call `GET /api/auth/profile` after `POST /api/auth/logout` was called. The server returned HTTP 200 with full user profile data, confirming post-logout token replay is fully functional.

**Missing Defense:** A server-side token denylist or Redis-based JWT invalidation store consulted by the `protect` middleware. Alternatively, short-lived access tokens (15 minutes) with server-side refresh token revocation.

---

### AUTH-VULN-02 — Token_Management_Issue: JWT Stored in localStorage (Dual-Storage Pattern)

**Severity:** High | **Externally Exploitable:** Yes

**Root Cause (Source → Sink Trace):**
1. **Source:** `server/src/controllers/authController.js:53` (`login`), line `res.json({ user, token })` — JWT is intentionally returned in the response body.
   - Also: `server/src/controllers/authController.js:50` (register), `server/src/routes/googleAuth.js:43` (Google OAuth) — all auth flows return the token in the body.
2. **Sink:** `client/src/context/AuthContext.jsx:18-19` — `localStorage.setItem('token', data.token)` — token written to browser's `localStorage`.
3. **Exposure Vector:** `localStorage` is accessible to any JavaScript running on the page. With CSP disabled (`server/src/index.js:50`), any XSS payload can read `localStorage.getItem('token')` and exfiltrate the JWT.
4. **Authentication via Stolen Token:** `server/src/middleware/auth.js:5` — Bearer header path enables use of stolen token from any origin, bypassing `SameSite=Strict` cookie protection.

**Compound Effect with AUTH-VULN-01:** A token stolen from `localStorage` via XSS remains valid for the full 7-day TTL even after victim logout, providing a durable persistence mechanism.

**Missing Defense:** JWT should only be delivered as an HttpOnly cookie. The JSON body token delivery should be removed. The frontend should rely entirely on the cookie for session management (no `localStorage` token storage).

---

### AUTH-VULN-03 — Abuse_Defenses_Missing: No Auth-Specific Rate Limit on POST /api/auth/google

**Severity:** High | **Externally Exploitable:** Yes

**Root Cause:**
- `server/src/routes/googleAuth.js` — The route handler is registered without any rate-limiting middleware: `router.post('/google', async (req, res) => { ... })`.
- `server/src/routes/auth.js:8-14` — The `authLimiter` (10 req/15min) is only applied to the four standard auth routes and is **not imported or applied** in `googleAuth.js`.
- The endpoint is only protected by the **global limiter** of 100 requests per 15 minutes (confirmed live via `RateLimit-Policy: 100;w=900` header on the Google OAuth response vs `RateLimit-Policy: 10;w=900` on login).

**Live Confirmation:** `POST /api/auth/google` with an invalid credential returns `RateLimit-Policy: 100;w=900` (global) and NOT `10;w=900` (authLimiter). Ten times more requests are permitted compared to credential-based login.

**Missing Defense:** Apply the `authLimiter` middleware to the `POST /api/auth/google` route, as done for all other authentication endpoints.

---

### AUTH-VULN-04 — Login_Flow_Logic: User Enumeration via Registration Endpoint

**Severity:** High | **Externally Exploitable:** Yes

**Root Cause:**
- `server/src/controllers/authController.js:35-37`:
```javascript
const existingUser = await User.findOne({ where: { email: email.toLowerCase().trim() } });
if (existingUser) {
  return res.status(400).json({ message: 'Email already registered' });
}
```
- The registration endpoint returns the distinguishing message `"Email already registered"` when the submitted email already exists in the database.

**Live Confirmation:** `POST /api/auth/register` with a known-existing email returns `{"message":"Email already registered"}` (HTTP 400). With a new email, it returns a 201 with user data.

**Contrast with Correct Implementation:** The `forgotPassword` handler correctly uses a generic response: `"If an account exists, a reset link has been sent"` for both existing and non-existing emails.

**Missing Defense:** Return the same HTTP 400 response with a generic message (e.g., `"Registration failed. Check your input."`) regardless of whether the email exists. The email uniqueness error should not be distinguishable from other validation errors.

**Scope Note:** At 10 requests per 15 minutes (authLimiter), an attacker can enumerate ~960 emails per day from a single IP. Distributed enumeration across multiple IPs is not limited.

---

### AUTH-VULN-05 — Reset_Recovery_Flaw: Password Reset Token Exposed in URL

**Severity:** Medium | **Externally Exploitable:** Yes

**Root Cause:**
- `server/src/controllers/authController.js:116-117`:
```javascript
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const resetUrl = `${clientUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
```
- The 64-character hex reset token (`crypto.randomBytes(32).toString('hex')`) is placed in the URL query string and sent via email.

**Exposure Vectors:**
1. **Browser History:** The reset URL with the token is stored permanently in the user's browser history.
2. **Server Access Logs:** Nginx and Express log all request URLs; the token appears in access logs when the reset page is accessed.
3. **Referrer Header Leakage:** If the user navigates from the reset page (`/reset-password?token=...&email=...`) to any external link (e.g., a product link, social share button, or attacker-controlled URL), the full reset URL including the token is sent in the HTTP `Referer` header. (Note: the `Referrer-Policy: no-referrer` header is set for API responses, but the frontend SPA page itself may not inherit this policy.)
4. **Email Service Intermediaries:** The URL is transmitted via Gmail SMTP; unencrypted log access at any intermediary could expose the token.

**Additional Issue — Plaintext Token Storage:** `server/src/controllers/authController.js:114` stores `resetToken` in the database as plaintext. Should the database be compromised, all pending reset tokens are directly usable for account takeover.

**Missing Defense:** Use opaque token in a POST form submission (not URL parameter), or include the token only in the URL path (not query string) while enforcing `Referrer-Policy: no-referrer` on all frontend pages. The token should also be hashed before database storage.

---

### AUTH-VULN-06 — OAuth_Flow_Issue: Google OAuth Account Linkage by Mutable Email Claim Only

**Severity:** Medium | **Externally Exploitable:** Yes

**Root Cause:**
- `server/src/routes/googleAuth.js:43-45`:
```javascript
const { email, name, picture, sub: googleId } = payload;
// ...
let user = await User.findOne({ where: { email: email.toLowerCase() } });
```
- The `sub` claim (Google's immutable, unique user identifier) is destructured as `googleId` but **never stored** in the User model. The account lookup uses only the `email` attribute, which is a mutable claim.
- There is no check for `payload.email_verified === true` before proceeding with account creation or login.

**Attack Scenarios:**

*Scenario A — Email-Based Account Merging:* An attacker who registers a local password-based account with `victim@domain.com` before the legitimate owner claims it can later use Google OAuth with the same email to log into the pre-created account, or vice versa — if a Google user's email matches an existing local account, the Google OAuth flow silently logs them into that account.

*Scenario B — Google Workspace Takeover Path:* If an attacker gains control of a Google Workspace domain that matches a registered user's email domain (e.g., through a domain acquisition after employee departure), they can create a Google identity for `victim@acquired-domain.com` and authenticate as the existing local user.

*Scenario C — Unverified Email Registration:* The absence of an `email_verified` check means that if a Google account with an unverified email is presented (possible in some OAuth edge cases), the application accepts it.

**nOAuth Compliance Failure:** Per OIDC best practice, persistent account linkage must use the immutable `sub` claim, not the mutable `email`. The `sub` should be stored on first Google login and verified on subsequent ones, making email changes at Google irrelevant to the application's identity binding.

**Missing Defense:** Store `googleId` (the `sub` claim) in the User model. On first Google OAuth login, create the account binding with `{ email, googleId }`. On subsequent logins, look up by `googleId` first, with email as a fallback for migration only. Add `email_verified: true` check before proceeding.

---

### AUTH-VULN-07 — Transport_Exposure: No Cache-Control: no-store on Sensitive Auth Responses

**Severity:** Low | **Externally Exploitable:** Yes (shared device scenarios)

**Root Cause:**
- `server/src/controllers/authController.js:83-84` (`getProfile`) — Returns sensitive PII (email, name, phone, address, role) with no explicit `Cache-Control` directive.
- Live observation: `GET /api/auth/profile` response contains `ETag: W/"ce-..."` but **no** `Cache-Control: no-store` or `Pragma: no-cache`.
- This applies to login/register responses as well (`POST /api/auth/login` returns JWT + user data with no no-store directive).

**Impact:** On shared devices (public computers, family PCs), the browser cache may retain authentication responses including JWT tokens and user PII. A subsequent user on the same device could access cached auth responses via browser developer tools or forward/back navigation.

**Missing Defense:** Add `res.set('Cache-Control', 'no-store')` to all authentication-related response handlers, or apply it as middleware on the `/api/auth/` route group.

---

## 5. Secure by Design: Validated Components

These components were analyzed and found to have robust defenses. They are low-priority for further testing.

| Component / Flow | Endpoint / File Location | Defense Mechanism Implemented | Verdict |
|---|---|---|---|
| Password Hashing | `server/src/models/User.js:53` | `bcryptjs` with 12 salt rounds via `beforeCreate`/`beforeUpdate` hooks; constant-time `comparePassword` via `bcrypt.compare` | SAFE |
| Password Policy | `server/src/controllers/authController.js:22-26` | Server-side enforcement: min 8 chars, upper+lower+digit required | SAFE |
| Cookie Security Flags | `server/src/controllers/authController.js:6-11` | `HttpOnly: true`, `Secure: true` (production), `SameSite: 'strict'` — confirmed in live `Set-Cookie` header | SAFE |
| HTTPS / HTTP Redirect | Nginx (production), `security.js:57-65` | HTTP 301 redirect to HTTPS confirmed live; Nginx terminates TLS | SAFE |
| HSTS Header | `server/src/index.js:49-53` (Helmet default) | `Strict-Transport-Security: max-age=31536000; includeSubDomains` confirmed in all API responses | SAFE |
| JWT Secret Strength | `server/.env` (production) | Live test confirms production JWT secret ≠ `dev_secret_change_in_production`; signatures do not match | SAFE |
| Role Injection Prevention | `server/src/controllers/authController.js:44` | Registration hardcodes `role: 'customer'`; client-supplied `role` field is ignored | SAFE |
| JWT Payload Minimization | `server/src/middleware/auth.js:62-66` | JWT contains only `{ id }`; role is fetched live from DB on every request via `User.findByPk()` | SAFE |
| Forgot-Password Enumeration | `server/src/controllers/authController.js:100-109` | Returns identical generic response for both existing and non-existing emails | SAFE |
| Login Error Messages | `server/src/controllers/authController.js:68-70` | Generic `"Invalid email or password"` returned regardless of whether email exists | SAFE |
| Reset Token Entropy | `server/src/controllers/authController.js:111` | `crypto.randomBytes(32).toString('hex')` — 256 bits of entropy; not guessable | SAFE |
| Reset Token TTL | `server/src/controllers/authController.js:112` | 1-hour expiry enforced server-side | SAFE |
| Reset Token Single-Use | `server/src/controllers/authController.js:158-159` | Token cleared (`resetToken: null`) after successful reset | SAFE |
| Auth Rate Limiting (standard endpoints) | `server/src/routes/auth.js:8-14` | 10 requests per 15 minutes per IP on login, register, forgot-password, reset-password | SAFE |
| CORS Configuration | `server/src/index.js:55-61` | `Access-Control-Allow-Origin: https://shophubonline.store` (production `CLIENT_URL` properly set); confirmed live | SAFE |
| Google ID Token Verification | `server/src/routes/googleAuth.js:24-29` | Uses `OAuth2Client.verifyIdToken` with audience check against `GOOGLE_CLIENT_ID`; cryptographic signature validation | SAFE |
| Role Hardcoding in Google OAuth | `server/src/routes/googleAuth.js:60` | Google OAuth-created accounts hardcoded to `role: 'customer'` | SAFE |
| Admin Credentials | `server/src/models/User.js`, `server/src/controllers/authController.js` | No default admin credentials in code or fixtures; admin accounts require direct DB setup | SAFE |
| XSS Sanitization | `server/src/middleware/security.js:1-18` | HTML-encodes `<` and `>` in request bodies (note: query parameters are not sanitized — separate concern) | SAFE (partial) |

---

## 6. Methodology Coverage Checklist

| Check | Methodology Step | Status | Finding |
|---|---|---|---|
| HTTPS enforcement | §1 Transport | SAFE | HTTP→HTTPS redirect confirmed (301) |
| HSTS header | §1 Transport | SAFE | `max-age=31536000; includeSubDomains` confirmed |
| Cache-Control on auth responses | §1 Caching | VULNERABLE | No `no-store` on `GET /api/auth/profile` or login responses |
| Rate limit — login | §2 Rate Limiting | SAFE | `authLimiter`: 10/15min |
| Rate limit — register | §2 Rate Limiting | SAFE | `authLimiter`: 10/15min |
| Rate limit — forgot-password | §2 Rate Limiting | SAFE | `authLimiter`: 10/15min |
| Rate limit — reset-password | §2 Rate Limiting | SAFE | `authLimiter`: 10/15min |
| Rate limit — Google OAuth | §2 Rate Limiting | VULNERABLE | Only global 100/15min; `AUTH-VULN-03` |
| CAPTCHA / account lockout | §2 Rate Limiting | NOTE | None implemented; partially mitigated by IP-based rate limits |
| Cookie HttpOnly flag | §3 Session Cookies | SAFE | Confirmed in live `Set-Cookie` |
| Cookie Secure flag | §3 Session Cookies | SAFE | Confirmed in live `Set-Cookie` |
| Cookie SameSite | §3 Session Cookies | SAFE | `SameSite=Strict` confirmed |
| Session ID rotation after login | §3/§5 Session Fixation | SAFE | New JWT generated on each login; no pre-login session exists |
| Server-side logout invalidation | §3 Session Management | VULNERABLE | Cookie cleared; Bearer token remains valid; `AUTH-VULN-01` |
| Idle / absolute session timeout | §3 Session Management | NOTE | 7-day absolute TTL; no idle timeout; acceptable for e-commerce |
| Session IDs not in URLs | §3 Session Management | SAFE | Session via cookie + Authorization header only |
| Token entropy | §4 Token Properties | SAFE | JWT signed with HS256; `crypto.randomBytes` for reset tokens |
| Token sent over HTTPS only | §4 Token Properties | SAFE | HTTPS enforced; `Secure` cookie flag set |
| Token not logged | §4 Token Properties | NOTE | JWT returned in response body — potentially logged by infra |
| Token expiration | §4 Token Properties | SAFE | 7-day `exp` claim enforced by `jwt.verify` |
| Token invalidated on logout | §4 Token Properties | VULNERABLE | No server-side revocation; `AUTH-VULN-01` |
| Token in localStorage (secure storage) | §4 Token Properties | VULNERABLE | JWT in response body → localStorage; `AUTH-VULN-02` |
| Default credentials | §6 Password Policy | SAFE | None found in code or fixtures |
| Password policy enforcement | §6 Password Policy | SAFE | Server-side regex; min 8 chars, upper+lower+digit |
| Password hashing | §6 Password Policy | SAFE | bcrypt 12 rounds |
| MFA available | §6 Password Policy | NOTE | Not implemented; no policy requirement found |
| Login error — no enumeration | §7 Login Responses | SAFE | Generic message for invalid credentials |
| Register error — no enumeration | §7 Login Responses | VULNERABLE | `"Email already registered"` disclosed; `AUTH-VULN-04` |
| Auth state not in URLs | §7 Login Responses | SAFE | No session tokens in redirect URLs |
| Reset token — single-use | §8 Recovery | SAFE | Token cleared after use |
| Reset token — short TTL | §8 Recovery | SAFE | 1-hour expiry |
| Reset token — rate limited | §8 Recovery | SAFE | `authLimiter`: 10/15min |
| Reset token — no enumeration | §8 Recovery | SAFE | Generic response for unknown emails |
| Reset token — URL exposure | §8 Recovery | VULNERABLE | Token in query string; `AUTH-VULN-05` |
| Logout — server-side invalidation | §8 Recovery | VULNERABLE | No revocation; captured in `AUTH-VULN-01` |
| Logout — cookie clearing | §8 Recovery | SAFE | Cookie expired on logout |
| Google OAuth — state/nonce | §9 OAuth | NOTE | Not applicable for credential (One-Tap) flow; `SameSite=Strict` provides CSRF protection |
| Google OAuth — redirect URI | §9 OAuth | NOTE | Not applicable for credential flow (no redirect URI) |
| Google OAuth — token verification | §9 OAuth | SAFE | `verifyIdToken` with audience check |
| Google OAuth — sub vs email | §9 OAuth | VULNERABLE | Account linked by email; sub not stored; `AUTH-VULN-06` |
| Google OAuth — email_verified | §9 OAuth | VULNERABLE | `email_verified` not checked; included in `AUTH-VULN-06` |


