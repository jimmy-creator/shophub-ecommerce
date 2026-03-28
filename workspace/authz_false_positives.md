# Authorization False Positives

No false positives identified during testing. All 6 vulnerabilities in the exploitation queue were either:
- EXPLOITED (5 findings): AUTHZ-VULN-01, AUTHZ-VULN-02, AUTHZ-VULN-03, AUTHZ-VULN-04, AUTHZ-VULN-05
- POTENTIAL (1 finding): AUTHZ-VULN-06 (secondary guard prevents full exploitation without real TXNID)

## Controls Confirmed Secure (from analysis phase, not re-tested):
- GET /api/orders/:id — protect middleware + userId ownership check (SAFE)
- POST /api/auth/register — role hardcoded to customer (SAFE)
- POST /api/staff — requires admin + inline role check (SAFE)
