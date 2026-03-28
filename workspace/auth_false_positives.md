# Auth Exploitation False Positives

## Investigation Log

No FALSE_POSITIVE classifications were determined during this engagement. 

All 7 vulnerabilities in the queue were confirmed as real findings:
- AUTH-VULN-01 through AUTH-VULN-04: EXPLOITED
- AUTH-VULN-07: EXPLOITED (Low - confirmed absent security control)
- AUTH-VULN-05, AUTH-VULN-06: POTENTIAL (blocked by external constraints, not security controls)

### Tested and Found Valid
- JWT replay after logout: server-side revocation confirmed absent (not a false positive)
- localStorage token storage: confirmed and exploitable (not a false positive)
- Google OAuth rate limit gap: 100 vs 10 req/15min confirmed (not a false positive)
- User enumeration: admin@shophubonline.store confirmed existing (not a false positive)
- Reset token in URL: confirmed plaintext in query string (not a false positive)
- OAuth email linkage: confirmed in code, requires external Google control (POTENTIAL)
- Missing Cache-Control: confirmed on all auth responses (not a false positive)
