# Vercel Deployment Guide

This guide explains how to deploy the StockAlert.pro Slack App on Vercel.

## Prerequisites

1. Vercel account
2. Slack App created at [api.slack.com/apps](https://api.slack.com/apps)
3. StockAlert.pro webhook secret

## Setup Steps

### 1. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create new app "From scratch"
3. Name: `StockAlert.pro`
4. Configure OAuth & Permissions:
   - Redirect URL: `https://your-app.vercel.app/api/slack/oauth`
   - Bot Token Scopes: `chat:write`, `chat:write.public`, `commands`, `channels:read`, `groups:read`
5. Create Slash Command:
   - Command: `/stockalert`
   - Request URL: `https://your-app.vercel.app/api/slack/commands`
   - Description: `Manage StockAlert notifications`

### 2. Deploy to Vercel

```bash
# Clone repository
git clone https://github.com/stockalert-pro/slack-app.git
cd slack-app

# Deploy with Vercel CLI
vercel

# Set environment variables
vercel env add SLACK_CLIENT_ID
vercel env add SLACK_CLIENT_SECRET
vercel env add SLACK_SIGNING_SECRET
vercel env add STOCKALERT_WEBHOOK_SECRET
vercel env add DEFAULT_SLACK_CHANNEL

# Deploy to production
vercel --prod
```

### 3. Environment Variables

| Variable | Description | Where to find |
|----------|-------------|---------------|
| `SLACK_CLIENT_ID` | Slack app client ID | Basic Information → App Credentials |
| `SLACK_CLIENT_SECRET` | Slack app client secret | Basic Information → App Credentials |
| `SLACK_SIGNING_SECRET` | For verifying Slack requests | Basic Information → App Credentials |
| `STOCKALERT_WEBHOOK_SECRET` | For verifying StockAlert webhooks | StockAlert.pro Dashboard |
| `DEFAULT_SLACK_CHANNEL` | Default channel for notifications | Your choice (e.g., `#general`) |

### 4. Configure StockAlert.pro

1. Go to [StockAlert.pro Dashboard](https://stockalert.pro/dashboard/settings)
2. Add webhook endpoint: `https://your-app.vercel.app/api/webhooks/stockalert`
3. Select events: `alert.triggered`
4. Copy webhook secret to Vercel env

### 5. Update Slack App URLs

After deployment, update these URLs in your Slack app settings:

- OAuth Redirect URL: `https://your-app.vercel.app/api/slack/oauth`
- Slash Command URL: `https://your-app.vercel.app/api/slack/commands`
- Install URL: `https://your-app.vercel.app/slack/install`

## Testing

1. Visit `https://your-app.vercel.app`
2. Click "Add to Slack"
3. Authorize the app
4. In Slack, type `/stockalert test`

## Architecture

```
/api
  /slack
    /commands.ts    # Slash command handler
    /install.ts     # OAuth install flow
    /oauth.ts       # OAuth callback
  /webhooks
    /stockalert.ts  # Webhook receiver
/lib
  /handlers        # Command logic
  /types          # TypeScript types
  *.ts            # Utilities
/public
  index.html      # Landing page
  *.html          # Success/error pages
```

## Limitations

- Installation data is stored in memory (add database for production)
- No rate limiting implemented
- Basic error handling

## Next Steps

1. Add database for storing installations (Vercel KV, Supabase, etc.)
2. Implement rate limiting
3. Add monitoring and logging
4. Submit to Slack App Directory

## Support

- Documentation: [stockalert.pro/api/docs](https://stockalert.pro/api/docs)
- GitHub: [github.com/stockalert-pro/slack-app](https://github.com/stockalert-pro/slack-app)
- Email: support@stockalert.pro