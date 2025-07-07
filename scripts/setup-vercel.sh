#!/bin/bash

echo "🚀 StockAlert Slack App - Vercel Setup"
echo "======================================"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Please install it first:"
    echo "   npm i -g vercel"
    exit 1
fi

echo "This script will help you set up the StockAlert Slack App on Vercel."
echo ""
echo "Prerequisites:"
echo "1. A Vercel account"
echo "2. A Slack App created at https://api.slack.com/apps"
echo "3. Your StockAlert.pro webhook secret"
echo ""
echo "Press Enter to continue..."
read

# Link to Vercel project
echo "📎 Linking to Vercel project..."
vercel link

# Add Postgres storage
echo ""
echo "🗄️  Adding Vercel Postgres storage..."
echo "Run this command in your Vercel dashboard or CLI:"
echo "vercel env add POSTGRES_URL"
echo "vercel env add POSTGRES_URL_NON_POOLING"
echo ""
echo "Press Enter after adding Postgres..."
read

# Add KV storage
echo "🔑 Adding Vercel KV storage for rate limiting..."
echo "Run this command in your Vercel dashboard or CLI:"
echo "vercel env add KV_URL"
echo "vercel env add KV_REST_API_URL"
echo "vercel env add KV_REST_API_TOKEN"
echo "vercel env add KV_REST_API_READ_ONLY_TOKEN"
echo ""
echo "Press Enter after adding KV..."
read

# Set up environment variables
echo ""
echo "🔐 Setting up environment variables..."
echo ""

# Slack credentials
echo "Enter your Slack Bot Token (xoxb-...):"
read -s SLACK_BOT_TOKEN
vercel env add SLACK_BOT_TOKEN production < <(echo "$SLACK_BOT_TOKEN")

echo "Enter your Slack Signing Secret:"
read -s SLACK_SIGNING_SECRET
vercel env add SLACK_SIGNING_SECRET production < <(echo "$SLACK_SIGNING_SECRET")

echo "Enter your Slack App Token (xapp-...):"
read -s SLACK_APP_TOKEN
vercel env add SLACK_APP_TOKEN production < <(echo "$SLACK_APP_TOKEN")

echo "Enter your Slack Client ID:"
read SLACK_CLIENT_ID
vercel env add SLACK_CLIENT_ID production < <(echo "$SLACK_CLIENT_ID")

echo "Enter your Slack Client Secret:"
read -s SLACK_CLIENT_SECRET
vercel env add SLACK_CLIENT_SECRET production < <(echo "$SLACK_CLIENT_SECRET")

# StockAlert credentials
echo "Enter your StockAlert Webhook Secret:"
read -s STOCKALERT_WEBHOOK_SECRET
vercel env add STOCKALERT_WEBHOOK_SECRET production < <(echo "$STOCKALERT_WEBHOOK_SECRET")

# Deploy
echo ""
echo "🚀 Deploying to Vercel..."
vercel --prod

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run database migrations: npm run db:push"
echo "2. Update your Slack App settings:"
echo "   - OAuth Redirect URL: https://your-domain.vercel.app/api/slack/oauth"
echo "   - Slash Commands URL: https://your-domain.vercel.app/api/slack/commands"
echo "3. Configure webhooks in StockAlert.pro:"
echo "   - Webhook URL: https://your-domain.vercel.app/api/webhooks/{teamId}/stockalert"
echo ""