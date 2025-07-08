# Storage Setup Guide

This guide covers setting up the required storage services for the StockAlert Slack App.

## Option 1: Neon PostgreSQL (Recommended)

1. **Create a Neon Account**: https://neon.tech
2. **Create a new database**
3. **Copy the connection URL**
4. **In Vercel**: Add the URL as `POSTGRES_URL`

### Environment Variables for Neon:

```
POSTGRES_URL=postgresql://user:pass@host/dbname?sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://user:pass@host/dbname?sslmode=require
```

## Option 2: Upstash Redis (for Rate Limiting)

1. **Create an Upstash Account**: https://upstash.com
2. **Create a Redis Database**
3. **Copy the credentials**
4. **In Vercel**: Add the credentials

### Environment Variables for Upstash:

```
KV_URL=redis://default:password@host:port
KV_REST_API_URL=https://your-endpoint.upstash.io
KV_REST_API_TOKEN=your-token
KV_REST_API_READ_ONLY_TOKEN=your-read-only-token
```

## Alternative: Vercel Edge Config (for simple Rate Limiting)

For simpler setup, you can use Edge Config for rate limiting:

1. In Vercel Dashboard: Storage → Create → Edge Config
2. Name: `rate-limits`
3. It will be automatically connected

## Minimal Setup (Postgres only)

For initial deployment, Neon Postgres is sufficient. Rate limiting can be added later.

### Steps:

1. Create Neon account
2. Create database
3. Add connection string in Vercel as `POSTGRES_URL`
4. Deploy!
