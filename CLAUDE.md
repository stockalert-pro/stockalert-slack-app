# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StockAlert Slack App - A TypeScript-based Slack integration for receiving stock alert notifications from StockAlert.pro. Built for serverless deployment on Vercel with support for traditional Node.js deployment.

## Essential Commands

### Development
```bash
npm run dev              # Start development server with hot reload
npm run test:webhook     # Test webhook integration locally
```

### Code Quality - Run these before committing
```bash
npm run lint            # Check ESLint rules
npm run lint:fix        # Auto-fix linting issues
npm run typecheck       # TypeScript type checking
npm test                # Run test suite
```

### Building & Deployment
```bash
npm run build           # Build for production (creates dist/)
npm start              # Run production build
```

## Architecture Overview

### Webhook Processing Flow
1. StockAlert.pro sends webhook to `/api/webhooks/{teamId}/stockalert`
2. Webhook signature verified using HMAC-SHA256
3. Payload validated with Zod schema (`AlertEvent`)
4. Message formatted using Slack Block Kit
5. Posted to configured Slack channel

### Key Architectural Patterns

**Type-Driven Development**: All data structures defined in `lib/types.ts` with Zod schemas for runtime validation.

**Configuration-Based Alert Types**: Alert types and their display properties (emoji, color, description) are centralized in `ALERT_TYPE_CONFIG`.

**Serverless-First Design**: API routes in `/api` directory are Vercel serverless functions. Shared code lives in `/lib`.

**Security Layer**: All webhooks verified with `verifyWebhookSignature()` before processing.

### Directory Structure
- `/api/*` - Vercel serverless functions (webhook handlers, Slack endpoints)
- `/lib/*` - Shared utilities (formatter, Slack client, verification, types)
- `/src/*` - Traditional Node.js server implementation (alternative to Vercel)

## Critical Implementation Details

### Webhook Signature Verification
Webhooks from StockAlert.pro must include `X-Signature` header with format `sha256=<signature>`. Verification uses HMAC-SHA256 with team-specific webhook secrets stored in the database.

### Slack Request Verification
All Slack requests verified using `SLACK_SIGNING_SECRET`. Use `verifySlackRequest()` from `lib/slack-verify.ts`.

### Message Formatting
Rich Slack messages created in `lib/formatter.ts`. Always use Block Kit format, not plain text. Include:
- Alert type badge with emoji
- Stock symbol and price information
- Price change calculations
- Action buttons for dashboard access

### Environment Variables Required
- `SLACK_CLIENT_ID` - Slack OAuth client ID
- `SLACK_CLIENT_SECRET` - Slack OAuth client secret
- `SLACK_SIGNING_SECRET` - For request verification
- `POSTGRES_URL` - Database connection string
- `BASE_URL` - Your app's base URL

## Production-Ready Features

**Database Integration**: Uses PostgreSQL (Neon recommended) for persistent storage of installations, channels, and webhook events.

**Multi-Tenant Support**: Each Slack workspace has its own webhook URL: `/api/webhooks/{teamId}/stockalert`

**Rate Limiting**: Can be implemented using Redis/Upstash KV (optional):
- Webhooks: 100/minute per team
- OAuth: 5 attempts per 15 minutes
- Commands: 30/minute per user

**OAuth Security**: State parameter validation with 10-minute expiry to prevent CSRF attacks.

**Idempotency**: Webhook events are deduplicated using event_id to prevent duplicate processing.

## Testing Webhooks

Use the test script to simulate webhooks:
```bash
npm run test:webhook
```

For manual testing, the test script shows the required payload format and headers.

## StockAlert.pro Webhook Events

Only `alert.triggered` events are processed. Webhook payload structure:
- `type`: Event type (must be "alert.triggered")
- `event_id`: Unique event identifier
- `triggered_at`: ISO timestamp
- `data`: Alert details (symbol, condition, threshold, current_value, etc.)

### Important Webhook Field Mappings

**Understanding threshold vs actual values**:
- `threshold`: The alert configuration value (e.g., "notify 7 days before")
- `current_value`: Often contains the actual metric value
- Alert-specific fields: Use these for accurate display

**Key mappings by alert type**:
- **Price Change**: Use `price_change_percentage` not `threshold`
- **Volume**: Use `volume_change_percentage` and `volume`/`average_volume`
- **MA Crossover**: Use `ma50`/`ma200` fields
- **RSI**: Use `rsi` field and `comparison` direction
- **Earnings**: Use `days_until_earnings` not `current_value`
- **Dividends**: Use `days_until_ex_date`/`days_until_payment`
- **52-Week**: Use `week_52_high`/`week_52_low` and `previous_high`/`previous_low`

**Nullable fields**:
- `threshold` can be null for reminders and daily updates
- `price` may be undefined for some alert types
- Many alert-specific fields are optional

## Adding New Features

### New Alert Type
1. Add to `ALERT_TYPE_CONFIG` in `lib/types.ts`
2. Update message formatting logic if needed

### New Slash Command
1. Add handler in `lib/handlers/commands.ts`
2. Update help text in the same file
3. Register command in Slack app configuration

### New Webhook Event Type
1. Update `AlertEvent` schema in `lib/types.ts`
2. Add handling logic in `/api/webhooks/[teamId]/stockalert.ts`
3. Create appropriate formatter function

## Common Debugging Tips

### Webhook Validation Errors
- Check if fields are nullable in the schema (e.g., `threshold` for reminders)
- Verify field types match webhook documentation
- Use `npm run test:webhook` to test payloads locally

### Alert Display Issues
- Always check which field contains the actual value vs configuration
- Look for alert-specific fields before falling back to generic ones
- Test with real webhook payloads, not assumptions

### Testing Approach
```typescript
// Quick test for any alert type
import { formatSlackAlert } from './lib/slack-formatter';
const result = formatSlackAlert(testPayload);
console.log(result.blocks[0]); // Check header
console.log(result.blocks[1]); // Check fields
```