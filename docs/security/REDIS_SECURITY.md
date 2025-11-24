# Redis Security Configuration

**Per S-9: Redis Security Hardening**

This document describes how to configure Redis with TLS and authentication for secure connections.

## Overview

The XIV Dye Tools Discord Bot supports secure Redis connections with:
- **TLS/SSL encryption** for data in transit
- **Password authentication** for access control
- **Certificate validation** in production

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Redis connection URL
# Use rediss:// for TLS connections
REDIS_URL=rediss://your-redis-host:6380

# Optional: Redis password (if not in URL)
REDIS_PASSWORD=your-secure-password

# Optional: Enable TLS explicitly (if using redis:// URL)
REDIS_TLS=true
```

### Connection URL Formats

#### Standard Connection (No TLS)
```bash
REDIS_URL=redis://localhost:6379
```

#### TLS Connection (Recommended for Production)
```bash
# Use rediss:// protocol for TLS
REDIS_URL=rediss://your-redis-host:6380

# Or use redis:// with REDIS_TLS=true
REDIS_URL=redis://your-redis-host:6380
REDIS_TLS=true
```

#### With Password Authentication
```bash
# Password in URL
REDIS_URL=redis://:password@host:6379
REDIS_URL=rediss://:password@host:6380

# Or separate password variable
REDIS_URL=rediss://host:6380
REDIS_PASSWORD=your-secure-password
```

## TLS Configuration

### Automatic TLS Detection

The bot automatically enables TLS if:
1. Redis URL uses `rediss://` protocol, OR
2. `REDIS_TLS=true` environment variable is set

### Certificate Validation

- **Production:** Certificate validation is enabled (`rejectUnauthorized: true`)
- **Development:** Certificate validation can be disabled for self-signed certificates

To disable certificate validation (development only):
```bash
NODE_ENV=development
```

**⚠️ Warning:** Never disable certificate validation in production!

## Authentication

### Password Authentication

Passwords can be provided in two ways:

1. **In URL (recommended for simple setups):**
   ```bash
   REDIS_URL=rediss://:password@host:6380
   ```

2. **Separate environment variable (recommended for security):**
   ```bash
   REDIS_URL=rediss://host:6380
   REDIS_PASSWORD=your-secure-password
   ```

### Redis ACL (Advanced)

For Redis 6.0+, you can use ACL (Access Control Lists) for more granular access control. Configure ACL users in your Redis server configuration.

## Provider-Specific Setup

### Upstash Redis

Upstash automatically provides TLS connections:

```bash
# Upstash provides rediss:// URL with password
REDIS_URL=rediss://default:password@host.upstash.io:6380
```

### Redis Cloud

Redis Cloud supports TLS:

```bash
# Use the TLS endpoint provided by Redis Cloud
REDIS_URL=rediss://default:password@host.redis.cloud:6380
```

### Self-Hosted Redis

For self-hosted Redis, enable TLS:

1. **Generate certificates:**
   ```bash
   # Create certificates directory
   mkdir -p /etc/redis/tls
   
   # Generate self-signed certificate (development)
   openssl req -x509 -newkey rsa:4096 -nodes \
     -keyout /etc/redis/tls/redis.key \
     -out /etc/redis/tls/redis.crt \
     -days 365
   ```

2. **Configure Redis (`redis.conf`):**
   ```conf
   # Enable TLS
   port 0
   tls-port 6380
   tls-cert-file /etc/redis/tls/redis.crt
   tls-key-file /etc/redis/tls/redis.key
   tls-ca-cert-file /etc/redis/tls/redis.crt
   
   # Require authentication
   requirepass your-secure-password
   ```

3. **Update bot configuration:**
   ```bash
   REDIS_URL=rediss://:your-secure-password@your-redis-host:6380
   ```

## Security Best Practices

### 1. Use TLS in Production

Always use `rediss://` or enable `REDIS_TLS=true` in production environments.

### 2. Strong Passwords

Use strong, randomly generated passwords:
```bash
# Generate secure password
openssl rand -base64 32
```

### 3. Environment Variables

Never commit passwords to version control. Use:
- `.env` files (not committed)
- Environment variable injection (CI/CD)
- Secret management services

### 4. Network Security

- Use private networks/VPNs when possible
- Restrict Redis port access via firewall
- Use Redis ACL for fine-grained access control

### 5. Certificate Management

- Use valid SSL certificates in production
- Rotate certificates regularly
- Monitor certificate expiration

## Testing Secure Connections

### Verify TLS Connection

Check logs for TLS confirmation:
```
Redis client connected
Redis TLS enabled
Redis password authentication enabled
Redis client ready
```

### Test Connection

```bash
# Test Redis connection
npm run dev

# Check logs for:
# - "Redis TLS enabled" (if using TLS)
# - "Redis password authentication enabled" (if password set)
# - "Redis client ready" (connection successful)
```

## Troubleshooting

### TLS Connection Failed

**Error:** `ECONNREFUSED` or `ETIMEDOUT`

**Solutions:**
1. Verify Redis server has TLS enabled
2. Check firewall rules for TLS port (usually 6380)
3. Verify certificate is valid
4. Check `REDIS_TLS=true` if using `redis://` URL

### Authentication Failed

**Error:** `NOAUTH Authentication required` or `WRONGPASS`

**Solutions:**
1. Verify password is correct
2. Check password is in URL or `REDIS_PASSWORD` env var
3. Verify Redis server has `requirepass` configured
4. Check for URL encoding issues in password

### Certificate Validation Failed

**Error:** `UNABLE_TO_VERIFY_LEAF_SIGNATURE` or `CERT_HAS_EXPIRED`

**Solutions:**
1. Use valid SSL certificate
2. For development: Set `NODE_ENV=development` (not recommended for production)
3. Update expired certificates
4. Verify certificate chain is complete

## Migration Guide

### From Non-Secure to Secure Redis

1. **Enable TLS on Redis server**
2. **Update Redis URL:**
   ```bash
   # Before
   REDIS_URL=redis://host:6379
   
   # After
   REDIS_URL=rediss://host:6380
   ```

3. **Add password (if needed):**
   ```bash
   REDIS_PASSWORD=your-secure-password
   ```

4. **Restart bot:**
   ```bash
   npm run start
   ```

5. **Verify connection in logs**

## Additional Resources

- [ioredis TLS Documentation](https://github.com/redis/ioredis#tls-options)
- [Redis Security Guide](https://redis.io/docs/management/security/)
- [Redis TLS Configuration](https://redis.io/docs/management/security/encryption/)

---

**Last Updated:** December 2024 (Copyright © 2025)  
**Related:** S-9: Redis Security

## Legal Notice

**This is a fan-made tool and is not affiliated with or endorsed by Square Enix Co., Ltd. FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**

