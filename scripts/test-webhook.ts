#!/usr/bin/env tsx

import * as crypto from 'crypto';
import { db } from '../lib/db';
import { installations } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

// Configuration - now with team ID support
const TEAM_ID = process.env['TEAM_ID'] || 'T1234567890';
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';
const WEBHOOK_URL = process.env['WEBHOOK_URL'] || `${BASE_URL}/api/webhooks/${TEAM_ID}/stockalert`;
const WEBHOOK_SECRET =
  process.env['WEBHOOK_SECRET'] || process.env['STOCKALERT_WEBHOOK_SECRET'] || null;

// Helper function to create different alert payloads
function createAlertPayload(type: string = 'price_above') {
  const basePayload = {
    event: 'alert.triggered' as const,
    timestamp: new Date().toISOString(),
    data: {
      alert_id: `alert_test_${Date.now()}`,
      symbol: 'AAPL',
      company_name: 'Apple Inc.',
      triggered_at: new Date().toISOString(),
      reason: 'Alert condition met',
      parameters: null,
    },
  };

  // Add type-specific fields based on OpenAPI spec
  switch (type) {
    case 'forward_pe_below':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          condition: 'forward_pe_below',
          threshold: 25.0,
          current_value: 222.59, // This is the stock price
          price: 222.59,
          forward_pe: 22.5, // This is the actual Forward P/E ratio
        },
      };

    case 'pe_ratio_above':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          condition: 'pe_ratio_above',
          threshold: 30.0,
          current_value: 205.5, // Stock price
          price: 205.5,
          pe_ratio: 32.5, // Actual P/E ratio
        },
      };

    case 'price_above':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          condition: 'price_above',
          threshold: 200.0,
          current_value: 205.5,
          price: 205.5,
        },
      };

    case 'price_change_up':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          symbol: 'GOOGL',
          condition: 'price_change_up',
          threshold: 5.0, // 5% increase threshold
          current_value: 7.2, // Actual percentage increase
          price: 142.8,
        },
      };

    case 'price_change_down':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          symbol: 'AMZN',
          condition: 'price_change_down',
          threshold: 3.0, // 3% drop threshold
          current_value: -5.5, // Actual percentage drop (negative)
          price: 178.5,
        },
      };

    case 'rsi_limit':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          condition: 'rsi_limit',
          threshold: 70.0,
          current_value: 72.5, // RSI value
          price: 205.5,
          parameters: { direction: 'above' },
        },
      };

    case 'new_high':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          symbol: 'NVDA',
          condition: 'new_high',
          threshold: 0, // Not used for 52-week alerts
          current_value: 850.0, // Current price at new high
          price: 850.0,
        },
      };

    case 'new_low':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          symbol: 'META',
          condition: 'new_low',
          threshold: 0, // Not used for 52-week alerts
          current_value: 450.0, // Current price at new low
          price: 450.0,
        },
      };

    case 'ma_crossover_golden':
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          condition: 'ma_crossover_golden',
          threshold: 0, // Not used for crossovers
          current_value: 205.5,
          price: 205.5,
          parameters: { short_period: 50, long_period: 200 },
        },
      };

    default:
      return {
        ...basePayload,
        data: {
          ...basePayload.data,
          condition: type,
          threshold: 200.0,
          current_value: 205.5,
          price: 205.5,
        },
      };
  }
}

// Get alert type from command line or default
const alertType = process.argv[2] || 'price_change_up';
const payload = createAlertPayload(alertType);

// Send webhook
async function sendTestWebhook(): Promise<void> {
  try {
    // Get webhook secret for the team if not provided
    let secret = WEBHOOK_SECRET;
    if (!secret) {
      // eslint-disable-next-line no-console
      console.log(`Looking up webhook secret for team ${TEAM_ID}...`);
      const [installation] = await db
        .select()
        .from(installations)
        .where(eq(installations.teamId, TEAM_ID))
        .limit(1);

      if (!installation) {
        console.error(`No installation found for team ${TEAM_ID}`);
        process.exit(1);
      }

      secret =
        installation.stockalertWebhookSecret || process.env['STOCKALERT_WEBHOOK_SECRET'] || null;
      if (!secret) {
        console.error('No webhook secret found for this team');
        process.exit(1);
      }
      // eslint-disable-next-line no-console
      console.log('Found webhook secret for team');
    }

    // Generate signature with the correct secret
    const payloadString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

    // eslint-disable-next-line no-console
    console.log('\n📨 Sending test webhook');
    // eslint-disable-next-line no-console
    console.log('Alert Type:', alertType);
    // eslint-disable-next-line no-console
    console.log('Webhook URL:', WEBHOOK_URL);
    // eslint-disable-next-line no-console
    console.log('Team ID:', TEAM_ID);
    // eslint-disable-next-line no-console
    console.log('\nPayload:', JSON.stringify(payload, null, 2));
    // eslint-disable-next-line no-console
    console.log('\nSignature:', signature);

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${signature}`, // Match OpenAPI spec format
        'X-StockAlert-Event': 'alert.triggered',
        'X-StockAlert-Timestamp': Date.now().toString(),
      },
      body: payloadString,
    });

    const responseText = await response.text();
    // eslint-disable-next-line no-console
    console.log('\nResponse Status:', response.status);
    // eslint-disable-next-line no-console
    console.log('Response:', responseText);

    if (response.ok) {
      // eslint-disable-next-line no-console
      console.log('\n✅ Webhook sent successfully!');
    } else {
      console.error('\n❌ Webhook failed!');
    }
  } catch (error) {
    console.error('\n❌ Error sending webhook:', error);
  } finally {
    // Close database connection
    process.exit();
  }
}

// Show usage if help is requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: npm run test:webhook [alert-type]

Available alert types:
  - price_above         Price above threshold
  - price_below         Price below threshold
  - price_change_up     Price increased by percentage (GOOGL example)
  - price_change_down   Price decreased by percentage (AMZN example)
  - forward_pe_below    Forward P/E below threshold (tests ratio formatting)
  - pe_ratio_above      P/E ratio above threshold
  - rsi_limit          RSI limit reached
  - ma_crossover_golden Golden cross signal
  - new_high           52-week high (NVDA example)
  - new_low            52-week low (META example)
  - volume_change      Volume spike

Example:
  npm run test:webhook forward_pe_below
  npm run test:webhook price_change_up
  npm run test:webhook new_high
`);
  process.exit(0);
}

// Run the test
sendTestWebhook();
