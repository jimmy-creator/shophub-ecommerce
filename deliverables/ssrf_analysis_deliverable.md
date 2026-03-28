# SSRF Analysis Report

## 1. Executive Summary

- **Analysis Status:** Complete
- **Key Outcome:** No exploitable Server-Side Request Forgery (SSRF) vulnerabilities were identified. All outbound HTTP requests made by the application target hardcoded, environment-variable-configured URLs and no user-supplied input reaches any HTTP client's destination URL. This finding is consistent with the reconnaissance deliverable's preliminary assessment in Section 9.6.
- **Purpose of this Document:** This report documents the complete backward taint analysis performed on every server-side outbound request sink in the ShopHub application, confirming that the application's outbound request architecture does not expose any SSRF attack surface exploitable from the internet.

---

## 2. Dominant Vulnerability Patterns

No exploitable SSRF patterns were identified. All analyzed sinks were confirmed safe. See Section 4 for the full secure component inventory.

---

## 3. Strategic Intelligence for Exploitation

- **HTTP Client Library:** The application uses the native Node.js `fetch()` API (Node 20 built-in) exclusively for outbound HTTP requests. This is used only in `server/src/services/paymentGateway.js` for the Paytm payment gateway integration.
- **Request Architecture:**
  - **Razorpay:** Outbound requests are made through the official `razorpay` npm SDK (`v2.9.6`). All endpoint URLs are hardcoded within the SDK to `api.razorpay.com`. No user input influences these URLs.
  - **Paytm:** Two `fetch()` calls are made to `this.baseUrl` which is set at object construction time from the `PAYTM_ENV` environment variable to either `https://secure.paytmpayments.com` (production) or `https://securestage.paytmpayments.com` (staging). These are hardcoded string constants — not user-controllable.
  - **Google OAuth:** Token verification is performed via `OAuth2Client.verifyIdToken()` from the `google-auth-library` package. The library contacts Google's certificate endpoint (`https://www.googleapis.com/oauth2/v3/certs`) using an internally hardcoded URL. User input (`credential`) provides only the JWT token to be verified, not the endpoint to contact.
  - **SMTP/Email:** All email is sent via `nodemailer` to an SMTP server configured entirely through environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_EMAIL`, `SMTP_APP_PASSWORD`). No user input influences the mail server destination.
- **Internal Services:** No internally reachable services (metadata endpoints, internal APIs) are exposed to SSRF. MySQL is on `localhost:3306` (Sequelize ORM — not HTTP), Express is on `127.0.0.1:3000` (not reachable from internet), and no proxy/fetch functionality targets internal addresses.
- **Gateway Routing Architecture:** The `gateway` parameter accepted by `POST /api/payment/create-order` and `POST /api/payment/verify` is validated against a hardcoded enum in `getPaymentGateway()` (`paymentGateway.js:301-306`). Unknown gateway names throw an error with a fixed message; this enum lookup cannot be abused to redirect requests to arbitrary URLs.
- **Paytm Callback Redirect (Non-SSRF):** `POST /api/payment/paytm-callback` uses `req.body.ORDERID` in a `res.redirect()` call (`payment.js:321,323`). This is a browser-facing HTTP redirect response, NOT a server-side outbound request, and therefore not an SSRF vector. The redirect base URL is the hardcoded `CLIENT_URL` environment variable.

---

## 4. Secure by Design: Validated Components

These components were analyzed using backward taint analysis and found to have no path from user-controlled input to an outbound HTTP request destination. They are confirmed safe and should be deprioritized for SSRF testing.

| Component / Flow | Endpoint / File Location | Defense Mechanism Implemented | Verdict |
|---|---|---|---|
| Razorpay Payment Order Creation | `POST /api/payment/create-order` → `paymentGateway.js:44` | Razorpay SDK uses hardcoded `api.razorpay.com` endpoint. `gateway` param validated against hardcoded enum; unknown values throw. No user input in URL. | SAFE |
| Razorpay Payment Verification | `POST /api/payment/verify` → `paymentGateway.js:55-68` | HMAC-SHA256 signature verification; `paymentData` fields (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`) are used for cryptographic comparison only, not in URL construction. | SAFE |
| Paytm `initiateTransaction` fetch | `POST /api/payment/create-order` → `paymentGateway.js:247` | `this.baseUrl` is set from `PAYTM_ENV` env var to one of two hardcoded string constants at object construction time. `orderId` in the query string is a server-generated `orderNumber` (not user input). `merchantId` is from env var. | SAFE |
| Paytm `verifyPayment` fetch | `POST /api/payment/verify` → `paymentGateway.js:274` | `this.baseUrl` is hardcoded (env var constant). User-supplied `paymentData.orderId` appears only in the JSON **body** of the request, never in the URL. The URL (`/v3/order/status`) is fully static. | SAFE |
| Gateway Selection via `gateway` Param | `POST /api/payment/create-order`, `POST /api/payment/verify` → `paymentGateway.js:301-306` | `getPaymentGateway(name)` performs an exact-match lookup against a hardcoded object (`{ razorpay, cashfree, payu, phonepe, ccavenue, paytm }`). Unknown values throw `Error('Unknown payment gateway: ...')`. No URL construction from user input. | SAFE |
| Google OAuth Token Verification | `POST /api/auth/google` → `googleAuth.js:30-32` | `OAuth2Client.verifyIdToken({ idToken: credential, audience: clientId })` contacts Google's certificate endpoint using a URL hardcoded inside `google-auth-library`. User supplies only the JWT string, not the verification URL. | SAFE |
| Nodemailer SMTP (emailService.js) | All email-sending endpoints → `emailService.js:1-22` | SMTP server (`host`, `port`) is configured entirely from environment variables. No user input influences the mail server connection target. Email recipient address comes from DB-stored or session-authenticated values. | SAFE |
| Nodemailer SMTP (lowStockJob.js) | Background job → `lowStockJob.js:12-21` | Identical SMTP config pattern to `emailService.js`. SMTP target fully env-var-controlled. No user input in network request path. | SAFE |
| Abandoned Cart Recovery Job | Background job → `abandonedCartJob.js:43-44` | Recovery URL uses `CLIENT_URL` env var + hardcoded `/cart` path. No user input in outbound request URL. SMTP destination is env-var-controlled. | SAFE |
| Paytm Callback Redirect | `POST /api/payment/paytm-callback` → `payment.js:321,323` | `res.redirect()` is a browser-redirect response, not a server-side HTTP request. Base URL is `CLIENT_URL` env var (trusted). `ORDERID` in query string could manipulate parameters but cannot redirect to an arbitrary host. Not an SSRF vector. | SAFE (Parameter injection risk only; out of SSRF scope) |
| Shipping Calculation | `POST /api/payment/calculate-shipping` → `utils/shipping.js` | Pure mathematical computation; no outbound HTTP requests. | SAFE |
| Tax Calculation | `POST /api/payment/calculate-tax` → `utils/tax.js` | Pure mathematical computation; no outbound HTTP requests. | SAFE |
| File Upload (image) | `POST /api/upload` → `upload.js` | Files stored to local filesystem using crypto-random names. No outbound HTTP requests to user-supplied URLs. | SAFE |
| Bulk Product CSV Import | `POST /api/bulk-products/import` → `bulkProducts.js` | CSV parsed from in-memory buffer; no outbound HTTP requests. | SAFE |
| Invoice PDF Generation | `GET /api/orders/:id/invoice` → `invoiceService.js` | PDF generated entirely in-memory using PDFKit; no outbound HTTP requests. | SAFE |

