# Deployment Guide - StockAlert Slack App

This guide walks you through deploying the StockAlert Slack App to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Slack App**: Create a new app at [api.slack.com/apps](https://api.slack.com/apps)
3. **StockAlert.pro Account**: Get your API key from the dashboard
4. **Vercel CLI**: Install with `npm i -g vercel`

## Quick Start

1. Fork the repository
2. Import to Vercel
3. Follow the setup steps below

## Manual Setup

### 1. Connect to Vercel

```bash
vercel link
```

### 2. Add Storage Services

#### Vercel Postgres

1. Go to your Vercel dashboard
2. Navigate to Storage → Create Database → Postgres
3. Connect to your project
4. The environment variables will be added automatically

#### Vercel KV

1. Go to your Vercel dashboard
2. Navigate to Storage → Create Database → KV
3. Connect to your project
4. The environment variables will be added automatically

### 3. Set Environment Variables

Add these secrets in Vercel dashboard or via CLI:

```bash
# Slack credentials
vercel env add SLACK_BOT_TOKEN production
vercel env add SLACK_SIGNING_SECRET production
vercel env add SLACK_APP_TOKEN production
vercel env add SLACK_CLIENT_ID production
vercel env add SLACK_CLIENT_SECRET production

# App configuration
vercel env add BASE_URL production  # e.g., https://your-app.vercel.app

# Optional
vercel env add SLACK_REDIRECT_URI production  # defaults to https://your-domain/api/slack/oauth
```

### 4. Deploy

```bash
vercel --prod
```

### 5. Run Database Migrations

After deployment, run migrations:

```bash
npm run db:push
```

## Post-Deployment Configuration

### 1. Update Slack App Settings

In your Slack app settings (api.slack.com):

1. **OAuth & Permissions**:
   - Redirect URL: `https://your-domain.vercel.app/api/slack/oauth`
   - Scopes: `chat:write`, `chat:write.public`, `commands`, `channels:read`, `groups:read`, `im:write`

2. **Slash Commands**:
   - Command: `/stockalert`
   - Request URL: `https://your-domain.vercel.app/api/slack/commands`

3. **Install App**:
   - Visit: `https://your-domain.vercel.app/api/slack/install`

### 2. Configure StockAlert.pro

The webhook configuration is automated! After installation:

1. In Slack, use `/stockalert apikey sk_your_api_key`
2. The webhook will be automatically created
3. Your team-specific webhook URL: `https://your-domain.vercel.app/api/webhooks/{teamId}/stockalert`

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ StockAlert.pro  │────▶│  Vercel Edge    │────▶│   Slack API     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │       │
                              ▼       ▼
                        ┌──────────┐ ┌────────┐
                        │ Postgres │ │   KV   │
                        └──────────┘ └────────┘
```

## Security Features

- ✅ **Webhook Signature Verification**: All webhooks verified with HMAC-SHA256
- ✅ **OAuth State Validation**: Prevents CSRF attacks
- ✅ **Rate Limiting**: Protects against abuse
  - Webhooks: 100/minute per team
  - OAuth: 5 attempts per 15 minutes
  - Commands: 30/minute per user
- ✅ **Database-backed Sessions**: Secure token storage

## Monitoring

### Health Check

```bash
curl https://your-domain.vercel.app/api/health
```

### Logs

View logs in Vercel dashboard or via CLI:

```bash
vercel logs
```

## Troubleshooting

### Database Connection Issues

- Ensure Postgres is properly connected in Vercel dashboard
- Check that all POSTGRES\_\* env vars are set

### Rate Limiting Not Working

- Verify KV storage is connected
- Check that all KV\_\* env vars are set

### Slack Commands Not Working

- Verify signing secret is correct
- Check request URL in Slack app settings
- Ensure slash command is enabled

## Scaling

The app automatically scales with Vercel's infrastructure:

- **Edge Functions**: Global distribution
- **Database Pooling**: Automatic connection management
- **KV Storage**: Distributed rate limiting

## Support

- Issues: [GitHub Issues](https://github.com/stockalert-pro/stockalert-slack-app/issues)
- Documentation: [StockAlert.pro Docs](https://stockalert.pro/docs)
