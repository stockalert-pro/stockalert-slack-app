#!/bin/bash

echo "🗄️  Running database migrations on Vercel..."
echo ""

# Load environment variables from Vercel
echo "Loading Vercel environment..."
vercel env pull .env.production

# Run migrations
echo "Running migrations..."
POSTGRES_URL=$(grep POSTGRES_URL .env.production | cut -d '=' -f2-) npm run db:push

# Clean up
rm .env.production

echo ""
echo "✅ Database migrations complete!"
echo ""
echo "Next steps:"
echo "1. Update Slack App URLs in api.slack.com"
echo "2. Test the installation flow"
echo "3. Configure StockAlert.pro webhooks"