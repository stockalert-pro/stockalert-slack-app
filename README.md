# StockAlert.pro Slack App

Get real-time stock market alerts directly in your Slack workspace. Powered by [StockAlert.pro](https://stockalert.pro).

🚀 **[Add to Slack](https://slack.stockalert.pro)**

## Features

- 📊 **21 Alert Types** - Price targets, moving averages, RSI, volume, dividends, earnings, and more
- ⚡ **Real-time Notifications** - Get alerts instantly when your conditions trigger
- 🎨 **Rich Formatting** - Beautiful Slack messages with price changes and action buttons
- 🔒 **Secure** - HMAC-SHA256 webhook verification and OAuth 2.0
- 👥 **Multi-Workspace** - Install on unlimited Slack workspaces

## Installation

### Quick Install (Recommended)

1. Visit [slack.stockalert.pro](https://slack.stockalert.pro)
2. Click "Add to Slack"
3. Choose a channel for alerts
4. Start receiving alerts!

### Manual Setup

If you prefer to self-host:

1. **Clone the repository**
   ```bash
   git clone https://github.com/stockalert-pro/stockalert-slack-app.git
   cd stockalert-slack-app
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Deploy to Vercel**
   ```bash
   npm install -g vercel
   vercel
   ```

## Usage

### Slash Commands

Once installed, use these commands in any channel:

- `/stockalert` - Show current webhook URL and status
- `/stockalert help` - Display available commands
- `/stockalert channel #alerts` - Set default alert channel

### Setting Up Alerts

1. Run `/stockalert status` in Slack to get your webhook credentials
2. Log in to [StockAlert.pro](https://stockalert.pro)
3. Go to Settings → Integrations → Slack
4. Enter your webhook URL and secret from step 1
5. Create alerts and they'll appear in Slack!

### Alert Format

Alerts appear as rich Slack messages:

```
📈 AAPL Alert: Price went above target

**Apple Inc.**
Price went above target

Target: $150.00
Current: $151.25 +0.83%

[View Dashboard] [Manage Alert]
```

## Technical Details

### Architecture

- **Hosting**: Vercel Functions (Serverless)
- **Database**: Neon PostgreSQL with Drizzle ORM
- **Authentication**: Slack OAuth 2.0
- **Security**: HMAC-SHA256 webhook signatures with team-specific secrets

### API Endpoints

- `GET /` - Landing page
- `GET /api/slack/install` - OAuth installation flow
- `GET /api/slack/oauth` - OAuth callback
- `POST /api/slack/commands` - Slash command handler
- `POST /api/webhooks/:teamId/stockalert` - Webhook receiver

### Database Schema

```sql
-- Slack installations
CREATE TABLE slack_installations (
  id SERIAL PRIMARY KEY,
  team_id TEXT UNIQUE NOT NULL,
  team_name TEXT NOT NULL,
  bot_token TEXT NOT NULL,
  bot_user_id TEXT NOT NULL,
  default_channel TEXT,
  webhook_url TEXT,
  installed_at TIMESTAMP DEFAULT NOW()
);

-- OAuth states for security
CREATE TABLE oauth_states (
  state TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Webhook events for idempotency
CREATE TABLE webhook_events (
  event_id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW()
);
```

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL (or Neon account)
- Slack App credentials
- StockAlert.pro webhook secret

### Local Development

```bash
# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# Run tests
npm test
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SLACK_CLIENT_ID` | Slack OAuth client ID | Yes |
| `SLACK_CLIENT_SECRET` | Slack OAuth client secret | Yes |
| `SLACK_SIGNING_SECRET` | Slack request verification | Yes |
| `STOCKALERT_WEBHOOK_SECRET` | Webhook signature verification | Yes |
| `POSTGRES_URL` | Database connection string | Yes |
| `BASE_URL` | Your app's base URL | Yes |

## Deployment

### Vercel (Recommended)

1. Fork this repository
2. Import to Vercel
3. Add environment variables
4. Deploy!

### Docker

```bash
docker build -t stockalert-slack .
docker run -p 3000:3000 --env-file .env stockalert-slack
```

## Security

- ✅ All webhooks verified with HMAC-SHA256
- ✅ Slack requests verified with signing secret
- ✅ OAuth state parameter prevents CSRF
- ✅ Database credentials encrypted
- ✅ No sensitive data in logs

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

## Support

- 📧 Email: support@stockalert.pro
- 🐛 Issues: [GitHub Issues](https://github.com/stockalert-pro/stockalert-slack-app/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/stockalert-pro/stockalert-slack-app/discussions)

## License

MIT - see [LICENSE](LICENSE) for details.

---

Made with ❤️ by [StockAlert.pro](https://stockalert.pro)