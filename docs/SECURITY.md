# Security Implementation

## Overview
This document outlines the security measures implemented in Playlist Lab to protect user credentials and sensitive data.

## Encryption

### What is Encrypted

All sensitive user credentials are encrypted before being stored in the database:

1. **Plex Tokens** - User authentication tokens for Plex servers
2. **Spotify Access Tokens** - OAuth tokens for Spotify API access
3. **API Keys** - Gemini and Grok API keys for AI features

### Encryption Method

**Algorithm**: AES-256-GCM (Galois/Counter Mode)
- Industry-standard authenticated encryption
- Provides both confidentiality and authenticity
- Resistant to tampering and forgery attacks

**Key Derivation**: PBKDF2 (Password-Based Key Derivation Function 2)
- 100,000 iterations
- SHA-256 hash function
- Random 64-byte salt per encryption
- Produces 32-byte (256-bit) encryption keys

**Components**:
- **IV (Initialization Vector)**: 16 bytes, randomly generated per encryption
- **Salt**: 64 bytes, randomly generated per encryption
- **Auth Tag**: 16 bytes, ensures data integrity
- **Ciphertext**: Variable length, the encrypted data

### Storage Format

Encrypted data is stored as base64-encoded strings containing:
```
[Salt (64 bytes)][IV (16 bytes)][Auth Tag (16 bytes)][Ciphertext (variable)]
```

This format ensures:
- Each encryption is unique (random salt and IV)
- Data integrity is verified (auth tag)
- Easy storage in text fields (base64 encoding)

## Implementation Details

### Encryption Utility (`apps/server/src/utils/encryption.ts`)

```typescript
// Encrypt sensitive data
const encrypted = encrypt(plaintext, secret);

// Decrypt when needed
const plaintext = decrypt(encrypted, secret);
```

**Features**:
- Automatic salt and IV generation
- Built-in authentication tag
- Error handling for corrupted data
- Constant-time operations where possible

### Encryption Secret

The encryption secret is derived from the `SESSION_SECRET` environment variable:

```env
SESSION_SECRET=your-strong-random-secret-here
```

**Requirements**:
- Minimum 32 characters
- Use cryptographically random values
- Never commit to version control
- Rotate periodically in production

**Generation**:
```bash
# Generate a secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Protected Data

### 1. Plex Tokens

**Location**: `users.plex_token` column
**Encryption**: ✅ Yes (via auth service)
**Usage**: Decrypted only when making Plex API calls

```typescript
// Encrypted before storage
const encryptedToken = encrypt(plexToken, secret);
db.run('UPDATE users SET plex_token = ?', encryptedToken);

// Decrypted when needed
const decryptedToken = decrypt(user.plex_token, secret);
```

### 2. Spotify Access Tokens

**Location**: `users.spotify_access_token` column
**Encryption**: ✅ Yes (as of latest update)
**Usage**: Decrypted only when making Spotify API calls

```typescript
// Encrypted before storage
const encryptedToken = encrypt(accessToken, ENCRYPTION_SECRET);

// Decrypted when needed
const decryptedToken = decrypt(user.spotify_access_token, ENCRYPTION_SECRET);
```

### 3. API Keys (Gemini, Grok)

**Location**: `user_settings.gemini_api_key`, `user_settings.grok_api_key`
**Encryption**: ✅ Yes (via settings service)
**Usage**: Decrypted only when making AI API calls

### 4. Session Data

**Location**: `sessions` table
**Encryption**: ✅ Yes (via express-session)
**Storage**: Encrypted session data in database
**Expiration**: Automatic cleanup of expired sessions

## Security Best Practices

### 1. Environment Variables

**Never commit secrets to version control**:
```bash
# .gitignore includes
.env
.env.local
.env.production
```

**Use strong secrets**:
```env
# ❌ Bad
SESSION_SECRET=secret123

# ✅ Good
SESSION_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 2. Database Security

**File Permissions**:
```bash
# Restrict database file access
chmod 600 data/playlist-lab.db
```

**Backup Encryption**:
```bash
# Encrypt database backups
gpg --encrypt --recipient your@email.com playlist-lab.db
```

**WAL Mode**:
- Enabled for better concurrent access
- Reduces corruption risk
- Automatic checkpointing

### 3. Network Security

