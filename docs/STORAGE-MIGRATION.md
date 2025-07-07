# Storage Setup Guide - Updated for 2025

Vercel hat Postgres und KV zu externen Partnern migriert. Hier ist die neue Setup-Anleitung:

## Option 1: Neon PostgreSQL (Empfohlen)

1. **Erstelle einen Neon Account**: https://neon.tech
2. **Erstelle eine neue Datenbank**
3. **Kopiere die Connection URL**
4. **In Vercel**: Füge die URL als `POSTGRES_URL` hinzu

### Environment Variables für Neon:
```
POSTGRES_URL=postgresql://user:pass@host/dbname?sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://user:pass@host/dbname?sslmode=require
```

## Option 2: Upstash Redis (für Rate Limiting)

1. **Erstelle einen Upstash Account**: https://upstash.com
2. **Erstelle eine Redis Database**
3. **Kopiere die Credentials**
4. **In Vercel**: Füge die Credentials hinzu

### Environment Variables für Upstash:
```
KV_URL=redis://default:password@host:port
KV_REST_API_URL=https://your-endpoint.upstash.io
KV_REST_API_TOKEN=your-token
KV_REST_API_READ_ONLY_TOKEN=your-read-only-token
```

## Alternative: Vercel Edge Config (für einfaches Rate Limiting)

Für einfacheres Setup können wir Edge Config für Rate Limiting nutzen:

1. In Vercel Dashboard: Storage → Create → Edge Config
2. Name: `rate-limits`
3. Das wird automatisch verbunden

## Minimale Setup (nur Postgres)

Für den Start reicht Neon Postgres. Rate Limiting kann später hinzugefügt werden.

### Schritte:
1. Neon Account erstellen
2. Datenbank erstellen
3. Connection String in Vercel als `POSTGRES_URL` hinzufügen
4. Deploy!