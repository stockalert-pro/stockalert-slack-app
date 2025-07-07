# Security Overview - StockAlert Slack App

## Security Features

### 🔐 Authentication & Authorization
- **OAuth 2.0 Flow**: Secure Slack app installation with state parameter validation
- **CSRF Protection**: Random state generation with 10-minute expiry
- **Token Isolation**: Each Slack workspace has isolated bot tokens
- **Signature Verification**: All requests verified with HMAC-SHA256

### 🛡️ Request Validation
- **Slack Signatures**: Timing-safe comparison for all Slack requests
- **Webhook Signatures**: StockAlert webhooks verified with shared secret
- **Timestamp Validation**: 5-minute window to prevent replay attacks
- **Input Validation**: Zod schemas for all user input

### 🚦 Rate Limiting
- **Commands**: 30 requests/minute per user
- **OAuth**: 5 attempts/15 minutes per IP
- **Webhooks**: 100 requests/minute per team
- **Graceful Degradation**: Works without KV storage

### 🗄️ Database Security
- **SQL Injection Prevention**: Parameterized queries via Drizzle ORM
- **Type Safety**: Full TypeScript coverage
- **Connection Security**: SSL/TLS required for all connections

### 🔒 Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 📝 Data Protection
- **No Logging of Sensitive Data**: Tokens never logged
- **Webhook Idempotency**: Duplicate events prevented
- **Secure Storage**: All credentials in environment variables
- **HTTPS Only**: Enforced by Vercel platform

## Security Checklist

- [x] HMAC signature verification for all webhooks
- [x] OAuth state parameter validation
- [x] Rate limiting on all endpoints
- [x] SQL injection prevention
- [x] XSS protection via Slack Block Kit
- [x] CSRF protection
- [x] Timing-safe comparisons
- [x] Security headers
- [x] Input validation
- [x] Error message sanitization

## Reporting Security Issues

Please report security vulnerabilities to security@stockalert.pro

## Compliance

This app follows security best practices for:
- Slack App Directory requirements
- OWASP Top 10 protection
- Industry standard cryptography