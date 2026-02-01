# Security Practices

## Mandatory Practices

- **Security Scans**  
  Run static and dynamic security scans **after every module completion** 

- **Input Validation & Sanitization**  
  All user inputs must be:
  - Validated on both client and server side
  - Sanitized to prevent injection and XSS attacks

- **SQL Injection Prevention**  
  Always use **parameterized queries** or ORM-safe methods to interact with the database. Avoid dynamic SQL construction.

- **Authentication & Authorization**
  - Implement secure **user authentication** using industry-standard methods (OAuth 2.0, JWT, etc.)
  - Enforce **role-based access control (RBAC)** for all protected resources

- **Data Encryption**
  - **Encrypt data at rest** using AES-256 or equivalent
  - **Encrypt data in transit** using TLS 1.2+ and HTTPS





## Sensitive Data Handling
- Never log credentials, tokens, or PII
- Mask sensitive data in error messages
- Implement data retention policies


## OWASP Top 10 Quick Reference

| Risk | Mitigation |
|------|------------|
| Injection | Parameterized queries, input validation |
| Broken Auth | Strong sessions, MFA, rate limiting |
| Sensitive Data Exposure | Encryption, minimal data collection |
| XXE | Disable external entities, use JSON |
| Broken Access Control | RBAC, default deny, server-side checks |
| Misconfiguration | Security headers, disable defaults |
| XSS | Output encoding, CSP headers |
| Insecure Deserialization | Validate before deserialize, use JSON |
| Vulnerable Components | Dependency scanning, regular updates |
| Logging Failures | Audit logs, monitoring, alerting |