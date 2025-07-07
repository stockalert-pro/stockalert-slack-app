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
1. StockAlert.pro sends webhook to `/api/webhooks/stockalert`
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
Webhooks from StockAlert.pro must include `X-Signature` header with format `sha256=<signature>`. Verification uses HMAC-SHA256 with `STOCKALERT_WEBHOOK_SECRET`.

### Slack Request Verification
All Slack requests verified using `SLACK_SIGNING_SECRET`. Use `verifySlackRequest()` from `lib/slack-verify.ts`.

### Message Formatting
Rich Slack messages created in `lib/formatter.ts`. Always use Block Kit format, not plain text. Include:
- Alert type badge with emoji
- Stock symbol and price information
- Price change calculations
- Action buttons for dashboard access

### Environment Variables Required
- `SLACK_BOT_TOKEN` - Bot OAuth token (xoxb-...)
- `SLACK_SIGNING_SECRET` - For request verification
- `SLACK_APP_TOKEN` - App-level token (xapp-...)
- `STOCKALERT_WEBHOOK_SECRET` - For webhook verification

## Production-Ready Features

**Database Integration**: Uses Vercel Postgres for persistent storage of installations, channels, and webhook events.

**Multi-Tenant Support**: Each Slack workspace has its own webhook URL: `/api/webhooks/{teamId}/stockalert`

**Rate Limiting**: Implemented using Vercel KV:
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

For manual testing with curl, see `scripts/test-webhook.sh` for the required payload format and headers.

## StockAlert.pro Webhook Events

Only `alert.triggered` events are processed. Webhook payload structure:
- `type`: Event type (must be "alert.triggered")
- `event_id`: Unique event identifier
- `triggered_at`: ISO timestamp
- `data`: Alert details (symbol, condition, threshold, current_value, etc.)

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
2. Add handling logic in `/api/webhooks/stockalert.ts`
3. Create appropriate formatter function