**HTTPS Only in Production**:
```nginx
# Force HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

**Secure Headers**:
```typescript
// Add security headers
app.use(helmet({
    contentSecurityPolicy: true,
    hsts: true,
    noSniff: true,
}));
```

### 4. Authentication

**Session Security**:
- HTTP-only cookies (prevents XSS)
- Secure flag in production (HTTPS only)
- SameSite=Strict (prevents CSRF)
- Automatic expiration

**Token Validation**:
- Verify token expiration
- Check token integrity
- Validate user permissions

### 5. Input Validation

**Sanitize User Input**:
```typescript
// Validate and sanitize
if (!url || typeof url !== 'string') {
    throw new Error('Invalid input');
}
```

**Parameterized Queries**:
```typescript
// ✅ Safe - parameterized
db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// ❌ Unsafe - string concatenation
db.prepare(`SELECT * FROM users WHERE id = ${userId}`).get();
```

## Threat Model

### Protected Against

1. **Database Theft**: Encrypted credentials are useless without encryption secret
2. **SQL Injection**: Parameterized queries prevent injection attacks
3. **XSS Attacks**: HTTP-only cookies prevent JavaScript access
4. **CSRF Attacks**: SameSite cookies and CSRF tokens
5. **Session Hijacking**: Secure session management with expiration
6. **Man-in-the-Middle**: HTTPS encryption in production

### Not Protected Against

1. **Compromised Encryption Secret**: If `SESSION_SECRET` is leaked, encryption can be broken
2. **Server Compromise**: If attacker has server access, they can decrypt data
3. **Memory Dumps**: Decrypted data exists in memory during use
4. **Timing Attacks**: Some operations may leak timing information

## Incident Response

### If Encryption Secret is Compromised

1. **Immediate Actions**:
   - Generate new `SESSION_SECRET`
   - Restart server with new secret
   - Force all users to re-authenticate
   - Rotate all encrypted credentials

2. **Re-encryption**:
   ```typescript
   // Decrypt with old secret, encrypt with new secret
   const oldData = decrypt(encrypted, oldSecret);
   const newData = encrypt(oldData, newSecret);
   ```

3. **User Notification**:
   - Inform users of the incident
   - Request re-authentication
   - Recommend changing passwords

### If Database is Compromised

1. **Assess Damage**:
   - Check if encryption secret was also compromised
   - Review access logs
   - Identify affected users

2. **Mitigation**:
   - If secret is safe, encrypted data remains secure
   - If secret is compromised, follow secret compromise procedure
   - Restore from clean backup if available

3. **Prevention**:
   - Review file permissions
   - Audit access controls
   - Implement additional monitoring

## Compliance

### Data Protection

**GDPR Compliance**:
- User data is encrypted at rest
- Users can request data deletion
- Data minimization principles followed
- Audit logs for data access

**Data Retention**:
- Sessions expire automatically
- Cached data cleaned periodically
- User data deleted on account removal

### Audit Trail

**Logged Events**:
- Authentication attempts
- Token encryption/decryption
- API key usage
- Database access errors

**Log Security**:
- Sensitive data never logged
- Logs rotated regularly
- Access restricted to administrators

## Security Checklist

### Development

- [ ] Never commit secrets to git
- [ ] Use environment variables for secrets
- [ ] Encrypt all sensitive data before storage
- [ ] Use parameterized queries
- [ ] Validate all user input
- [ ] Implement proper error handling
- [ ] Add security headers
- [ ] Use HTTPS in production

### Deployment

- [ ] Generate strong `SESSION_SECRET`
- [ ] Set proper file permissions
- [ ] Enable HTTPS
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Enable audit logging
- [ ] Monitor for security issues
- [ ] Keep dependencies updated

### Maintenance

- [ ] Rotate encryption secrets periodically
- [ ] Review access logs regularly
- [ ] Update dependencies for security patches
- [ ] Test backup restoration
- [ ] Audit user permissions
- [ ] Clean up expired sessions
- [ ] Monitor for unusual activity

## Resources

### Documentation

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [SQLite Security](https://www.sqlite.org/security.html)

### Tools

- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - Check for vulnerabilities
- [Snyk](https://snyk.io/) - Continuous security monitoring
- [OWASP ZAP](https://www.zaproxy.org/) - Security testing

## Contact

For security issues, please contact the development team privately rather than opening a public issue.
