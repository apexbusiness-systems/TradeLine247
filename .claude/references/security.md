# Security Standards

## Authentication

### Password Requirements
- Minimum 12 characters
- Combination of uppercase, lowercase, numbers, symbols
- Check against common password lists
- Hash with bcrypt (cost 12+) or Argon2

### JWT Best Practices
```javascript
{
  accessToken: {
    expiresIn: '15m',
    algorithm: 'RS256'
  },
  refreshToken: {
    expiresIn: '7d',
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  }
}
```

### OAuth 2.0 Flow
1. Authorization request
2. User consent
3. Authorization code
4. Token exchange
5. Access protected resources

### Multi-Factor Authentication
- TOTP (Time-based One-Time Password)
- SMS (less secure, use as backup)
- Hardware tokens (YubiKey)
- Biometric authentication

## Authorization

### Role-Based Access Control (RBAC)
```typescript
enum Role {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest'
}

const permissions = {
  admin: ['read', 'write', 'delete'],
  user: ['read', 'write'],
  guest: ['read']
}
```

### Principle of Least Privilege
- Grant minimum necessary permissions
- Review permissions regularly
- Implement time-based access expiration
- Audit permission changes

## Data Protection

### Encryption at Rest
- AES-256-GCM for sensitive data
- Encrypt database fields containing PII
- Key rotation every 90 days
- Use cloud provider encryption services (AWS KMS, Azure Key Vault)

### Encryption in Transit
- TLS 1.3 required
- Disable older protocols (TLS 1.0, 1.1)
- Use strong cipher suites
- Implement HSTS headers

### Sensitive Data Handling
- Never log passwords, tokens, credit cards
- Mask PII in logs (email: `u***@example.com`)
- Secure deletion of sensitive data
- Implement data retention policies

## Input Validation

### SQL Injection Prevention
```javascript
// ❌ NEVER do this
db.query(`SELECT * FROM users WHERE id = ${userId}`)

// ✅ ALWAYS use parameterized queries
db.query('SELECT * FROM users WHERE id = ?', [userId])
```

### XSS Prevention
- Sanitize all user inputs
- Use Content Security Policy (CSP) headers
- Escape output in templates
- Avoid `dangerouslySetInnerHTML`

### Command Injection Prevention
- Never pass user input directly to shell commands
- Use libraries instead of shell commands when possible
- Whitelist allowed characters if shell execution is necessary

## Secrets Management

### Environment Variables
```bash
# .env (NEVER commit to git)
DATABASE_URL=postgresql://user:pass@localhost/db
JWT_SECRET=your-256-bit-secret
API_KEY=your-api-key
```

### Secret Rotation
- Rotate secrets every 90 days
- Automate rotation where possible
- Have rollback plan for failed rotations
- Monitor for unauthorized access

### Secret Storage
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Never hardcode secrets in code

## OWASP Top 10 (2021)

### 1. Broken Access Control
- Implement proper authorization checks
- Validate user permissions on every request
- Use secure session management

### 2. Cryptographic Failures
- Use strong encryption algorithms
- Protect data in transit and at rest
- Implement proper key management

### 3. Injection
- Use parameterized queries
- Validate and sanitize all inputs
- Use ORMs with built-in protections

### 4. Insecure Design
- Threat modeling during design phase
- Security requirements from the start
- Use established security patterns

### 5. Security Misconfiguration
- Remove default credentials
- Disable unnecessary features
- Keep all software up to date
- Implement security headers

### 6. Vulnerable and Outdated Components
- Regular dependency audits (`npm audit`)
- Automated dependency updates (Dependabot)
- Monitor CVE databases
- Remove unused dependencies

### 7. Identification and Authentication Failures
- Implement MFA
- Strong password policies
- Rate limiting on login attempts
- Secure session management

### 8. Software and Data Integrity Failures
- Use signed packages
- Verify integrity of third-party code
- Implement CI/CD pipeline security
- Code signing for releases

### 9. Security Logging and Monitoring Failures
- Log all authentication attempts
- Monitor for suspicious activity
- Set up alerts for security events
- Implement audit trails

### 10. Server-Side Request Forgery (SSRF)
- Validate and sanitize URLs
- Use allowlists for external services
- Implement network segmentation
- Disable unnecessary protocols

## Security Headers

```javascript
{
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
}
```

## Compliance Standards

### GDPR
- Right to access personal data
- Right to be forgotten
- Data portability
- Consent management
- Data breach notification (72 hours)

### PCI-DSS
- Encrypt cardholder data
- Use strong cryptography
- Protect stored cardholder data
- Never store CVV/CVV2

### HIPAA
- Encryption of PHI
- Access controls and audit trails
- Business associate agreements
- Incident response plan

## Incident Response

1. **Detect**: Monitoring and alerting
2. **Contain**: Isolate affected systems
3. **Eradicate**: Remove threat
4. **Recover**: Restore normal operations
5. **Learn**: Post-incident analysis