---

## 5. SSRF Sink Inventory (Exhaustive)

The following is the complete inventory of all server-side outbound network calls identified in the application codebase. Every sink has been traced to its source and confirmed safe.

| Sink ID | Location | HTTP Client | Target URL | User-Controlled Component? | Verdict |
|---|---|---|---|---|---|
| SINK-01 | `paymentGateway.js:44` | Razorpay SDK (internal) | `https://api.razorpay.com/v1/orders` | None — SDK hardcodes URL | SAFE |
| SINK-02 | `paymentGateway.js:247` | `fetch()` | `${this.baseUrl}/theia/api/v1/initiateTransaction?mid=...&orderId=...` | `orderId` = server-generated `orderNumber`; `baseUrl` = env var constant | SAFE |
| SINK-03 | `paymentGateway.js:274` | `fetch()` | `${this.baseUrl}/v3/order/status` | None — `baseUrl` = env var constant; user `orderId` in JSON body only | SAFE |
| SINK-04 | `googleAuth.js:30` | `google-auth-library` internal | `https://www.googleapis.com/oauth2/v3/certs` | None — library hardcodes URL; user supplies JWT token only | SAFE |
| SINK-05 | `emailService.js:241` | nodemailer SMTP | `${SMTP_HOST}:${SMTP_PORT}` or `smtp.gmail.com:587` | None — SMTP target from env vars only | SAFE |
| SINK-06 | `lowStockJob.js:67` | nodemailer SMTP | Same as SINK-05 | None | SAFE |

---

## 6. Methodology Applied

The following checks from the SSRF White-Box Analysis Procedure were applied to each sink:

1. **HTTP Client Usage Patterns (§1):** All `fetch()`, SDK, and `nodemailer` call sites were identified. Backward taint analysis was applied to each sink variable to determine whether any user-supplied request parameter (query string, body, header, path param) reaches the URL construction.

2. **Protocol and Scheme Validation (§2):** Not applicable — no user input reaches URL construction, so there is no protocol bypass surface.

3. **Hostname and IP Address Validation (§3):** Not applicable — all hostnames are hardcoded constants or environment variable-configured values controlled by the application operator.

4. **Port Restriction and Service Access Controls (§4):** Not applicable — same as §3.

5. **URL Parsing and Validation Bypass Techniques (§5):** Not applicable — no URL parsing of user input occurs in the outbound request path.

6. **Request Modification and Headers (§6):** The `paymentData` parameter in `POST /api/payment/verify` is passed to `verifyPayment()`. For Paytm, `paymentData.orderId` is included in the JSON request body only. No custom headers can be injected through this path.

7. **Response Handling and Information Disclosure (§7):** Paytm API responses are parsed as JSON and specific fields are extracted. Error messages include only gateway status codes/messages (`resultCode`, `resultMsg`) — no internal infrastructure details are reflected to users.

---

## 7. Conclusion

The ShopHub application has **no exploitable SSRF vulnerabilities**. The architecture demonstrates a "closed" outbound request model:

- Payment gateway URLs are either hardcoded in vendor SDKs or set as environment variable constants at server startup.
- The gateway selection mechanism validates against a strict allowlist enum.
- No URL parameters, webhook payloads, or any other user-supplied data influence the destination of any outbound HTTP request.
- The application makes no use of URL-fetching features (proxy, image-by-URL, webhook delivery, OIDC discovery, or file-by-URL imports) that commonly introduce SSRF.

**The exploitation queue for this analysis phase is empty.**
