# StockAlert.pro Slack App

Official Slack app for receiving [StockAlert.pro](https://stockalert.pro) webhook notifications in your Slack workspace.

## Features

- 🔔 Real-time alert notifications in Slack channels
- 🎨 Rich message formatting with stock information
- 🔒 Secure webhook signature verification
- 📊 Support for all StockAlert.pro alert types
- ⚡ High-performance webhook processing

## Installation

### Option 1: Deploy to Your Server

1. Clone the repository:
```bash
git clone https://github.com/stockalert-pro/slack-app.git
cd slack-app
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```env
# Slack App Credentials
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# StockAlert.pro Configuration
STOCKALERT_WEBHOOK_SECRET=your-webhook-secret

# Server Configuration
PORT=3000
NODE_ENV=production
```

4. Build and start:
```bash
npm run build
npm start
```

### Option 2: Use Our Hosted Version

Coming soon! We're working on a hosted version that you can install directly from the Slack App Directory.

## Slack App Setup

1. Create a new Slack app at [api.slack.com/apps](https://api.slack.com/apps)

2. Configure OAuth & Permissions:
   - Add Bot Token Scopes:
     - `chat:write`
     - `chat:write.public`
     - `channels:read`
     - `groups:read`

3. Enable Socket Mode:
   - Go to "Socket Mode" in the sidebar
   - Enable Socket Mode
   - Generate an App-Level Token with `connections:write` scope

4. Install the app to your workspace

5. Copy your credentials to the `.env` file

## StockAlert.pro Configuration

1. Get your webhook secret from [StockAlert.pro Dashboard](https://stockalert.pro/dashboard/settings)

2. Configure webhook endpoint:
   ```
   https://your-domain.com/webhooks/stockalert
   ```

3. Select the events you want to receive:
   - `alert.triggered`
   - `alert.created`
   - `alert.updated`
   - `alert.deleted`

## Usage

### Basic Setup

Once installed, the app will automatically post alerts to the channel where it's invited:

```
/invite @StockAlert
```

### Slash Commands

- `/stockalert help` - Show available commands
- `/stockalert channel #channel-name` - Set default notification channel
- `/stockalert test` - Send a test notification

### Message Format

Alerts are posted with rich formatting:

```
🚨 AAPL Alert Triggered

Apple Inc. has reached your price target!

Target: $200.00
Current: $201.50 (+0.75%)

View Dashboard → | Manage Alert →
```

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

### Testing Webhooks

Use our test script to simulate webhook events:

```bash
npm run test:webhook
```

Or use curl:

```bash
curl -X POST http://localhost:3000/webhooks/stockalert \
  -H "Content-Type: application/json" \
  -H "X-StockAlert-Signature: sha256=..." \
  -H "X-StockAlert-Event: alert.triggered" \
  -d '{
    "id": "evt_123",
    "type": "alert.triggered",
    "data": {
      "alert": {
        "id": "alert_456",
        "symbol": "AAPL",
        "company_name": "Apple Inc.",
        "condition": "price_above",
        "threshold": 200,
        "triggered_value": 201.50
      }
    }
  }'
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### PM2

```bash
pm2 start dist/index.js --name stockalert-slack
pm2 save
pm2 startup
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SLACK_BOT_TOKEN` | Bot User OAuth Token | Yes |
| `SLACK_SIGNING_SECRET` | Slack app signing secret | Yes |
| `SLACK_APP_TOKEN` | App-level token for Socket Mode | Yes |
| `STOCKALERT_WEBHOOK_SECRET` | Webhook secret from StockAlert.pro | Yes |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `DEFAULT_CHANNEL` | Default Slack channel for notifications | No |

## Security

- All webhooks are verified using HMAC-SHA256 signatures
- Slack requests are verified using signing secrets
- No sensitive data is logged
- All external URLs use HTTPS

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## Support

- 📧 Email: support@stockalert.pro
- 💬 GitHub Discussions: [github.com/stockalert-pro/slack-app/discussions](https://github.com/stockalert-pro/slack-app/discussions)
- 🐛 Issues: [github.com/stockalert-pro/slack-app/issues](https://github.com/stockalert-pro/slack-app/issues)

## License

MIT - see [LICENSE](LICENSE) for details.